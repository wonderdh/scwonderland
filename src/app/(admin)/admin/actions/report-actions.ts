"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type {
  ReportCard,
  ReportCardListItem,
  UntranslatedReport,
  ClassReportSummary,
} from "@/lib/types";
import { verifyAdmin } from "./auth-helpers";
import { getUserRoles } from "@/lib/auth/user-roles";
import { getStudentRecordByProfileId, getStudentsByIds, getTeacherRecordByProfileId } from "@/lib/server/domain-helpers";
import { translateText } from "@/lib/server/translate";
import { logger } from "@/lib/server/logger";

/** 선택한 학생·년·월의 리포트카드 1건 조회 (없으면 null). admin/선생/해당 학생만 조회 가능(RLS). */
export async function getReportCard(
  studentProfileId: string,
  year: number,
  month: number
): Promise<ReportCard | null> {
  const supabase = await createClient();
  const admin = createAdminClient();
  const student = await getStudentRecordByProfileId(admin, studentProfileId);
  if (!student) return null;
  const { data, error } = await supabase
    .from("report_cards")
    .select("id, student_id, year, month, teacher_id, content_en, content_ko, reply_ko, reply_en, created_at, updated_at")
    .eq("student_id", student.id)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();
  if (error) {
    logger.error("[getReportCard]", error.message, { studentProfileId, year, month });
    return null;
  }
  if (!data) return null;

  let author_name: string | null = null;
  if (data.teacher_id) {
    const { data: teacher } = await admin
      .from("teachers")
      .select("name")
      .eq("id", data.teacher_id)
      .maybeSingle();
    author_name = teacher?.name ?? null;
  }

  return { ...data, student_profile_id: student.profile_id, author_name } as ReportCard;
}

/** 해당 학생의 리포트카드 목록 (년·월 내림차순). admin/선생/해당 학생만 조회 가능(RLS). */
export async function listReportCardsByStudent(
  studentProfileId: string
): Promise<ReportCardListItem[]> {
  const supabase = await createClient();
  const admin = createAdminClient();
  const student = await getStudentRecordByProfileId(admin, studentProfileId);
  if (!student) return [];
  const { data, error } = await supabase
    .from("report_cards")
    .select("id, year, month")
    .eq("student_id", student.id)
    .order("year", { ascending: false })
    .order("month", { ascending: false });
  if (error) {
    logger.error("[listReportCardsByStudent]", error.message, { studentProfileId });
    return [];
  }
  return (data ?? []) as ReportCardListItem[];
}

