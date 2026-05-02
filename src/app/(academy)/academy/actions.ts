// @ts-nocheck — students/teachers.profile_id + 사라진 도메인 테이블(textbooks 등) 혼재.
// 점검 종료 전 refactor: profile_id → id 전환 + 사라진 도메인 함수 분리.
"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getUserRoles, hasUserRole } from "@/lib/auth/user-roles";
import { createClient } from "@/lib/supabase/server";
import type { StudentProfile, StudentClassItem, TeacherProfile, TeacherClassWithStudents, ReportCardStatus, TeacherClassTextbook, StudentTextbookItem } from "@/lib/types";

/** 로그인한 학생 본인의 프로필(학생 정보). 학생이 아니면 null. */
export async function getCurrentStudentProfile(): Promise<StudentProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const isStudent = await hasUserRole(supabase, user.id, "student");
  if (!isStudent) return null;

  const { data: student } = await supabase
    .from("students")
    .select("id, korean_name, english_name")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email ?? "",
    korean_name: student?.korean_name ?? null,
    english_name: student?.english_name ?? null,
  };
}

/** 로그인한 학생 본인이 소속된 반 목록 (반 이름, 담당 선생들). 학생이 아니면 []. */
export async function getCurrentStudentClasses(): Promise<StudentClassItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const admin = createAdminClient();
  const isStudent = await hasUserRole(admin, user.id, "student");
  if (!isStudent) return [];

  const { data: student } = await admin
    .from("students")
    .select("id")
    .eq("id", user.id)
    .single();
  if (!student) return [];

  const { data: members } = await admin
    .from("class_students")
    .select("class_id")
    .eq("student_id", student.id);
  if (!members?.length) return [];

  const classIds = members.map((m) => m.class_id);
  const { data: classes } = await admin
    .from("classes")
    .select("id, name")
    .in("id", classIds);
  if (!classes?.length) return [];

  // class_teachers 중간 테이블에서 교사 매핑 조회
  const { data: classTeachers } = await admin
    .from("class_teachers")
    .select("class_id, teacher_id")
    .in("class_id", classIds);

  const teacherIds = [
    ...new Set((classTeachers ?? []).map((ct) => ct.teacher_id)),
  ];
  let teacherMap = new Map<string, { name: string | null; teacher_type: string }>();
  if (teacherIds.length > 0) {
    const { data: teachers } = await admin
      .from("teachers")
      .select("id, name, teacher_type")
      .in("id", teacherIds);
    teacherMap = new Map(
      (teachers ?? []).map((teacher) => [
        teacher.id,
        {
          name: teacher.name ?? null,
          teacher_type: teacher.teacher_type ?? "korean",
        },
      ])
    );
  }

  return classes.map((c) => ({
    class_name: c.name,
    teachers: (classTeachers ?? [])
      .filter((ct) => ct.class_id === c.id)
      .map((ct) => {
        const t = teacherMap.get(ct.teacher_id);
        return {
          name: t?.name ?? null,
          teacher_type: (t?.teacher_type ?? "korean") as "korean" | "native",
        };
      }),
  }));
}

// --- 교사 포털 ---

export async function getCurrentTeacherProfile(): Promise<TeacherProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const isTeacher = await hasUserRole(supabase, user.id, "teacher");
  if (!isTeacher) return null;

  const admin = createAdminClient();
  const { data: teacher } = await admin
    .from("teachers")
    .select("id, name, teacher_type")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email ?? "",
    name: teacher?.name ?? null,
    teacher_type: (teacher?.teacher_type ?? "korean") as "korean" | "native",
  };
}

