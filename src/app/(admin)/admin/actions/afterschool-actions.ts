"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { verifyAdmin, verifyAuthenticated } from "./auth-helpers";
import { logger } from "@/lib/server/logger";
import type { DayEnrollment, AfterschoolStudentEnrollment } from "@/lib/types";

// ── 방과후 반 조회 or 자동 생성 ──

export async function getOrCreateAfterschoolClass(): Promise<{ id: string; name: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { id: "", name: "" };

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("classes")
    .select("id, name")
    .eq("group_type", "afterschool")
    .limit(1)
    .single();

  if (existing) return { id: existing.id, name: existing.name };

  // 없으면 자동 생성
  const { data: created, error } = await supabase
    .from("classes")
    .insert({ name: "방과후", group_type: "afterschool" })
    .select("id, name")
    .single();

  if (error || !created) return { id: "", name: "" };
  return { id: created.id, name: created.name };
}

// ── 등록 학생 + 요일/교시 정보 ──

export async function getAfterschoolEnrollments(
  classId: string,
): Promise<AfterschoolStudentEnrollment[]> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return [];

  const supabase = createAdminClient();

  const { data: enrollments } = await supabase
    .from("afterschool_enrollments")
    .select("student_id, day_of_week, second_period")
    .eq("class_id", classId);

  // 2교시 여부는 second_period 컬럼(하원 시각 기준)으로 판정.
  const studentDaysMap = new Map<string, DayEnrollment[]>();
  for (const e of enrollments ?? []) {
    const days = studentDaysMap.get(e.student_id) ?? [];
    days.push({ day: e.day_of_week, second_period: e.second_period });
    studentDaysMap.set(e.student_id, days);
  }

  const studentIds = [...studentDaysMap.keys()];
  if (!studentIds.length) return [];

  const [studentRowsResult, classRowsResult] = await Promise.all([
    supabase
      .from("students")
      .select("id, korean_name, english_name, age")
      .in("id", studentIds),
    // 방과후 반 제외한 첫 번째 소속 반 이름
    supabase
      .from("class_students")
      .select("student_id, classes(id, name, group_type)")
      .in("student_id", studentIds)
      .eq("is_active", true)
      .neq("class_id", classId),
  ]);

  // 학생별 반 이름 맵 (방과후 제외)
  const classNameMap = new Map<string, string>();
  for (const row of classRowsResult.data ?? []) {
    const cls = (row.classes as unknown) as { id: string; name: string; group_type: string } | null;
    if (!cls) continue;
    if (cls.group_type === "afterschool") continue;
    if (!classNameMap.has(row.student_id)) {
      classNameMap.set(row.student_id, cls.name);
    }
  }

  const students = (studentRowsResult.data ?? []).map((s) => ({
    student_profile_id: s.id,
    korean_name: s.korean_name ?? null,
    english_name: s.english_name ?? null,
    age: s.age ?? null,
    days: (studentDaysMap.get(s.id) ?? []).sort((a, b) => a.day - b.day),
    class_name: classNameMap.get(s.id) ?? null,
  }));

  students.sort((a, b) => (a.korean_name ?? "").localeCompare(b.korean_name ?? ""));
  return students;
}

// ── 학생 등록 (요일 + 교시 포함) ──

export async function enrollStudent(
  classId: string,
  studentProfileId: string,
  days: number[],
  secondPeriod: boolean,
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  if (!days.length) return { error: "요일을 선택해 주세요." };

  const supabase = createAdminClient();

  // 2교시 여부는 하원 시각으로 판정된 secondPeriod 를 그대로 저장.
  const rows = days.map((d) => ({
    class_id: classId,
    student_id: studentProfileId,
    day_of_week: d,
    second_period: secondPeriod,
  }));

  const { error } = await supabase.from("afterschool_enrollments").insert(rows);
  if (error) {
    logger.error("[enrollStudent]", error.message);
    return { error: error.message };
  }

  // class_students에도 추가 (출석/숙제 호환)
  const { error: csError } = await supabase
    .from("class_students")
    .upsert(
      { class_id: classId, student_id: studentProfileId, is_active: true },
      { onConflict: "class_id,student_id" },
    );
  if (csError && csError.code !== "23505") {
    logger.error("[enrollStudent:class_students]", csError.message);
  }

  revalidatePath("/admin/afterschool");
  return {};
}

// ── 학생 제거 ──

export async function removeAfterschoolStudent(
  classId: string,
  studentProfileId: string,
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();

  const { error: aeError } = await supabase
    .from("afterschool_enrollments")
    .delete()
    .eq("class_id", classId)
    .eq("student_id", studentProfileId);

  if (aeError) {
    logger.error("[removeAfterschoolStudent:enrollments]", aeError.message);
    return { error: aeError.message };
  }

  const { error: csError } = await supabase
    .from("class_students")
    .update({ is_active: false })
    .eq("class_id", classId)
    .eq("student_id", studentProfileId);

  if (csError) {
    logger.error("[removeAfterschoolStudent:class_students]", csError.message);
  }

  revalidatePath("/admin/afterschool");
  return {};
}

