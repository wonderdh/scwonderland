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

export async function getGroupTimetableGrid(
  groupLabel: string,
): Promise<GroupTimetableData> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return { periods: [], classes: [], cells: {}, teachers: [], textbooks: [] };

  const supabase = createAdminClient();

  // 1. 해당 그룹의 교시 목록
  const { data: periods } = await supabase
    .from("academy_periods")
    .select("id, name, start_time, end_time")
    .eq("group_label", groupLabel)
    .eq("is_active", true)
    .order("start_time");

  if (!periods?.length) return { periods: [], classes: [], cells: {}, teachers: [], textbooks: [] };

  const periodIds = periods.map((p) => p.id);

  // 2. 해당 그룹의 반 목록 (group_label로 직접 조회)
  const { data: classRows } = await supabase
    .from("classes")
    .select("id, name, english_name")
    .eq("group_label", groupLabel)
    .order("name");
  const classes = (classRows ?? []) as { id: string; name: string; english_name: string | null }[];

  // 3. 해당 교시에 배정된 수업 시간표 전체 (반 배정만, 학생 개인 배정 제외)
  const { data: schedules } = await supabase
    .from("class_schedules")
    .select("id, class_id, academy_period_id, day_of_week, teacher_profile_id, label, textbook_id")
    .in("academy_period_id", periodIds)
    .is("student_profile_id", null);

  // 4+5. 활성 교사 전체 조회 (deleted_at IS NULL 필터 + 정렬) — 단일 쿼리
  const { data: allTeachersData } = await supabase
    .from("teachers")
    .select("profile_id, name, teacher_type, profiles!inner(deleted_at)")
    .is("profiles.deleted_at", null)
    .order("name");

  const teacherMap = new Map(
    (allTeachersData ?? []).map((t) => [
      t.profile_id,
      { name: t.name, teacher_type: t.teacher_type },
    ]),
  );

  // 6. 전체 교재 목록 (배정용)
  const { data: allTextbooks } = await supabase
    .from("textbooks")
    .select("id, title, series")
    .eq("is_active", true)
    .order("title");

  // 7. 셀 맵 구성 (슬롯당 복수 교사 배열)
  const cells: GroupTimetableData["cells"] = {};
  for (const s of schedules ?? []) {
    const teacher = s.teacher_profile_id ? teacherMap.get(s.teacher_profile_id) : null;
    const key = `${s.class_id}_${s.academy_period_id}_${s.day_of_week}`;
    const entry: CellEntry = {
      scheduleId: s.id,
      label: s.label ?? null,
      teacherId: s.teacher_profile_id ?? null,
      teacherName: teacher?.name ?? null,
      teacherType: (teacher?.teacher_type ?? "korean") as "korean" | "native",
      textbookId: s.textbook_id ?? null,
    };
    if (cells[key]) {
      cells[key].push(entry);
    } else {
      cells[key] = [entry];
    }
  }

  return {
    periods,
    classes,
    cells,
    teachers: (allTeachersData ?? []).map((t) => ({
      id: t.profile_id,
      name: t.name,
      teacher_type: t.teacher_type as "korean" | "native",
    })),
    textbooks: (allTextbooks ?? []).map((tb) => ({
      id: tb.id,
      title: tb.title,
      series: tb.series ?? null,
    })),
  };
}

// ── 단일 수업 배정 추가 (반 또는 학생 개인) ──

