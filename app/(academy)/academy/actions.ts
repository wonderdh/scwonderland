"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type StudentProfile = {
  id: string;
  email: string;
  korean_name: string | null;
  english_name: string | null;
  student_number: string | null;
};

/** 로그인한 학생 본인의 프로필(학생 정보). 학생이 아니면 null. */
export async function getCurrentStudentProfile(): Promise<StudentProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, first_name, last_name")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "student") return null;

  const { data: student } = await supabase
    .from("students")
    .select("profile_id, korean_name, english_name, student_number")
    .eq("profile_id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email ?? "",
    korean_name: student?.korean_name ?? profile?.first_name ?? null,
    english_name: student?.english_name ?? profile?.last_name ?? null,
    student_number: student?.student_number ?? null,
  };
}

export type StudentClassItem = {
  class_name: string;
  teacher_name: string | null;
};

/** 로그인한 학생 본인이 소속된 반 목록 (반 이름, 담당 선생). 학생이 아니면 []. */
export async function getCurrentStudentClasses(): Promise<StudentClassItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "student") return [];

  const admin = createAdminClient();
  const { data: members } = await admin
    .from("class_students")
    .select("class_id")
    .eq("student_profile_id", user.id);
  if (!members?.length) return [];

  const classIds = members.map((m) => m.class_id);
  const { data: classes } = await admin
    .from("classes")
    .select("id, name, teacher_profile_id")
    .in("id", classIds);
  if (!classes?.length) return [];

  const teacherIds = [
    ...new Set(
      (classes as { teacher_profile_id: string | null }[])
        .map((c) => c.teacher_profile_id)
        .filter(Boolean) as string[]
    ),
  ];
  let teacherMap = new Map<string, string>();
  if (teacherIds.length > 0) {
    const { data: teachers } = await admin
      .from("teachers")
      .select("profile_id, name")
      .in("profile_id", teacherIds);
    teacherMap = new Map((teachers ?? []).map((t) => [t.profile_id, t.name ?? ""]));
  }

  return classes.map((c) => ({
    class_name: c.name,
    teacher_name: c.teacher_profile_id
      ? teacherMap.get(c.teacher_profile_id) ?? null
      : null,
  }));
}
