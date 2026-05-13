"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdmin, verifyAuthenticated } from "./auth-helpers";
import { logger } from "@/lib/server/logger";
import type {
  ClassScheduleWithDetails,
  StudentTimetableRow,
  StudentTimetableCell,
  CellEntry,
  GroupTimetableData,
} from "@/lib/types";

const DAY_RANGE = [1, 2, 3, 4, 5];

const GROUP_TYPE_MAP = {
  "유치부": "kindergarten",
  "오후반": "afternoon",
  "방과후": "afterschool",
} as const satisfies Record<string, "kindergarten" | "afternoon" | "afterschool">;

// ── 그룹별 시간표 그리드 ──
export async function getGroupTimetableGrid(
  groupLabel: string,
): Promise<GroupTimetableData> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return { periods: [], classes: [], cells: {}, teachers: [], textbooks: [] };

  const supabase = createAdminClient();
  const groupType = GROUP_TYPE_MAP[groupLabel as keyof typeof GROUP_TYPE_MAP];

  // 1. 해당 그룹의 교시 (group_type 매칭)
  let periodsQuery = supabase
    .from("academy_periods")
    .select("id, name, start_time, end_time")
    .order("start_time");
  periodsQuery = groupType
    ? periodsQuery.eq("group_type", groupType)
    : periodsQuery;

  const { data: periods } = await periodsQuery;
  if (!periods?.length) return { periods: [], classes: [], cells: {}, teachers: [], textbooks: [] };

  const periodIds = periods.map((p) => p.id);

  // 2. 해당 그룹의 반
  let classesQuery = supabase
    .from("classes")
    .select("id, name, days_of_week")
    .order("name");
  classesQuery = groupType
    ? classesQuery.eq("group_type", groupType)
    : classesQuery;
  const { data: classRows } = await classesQuery;
  const classes = (classRows ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    days_of_week: (c.days_of_week as number[] | null) ?? [1, 2, 3, 4, 5],
  }));

  // 3. 수업 시간표 (반 배정. 신 스키마는 학생 개인 배정 컬럼 없음)
  const { data: schedules } = await supabase
    .from("class_schedules")
    .select("id, class_id, academy_period_id, day_of_week, class_teacher_id, label")
    .in("academy_period_id", periodIds);

  // 4. 활성 교사
  const { data: allTeachersData } = await supabase
    .from("teachers")
    .select("id, name, teacher_type, profiles!inner(deleted_at)")
    .is("profiles.deleted_at", null)
    .order("name");

  const teacherMap = new Map(
    (allTeachersData ?? []).map((t) => [
      t.id,
      { name: t.name, teacher_type: t.teacher_type },
    ]),
  );

  // 5. 셀 맵 (textbooks 도메인 제거)
  const cells: GroupTimetableData["cells"] = {};
  for (const s of schedules ?? []) {
    const teacher = s.class_teacher_id ? teacherMap.get(s.class_teacher_id) : null;
    const key = `${s.class_id}_${s.academy_period_id}_${s.day_of_week}`;
    const entry: CellEntry = {
      scheduleId: s.id,
      label: s.label ?? null,
      teacherId: s.class_teacher_id ?? null,
      teacherName: teacher?.name ?? null,
      teacherType: (teacher?.teacher_type ?? "korean") as "korean" | "native",
      textbookId: null,
    };
    if (cells[key]) cells[key].push(entry);
    else cells[key] = [entry];
  }

  return {
    periods,
    classes,
    cells,
    teachers: (allTeachersData ?? []).map((t) => ({
      id: t.id,
      name: t.name ?? "",
      teacher_type: t.teacher_type as "korean" | "native",
    })),
    textbooks: [],
  };
}

