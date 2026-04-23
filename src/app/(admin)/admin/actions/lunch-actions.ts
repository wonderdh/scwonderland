"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdmin } from "./auth-helpers";
import { logger } from "@/lib/server/logger";
import {
  computeLunchDaySchedule,
  type LunchDaySchedule,
  type LunchGroup,
} from "@/lib/lunch/rotation";
import { todayKst } from "@/lib/utils/date-kst";

export type LunchGroupClass = {
  id: string;
  name: string;
  lunch_group: LunchGroup | null;
  student_count: number;
};

/**
 * 점심지도 페이지 settings 용 — 유치부 반 전체 + 현재 lunch_group 지정 상태.
 * lunch_group 설정 UI가 이걸로 렌더.
 */
export async function listLunchGroupClasses(): Promise<LunchGroupClass[]> {
  const auth = await verifyAdmin();
  if ("error" in auth) return [];

  const admin = createAdminClient();
  const { data: classes, error } = await admin
    .from("classes")
    .select("id, name, lunch_group")
    .eq("group_label", "유치부")
    .order("name");
  if (error) {
    logger.error("[listLunchGroupClasses]", error.message);
    return [];
  }

  const classIds = (classes ?? []).map((c) => c.id);
  const { data: memberships } = await admin
    .from("class_students")
    .select("class_id")
    .in("class_id", classIds);

  const countMap = new Map<string, number>();
  for (const m of memberships ?? []) {
    countMap.set(m.class_id, (countMap.get(m.class_id) ?? 0) + 1);
  }

  return (classes ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    lunch_group: (c.lunch_group ?? null) as LunchGroup | null,
    student_count: countMap.get(c.id) ?? 0,
  }));
}

/** 반의 lunch_group 값 설정 (null로 해제 가능). admin 전용. */
export async function setClassLunchGroup(
  classId: string,
  group: LunchGroup | null,
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const admin = createAdminClient();
  const { error } = await admin
    .from("classes")
    .update({ lunch_group: group })
    .eq("id", classId);
  if (error) {
    logger.error("[setClassLunchGroup]", error.message, { classId });
    return { error: error.message };
  }
  revalidatePath("/admin/lunch");
  revalidatePath("/admin/lunch/settings");
  revalidatePath("/lunch-monitor");
  return {};
}

/**
 * 특정 날짜의 점심지도 일정 계산.
 * - classes.lunch_group IN ('7세','6세') 4반 조회 (7세 2·6세 2 조합)
 * - 각 반 학생 목록 + 오늘 attendance(결석·조퇴) + override 조회
 * - rotation.ts 로 결정론 계산 + override 적용
 *
 * 반 수가 부족(7세 또는 6세가 2반 미만)하면 해당 그룹은 빈 배열.
 */