/** 리포트카드 본문 작성/수정. 선생 또는 admin만 가능. teacher_id는 현재 로그인 사용자. */
// @auth-skip: getUser + profiles.role + teachers.teacher_type(native) + 담당반 membership 수동 검증
export async function upsertReportCard(
  studentProfileId: string,
  year: number,
  month: number,
  content: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const admin = createAdminClient();
  const roles = await getUserRoles(admin, user.id);
  const isAdmin = roles.roles.includes("admin");
  const isTeacher = roles.roles.includes("teacher");
  if (!isAdmin && !isTeacher) {
    return { error: "리포트카드 작성 권한이 없습니다." };
  }
  const student = await getStudentRecordByProfileId(admin, studentProfileId);
  if (!student) return { error: "학생 정보를 찾을 수 없습니다." };

  // Teacher 추가 검증: native 타입만 + 담당반 학생만
  let isNativeTeacher = false;
  let teacherName: string | null = null;
  if (isTeacher && !isAdmin) {
    const teacher = await getTeacherRecordByProfileId(admin, user.id);
    if (teacher?.teacher_type !== "native") {
      return { error: "리포트카드 작성 권한이 없습니다." };
    }
    isNativeTeacher = true;
    teacherName = teacher?.name ?? null;
    // 담당반 학생인지 확인
    const { data: classTeachers } = await admin
      .from("class_teachers")
      .select("class_id")
      .eq("teacher_id", teacher.id);
    const classIds = (classTeachers ?? []).map((ct) => ct.class_id);
    if (classIds.length === 0) {
      return { error: "담당 반이 없습니다." };
    }
    const { data: membership } = await admin
      .from("class_students")
      .select("id")
      .eq("student_id", student.id)
      .in("class_id", classIds)
      .maybeSingle();
    if (!membership) {
      return { error: "담당 반 학생에게만 리포트카드를 작성할 수 있습니다." };
    }
  }

  const y = Number(year);
  const m = Number(month);
  if (y < 2000 || y > 2100 || m < 1 || m > 12) {
    return { error: "년도 또는 월이 올바르지 않습니다." };
  }

  const trimmedContent = content.trim() || null;

  // 원어민 교사 저장 시 한국어 자동 번역 (DeepL Free).
  // 저장마다 content_ko를 null로 초기화한 후 번역 시도 — 번역 실패 시에도
  // null이 저장되어 관리자 번역 대기 목록에 자동으로 올라옴 (의도된 동작).
  let content_ko: string | null = null;
  if (isNativeTeacher && trimmedContent) {
    const names = [student.english_name, student.korean_name, teacherName].filter(Boolean) as string[];
    content_ko = await translateText(trimmedContent, "ko", names);
  }

  const { error } = await supabase.from("report_cards").upsert(
    {
      student_id: student.id,
      year: y,
      month: m,
      teacher_id: user.id,
      content_en: trimmedContent,
      content_ko,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id,year,month" }
  );
  if (error) {
    logger.error("[upsertReportCard]", error.message, { studentProfileId, year, month });
    return { error: error.message };
  }
  revalidatePath("/academy/student/reports");
  revalidatePath("/academy/teacher/reports");
  return {};
}

/** 리포트카드 삭제. 작성한 선생(native) 또는 admin만 가능. */
// @auth-skip: getUser + profiles.role + teacher_type(native) + teacher_id === user.id 수동 검증
export async function deleteReportCard(
  reportCardId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const admin = createAdminClient();
  const roles = await getUserRoles(admin, user.id);
  const isAdmin = roles.roles.includes("admin");
  const isTeacher = roles.roles.includes("teacher");
  if (!isAdmin && !isTeacher) {
    return { error: "삭제 권한이 없습니다." };
  }

  if (isTeacher && !isAdmin) {
    const teacher = await getTeacherRecordByProfileId(admin, user.id);
    if (teacher?.teacher_type !== "native") {
      return { error: "삭제 권한이 없습니다." };
    }
    // 본인이 작성한 리포트만 삭제 가능
    const { data: report } = await admin
      .from("report_cards")
      .select("teacher_id")
      .eq("id", reportCardId)
      .single();
    if (!report) return { error: "리포트카드를 찾을 수 없습니다." };
    if (report.teacher_id !== user.id) {
      return { error: "본인이 작성한 리포트카드만 삭제할 수 있습니다." };
    }
  }

  const { error } = await admin
    .from("report_cards")
    .delete()
    .eq("id", reportCardId);
  if (error) {
    logger.error("[deleteReportCard]", error.message, { reportCardId });
    return { error: error.message };
  }
  revalidatePath("/academy/student/reports");
  revalidatePath("/academy/teacher/reports");
  return {};
}

/** 학생이 자신의 리포트카드에 답글만 작성/수정. 본문이 있을 때만 허용.
 *  translateToEnglish=true 시 한국어 답글을 영어로 번역하여 reply_en에 저장. */
// @auth-skip: getUser + row.student_profile_id === user.id 소유권 수동 검증
export async function updateReportCardReply(
  reportCardId: string,
  reply: string,
  translateToEnglish?: boolean
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { data: row } = await supabase
    .from("report_cards")
    .select("id, student_id, content_en")
    .eq("id", reportCardId)
    .single();
  if (!row) return { error: "리포트카드를 찾을 수 없습니다." };
  const admin = createAdminClient();
  const studentRows = await getStudentsByIds(admin, [row.student_id]);
  const student = studentRows.get(row.student_id);
  if (!student || student.profile_id !== user.id) return { error: "본인 리포트카드만 답글을 달 수 있습니다." };
  if (row.content_en == null || row.content_en === "") {
    return { error: "본문이 작성된 후에 답글을 남길 수 있습니다." };
  }

  const trimmedReply = reply.trim() || null;

  // 번역 옵션: 한국어 답글 → 영어 (답글 삭제 시에는 null)
  let reply_en: string | null = null;
  if (trimmedReply && translateToEnglish) {
    const names = [student.english_name, student.korean_name].filter(Boolean) as string[];
    reply_en = await translateText(trimmedReply, "en", names);
  }

  const { error } = await supabase
    .from("report_cards")
    .update({ reply_ko: trimmedReply, reply_en, updated_at: new Date().toISOString() })
    .eq("id", reportCardId)
    .eq("student_id", row.student_id);
  if (error) {
    logger.error("[updateReportCardReply]", error.message, { reportCardId });
    return { error: error.message };
  }
  revalidatePath("/academy/student/reports");
  return {};
}

/** 전체 반의 지정 년/월 리포트카드 작성 현황 요약 (관리자 전용). */
export async function listAllClassesReportStatus(
  year: number,
  month: number
): Promise<ClassReportSummary[]> {
  const auth = await verifyAdmin();
  if ("error" in auth) return [];

  const admin = createAdminClient();
  const [{ data: classes, error: classError }, { data: memberships, error: membershipError }, { data: cards, error: cardError }] = await Promise.all([
    admin.from("classes").select("id, name, group_type").neq("group_type", "afterschool").order("name"),
    admin.from("class_students").select("class_id, student_id"),
    admin.from("report_cards").select("student_id").eq("year", year).eq("month", month),
  ]);
  if (classError || membershipError || cardError) {
    logger.error("[listAllClassesReportStatus]", classError?.message ?? membershipError?.message ?? cardError?.message ?? "unknown");
    return [];
  }

  const writtenStudentIds = new Set((cards ?? []).map((card) => card.student_id as string));
  return (classes ?? []).map((classRow) => {
    const classStudentIds = (memberships ?? [])
      .filter((membership) => membership.class_id === classRow.id)
      .map((membership) => membership.student_id as string);
    const uniqueStudentIds = [...new Set(classStudentIds)];
    const written = uniqueStudentIds.filter((studentId) => writtenStudentIds.has(studentId)).length;
    return {
      classId: classRow.id,
      className: classRow.name,
      total: uniqueStudentIds.length,
      written,
    };
  });
}

/** 번역 현황 조회 — content가 있는 리포트 전체 (번역 대기 + 완료 포함). 관리자 전용. */
export async function listUntranslatedReports(
  year: number,
  month: number
): Promise<UntranslatedReport[]> {
  const auth = await verifyAdmin();
  if ("error" in auth) return [];

  const admin = createAdminClient();

  // 1. 리포트카드 조회 (content_en 있는 것만)
  const { data: cards, error } = await admin
    .from("report_cards")
    .select("id, content_en, content_ko, reply_ko, reply_en, student_id")
    .eq("year", year)
    .eq("month", month)
    .not("content_en", "is", null);

  if (error || !cards || cards.length === 0) {
    if (error) logger.error("[listUntranslatedReports]", error.message);
    return [];
  }

  const studentIds = cards.map((c) => c.student_id);
  const students = await getStudentsByIds(admin, studentIds);

  // 3. 반 이름 조회 (class_students + classes, 방과후 제외)
  const { data: classMemberships } = await admin
    .from("class_students")
    .select("student_id, classes(name, group_type)")
    .in("student_id", studentIds);

  // 4. 코드에서 조인
  const studentMap = new Map(
    [...students.values()].map((s) => [s.id, s.korean_name ?? "—"])
  );

  // 방과후 제외, 학생당 본반은 1개이므로 첫 번째 비방과후 항목만 사용
  const classMap = new Map<string, string>();
  for (const m of classMemberships ?? []) {
    const cls = m.classes as unknown as { name: string; group_type: string } | null;
    if (cls?.group_type !== "afterschool" && !classMap.has(m.student_id)) {
      classMap.set(m.student_id, cls?.name ?? "—");
    }
  }

  return cards.map((card) => ({
    id: card.id,
    student_name: studentMap.get(card.student_id) ?? "—",
    class_name: classMap.get(card.student_id) ?? "—",
    content_en: card.content_en,
    content_ko: card.content_ko,
    reply_ko: card.reply_ko,
    reply_en: card.reply_en,
  }));
}

/** 번역된 JSON을 받아 content_ko / reply_en 일괄 저장. 관리자 전용. */
export async function importTranslations(
  records: { id: string; content_ko?: string; reply_en?: string }[]
): Promise<{ error?: string; count: number }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error, count: 0 };

  if (!Array.isArray(records) || records.length === 0) {
    return { error: "가져올 데이터가 없습니다.", count: 0 };
  }

  const admin = createAdminClient();
  let count = 0;

  await Promise.all(
    records.map(async (rec) => {
      if (!rec.id) return;
      const patch: Record<string, string> = { updated_at: new Date().toISOString() };
      if (rec.content_ko) patch.content_ko = rec.content_ko;
      if (rec.reply_en) patch.reply_en = rec.reply_en;
      if (Object.keys(patch).length === 1) return; // updated_at만이면 skip
      const { error } = await admin
        .from("report_cards")
        .update(patch)
        .eq("id", rec.id);
      if (!error) count++;
    })
  );

  revalidatePath("/admin/reports");
  revalidatePath("/academy/student/reports");
  revalidatePath("/academy/teacher/reports");
  return { count };
}