export async function addSingleClassSchedule(
  classId: string | null,
  academyPeriodId: string,
  dayOfWeek: number,
  teacherProfileId: string | null,
  label: string | null,
  textbookId: string | null = null,
  studentProfileId: string | null = null,
  force: boolean = false,
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  if (!classId && !studentProfileId) {
    return { error: "반 또는 학생을 지정해 주세요." };
  }
  if (!academyPeriodId) {
    return { error: "교시를 선택해 주세요." };
  }
  if (dayOfWeek < 1 || dayOfWeek > 5) return { error: "요일이 올바르지 않습니다." };

  const supabase = createAdminClient();

  // 교사 충돌 검사: 반 배정일 때만 (학생 개인 배정 제외), force=true면 건너뜀
  if (teacherProfileId && classId && !studentProfileId && !force) {
    const { data: conflict } = await supabase
      .from("class_schedules")
      .select("id, class_id")
      .eq("teacher_profile_id", teacherProfileId)
      .eq("academy_period_id", academyPeriodId)
      .eq("day_of_week", dayOfWeek)
      .is("student_profile_id", null)
      .neq("class_id", classId)
      .limit(1)
      .maybeSingle();

    if (conflict) {
      const { data: conflictClass } = await supabase
        .from("classes")
        .select("name")
        .eq("id", conflict.class_id)
        .maybeSingle();
      const className = conflictClass?.name ?? "다른 반";
      return { error: `CONFLICT:${className}` };
    }
  }

  // 기존 행 조회: 반 배정은 teacher_profile_id 도 포함해 조회 (복수 교사 슬롯에서 maybeSingle 오류 방지)
  let query = supabase
    .from("class_schedules")
    .select("id")
    .eq("academy_period_id", academyPeriodId)
    .eq("day_of_week", dayOfWeek);

  if (classId) {
    query = query.eq("class_id", classId).is("student_profile_id", null);
    if (teacherProfileId) query = query.eq("teacher_profile_id", teacherProfileId);
  } else {
    query = query.eq("student_profile_id", studentProfileId!).is("class_id", null);
  }

  const { data: existing } = await query.maybeSingle();

  const payload = {
    class_id: classId || null,
    student_profile_id: studentProfileId || null,
    academy_period_id: academyPeriodId,
    day_of_week: dayOfWeek,
    teacher_profile_id: teacherProfileId || null,
    label: label || null,
    textbook_id: textbookId || null,
  };

  if (existing) {
    const { error } = await supabase
      .from("class_schedules")
      .update({
        teacher_profile_id: payload.teacher_profile_id,
        label: payload.label,
        textbook_id: payload.textbook_id,
      })
      .eq("id", existing.id);
    if (error) {
      logger.error("[addSingleClassSchedule:update]", error.message);
      return { error: error.message };
    }
  } else {
    const { error } = await supabase.from("class_schedules").insert(payload);
    if (error) {
      logger.error("[addSingleClassSchedule:insert]", error.message);
      return { error: error.message };
    }
  }

  logger.info("[addSingleClassSchedule]", existing ? "수업 배정 수정" : "수업 배정 추가", {
    classId,
    studentProfileId,
    academyPeriodId,
    dayOfWeek,
    teacherProfileId,
  });
  revalidatePath("/admin/timetable");
  return {};
}

