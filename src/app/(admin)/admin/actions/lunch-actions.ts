// @ts-nocheck — lunch_* 테이블이 신 스키마에서 제거되어 type-check 일시 우회.
// 점검 페이지가 떠있어 런타임 호출되지 않음. 도메인 재도입 시 마이그레이션 추가 후 제거.
"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdmin } from "./auth-helpers";
import { logger } from "@/lib/server/logger";
import {
  computeLunchDaySchedule,
  type LunchDaySchedule,
  type LunchGroup,
  type LeaderAnchor,
  type ClassOrderAnchor,
} from "@/lib/lunch/rotation";
import { todayKst } from "@/lib/utils/date-kst";

export type LunchGroupClass = {
  id: string;
  name: string;
  lunch_group: LunchGroup | null;
  student_count: number;
};

/** 유치부 반 전체 + 현재 lunch_group 지정 상태. settings 페이지용. */
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
 * 특정 날짜의 점심지도 일정 계산 (anchor 방식).
 *
 * @auth-skip: read-only 조회. /lunch-monitor (비인증 TV) 와 공유.
 * 민감도: /bus-monitor 와 동일한 학생 이름 수준. Anchor 쓰기 action은
 * 여전히 verifyAdmin 유지.
 */
export async function getLunchSchedule(
  date?: string,
): Promise<{ schedule: LunchDaySchedule | null; needsSetup: boolean }> {
  const targetDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayKst();

  const admin = createAdminClient();

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
    return { schedule: null, needsSetup: true };
  }

  const classIds = classes.map((c) => c.id);

  const [membershipsRes, attendanceRes, leaderAnchorsRes, classOrderAnchorsRes] =
    await Promise.all([
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
        .from("lunch_leader_anchors")
        .select("id, effective_from, class_id, leader_student_id")
        .in("class_id", classIds)
        .lte("effective_from", targetDate),
      admin
        .from("lunch_class_order_anchors")
        .select("id, effective_from, lunch_group, first_class_id")
        .in("lunch_group", ["7세", "6세"])
        .lte("effective_from", targetDate),
    ]);

  const memberships = membershipsRes.data ?? [];
  const absentIds = new Set(
    (attendanceRes.data ?? []).map((a) => a.student_profile_id),
  );
  const leaderAnchors: LeaderAnchor[] = leaderAnchorsRes.data ?? [];
  const classOrderAnchors: ClassOrderAnchor[] = (classOrderAnchorsRes.data ?? []).map(
    (a) => ({
      id: a.id,
      effective_from: a.effective_from,
      lunch_group: a.lunch_group as LunchGroup,
      first_class_id: a.first_class_id,
    }),
  );

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

  const toBuildInput = (cls: {
    id: string;
    name: string;
    lunch_group: string | null;
  }) => ({
    class_id: cls.id,
    class_name: cls.name,
    lunch_group: cls.lunch_group as LunchGroup,
    students: studentsByClass.get(cls.id) ?? [],
    absentIds,
  });

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
    leaderAnchors,
    classOrderAnchors,
  });

  return { schedule, needsSetup: false };
}

/**
 * 리더 anchor 설정 (upsert by date + class).
 * 이 날짜부터 영구 적용 — 이후 날짜는 anchor 기준으로 자동 회전.
 */
export async function setLunchLeaderAnchor(
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
    .from("lunch_leader_anchors")
    .upsert(
      {
        effective_from: date,
        class_id: classId,
        leader_student_id: leaderStudentId,
        created_by: auth.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "effective_from,class_id" },
    );
  if (error) {
    logger.error("[setLunchLeaderAnchor]", error.message, { date, classId });
    return { error: error.message };
  }
  revalidatePath("/admin/lunch");
  revalidatePath("/lunch-monitor");
  return {};
}

/** 해당 날짜의 리더 anchor 삭제 (그 anchor 효력 제거 — 이전 anchor 또는 EPOCH로 복귀). */
export async function clearLunchLeaderAnchor(
  date: string,
  classId: string,
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const admin = createAdminClient();
  const { error } = await admin
    .from("lunch_leader_anchors")
    .delete()
    .eq("effective_from", date)
    .eq("class_id", classId);
  if (error) {
    logger.error("[clearLunchLeaderAnchor]", error.message, { date, classId });
    return { error: error.message };
  }
  revalidatePath("/admin/lunch");
  revalidatePath("/lunch-monitor");
  return {};
}

/**
 * 반 순서 anchor 설정 (upsert by date + lunch_group).
 * 이 날짜부터 영구 적용 — 이후 날짜는 anchor 기준으로 자동 교대.
 */
export async function setLunchClassOrderAnchor(
  date: string,
  lunchGroup: LunchGroup,
  firstClassId: string,
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: "날짜 형식이 올바르지 않습니다." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("lunch_class_order_anchors")
    .upsert(
      {
        effective_from: date,
        lunch_group: lunchGroup,
        first_class_id: firstClassId,
        created_by: auth.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "effective_from,lunch_group" },
    );
  if (error) {
    logger.error("[setLunchClassOrderAnchor]", error.message, { date, lunchGroup });
    return { error: error.message };
  }
  revalidatePath("/admin/lunch");
  revalidatePath("/lunch-monitor");
  return {};
}

/** 해당 날짜의 반 순서 anchor 삭제. */
export async function clearLunchClassOrderAnchor(
  date: string,
  lunchGroup: LunchGroup,
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const admin = createAdminClient();
  const { error } = await admin
    .from("lunch_class_order_anchors")
    .delete()
    .eq("effective_from", date)
    .eq("lunch_group", lunchGroup);
  if (error) {
    logger.error("[clearLunchClassOrderAnchor]", error.message, { date, lunchGroup });
    return { error: error.message };
  }
  revalidatePath("/admin/lunch");
  revalidatePath("/lunch-monitor");
  return {};
}