// ── 미등록 학생 목록 ──

export async function listAvailableStudents(
  classId: string,
): Promise<{ id: string; korean_name: string | null; english_name: string | null; age: number | null }[]> {
  const auth = await verifyAdmin();
  if ("error" in auth) return [];

  const supabase = createAdminClient();

  const { data: enrolled } = await supabase
    .from("afterschool_enrollments")
    .select("student_id")
    .eq("class_id", classId);

  const enrolledIds = new Set((enrolled ?? []).map((e) => e.student_id));

  const { data: activeProfiles } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "student")
    .is("deleted_at", null);

  const activeIds = (activeProfiles ?? []).map((p) => p.id);
  if (!activeIds.length) return [];

  const { data: students } = await supabase
    .from("students")
    .select("id, korean_name, english_name, age")
    .in("id", activeIds)
    .order("korean_name");

  return (students ?? [])
    .filter((s) => !enrolledIds.has(s.id))
    .map((s) => ({
      id: s.id,
      korean_name: s.korean_name ?? null,
      english_name: s.english_name ?? null,
      age: s.age ?? null,
    }));
}

// ── 학생별 방과후 등록 요일 조회 ──

/** 특정 요일에 방과후에 등록된 학생 id 목록 (= profile_id, Shared PK) */
export async function listAfterschoolStudentIdsByDay(
  day: number,
): Promise<string[]> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return [];

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("afterschool_enrollments")
    .select("student_id")
    .eq("day_of_week", day);
  return [...new Set((data ?? []).map((d) => d.student_id))];
}

export async function getStudentAfterschoolDays(
  studentProfileId: string,
): Promise<number[]> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return [];

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("afterschool_enrollments")
    .select("day_of_week")
    .eq("student_id", studentProfileId);
  return (data ?? []).map((d) => d.day_of_week).sort();
}

/** 학생의 방과후 등록 정보 (요일 + 2교시 여부). academy_period_id 로 1/2교시 판정. */
export async function getStudentAfterschoolDetail(
  studentProfileId: string,
): Promise<{ day_of_week: number; second_period: boolean }[]> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return [];

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("afterschool_enrollments")
    .select("day_of_week, second_period")
    .eq("student_id", studentProfileId);
  return (data ?? [])
    .map((d) => ({
      day_of_week: d.day_of_week,
      second_period: d.second_period,
    }))
    .sort((a, b) => a.day_of_week - b.day_of_week);
}

// ── 특정 요일 등록 삭제 ──

export async function deleteAfterschoolEnrollmentDay(
  studentProfileId: string,
  dayOfWeek: number,
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("afterschool_enrollments")
    .delete()
    .eq("student_id", studentProfileId)
    .eq("day_of_week", dayOfWeek);

  if (error) {
    logger.error("[deleteAfterschoolEnrollmentDay]", error.message);
    return { error: error.message };
  }
  return {};
}

// ── 특정 요일 2교시 여부 업데이트 ──

export async function updateAfterschoolSecondPeriod(
  studentProfileId: string,
  dayOfWeek: number,
  secondPeriod: boolean,
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("afterschool_enrollments")
    .update({ second_period: secondPeriod })
    .eq("student_id", studentProfileId)
    .eq("day_of_week", dayOfWeek);
  if (error) {
    logger.error("[updateAfterschoolSecondPeriod]", error.message);
    return { error: error.message };
  }
  revalidatePath("/admin/afterschool");
  return {};
}

// ── 일괄 요일/교시 저장 ──

export async function bulkUpdateEnrollmentDays(
  classId: string,
  updates: { studentProfileId: string; days: DayEnrollment[] }[],
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();

  const studentIds = updates.map((u) => u.studentProfileId);

  const { error: delError } = await supabase
    .from("afterschool_enrollments")
    .delete()
    .eq("class_id", classId)
    .in("student_id", studentIds);

  if (delError) {
    logger.error("[bulkUpdateEnrollmentDays:delete]", delError.message);
    return { error: delError.message };
  }

  const rows = updates.flatMap((u) =>
    u.days.map((d) => ({
      class_id: classId,
      student_id: u.studentProfileId,
      day_of_week: d.day,
      second_period: d.second_period,
    })),
  );

  if (rows.length > 0) {
    const { error } = await supabase.from("afterschool_enrollments").insert(rows);
    if (error) {
      logger.error("[bulkUpdateEnrollmentDays:insert]", error.message);
      return { error: error.message };
    }
  }

  // 요일이 0개인 학생은 class_students에서도 제거
  for (const u of updates) {
    if (u.days.length === 0) {
      await supabase
        .from("class_students")
        .update({ is_active: false })
        .eq("class_id", classId)
        .eq("student_id", u.studentProfileId);
    }
  }

  revalidatePath("/admin/afterschool");
  return {};
}