// ── 반 슬롯 전체 교사 덮어쓰기 (복수 교사 배정, GroupTimetableGrid 전용) ──

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

  // 교사 충돌 검사: force=false 일 때만
  if (!force) {
    const conflictNames: string[] = [];
    for (const a of assignments) {
      if (!a.teacherProfileId) continue;
      const { data: conflict } = await supabase
        .from("class_schedules")
        .select("id, class_id")
        .eq("teacher_profile_id", a.teacherProfileId)
        .eq("academy_period_id", academyPeriodId)
        .eq("day_of_week", dayOfWeek)
        .is("student_profile_id", null)
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

  // 슬롯의 기존 반 배정 전부 삭제
  const { error: delError } = await supabase
    .from("class_schedules")
    .delete()
    .eq("class_id", classId)
    .eq("academy_period_id", academyPeriodId)
    .eq("day_of_week", dayOfWeek)
    .is("student_profile_id", null);

  if (delError) {
    logger.error("[setClassScheduleSlot:delete]", delError.message);
    return { error: delError.message };
  }

  // 새 배정 삽입
  if (assignments.length > 0) {
    const rows = assignments.map((a) => ({
      class_id: classId,
      academy_period_id: academyPeriodId,
      day_of_week: dayOfWeek,
      teacher_profile_id: a.teacherProfileId ?? null,
      label: a.label ?? null,
      textbook_id: a.textbookId ?? null,
      student_profile_id: null,
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

// ── 반별 수업 시간표 조회 ──

export async function listClassSchedules(
  classId: string,
): Promise<ClassScheduleWithDetails[]> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return [];

  const supabase = createAdminClient();

  const { data: schedules, error } = await supabase
    .from("class_schedules")
    .select("id, class_id, academy_period_id, day_of_week, teacher_profile_id, label, textbook_id")
    .eq("class_id", classId)
    .is("student_profile_id", null);

  if (error || !schedules?.length) return [];

  // period 정보
  const periodIds = [...new Set(schedules.map((s) => s.academy_period_id))];
  const { data: periods } = await supabase
    .from("academy_periods")
    .select("id, name, start_time, end_time")
    .in("id", periodIds);
  const periodMap = new Map(
    (periods ?? []).map((p) => [p.id, p]),
  );

  // 교사 정보
  const teacherIds = [...new Set(schedules.map((s) => s.teacher_profile_id).filter(Boolean))];
  let teacherMap = new Map<string, { profile_id: string; name: string; teacher_type: string }>();
  if (teacherIds.length > 0) {
    const { data: teachers } = await supabase
      .from("teachers")
      .select("profile_id, name, teacher_type")
      .in("profile_id", teacherIds);
    teacherMap = new Map(
      (teachers ?? []).map((t) => [t.profile_id, t]),
    );
  }

  return schedules
    .map((s) => {
      const period = periodMap.get(s.academy_period_id);
      const teacher = s.teacher_profile_id ? teacherMap.get(s.teacher_profile_id) : null;
      return {
        id: s.id,
        class_id: s.class_id,
        student_profile_id: null,
        academy_period_id: s.academy_period_id,
        day_of_week: s.day_of_week,
        teacher_profile_id: s.teacher_profile_id,
        label: s.label ?? null,
        textbook_id: s.textbook_id ?? null,
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

// ── 수업 배정 추가 (여러 요일 한꺼번에) ──

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
  if (!classId || !academyPeriodId) {
    return { error: "반과 교시를 선택해 주세요." };
  }
  for (const d of dayOfWeeks) {
    if (!DAY_RANGE.includes(d)) return { error: "요일이 올바르지 않습니다." };
  }

  const supabase = createAdminClient();

  const rows = dayOfWeeks.map((dow) => ({
    class_id: classId,
    academy_period_id: academyPeriodId,
    day_of_week: dow,
    teacher_profile_id: teacherProfileId || null,
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
  logger.info("[deleteClassSchedule]", "수업 배정 삭제", { scheduleId });
  revalidatePath("/admin/timetable");
  return {};
}

// ── 학생 시간표 조회 (소속 반 + 개인 배정 통합) ──

export async function getStudentTimetable(
  studentProfileId: string,
): Promise<StudentTimetableRow[]> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return [];

  const supabase = createAdminClient();

  // 1. 학생의 소속 반
  const { data: memberships } = await supabase
    .from("class_students")
    .select("class_id")
    .eq("student_profile_id", studentProfileId);

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

  // 2.5 방과후 등록 요일 조회
  const { data: afterschoolEnrollments } = await supabase
    .from("afterschool_enrollments")
    .select("class_id, day_of_week")
    .eq("student_profile_id", studentProfileId);

  // 방과후 등록된 class_id 중 일반 반(classIds)에 없는 것만 추가 조회 필요
  const afterschoolClassIds = [...new Set(
    (afterschoolEnrollments ?? [])
      .map((e) => e.class_id)
      .filter((cid) => !classIds.includes(cid)),
  )];

  // 방과후 등록 요일 맵: class_id → Set<day_of_week>
  const afterschoolDayMap = new Map<string, Set<number>>();
  for (const e of afterschoolEnrollments ?? []) {
    const set = afterschoolDayMap.get(e.class_id) ?? new Set();
    set.add(e.day_of_week);
    afterschoolDayMap.set(e.class_id, set);
  }

  // 방과후 반 이름 조회
  if (afterschoolClassIds.length > 0) {
    const { data: asClasses } = await supabase
      .from("classes")
      .select("id, name")
      .in("id", afterschoolClassIds);
    for (const c of asClasses ?? []) {
      classMap.set(c.id, c.name);
    }
  }

  // 3. 반 기반 수업 시간표 + 개인 배정 + 방과후 반 스케줄 병렬 조회
  const allClassIdsForSchedule = [...classIds, ...afterschoolClassIds];
  const [{ data: classSchedules }, { data: individualSchedules }] = await Promise.all([
    allClassIdsForSchedule.length > 0
      ? supabase
          .from("class_schedules")
          .select("id, class_id, academy_period_id, day_of_week, teacher_profile_id, label, textbook_id")
          .in("class_id", allClassIdsForSchedule)
          .is("student_profile_id", null)
      : Promise.resolve({ data: [] as { id: string; class_id: string; academy_period_id: string; day_of_week: number; teacher_profile_id: string | null; label: string | null; textbook_id: string | null }[] }),
    supabase
      .from("class_schedules")
      .select("id, academy_period_id, day_of_week, teacher_profile_id, label, textbook_id")
      .eq("student_profile_id", studentProfileId)
      .is("class_id", null),
  ]);

  // 방과후 스케줄: 등록 요일에 해당하는 것만 필터
  const filteredClassSchedules = (classSchedules ?? []).filter((s) => {
    // 일반 반은 그대로 포함
    if (classIds.includes(s.class_id)) return true;
    // 방과후 반은 등록 요일만 포함
    const days = afterschoolDayMap.get(s.class_id);
    return days?.has(s.day_of_week) ?? false;
  });

  const allSchedules = [...filteredClassSchedules, ...(individualSchedules ?? [])];
  if (allSchedules.length === 0) return [];

  // 4. period + teacher 정보
  const periodIds = [...new Set(allSchedules.map((s) => s.academy_period_id))];
  const teacherIds = [...new Set(allSchedules.map((s) => s.teacher_profile_id).filter(Boolean))];

  const [{ data: periods }, { data: teachers }] = await Promise.all([
    supabase
      .from("academy_periods")
      .select("id, name, start_time, end_time")
      .in("id", periodIds)
      .eq("is_active", true),
    teacherIds.length > 0
      ? supabase
          .from("teachers")
          .select("profile_id, name, teacher_type")
          .in("profile_id", teacherIds)
      : Promise.resolve({ data: [] as { profile_id: string; name: string; teacher_type: string }[] }),
  ]);

  const teacherMap = new Map(
    (teachers ?? []).map((t) => [t.profile_id, t]),
  );

  // 5. 개인 배정 맵 (period_day → schedule) — 개인 우선
  const individualMap = new Map<string, (typeof individualSchedules extends (infer T)[] | null ? T : never)>();
  for (const s of individualSchedules ?? []) {
    individualMap.set(`${s.academy_period_id}_${s.day_of_week}`, s);
  }

  // 6. 사용된 period 기준으로 행 구성
  const usedPeriodIds = new Set(allSchedules.map((s) => s.academy_period_id));
  const relevantPeriods = (periods ?? [])
    .filter((p) => usedPeriodIds.has(p.id))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  return relevantPeriods.map((period) => {
    const cells: Record<number, StudentTimetableCell | null> = {};
    for (let day = 1; day <= 5; day++) {
      const slotKey = `${period.id}_${day}`;
      // 개인 배정 우선
      const individual = individualMap.get(slotKey);
      if (individual) {
        const teacher = individual.teacher_profile_id ? teacherMap.get(individual.teacher_profile_id) : null;
        cells[day] = {
          schedule_id: individual.id,
          class_id: null,
          class_name: null,
          label: individual.label ?? null,
          teacher_profile_id: individual.teacher_profile_id ?? null,
          teacher_name: teacher?.name ?? null,
          teacher_type: (teacher?.teacher_type ?? "korean") as "korean" | "native",
          textbook_id: individual.textbook_id ?? null,
          source: "individual",
        };
        continue;
      }

      const schedule = filteredClassSchedules.find(
        (s) => s.academy_period_id === period.id && s.day_of_week === day,
      );
      if (schedule) {
        const teacher = schedule.teacher_profile_id ? teacherMap.get(schedule.teacher_profile_id) : null;
        cells[day] = {
          schedule_id: schedule.id,
          class_id: schedule.class_id,
          class_name: classMap.get(schedule.class_id) ?? "",
          label: schedule.label ?? null,
          teacher_profile_id: schedule.teacher_profile_id ?? null,
          teacher_name: teacher?.name ?? null,
          teacher_type: (teacher?.teacher_type ?? "korean") as "korean" | "native",
          textbook_id: schedule.textbook_id ?? null,
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

// ── 학생 개인 시간표 편집용 데이터 ──

type StudentTimetableEditData = {
  periods: { id: string; name: string; start_time: string; end_time: string; group_label: string | null }[];
  /** key: `${periodId}_${day}` */
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
  studentProfileId: string,
): Promise<StudentTimetableEditData> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return { periods: [], cells: {}, teachers: [], textbooks: [] };

  const supabase = createAdminClient();

  // 1. 전체 활성 교시
  const { data: periods } = await supabase
    .from("academy_periods")
    .select("id, name, start_time, end_time, group_label")
    .eq("is_active", true)
    .order("start_time");

  // 2. 학생 개인 배정만
  const { data: schedules } = await supabase
    .from("class_schedules")
    .select("id, academy_period_id, day_of_week, teacher_profile_id, label, textbook_id")
    .eq("student_profile_id", studentProfileId)
    .is("class_id", null);

  // 3. 교사 정보
  const teacherIds = [...new Set((schedules ?? []).map((s) => s.teacher_profile_id).filter(Boolean))];
  let teacherRows: { profile_id: string; name: string; teacher_type: string }[] = [];
  if (teacherIds.length > 0) {
    const { data } = await supabase
      .from("teachers")
      .select("profile_id, name, teacher_type")
      .in("profile_id", teacherIds);
    teacherRows = data ?? [];
  }
  const teacherMap = new Map(teacherRows.map((t) => [t.profile_id, t]));

  // 4. 전체 활성 교사 목록
  const { data: activeProfiles } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "teacher")
    .is("deleted_at", null);
  const activeTeacherIds = (activeProfiles ?? []).map((p) => p.id);

  let allTeachersRaw: { profile_id: string; name: string; teacher_type: string }[] = [];
  if (activeTeacherIds.length > 0) {
    const { data } = await supabase
      .from("teachers")
      .select("profile_id, name, teacher_type")
      .in("profile_id", activeTeacherIds)
      .order("name");
    allTeachersRaw = data ?? [];
  }

  // 5. 전체 교재 목록
  const { data: allTextbooks } = await supabase
    .from("textbooks")
    .select("id, title, series")
    .eq("is_active", true)
    .order("title");

  // 6. 셀 맵
  const cells: StudentTimetableEditData["cells"] = {};
  for (const s of schedules ?? []) {
    const teacher = s.teacher_profile_id ? teacherMap.get(s.teacher_profile_id) : null;
    cells[`${s.academy_period_id}_${s.day_of_week}`] = {
      scheduleId: s.id,
      label: s.label ?? null,
      teacherId: s.teacher_profile_id ?? null,
      teacherName: teacher?.name ?? null,
      teacherType: (teacher?.teacher_type ?? "korean") as "korean" | "native",
      textbookId: s.textbook_id ?? null,
    };
  }

  return {
    periods: (periods ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      start_time: p.start_time,
      end_time: p.end_time,
      group_label: p.group_label ?? null,
    })),
    cells,
    teachers: allTeachersRaw.map((t) => ({
      id: t.profile_id,
      name: t.name,
      teacher_type: t.teacher_type as "korean" | "native",
    })),
    textbooks: (allTextbooks ?? []).map((tb) => ({
      id: tb.id,
      title: tb.title,
      series: tb.series ?? null,
    })),
  };
}

// ── 학생 개인 배정 삭제 ──

export async function deleteStudentSchedule(
  scheduleId: string,
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("class_schedules")
    .delete()
    .eq("id", scheduleId)
    .not("student_profile_id", "is", null);

  if (error) {
    logger.error("[deleteStudentSchedule]", error.message);
    return { error: error.message };
  }
  revalidatePath("/admin/timetable");
  return {};
}