// ── 단일 수업 배정 (반 배정만 — 학생 개인 배정은 schema 제거) ──
export async function addSingleClassSchedule(
  classId: string | null,
  academyPeriodId: string,
  dayOfWeek: number,
  teacherProfileId: string | null,
  label: string | null,
  _textbookId: string | null = null,
  studentProfileId: string | null = null,
  force: boolean = false,
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  if (studentProfileId) {
    return { error: "학생 개인 배정 기능은 현재 비활성화되어 있습니다." };
  }
  if (!classId) return { error: "반을 지정해 주세요." };
  if (!academyPeriodId) return { error: "교시를 선택해 주세요." };
  if (dayOfWeek < 1 || dayOfWeek > 5) return { error: "요일이 올바르지 않습니다." };

  const supabase = createAdminClient();

  // 교사 충돌 검사
  if (teacherProfileId && !force) {
    const { data: conflict } = await supabase
      .from("class_schedules")
      .select("id, class_id")
      .eq("class_teacher_id", teacherProfileId)
      .eq("academy_period_id", academyPeriodId)
      .eq("day_of_week", dayOfWeek)
      .neq("class_id", classId)
      .limit(1)
      .maybeSingle();
    if (conflict) {
      const { data: conflictClass } = await supabase
        .from("classes")
        .select("name")
        .eq("id", conflict.class_id)
        .maybeSingle();
      return { error: `CONFLICT:${conflictClass?.name ?? "다른 반"}` };
    }
  }

  // 기존 행 조회 (class_teacher_id 까지 매칭해 복수 교사 슬롯 충돌 방지)
  let query = supabase
    .from("class_schedules")
    .select("id")
    .eq("academy_period_id", academyPeriodId)
    .eq("day_of_week", dayOfWeek)
    .eq("class_id", classId);
  if (teacherProfileId) query = query.eq("class_teacher_id", teacherProfileId);
  const { data: existing } = await query.maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("class_schedules")
      .update({
        class_teacher_id: teacherProfileId || null,
        label: label || null,
      })
      .eq("id", existing.id);
    if (error) {
      logger.error("[addSingleClassSchedule:update]", error.message);
      return { error: error.message };
    }
  } else {
    const { error } = await supabase.from("class_schedules").insert({
      class_id: classId,
      academy_period_id: academyPeriodId,
      day_of_week: dayOfWeek,
      class_teacher_id: teacherProfileId || null,
      label: label || null,
    });
    if (error) {
      logger.error("[addSingleClassSchedule:insert]", error.message);
      return { error: error.message };
    }
  }

  revalidatePath("/admin/timetable");
  return {};
}

// ── 반 슬롯 전체 교사 덮어쓰기 ──
export async function setClassScheduleSlot(
  classId: string,
  academyPeriodId: string,
  dayOfWeek: number,
  assignments: { teacherProfileId: string | null; label: string | null; textbookId: string | null }[],
  force: boolean = false,
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  if (!classId || !academyPeriodId) return { error: "반 또는 교시가 지정되지 않았습니다." };
  if (dayOfWeek < 1 || dayOfWeek > 5) return { error: "요일이 올바르지 않습니다." };

  const supabase = createAdminClient();

  // 교사 충돌 검사
  if (!force) {
    const conflictNames: string[] = [];
    for (const a of assignments) {
      if (!a.teacherProfileId) continue;
      const { data: conflict } = await supabase
        .from("class_schedules")
        .select("id, class_id")
        .eq("class_teacher_id", a.teacherProfileId)
        .eq("academy_period_id", academyPeriodId)
        .eq("day_of_week", dayOfWeek)
        .neq("class_id", classId)
        .limit(1)
        .maybeSingle();
      if (conflict) {
        const { data: cc } = await supabase
          .from("classes")
          .select("name")
          .eq("id", conflict.class_id)
          .maybeSingle();
        const name = cc?.name ?? "다른 반";
        if (!conflictNames.includes(name)) conflictNames.push(name);
      }
    }
    if (conflictNames.length > 0) return { error: `CONFLICT:${conflictNames.join(",")}` };
  }

  // 슬롯 기존 배정 전체 삭제
  const { error: delError } = await supabase
    .from("class_schedules")
    .delete()
    .eq("class_id", classId)
    .eq("academy_period_id", academyPeriodId)
    .eq("day_of_week", dayOfWeek);
  if (delError) {
    logger.error("[setClassScheduleSlot:delete]", delError.message);
    return { error: delError.message };
  }

  if (assignments.length > 0) {
    const rows = assignments.map((a) => ({
      class_id: classId,
      academy_period_id: academyPeriodId,
      day_of_week: dayOfWeek,
      class_teacher_id: a.teacherProfileId ?? null,
      label: a.label ?? null,
    }));
    const { error: insError } = await supabase.from("class_schedules").insert(rows);
    if (insError) {
      logger.error("[setClassScheduleSlot:insert]", insError.message);
      return { error: insError.message };
    }
  }

  revalidatePath("/admin/timetable");
  return {};
}

