"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { verifyAdmin } from "./auth-helpers";

// ── 방과후 반 조회 or 자동 생성 ──

export async function getOrCreateAfterschoolClass(): Promise<{ id: string; name: string }> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("classes")
    .select("id, name")
    .eq("group_label", "방과후")
    .limit(1)
    .single();

  if (existing) return { id: existing.id, name: existing.name };

  // 없으면 자동 생성
  const { data: created } = await supabase
    .from("classes")
    .insert({ name: "방과후", group_label: "방과후" })
    .select("id, name")
    .single();

  return { id: created!.id, name: created!.name };
}

// ── 등록 학생 + 요일/교시 정보 ──

export type DayEnrollment = {
  day: number;
  second_period: boolean;
};

export type AfterschoolStudentEnrollment = {
  student_profile_id: string;
  korean_name: string | null;
  english_name: string | null;
  age: number | null;
  days: DayEnrollment[];
};

export async function getAfterschoolEnrollments(
  classId: string,
): Promise<AfterschoolStudentEnrollment[]> {
  const supabase = createAdminClient();

  const { data: enrollments } = await supabase
    .from("afterschool_enrollments")
    .select("student_profile_id, day_of_week, second_period")
    .eq("class_id", classId);

  const studentDaysMap = new Map<string, DayEnrollment[]>();
  for (const e of enrollments ?? []) {
    const days = studentDaysMap.get(e.student_profile_id) ?? [];
    days.push({ day: e.day_of_week, second_period: e.second_period });
    studentDaysMap.set(e.student_profile_id, days);
  }

  const profileIds = [...studentDaysMap.keys()];
  if (!profileIds.length) return [];

  const { data: studentRows } = await supabase
    .from("students")
    .select("profile_id, korean_name, english_name, age")
    .in("profile_id", profileIds);

  const students = (studentRows ?? []).map((s) => ({
    student_profile_id: s.profile_id,
    korean_name: s.korean_name ?? null,
    english_name: s.english_name ?? null,
    age: s.age ?? null,
    days: (studentDaysMap.get(s.profile_id) ?? []).sort((a, b) => a.day - b.day),
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

  const rows = days.map((d) => ({
    class_id: classId,
    student_profile_id: studentProfileId,
    day_of_week: d,
    second_period: secondPeriod,
  }));

  const { error } = await supabase.from("afterschool_enrollments").insert(rows);
  if (error) {
    console.error("[enrollStudent]", error.message);
    return { error: error.message };
  }

  // class_students에도 추가 (출석/숙제 호환)
  const { error: csError } = await supabase
    .from("class_students")
    .upsert(
      { class_id: classId, student_profile_id: studentProfileId },
      { onConflict: "class_id,student_profile_id", ignoreDuplicates: true },
    );
  if (csError && csError.code !== "23505") {
    console.error("[enrollStudent:class_students]", csError.message);
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
    .eq("student_profile_id", studentProfileId);

  if (aeError) {
    console.error("[removeAfterschoolStudent:enrollments]", aeError.message);
    return { error: aeError.message };
  }

  const { error: csError } = await supabase
    .from("class_students")
    .delete()
    .eq("class_id", classId)
    .eq("student_profile_id", studentProfileId);

  if (csError) {
    console.error("[removeAfterschoolStudent:class_students]", csError.message);
  }

  revalidatePath("/admin/afterschool");
  return {};
}

// ── 미등록 학생 목록 ──

export async function listAvailableStudents(
  classId: string,
): Promise<{ id: string; korean_name: string | null; english_name: string | null; age: number | null }[]> {
  const supabase = createAdminClient();

  const { data: enrolled } = await supabase
    .from("afterschool_enrollments")
    .select("student_profile_id")
    .eq("class_id", classId);

  const enrolledIds = new Set((enrolled ?? []).map((e) => e.student_profile_id));

  const { data: activeProfiles } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "student")
    .is("deleted_at", null);

  const activeIds = (activeProfiles ?? []).map((p) => p.id);
  if (!activeIds.length) return [];

  const { data: students } = await supabase
    .from("students")
    .select("profile_id, korean_name, english_name, age")
    .in("profile_id", activeIds)
    .order("korean_name");

  return (students ?? [])
    .filter((s) => !enrolledIds.has(s.profile_id))
    .map((s) => ({
      id: s.profile_id,
      korean_name: s.korean_name ?? null,
      english_name: s.english_name ?? null,
      age: s.age ?? null,
    }));
}

// ── 학생별 방과후 등록 요일 조회 ──

/** 특정 요일에 방과후에 등록된 학생 profile_id 목록 */
export async function listAfterschoolStudentIdsByDay(
  day: number,
): Promise<string[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("afterschool_enrollments")
    .select("student_profile_id")
    .eq("day_of_week", day);
  // 중복 제거
  return [...new Set((data ?? []).map((d) => d.student_profile_id))];
}

export async function getStudentAfterschoolDays(
  studentProfileId: string,
): Promise<number[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("afterschool_enrollments")
    .select("day_of_week")
    .eq("student_profile_id", studentProfileId);
  return (data ?? []).map((d) => d.day_of_week).sort();
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
    .in("student_profile_id", studentIds);

  if (delError) {
    console.error("[bulkUpdateEnrollmentDays:delete]", delError.message);
    return { error: delError.message };
  }

  const rows = updates.flatMap((u) =>
    u.days.map((d) => ({
      class_id: classId,
      student_profile_id: u.studentProfileId,
      day_of_week: d.day,
      second_period: d.second_period,
    })),
  );

  if (rows.length > 0) {
    const { error } = await supabase.from("afterschool_enrollments").insert(rows);
    if (error) {
      console.error("[bulkUpdateEnrollmentDays:insert]", error.message);
      return { error: error.message };
    }
  }

  // 요일이 0개인 학생은 class_students에서도 제거
  for (const u of updates) {
    if (u.days.length === 0) {
      await supabase
        .from("class_students")
        .delete()
        .eq("class_id", classId)
        .eq("student_profile_id", u.studentProfileId);
    }
  }

  revalidatePath("/admin/afterschool");
  return {};
}