export async function getLunchSchedule(
  date?: string,
): Promise<{ schedule: LunchDaySchedule | null; needsSetup: boolean }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { schedule: null, needsSetup: false };

  const targetDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayKst();

  const admin = createAdminClient();

  // 1) lunch_group 지정된 반 조회
  const { data: classesRaw, error: classesErr } = await admin
    .from("classes")
    .select("id, name, lunch_group")
    .in("lunch_group", ["7세", "6세"])
    .order("name");
  if (classesErr) {
    logger.error("[getLunchSchedule]", classesErr.message);
    return { schedule: null, needsSetup: false };
  }
  const classes = classesRaw ?? [];

  const age7 = classes.filter((c) => c.lunch_group === "7세");
  const age6 = classes.filter((c) => c.lunch_group === "6세");
  if (age7.length !== 2 || age6.length !== 2) {
    // settings 미완료 상태
    return { schedule: null, needsSetup: true };
  }

  const classIds = classes.map((c) => c.id);

  // 2) 학생·attendance·override 병렬 조회
  const [membershipsRes, attendanceRes, overridesRes] = await Promise.all([
    admin
      .from("class_students")
      .select("class_id, student_profile_id")
      .in("class_id", classIds),
    admin
      .from("attendance")
      .select("student_profile_id, status")
      .eq("attendance_date", targetDate)
      .in("status", ["absent", "early_leave"]),
    admin
      .from("lunch_leader_overrides")
      .select("id, class_id, leader_student_id")
      .eq("override_date", targetDate),
  ]);

  const memberships = membershipsRes.data ?? [];
  const absentIds = new Set(
    (attendanceRes.data ?? []).map((a) => a.student_profile_id),
  );
  const overridesByClass = new Map<
    string,
    { id: string; leader_student_id: string }
  >();
  for (const ov of overridesRes.data ?? []) {
    overridesByClass.set(ov.class_id, {
      id: ov.id,
      leader_student_id: ov.leader_student_id,
    });
  }

  // 3) 학생 상세 조회
  const studentProfileIds = [
    ...new Set(memberships.map((m) => m.student_profile_id)),
  ];
  const { data: studentsData } = await admin
    .from("students")
    .select("profile_id, korean_name, english_name, age")
    .in("profile_id", studentProfileIds);

  const studentMap = new Map(
    (studentsData ?? []).map((s) => [s.profile_id, s]),
  );
  const studentsByClass = new Map<string, typeof studentsData>();
  for (const m of memberships) {
    const s = studentMap.get(m.student_profile_id);
    if (!s) continue;
    const arr = studentsByClass.get(m.class_id) ?? [];
    arr.push(s);
    studentsByClass.set(m.class_id, arr);
  }

  // 4) rotation.ts BuildInput 포맷으로 변환
  const toBuildInput = (cls: { id: string; name: string; lunch_group: string | null }) => {
    const override = overridesByClass.get(cls.id);
    return {
      class_id: cls.id,
      class_name: cls.name,
      lunch_group: cls.lunch_group as LunchGroup,
      students: studentsByClass.get(cls.id) ?? [],
      overrideLeaderId: override?.leader_student_id ?? null,
      overrideId: override?.id ?? null,
      absentIds,
    };
  };

  const schedule = computeLunchDaySchedule({
    date: targetDate,
    age7Classes: [toBuildInput(age7[0]), toBuildInput(age7[1])] as [
      ReturnType<typeof toBuildInput>,
      ReturnType<typeof toBuildInput>,
    ],
    age6Classes: [toBuildInput(age6[0]), toBuildInput(age6[1])] as [
      ReturnType<typeof toBuildInput>,
      ReturnType<typeof toBuildInput>,
    ],
  });

  return { schedule, needsSetup: false };
}

/** 특정 날짜·반의 리더를 수동으로 지정 (override upsert). */
export async function setLunchLeaderOverride(
  date: string,
  classId: string,
  leaderStudentId: string,
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: "날짜 형식이 올바르지 않습니다." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("lunch_leader_overrides")
    .upsert(
      {
        override_date: date,
        class_id: classId,
        leader_student_id: leaderStudentId,
        created_by: auth.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "override_date,class_id" },
    );
  if (error) {
    logger.error("[setLunchLeaderOverride]", error.message, { date, classId });
    return { error: error.message };
  }
  revalidatePath("/admin/lunch");
  revalidatePath("/lunch-monitor");
  return {};
}

/** 특정 날짜·반의 리더 override 해제 (자동 로테이션으로 복귀). */
export async function clearLunchLeaderOverride(
  date: string,
  classId: string,
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const admin = createAdminClient();
  const { error } = await admin
    .from("lunch_leader_overrides")
    .delete()
    .eq("override_date", date)
    .eq("class_id", classId);
  if (error) {
    logger.error("[clearLunchLeaderOverride]", error.message, { date, classId });
    return { error: error.message };
  }
  revalidatePath("/admin/lunch");
  revalidatePath("/lunch-monitor");
  return {};
}
