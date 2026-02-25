"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { StudentProfile, StudentClassItem, TeacherProfile, TeacherClassWithStudents, ReportCardStatus, TeacherClassTextbook, StudentTextbookItem } from "@/lib/types";

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

// --- 교사 포털 ---

export async function getCurrentTeacherProfile(): Promise<TeacherProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, first_name")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "teacher") return null;

  const admin = createAdminClient();
  const { data: teacher } = await admin
    .from("teachers")
    .select("profile_id, name, teacher_number")
    .eq("profile_id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email ?? "",
    name: teacher?.name ?? profile?.first_name ?? null,
    teacher_number: teacher?.teacher_number ?? null,
  };
}

/** 교사 본인의 담당 반 + 각 반 학생 목록 */
export async function getTeacherClasses(): Promise<TeacherClassWithStudents[]> {
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
  if (profile?.role !== "teacher") return [];

  const admin = createAdminClient();
  const { data: classes } = await admin
    .from("classes")
    .select("id, name")
    .eq("teacher_profile_id", user.id)
    .order("name");
  if (!classes?.length) return [];

  const classIds = classes.map((c) => c.id);
  const { data: members } = await admin
    .from("class_students")
    .select("class_id, student_profile_id")
    .in("class_id", classIds);

  const studentIds = [...new Set((members ?? []).map((m) => m.student_profile_id))];
  let studentMap = new Map<string, { korean_name: string | null; english_name: string | null; student_number: string | null }>();
  if (studentIds.length) {
    const { data: students } = await admin
      .from("students")
      .select("profile_id, korean_name, english_name, student_number")
      .in("profile_id", studentIds);
    studentMap = new Map((students ?? []).map((s) => [s.profile_id, s]));
  }

  return classes.map((c) => ({
    id: c.id,
    name: c.name,
    students: (members ?? [])
      .filter((m) => m.class_id === c.id)
      .map((m) => {
        const s = studentMap.get(m.student_profile_id);
        return {
          profile_id: m.student_profile_id,
          korean_name: s?.korean_name ?? null,
          english_name: s?.english_name ?? null,
          student_number: s?.student_number ?? null,
        };
      }),
  }));
}

/** 특정 반의 지정 년/월 리포트카드 작성 현황 */
export async function getClassReportStatus(
  classId: string,
  year: number,
  month: number
): Promise<ReportCardStatus[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const admin = createAdminClient();

  // 반 학생 목록
  const { data: members } = await admin
    .from("class_students")
    .select("student_profile_id")
    .eq("class_id", classId);
  if (!members?.length) return [];

  const studentIds = members.map((m) => m.student_profile_id);

  // 학생 정보
  const { data: students } = await admin
    .from("students")
    .select("profile_id, korean_name, english_name, student_number")
    .in("profile_id", studentIds);
  const studentMap = new Map((students ?? []).map((s) => [s.profile_id, s]));

  // 리포트카드 조회
  const { data: reports } = await admin
    .from("report_cards")
    .select("id, student_profile_id, content, reply")
    .in("student_profile_id", studentIds)
    .eq("year", year)
    .eq("month", month);
  const reportMap = new Map((reports ?? []).map((r) => [r.student_profile_id, r]));

  return studentIds.map((sid) => {
    const s = studentMap.get(sid);
    const r = reportMap.get(sid);
    return {
      student_profile_id: sid,
      korean_name: s?.korean_name ?? null,
      english_name: s?.english_name ?? null,
      student_number: s?.student_number ?? null,
      has_report: r != null && r.content != null && r.content.trim() !== "",
      has_reply: r != null && r.reply != null && r.reply.trim() !== "",
      report_id: r?.id ?? null,
    };
  });
}

/** 특정 반에 배정된 교재 목록 */
export async function getClassTextbooks(classId: string): Promise<TeacherClassTextbook[]> {
  const admin = createAdminClient();

  const { data: classTextbooks } = await admin
    .from("class_textbooks")
    .select("textbook_id")
    .eq("class_id", classId);
  if (!classTextbooks?.length) return [];

  const textbookIds = classTextbooks.map((ct) => ct.textbook_id);
  const { data: textbooks } = await admin
    .from("textbooks")
    .select("id, title, series, level, category, total_units")
    .in("id", textbookIds)
    .eq("is_active", true);

  return (textbooks ?? []).map((t) => ({
    id: t.id,
    textbook_title: t.title,
    textbook_series: t.series ?? null,
    textbook_level: t.level ?? null,
    textbook_category: t.category ?? "general",
    total_units: t.total_units ?? 0,
  }));
}

// --- 학생 본인 교재 진도 조회 ---

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