/** 단건 번역 실행 — content → content_ko 또는 reply → reply_en. 관리자 전용. */
export async function translateReportCard(
  reportCardId: string,
  target: "content" | "reply"
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const admin = createAdminClient();

  const { data: row } = await admin
    .from("report_cards")
    .select("content_en, reply_ko, student_id, teacher_id")
    .eq("id", reportCardId)
    .single();

  if (!row) return { error: "리포트카드를 찾을 수 없습니다." };

  // 학생·교사 이름 조회 (번역 시 이름 보존)
  const [studentRows, teacherRow] = await Promise.all([
    getStudentsByIds(admin, [row.student_id]),
    row.teacher_id
      ? admin.from("teachers").select("name").eq("id", row.teacher_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const studentRow = studentRows.get(row.student_id);
  const studentNames = [
    studentRow?.english_name,
    studentRow?.korean_name,
    teacherRow.data?.name,
  ].filter(Boolean) as string[];

  if (target === "content") {
    if (!row.content_en) return { error: "번역할 본문이 없습니다." };
    const content_ko = await translateText(row.content_en, "ko", studentNames);
    if (!content_ko) return { error: "번역에 실패했습니다. API 키를 확인해 주세요." };
    const { error } = await admin
      .from("report_cards")
      .update({ content_ko, updated_at: new Date().toISOString() })
      .eq("id", reportCardId);
    if (error) return { error: error.message };
  } else {
    if (!row.reply_ko) return { error: "번역할 답글이 없습니다." };
    const reply_en = await translateText(row.reply_ko, "en", studentNames);
    if (!reply_en) return { error: "번역에 실패했습니다. API 키를 확인해 주세요." };
    const { error } = await admin
      .from("report_cards")
      .update({ reply_en, updated_at: new Date().toISOString() })
      .eq("id", reportCardId);
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/reports");
  revalidatePath("/academy/student/reports");
  revalidatePath("/academy/teacher/reports");
  return {};
}
