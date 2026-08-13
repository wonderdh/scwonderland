"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserRoles, hasUserRole } from "@/lib/auth/user-roles";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { aggregateReadingStats, type ClassReadingStats } from "@/lib/raz/stats";
import { getRazBooks } from "@/lib/raz/books.server";
import type { StudentProfile, StudentClassItem, TeacherProfile, TeacherClassWithStudents, ReportCardStatus } from "@/lib/types";

export interface StudentMonthlyStats {
  attendance: { total: number; present: number; absent: number; late: number; rate: number };
  homework: { total: number; completed: number; missed: number; rate: number };
}

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

/**
 * 학생 본인의 월별 출석/숙제 통합 통계.
 * - attendance rate = present / (present + absent + late + early_leave)
 * - homework rate: student_homework_progress 에 날짜 컬럼이 없으므로
 *   status 단순 집계 (completed / (completed + missed + pending)) 로 대체.
 */
export async function getStudentMonthlyStats(
  studentId: string,
  monthKstStart: string
): Promise<StudentMonthlyStats> {
  const empty: StudentMonthlyStats = {
    attendance: { total: 0, present: 0, absent: 0, late: 0, rate: 0 },
    homework: { total: 0, completed: 0, missed: 0, rate: 0 },
  };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return empty;

  const isStudent = await hasUserRole(supabase, user.id, "student");
  if (!isStudent) return empty;

  if (user.id !== studentId) return empty;

  // user-context client 그대로 사용 (admin client 우회 금지). RLS 가 다음 정책으로
  // 학생 본인 row 만 통과시켜 defense-in-depth 확보:
  //   attendance_select:  student_id = auth.uid() OR admin/teacher
  //   shp_select:         admin/teacher OR class_students 경유 본인
  //   class_students_select: 본인 row + 같은 반 + staff (20260601020000_narrow)

  // --- Attendance ---
  // monthKstStart 는 KST 기준 "YYYY-MM-01" 문자열. Date 파싱 시 로컬 타임존에 따라
  // 월이 밀릴 수 있어 (Vercel UTC 외 환경) 문자열 split 으로 직접 계산.
  const start = monthKstStart;
  const [yStr, mStr] = monthKstStart.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const end = `${nextY}-${String(nextM).padStart(2, "0")}-01`;

  const { data: attRows } = await supabase
    .from("attendance")
    .select("status")
    .eq("student_id", studentId)
    .gte("attendance_date", start)
    .lt("attendance_date", end);

  const att = attRows ?? [];
  const present = att.filter((r) => r.status === "present").length;
  const absent = att.filter((r) => r.status === "absent").length;
  const late = att.filter((r) => r.status === "late").length;
  const earlyLeave = att.filter((r) => r.status === "early_leave").length;
  const attDenominator = present + absent + late + earlyLeave;
  const attRate = attDenominator > 0 ? Math.round((present / attDenominator) * 100) : 0;

  // --- Homework (status-based fallback; no date column on student_homework_progress) ---
  // 현재는 누적 집계 (월별이 아님). UI 라벨에서 "(누적)" 으로 표기.
  // 월별 정합성은 향후 student_homework_progress.completed_at 컬럼 추가 후 도입.
  const { data: hwRows } = await supabase
    .from("student_homework_progress")
    .select("status, student_homework_books!inner(class_student_id, class_students!inner(student_id))")
    .eq("student_homework_books.class_students.student_id", studentId);

  const hw = hwRows ?? [];
  const hwCompleted = hw.filter((r) => r.status === "completed").length;
  const hwMissed = hw.filter((r) => r.status === "missed").length;
  const hwTotal = hw.length;
  const hwRate = hwTotal > 0 ? Math.round((hwCompleted / hwTotal) * 100) : 0;

  return {
    attendance: { total: att.length, present, absent, late, rate: attRate },
    homework: { total: hwTotal, completed: hwCompleted, missed: hwMissed, rate: hwRate },
  };
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

  // class_students.id 목록 조회 (student_id → class_student_id 매핑)
  const { data: classStudentRows } = await admin
    .from("class_students")
    .select("id, student_id")
    .in("student_id", studentIds)
    .eq("class_id", classId);
  const studentIdToClassStudentId = new Map(
    (classStudentRows ?? []).map((cs) => [cs.student_id, cs.id])
  );
  const classStudentIds = [...studentIdToClassStudentId.values()];

  // 리포트카드 조회 (report_cards.class_student_id 기반)
  const { data: reports } = await admin
    .from("report_cards")
    .select("id, class_student_id, content_en, reply_ko")
    .in("class_student_id", classStudentIds)
    .eq("year", year)
    .eq("month", month);
  // class_student_id → report 매핑
  const reportByClassStudentId = new Map((reports ?? []).map((r) => [r.class_student_id, r]));

  return studentIds.map((sid) => {
    const s = studentMap.get(sid);
    const csId = studentIdToClassStudentId.get(sid);
    const r = csId ? reportByClassStudentId.get(csId) : undefined;
    return {
      student_profile_id: sid,  // students.id IS the profile_id (shared PK)
      korean_name: s?.korean_name ?? null,
      english_name: s?.english_name ?? null,
      student_number: null,
      has_report: r != null && r.content_en != null && r.content_en.trim() !== "",
      has_reply: r != null && r.reply_ko != null && r.reply_ko.trim() !== "",
      report_id: r?.id ?? null,
    };
  });
}

