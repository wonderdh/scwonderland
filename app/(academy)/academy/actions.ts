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

// --- 학생 본인 교재 진도 조회 ---

export type StudentTextbookItem = {
  id: string;
  textbook_title: string;
  textbook_series: string | null;
  textbook_level: string | null;
  textbook_category: string;
  total_units: number;
  source_type: "class" | "individual";
  source_class_name: string | null;
  status: "not_started" | "in_progress" | "completed";
  completed_units: number;
};

export async function getCurrentStudentTextbooks(): Promise<StudentTextbookItem[]> {
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

  const { data: progress } = await admin
    .from("student_textbook_progress")
    .select("id, textbook_id, source_type, source_class_id, status, completed_units")
    .eq("student_profile_id", user.id);

  if (!progress?.length) return [];

  // 교재 정보 조인
  const textbookIds = [...new Set(progress.map((p) => p.textbook_id))];
  const { data: textbooks } = await admin
    .from("textbooks")
    .select("id, title, series, level, category, total_units")
    .in("id", textbookIds)
    .eq("is_active", true);
  const textbookMap = new Map((textbooks ?? []).map((t) => [t.id, t]));

  // 반 정보 조인
  const classIds = [...new Set(progress.map((p) => p.source_class_id).filter(Boolean))] as string[];
  let classMap = new Map<string, string>();
  if (classIds.length) {
    const { data: classes } = await admin
      .from("classes")
      .select("id, name")
      .in("id", classIds);
    classMap = new Map((classes ?? []).map((c) => [c.id, c.name]));
  }

  return progress
    .filter((p) => textbookMap.has(p.textbook_id))
    .map((p) => {
      const t = textbookMap.get(p.textbook_id)!;
      return {
        id: p.id,
        textbook_title: t.title,
        textbook_series: t.series ?? null,
        textbook_level: t.level ?? null,
        textbook_category: t.category ?? "general",
        total_units: t.total_units ?? 0,
        source_type: p.source_type as "class" | "individual",
        source_class_name: p.source_class_id ? classMap.get(p.source_class_id) ?? null : null,
        status: p.status as "not_started" | "in_progress" | "completed",
        completed_units: p.completed_units ?? 0,
      };
    });
}
