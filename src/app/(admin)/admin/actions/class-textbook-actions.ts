"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdmin, verifyAuthenticated, verifyTeacherOrAdmin } from "./auth-helpers";
import { logger } from "@/lib/server/logger";
import type { Database } from "@/lib/types/database.generated";

type ClassHomeworkBookRow =
  Database["public"]["Tables"]["class_homework_books"]["Row"];
type StudentHomeworkBookRow =
  Database["public"]["Tables"]["student_homework_books"]["Row"];

export type ClassTextbookWithDetails = ClassHomeworkBookRow & {
  title: string;
  series: string | null;
  publisher: string | null;
  cover_image_url: string | null;
  total_units: number;
  // Deprecated: 20260515 마이그레이션에서 컬럼 제거됨. 옛 UI 호환용 optional 유지.
  homework_days?: number[] | null;
  skip_dates?: string[] | null;
  start_unit?: number | null;
};

export type StudentTextbookWithDetails = StudentHomeworkBookRow & {
  // class_students 를 통한 derived 컬럼 — UI 호환용
  student_id?: string | null;
  textbook_id?: string | null;
  // Deprecated (20260516 부터 컬럼 없음, 옛 UI 호환용 optional)
  note?: string | null;
  homework_days?: number[] | null;
  skip_dates?: string[] | null;
  start_unit?: number | null;
  title: string;
  series: string | null;
  publisher: string | null;
  cover_image_url: string | null;
  total_units: number;
};

const REVALIDATE_PATHS = [
  "/admin/classes",
  "/admin/students",
  "/academy/teacher/homework",
  "/academy/student/homework",
] as const;

function revalidateAll() {
  for (const path of REVALIDATE_PATHS) revalidatePath(path);
}

async function assertKoreanTeacherOrAdmin(
  userId: string,
  role: "teacher" | "admin"
): Promise<{ error?: string }> {
  if (role === "admin") return {};
  const supabase = createAdminClient();
  const { data: t } = await supabase
    .from("teachers")
    .select("teacher_type")
    .eq("id", userId)
    .maybeSingle();
  if (t?.teacher_type !== "korean") {
    return { error: "한국인 교사만 부여 가능합니다." };
  }
  return {};
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateStartDate(s: string): { ok: true; value: string } | { ok: false; error: string } {
  if (!ISO_DATE_RE.test(s)) return { ok: false, error: "시작 날짜 형식이 올바르지 않습니다." };
  const [y, m, d] = s.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  if (wd === 0 || wd === 6) {
    return { ok: false, error: "시작 날짜는 평일(월~금)만 가능합니다." };
  }
  return { ok: true, value: s };
}

type DaysPayload = {
  note?: string | null;
  /** 숙제 일정 시작일 (YYYY-MM-DD). null 명시 시 schedule 비활성. */
  startDate?: string | null;
};

// ── 반별 숙제 ──

export async function listClassTextbooks(
  classId: string
): Promise<ClassTextbookWithDetails[]> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("class_homework_books")
    .select(
      "id, class_id, textbook_id, start_date, note, homework_books(title, series, publisher, cover_image_url, total_units)"
    )
    .eq("class_id", classId)
    .order("id", { ascending: true });
  if (error) {
    logger.error("[listClassTextbooks]", error.message);
    return [];
  }
  return (data ?? []).map((row) => {
    const tb = Array.isArray(row.homework_books) ? row.homework_books[0] : row.homework_books;
    return {
      id: row.id,
      class_id: row.class_id,
      textbook_id: row.textbook_id,
      start_date: row.start_date ?? null,
      note: row.note,
      title: tb?.title ?? "",
      series: tb?.series ?? null,
      publisher: tb?.publisher ?? null,
      cover_image_url: tb?.cover_image_url ?? null,
      total_units: tb?.total_units ?? 0,
    };
  });
}

export async function assignClassTextbook(
  formData: FormData
): Promise<{ error?: string; id?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const classId = (formData.get("classId") as string)?.trim();
  const textbookId = (formData.get("textbookId") as string)?.trim();
  const note = (formData.get("note") as string)?.trim() || null;

  if (!classId || !textbookId) return { error: "반과 숙제를 선택해 주세요." };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("class_homework_books")
    .insert({
      class_id: classId,
      textbook_id: textbookId,
      note,
    })
    .select("id")
    .single();
  if (error) {
    logger.error("[assignClassTextbook]", error.message);
    if (error.code === "23505") {
      return { error: "이미 이 반에 부여된 숙제입니다." };
    }
    return { error: error.message };
  }
  revalidateAll();
  return { id: data.id };
}