/** 교사 본인의 담당 반 + 각 반 학생 목록 */
export async function getTeacherClasses(): Promise<TeacherClassWithStudents[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const admin = createAdminClient();
  const isTeacher = await hasUserRole(admin, user.id, "teacher");
  if (!isTeacher) return [];

  const { data: teacher } = await admin
    .from("teachers")
    .select("id")
    .eq("id", user.id)
    .single();
  if (!teacher) return [];

  // class_teachers 중간 테이블에서 담당 반 조회
  const { data: classTeacherRows } = await admin
    .from("class_teachers")
    .select("class_id")
    .eq("teacher_id", teacher.id);
  if (!classTeacherRows?.length) return [];

  const classIds = classTeacherRows.map((ct) => ct.class_id);
  const { data: classes } = await admin
    .from("classes")
    .select("id, name")
    .in("id", classIds)
    .order("name");
  if (!classes?.length) return [];

  const { data: members } = await admin
    .from("class_students")
    .select("class_id, student_id")
    .in("class_id", classIds);

  const studentIds = [...new Set((members ?? []).map((m) => m.student_id))];
  let studentMap = new Map<string, { id: string; korean_name: string | null; english_name: string | null }>();
  if (studentIds.length) {
    const { data: students } = await admin
      .from("students")
      .select("id, korean_name, english_name")
      .in("id", studentIds);
    studentMap = new Map((students ?? []).map((studentRow) => [studentRow.id, studentRow]));
  }

  return classes.map((c) => ({
    id: c.id,
    name: c.name,
    students: (members ?? [])
      .filter((m) => m.class_id === c.id)
      .map((m) => {
        const s = studentMap.get(m.student_id);
        return {
          profile_id: s?.id ?? "",  // students.id IS the profile_id (shared PK)
          korean_name: s?.korean_name ?? null,
          english_name: s?.english_name ?? null,
          age: null,
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

  // 권한 확인: admin은 전체, teacher는 담당반만, 그 외 차단
  const { roles } = await getUserRoles(supabase, user.id);

  if (roles.includes("teacher")) {
    const { data: teacher } = await admin
      .from("teachers")
      .select("id")
      .eq("id", user.id)
      .single();
    if (!teacher) return [];

    const { data: assignment } = await admin
      .from("class_teachers")
      .select("class_id")
      .eq("teacher_id", teacher.id)
      .eq("class_id", classId)
      .maybeSingle();
    if (!assignment) return [];
  } else if (!roles.includes("admin")) {
    return [];
  }

  // 반 학생 목록
  const { data: members } = await admin
    .from("class_students")
    .select("student_id")
    .eq("class_id", classId);
  if (!members?.length) return [];

  const studentIds = members.map((m) => m.student_id);

  // 학생 정보 (students.id = profiles.id, shared PK)
  const { data: students } = await admin
    .from("students")
    .select("id, korean_name, english_name")
    .in("id", studentIds);
  const studentMap = new Map((students ?? []).map((studentRow) => [studentRow.id, studentRow]));

  // 리포트카드 조회 (report_cards.student_id = students.id)
  const { data: reports } = await admin
    .from("report_cards")
    .select("id, student_id, content, reply")
    .in("student_id", studentIds)
    .eq("year", year)
    .eq("month", month);
  const reportMap = new Map((reports ?? []).map((r) => [r.student_id, r]));

  return studentIds.map((sid) => {
    const s = studentMap.get(sid);
    const r = reportMap.get(sid);
    return {
      student_profile_id: sid,  // students.id IS the profile_id (shared PK)
      korean_name: s?.korean_name ?? null,
      english_name: s?.english_name ?? null,
      student_number: null,
      has_report: r != null && r.content != null && r.content.trim() !== "",
      has_reply: r != null && r.reply != null && r.reply.trim() !== "",
      report_id: r?.id ?? null,
    };
  });
}

/** 특정 반에 배정된 교재 목록 */
export async function getClassTextbooks(classId: string): Promise<TeacherClassTextbook[]> {
  // 인증 검증
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

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

  const isStudent = await hasUserRole(supabase, user.id, "student");
  if (!isStudent) return [];

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
    .select("id, title, series, level, category, total_units, cover_image")
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
        textbook_cover_image: t.cover_image ?? null,
        total_units: t.total_units ?? 0,
        source_type: p.source_type as "class" | "individual",
        source_class_name: p.source_class_id ? classMap.get(p.source_class_id) ?? null : null,
        status: p.status as "not_started" | "in_progress" | "completed",
        completed_units: p.completed_units ?? 0,
      };
    });
}