// ── 반별 수업 시간표 ──
export async function listClassSchedules(
  classId: string,
): Promise<ClassScheduleWithDetails[]> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return [];

  const supabase = createAdminClient();
  const { data: schedules, error } = await supabase
    .from("class_schedules")
    .select("id, class_id, academy_period_id, day_of_week, class_teacher_id, label")
    .eq("class_id", classId);

  if (error || !schedules?.length) return [];

  const periodIds = [...new Set(schedules.map((s) => s.academy_period_id))];
  const { data: periods } = await supabase
    .from("academy_periods")
    .select("id, name, start_time, end_time")
    .in("id", periodIds);
  const periodMap = new Map((periods ?? []).map((p) => [p.id, p]));

  const teacherIds = [...new Set(
    schedules.map((s) => s.class_teacher_id).filter((v): v is string => v !== null),
  )];
  let teacherMap = new Map<string, { id: string; name: string; teacher_type: string }>();
  if (teacherIds.length > 0) {
    const { data: teachers } = await supabase
      .from("teachers")
      .select("id, name, teacher_type")
      .in("id", teacherIds);
    teacherMap = new Map((teachers ?? []).map((t) => [t.id, { id: t.id, name: t.name ?? "", teacher_type: t.teacher_type ?? "korean" }]));
  }

  return schedules
    .map((s) => {
      const period = periodMap.get(s.academy_period_id);
      const teacher = s.class_teacher_id ? teacherMap.get(s.class_teacher_id) : null;
      return {
        id: s.id,
        class_id: s.class_id,
        student_profile_id: null,
        academy_period_id: s.academy_period_id,
        day_of_week: s.day_of_week,
        teacher_profile_id: s.class_teacher_id,
        label: s.label ?? null,
        textbook_id: null,
        period_name: period?.name ?? "",
        period_start_time: period?.start_time ?? "",
        period_end_time: period?.end_time ?? "",
        teacher_name: teacher?.name ?? null,
        teacher_type: (teacher?.teacher_type ?? "korean") as "korean" | "native",
      };
    })
    .sort((a, b) => {
      if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
      return a.period_start_time.localeCompare(b.period_start_time);
    });
}

// ── 여러 요일 일괄 추가 ──
export async function addClassScheduleBatch(
  classId: string,
  academyPeriodId: string,
  dayOfWeeks: number[],
  teacherProfileId: string | null,
  label: string | null,
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  if (dayOfWeeks.length === 0) return { error: "요일을 하나 이상 선택해 주세요." };
  if (!classId || !academyPeriodId) return { error: "반과 교시를 선택해 주세요." };
  for (const d of dayOfWeeks) {
    if (!DAY_RANGE.includes(d)) return { error: "요일이 올바르지 않습니다." };
  }

  const supabase = createAdminClient();
  const rows = dayOfWeeks.map((dow) => ({
    class_id: classId,
    academy_period_id: academyPeriodId,
    day_of_week: dow,
    class_teacher_id: teacherProfileId || null,
    label: label || null,
  }));

  const { error } = await supabase.from("class_schedules").insert(rows);
  if (error) {
    if (error.code === "23505") {
      return { error: "선택한 요일 중 이미 배정된 교시가 있습니다." };
    }
    logger.error("[addClassScheduleBatch]", error.message);
    return { error: error.message };
  }
  revalidatePath("/admin/timetable");
  return {};
}

// ── 수업 배정 삭제 ──
export async function deleteClassSchedule(
  scheduleId: string,
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("class_schedules")
    .delete()
    .eq("id", scheduleId);
  if (error) {
    logger.error("[deleteClassSchedule]", error.message);
    return { error: error.message };
  }
  revalidatePath("/admin/timetable");
  return {};
}