export async function updateClassTextbookDays(
  id: string,
  payload: DaysPayload
): Promise<{ error?: string }> {
  const auth = await verifyTeacherOrAdmin();
  if ("error" in auth) return { error: auth.error };

  const guard = await assertKoreanTeacherOrAdmin(auth.userId, auth.role);
  if (guard.error) return { error: guard.error };

  const update: Database["public"]["Tables"]["class_homework_books"]["Update"] = {};
  if (payload.note !== undefined) update.note = payload.note ?? null;
  if (payload.startDate !== undefined) {
    if (payload.startDate === null) {
      update.start_date = null;
    } else {
      const v = validateStartDate(payload.startDate);
      if (!v.ok) return { error: v.error };
      update.start_date = v.value;
    }
  }
  if (Object.keys(update).length === 0) return {};

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("class_homework_books")
    .update(update)
    .eq("id", id);
  if (error) {
    logger.error("[updateClassTextbookDays]", error.message);
    return { error: error.message };
  }
  revalidateAll();
  return {};
}

export async function unassignClassTextbook(id: string): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const supabase = createAdminClient();
  const { error } = await supabase.from("class_homework_books").delete().eq("id", id);
  if (error) {
    logger.error("[unassignClassTextbook]", error.message);
    return { error: error.message };
  }
  revalidateAll();
  return {};
}

// ── 개인 학생 숙제 ──

export async function listStudentTextbooks(
  studentId: string
): Promise<StudentTextbookWithDetails[]> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("student_homework_books")
    .select(
      "id, class_student_id, class_homework_book_id, start_date, class_students!inner(student_id), class_homework_books(textbook_id, homework_books(title, series, publisher, cover_image_url, total_units))"
    )
    .eq("class_students.student_id", studentId)
    .order("id", { ascending: true });
  if (error) {
    logger.error("[listStudentTextbooks]", error.message);
    return [];
  }
  return (data ?? []).map((row) => {
    const chb = Array.isArray(row.class_homework_books)
      ? row.class_homework_books[0]
      : row.class_homework_books;
    const tb = chb && chb.homework_books
      ? (Array.isArray(chb.homework_books) ? chb.homework_books[0] : chb.homework_books)
      : null;
    const cs = Array.isArray(row.class_students)
      ? row.class_students[0]
      : row.class_students;
    return {
      id: row.id,
      student_id: cs?.student_id ?? null,
      class_student_id: row.class_student_id,
      class_homework_book_id: row.class_homework_book_id,
      textbook_id: chb?.textbook_id ?? null,
      start_date: row.start_date ?? null,
      note: null,
      title: tb?.title ?? "",
      series: tb?.series ?? null,
      publisher: tb?.publisher ?? null,
      cover_image_url: tb?.cover_image_url ?? null,
      total_units: tb?.total_units ?? 0,
    } as StudentTextbookWithDetails;
  });
}

// 새 스키마: student_homework_books 는 class_homework_books 의 instance.
// 개별 학생 직접 부여 flow 는 trigger 자동 시드로 대체되어 수동 assign 은 비활성.
export async function assignStudentTextbook(
  _formData: FormData
): Promise<{ error?: string; id?: string }> {
  return { error: "개별 부여 flow 재설계 중 — 학생이 반에 속하면 자동 부여됩니다." };
}

export async function updateStudentTextbookDays(
  id: string,
  payload: DaysPayload
): Promise<{ error?: string }> {
  const auth = await verifyTeacherOrAdmin();
  if ("error" in auth) return { error: auth.error };

  const guard = await assertKoreanTeacherOrAdmin(auth.userId, auth.role);
  if (guard.error) return { error: guard.error };

  const update: Database["public"]["Tables"]["student_homework_books"]["Update"] = {};
  if (payload.startDate !== undefined) {
    if (payload.startDate === null) {
      update.start_date = null;
    } else {
      const v = validateStartDate(payload.startDate);
      if (!v.ok) return { error: v.error };
      update.start_date = v.value;
    }
  }
  if (Object.keys(update).length === 0) return {};

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("student_homework_books")
    .update(update)
    .eq("id", id);
  if (error) {
    logger.error("[updateStudentTextbookDays]", error.message);
    return { error: error.message };
  }
  revalidateAll();
  return {};
}

export async function unassignStudentTextbook(id: string): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const supabase = createAdminClient();
  const { error } = await supabase.from("student_homework_books").delete().eq("id", id);
  if (error) {
    logger.error("[unassignStudentTextbook]", error.message);
    return { error: error.message };
  }
  revalidateAll();
  return {};
}

// ── Schedule (deprecated — homework_days/skip_dates 컬럼 제거됨)
// 호출부 호환을 위해 빈 배열 반환. 재설계 후 별도 PR 로 복구 예정.

import type { StudentDayUnits } from "@/lib/utils/homework-schedule";

export async function listStudentScheduleByMonth(
  _studentId: string,
  _year: number,
  _month: number
): Promise<StudentDayUnits[]> {
  return [];
}