// --- Raz 리딩 ---

/** 대상 학생의 읽은 book_id 목록. 본인 또는 teacher 만. (읽은 책이 1,000권 넘을 수 있어 페이지네이션) */
export async function getReadBookIds(studentId: string): Promise<number[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  if (user.id !== studentId) {
    const isTeacher = await hasUserRole(supabase, user.id, "teacher");
    if (!isTeacher) return [];
  }
  const rows = await fetchAllRows<{ book_id: number }>((from, to) =>
    supabase.from("raz_read_logs").select("book_id").eq("student_id", studentId).order("book_id").range(from, to),
  );
  return rows.map((r) => r.book_id);
}

/** 읽음 토글. 본인 또는 teacher. user-context client 사용 — RLS 가 이중 방어선. */
export async function toggleRazRead(
  studentId: string,
  bookId: number,
  read: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "인증이 필요합니다." };
  if (user.id !== studentId) {
    const isTeacher = await hasUserRole(supabase, user.id, "teacher");
    if (!isTeacher) return { error: "권한이 없습니다." };
  }

  if (read) {
    // 이미 있으면 무시 (update 정책이 없으므로 DO NOTHING 이어야 함)
    const { error } = await supabase
      .from("raz_read_logs")
      .upsert({ student_id: studentId, book_id: bookId, marked_by: user.id }, { ignoreDuplicates: true });
    if (error) return { error: "저장에 실패했습니다." };
  } else {
    const { error } = await supabase
      .from("raz_read_logs")
      .delete()
      .eq("student_id", studentId)
      .eq("book_id", bookId);
    if (error) return { error: "삭제에 실패했습니다." };
  }

  revalidatePath("/academy/student/reading");
  revalidatePath(`/academy/teacher/reading/${studentId}`);
  revalidatePath(`/admin/reading/${studentId}`);
  return {};
}

/** 교사 본인 담당 반들의 학생별 읽기 통계. (권한은 getTeacherClasses 가 담당) */
export async function getTeacherReadingStats(): Promise<ClassReadingStats[]> {
  const classes = await getTeacherClasses();
  if (!classes.length) return [];

  const classShapes = classes.map((c) => ({
    id: c.id,
    name: c.name,
    students: c.students
      .filter((s) => s.profile_id !== "")
      .map((s) => ({ id: s.profile_id, koreanName: s.korean_name, englishName: s.english_name })),
  }));
  const studentIds = [...new Set(classShapes.flatMap((c) => c.students.map((s) => s.id)))];
  if (!studentIds.length) return classShapes.map((c) => ({ classId: c.id, className: c.name, students: [] }));

  const admin = createAdminClient();
  const logs = await fetchAllRows<{ student_id: string; book_id: number }>((from, to) =>
    admin.from("raz_read_logs").select("student_id, book_id").in("student_id", studentIds).order("student_id").order("book_id").range(from, to),
  );
  const books = await getRazBooks();
  return aggregateReadingStats(classShapes, logs, books);
}

/** 교사 화면 헤더용 학생 이름. teacher 만. */
export async function getStudentNameForStaff(
  studentId: string,
): Promise<{ korean_name: string | null; english_name: string | null } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const isTeacher = await hasUserRole(supabase, user.id, "teacher");
  if (!isTeacher) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("students")
    .select("korean_name, english_name")
    .eq("id", studentId)
    .single();
  return data ?? null;
}