// ── 학생 시간표 (소속 반 기반. 신 스키마는 학생 개인 배정 폐지) ──
export async function getStudentTimetable(
  studentProfileId: string,
): Promise<StudentTimetableRow[]> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return [];

  const supabase = createAdminClient();

  // 1. 학생 소속 반
  const { data: memberships } = await supabase
    .from("class_students")
    .select("class_id")
    .eq("student_id", studentProfileId);
  const classIds = (memberships ?? []).map((m) => m.class_id);

  // 2. 반 이름
  let classMap = new Map<string, string>();
  if (classIds.length > 0) {
    const { data: classes } = await supabase
      .from("classes")
      .select("id, name")
      .in("id", classIds);
    classMap = new Map((classes ?? []).map((c) => [c.id, c.name]));
  }

  // 3. 방과후 등록 요일
  const { data: afterschoolEnrollments } = await supabase
    .from("afterschool_enrollments")
    .select("class_id, day_of_week")
    .eq("student_id", studentProfileId);

  const afterschoolClassIds = [...new Set(
    (afterschoolEnrollments ?? [])
      .map((e) => e.class_id)
      .filter((cid) => !classIds.includes(cid)),
  )];

  const afterschoolDayMap = new Map<string, Set<number>>();
  for (const e of afterschoolEnrollments ?? []) {
    const set = afterschoolDayMap.get(e.class_id) ?? new Set();
    set.add(e.day_of_week);
    afterschoolDayMap.set(e.class_id, set);
  }

  if (afterschoolClassIds.length > 0) {
    const { data: asClasses } = await supabase
      .from("classes")
      .select("id, name")
      .in("id", afterschoolClassIds);
    for (const c of asClasses ?? []) classMap.set(c.id, c.name);
  }

  // 4. 반 기반 수업 시간표 (학생 개인 배정 컬럼 없음)
  const allClassIds = [...classIds, ...afterschoolClassIds];
  if (!allClassIds.length) return [];

  const { data: classSchedules } = await supabase
    .from("class_schedules")
    .select("id, class_id, academy_period_id, day_of_week, class_teacher_id, label")
    .in("class_id", allClassIds);

  const filteredSchedules = (classSchedules ?? []).filter((s) => {
    if (classIds.includes(s.class_id)) return true;
    const days = afterschoolDayMap.get(s.class_id);
    return days?.has(s.day_of_week) ?? false;
  });

  if (!filteredSchedules.length) return [];

  // 5. period + teacher
  const periodIds = [...new Set(filteredSchedules.map((s) => s.academy_period_id))];
  const teacherIds = [...new Set(
    filteredSchedules.map((s) => s.class_teacher_id).filter((v): v is string => v !== null),
  )];

  const [{ data: periods }, { data: teachers }] = await Promise.all([
    supabase
      .from("academy_periods")
      .select("id, name, start_time, end_time")
      .in("id", periodIds),
    teacherIds.length > 0
      ? supabase
          .from("teachers")
          .select("id, name, teacher_type")
          .in("id", teacherIds)
      : Promise.resolve({ data: [] as { id: string; name: string; teacher_type: string }[] }),
  ]);

  const teacherMap = new Map((teachers ?? []).map((t) => [t.id, t]));

  // 6. 행 구성
  const usedPeriodIds = new Set(filteredSchedules.map((s) => s.academy_period_id));
  const relevantPeriods = (periods ?? [])
    .filter((p) => usedPeriodIds.has(p.id))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  return relevantPeriods.map((period) => {
    const cells: Record<number, StudentTimetableCell | null> = {};
    for (let day = 1; day <= 5; day++) {
      const schedule = filteredSchedules.find(
        (s) => s.academy_period_id === period.id && s.day_of_week === day,
      );
      if (schedule) {
        const teacher = schedule.class_teacher_id ? teacherMap.get(schedule.class_teacher_id) : null;
        cells[day] = {
          schedule_id: schedule.id,
          class_id: schedule.class_id,
          class_name: classMap.get(schedule.class_id) ?? "",
          label: schedule.label ?? null,
          teacher_profile_id: schedule.class_teacher_id ?? null,
          teacher_name: teacher?.name ?? null,
          teacher_type: (teacher?.teacher_type ?? "korean") as "korean" | "native",
          textbook_id: null,
          source: "class",
        };
      } else {
        cells[day] = null;
      }
    }
    return {
      academy_period_id: period.id,
      period_name: period.name,
      start_time: period.start_time,
      end_time: period.end_time,
      cells,
    };
  });
}

// ── 학생 개인 배정 편집 데이터 (신 스키마에서 폐지) ──
type StudentTimetableEditData = {
  periods: { id: string; name: string; start_time: string; end_time: string }[];
  cells: Record<string, {
    scheduleId: string;
    label: string | null;
    teacherId: string | null;
    teacherName: string | null;
    teacherType: "korean" | "native";
    textbookId: string | null;
  }>;
  teachers: { id: string; name: string; teacher_type: "korean" | "native" }[];
  textbooks: { id: string; title: string; series: string | null }[];
};

export async function getStudentTimetableEditable(
  _studentProfileId: string,
): Promise<StudentTimetableEditData> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return { periods: [], cells: {}, teachers: [], textbooks: [] };
  return { periods: [], cells: {}, teachers: [], textbooks: [] };
}

export async function deleteStudentSchedule(
  _scheduleId: string,
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  return { error: "학생 개인 배정 기능은 현재 비활성화되어 있습니다." };
}
