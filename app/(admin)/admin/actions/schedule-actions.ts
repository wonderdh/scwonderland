"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ClassScheduleWithDetails,
  StudentTimetableRow,
  StudentTimetableCell,
} from "@/lib/types";

const DAY_RANGE = [1, 2, 3, 4, 5];

// ── 그룹별 시간표 그리드 데이터 조회 ──

export type GroupTimetableData = {
  periods: { id: string; name: string; start_time: string; end_time: string }[];
  classes: { id: string; name: string }[];
  /** key: `${classId}_${periodId}_${dayOfWeek}` */
  cells: Record<string, { scheduleId: string; label: string | null; teacherId: string | null; teacherName: string | null; teacherType: "korean" | "native" }>;
  teachers: { id: string; name: string; teacher_type: "korean" | "native" }[];
};

export async function getGroupTimetableGrid(
  groupLabel: string,
): Promise<GroupTimetableData> {
  const supabase = createAdminClient();

  // 1. 해당 그룹의 교시 목록
  const { data: periods } = await supabase
    .from("academy_periods")
    .select("id, name, start_time, end_time")
    .eq("group_label", groupLabel)
    .eq("is_active", true)
    .order("start_time");

  if (!periods?.length) return { periods: [], classes: [], cells: {}, teachers: [] };

  const periodIds = periods.map((p) => p.id);

  // 2. 해당 그룹의 반 목록 (group_label로 직접 조회)
  const { data: classRows } = await supabase
    .from("classes")
    .select("id, name")
    .eq("group_label", groupLabel)
    .order("name");
  const classes = classRows ?? [];

  // 3. 해당 교시에 배정된 수업 시간표 전체
  const { data: schedules } = await supabase
    .from("class_schedules")
    .select("id, class_id, academy_period_id, day_of_week, teacher_profile_id, label")
    .in("academy_period_id", periodIds);

  // 4. 관련 교사 목록
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

  // 5. 전체 교사 목록 (추가용)
  const { data: allTeachers } = await supabase
    .from("teachers")
    .select("profile_id, name, teacher_type")
    .order("name");

  // 6. 셀 맵 구성
  const cells: GroupTimetableData["cells"] = {};
  for (const s of schedules ?? []) {
    const teacher = s.teacher_profile_id ? teacherMap.get(s.teacher_profile_id) : null;
    cells[`${s.class_id}_${s.academy_period_id}_${s.day_of_week}`] = {
      scheduleId: s.id,
      label: s.label ?? null,
      teacherId: s.teacher_profile_id ?? null,
      teacherName: teacher?.name ?? null,
      teacherType: (teacher?.teacher_type ?? "korean") as "korean" | "native",
    };
  }

  return {
    periods,
    classes,
    cells,
    teachers: (allTeachers ?? []).map((t) => ({
      id: t.profile_id,
      name: t.name,
      teacher_type: t.teacher_type as "korean" | "native",
    })),
  };
}

// ── 단일 수업 배정 추가 ──

export async function addSingleClassSchedule(
  classId: string,
  academyPeriodId: string,
  dayOfWeek: number,
  teacherProfileId: string | null,
  label: string | null,
): Promise<{ error?: string }> {
  if (!classId || !academyPeriodId) {
    return { error: "반과 교시를 선택해 주세요." };
  }
  if (dayOfWeek < 1 || dayOfWeek > 5) return { error: "요일이 올바르지 않습니다." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("class_schedules").upsert(
    {
      class_id: classId,
      academy_period_id: academyPeriodId,
      day_of_week: dayOfWeek,
      teacher_profile_id: teacherProfileId || null,
      label: label || null,
    },
    { onConflict: "class_id,academy_period_id,day_of_week" },
  );

  if (error) {
    console.error("[addSingleClassSchedule]", error.message);
    return { error: error.message };
  }
  return {};
}

// ── 반별 수업 시간표 조회 ──

export async function listClassSchedules(
  classId: string,
): Promise<ClassScheduleWithDetails[]> {
  const supabase = createAdminClient();

  const { data: schedules, error } = await supabase
    .from("class_schedules")
    .select("id, class_id, academy_period_id, day_of_week, teacher_profile_id, label, textbook_id")
    .eq("class_id", classId);

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
    console.error("[addClassScheduleBatch]", error.message);
    return { error: error.message };
  }
  return {};
}

// ── 수업 배정 삭제 ──

export async function deleteClassSchedule(
  scheduleId: string,
): Promise<{ error?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("class_schedules")
    .delete()
    .eq("id", scheduleId);

  if (error) {
    console.error("[deleteClassSchedule]", error.message);
    return { error: error.message };
  }
  return {};
}

// ── 학생 시간표 조회 (소속 반의 수업 시간표 통합) ──

export async function getStudentTimetable(
  studentProfileId: string,
): Promise<StudentTimetableRow[]> {
  const supabase = createAdminClient();

  // 1. 학생의 소속 반
  const { data: memberships } = await supabase
    .from("class_students")
    .select("class_id")
    .eq("student_profile_id", studentProfileId);

  if (!memberships?.length) return [];

  const classIds = memberships.map((m) => m.class_id);

  // 2. 반 이름
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name")
    .in("id", classIds);
  const classMap = new Map((classes ?? []).map((c) => [c.id, c.name]));

  // 3. 해당 반들의 수업 시간표
  const { data: schedules } = await supabase
    .from("class_schedules")
    .select("id, class_id, academy_period_id, day_of_week, teacher_profile_id, label")
    .in("class_id", classIds);

  if (!schedules?.length) return [];

  // 4. period + teacher 정보
  const periodIds = [...new Set(schedules.map((s) => s.academy_period_id))];
  const teacherIds = [...new Set(schedules.map((s) => s.teacher_profile_id).filter(Boolean))];

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

  // 5. 사용된 period 기준으로 행 구성
  const usedPeriodIds = new Set(schedules.map((s) => s.academy_period_id));
  const relevantPeriods = (periods ?? [])
    .filter((p) => usedPeriodIds.has(p.id))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  return relevantPeriods.map((period) => {
    const cells: Record<number, StudentTimetableCell | null> = {};
    for (let day = 1; day <= 5; day++) {
      const schedule = schedules.find(
        (s) => s.academy_period_id === period.id && s.day_of_week === day,
      );
      if (schedule) {
        const teacher = schedule.teacher_profile_id ? teacherMap.get(schedule.teacher_profile_id) : null;
        cells[day] = {
          class_id: schedule.class_id,
          class_name: classMap.get(schedule.class_id) ?? "",
          label: schedule.label ?? null,
          teacher_name: teacher?.name ?? null,
          teacher_type: (teacher?.teacher_type ?? "korean") as "korean" | "native",
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
