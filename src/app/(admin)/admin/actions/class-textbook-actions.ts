"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdmin, verifyAuthenticated, verifyTeacherOrAdmin } from "./auth-helpers";
import { logger } from "@/lib/server/logger";
import type { Database } from "@/lib/types/database.generated";
import {
  isValidGradingDate,
  GRADING_DATE_ERROR_MESSAGES,
} from "@/lib/utils/homework-schedule";

type ClassHomeworkBookRow =
  Database["public"]["Tables"]["class_homework_books"]["Row"];
type StudentHomeworkBookRow =
  Database["public"]["Tables"]["student_homework_books"]["Row"];

export type ClassTextbookWithDetails = ClassHomeworkBookRow & {
  title: string;
  level: string | null;
  series: string | null;
  publisher: string | null;
  cover_image_url: string | null;
  total_units: number;
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
  level: string | null;
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

/**
 * Strict 검사일 검증 — class_schedules.day_of_week + academy_closed_days + 책별 skip_dates 를
 * 모아 isValidGradingDate(pure) 로 통과 여부 결정. 서버 액션 진입점에서 호출.
 *
 * `meetDays` 가 비어 있으면 (이 반에 등원 요일 미설정) 검사일을 의미있게 검증할 수 없으므로 reject.
 */
async function validateGradingDateForClass(
  supabase: ReturnType<typeof createAdminClient>,
  classId: string,
  startDate: string,
  skipDates: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: scheduleRows, error: scheduleErr } = await supabase
    .from("class_schedules")
    .select("day_of_week")
    .eq("class_id", classId);
  if (scheduleErr) {
    logger.error("[validateGradingDateForClass schedules]", scheduleErr.message);
    return { ok: false, error: "반 수업 요일을 불러오지 못했습니다." };
  }
  const meetDays = Array.from(
    new Set((scheduleRows ?? []).map((r) => r.day_of_week as number))
  ).sort((a, b) => a - b);
  if (meetDays.length === 0) {
    return {
      ok: false,
      error: "이 반의 수업 요일이 설정되어 있지 않아 검사일을 검증할 수 없습니다.",
    };
  }
  const { data: closedRows, error: closedErr } = await supabase
    .from("academy_closed_days")
    .select("closed_date");
  if (closedErr) {
    logger.error("[validateGradingDateForClass closed]", closedErr.message);
    return { ok: false, error: "학원 휴원일을 불러오지 못했습니다." };
  }
  const closedDates = (closedRows ?? []).map((r) => r.closed_date as string);
  const v = isValidGradingDate(startDate, meetDays, closedDates, skipDates);
  if (!v.ok) return { ok: false, error: GRADING_DATE_ERROR_MESSAGES[v.reason] };
  return { ok: true };
}

type DaysPayload = {
  note?: string | null;
  /** 숙제 일정 시작일 (YYYY-MM-DD). null 명시 시 schedule 비활성. */
  startDate?: string | null;
  /** 부여 단위 숙제 요일 (0=일~6=토). undefined 면 변경 안 함. */
  homeworkDays?: number[];
  /** 부여 단위 예외일 (YYYY-MM-DD). undefined 면 변경 안 함. */
  skipDates?: string[];
  /** 시작 unit (1-based). undefined 면 변경 안 함. */
  startUnit?: number;
};

function normalizeHomeworkDays(days: number[]): number[] {
  return Array.from(
    new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))
  ).sort((a, b) => a - b);
}

function normalizeSkipDates(dates: string[]): string[] {
  return Array.from(
    new Set(dates.filter((d) => typeof d === "string" && ISO_DATE_RE.test(d)))
  ).sort();
}

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
      "id, class_id, textbook_id, start_date, note, homework_days, skip_dates, start_unit, homework_books(title, level, publisher, series_rel:series_id(name, total_units, cover_image_url))"
    )
    .eq("class_id", classId)
    .order("id", { ascending: true });
  if (error) {
    logger.error("[listClassTextbooks]", error.message);
    return [];
  }
  return (data ?? []).map((row) => {
    const tb = Array.isArray(row.homework_books) ? row.homework_books[0] : row.homework_books;
    const sr = tb?.series_rel
      ? Array.isArray(tb.series_rel)
        ? tb.series_rel[0]
        : tb.series_rel
      : null;
    return {
      id: row.id,
      class_id: row.class_id,
      textbook_id: row.textbook_id,
      start_date: row.start_date ?? null,
      note: row.note,
      homework_days: (row.homework_days as number[] | null) ?? [],
      skip_dates: (row.skip_dates as string[] | null) ?? [],
      start_unit: row.start_unit ?? 1,
      title: tb?.title ?? "",
      level: tb?.level ?? null,
      series: sr?.name ?? null,
      publisher: tb?.publisher ?? null,
      cover_image_url: sr?.cover_image_url ?? null,
      total_units: sr?.total_units ?? 0,
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
  const startDateRaw = (formData.get("startDate") as string | null)?.trim() || null;
  const homeworkDaysRaw = (formData.get("homeworkDays") as string | null)?.trim() || "";
  const skipDatesRaw = (formData.get("skipDates") as string | null)?.trim() || "";
  const startUnitRaw = (formData.get("startUnit") as string | null)?.trim() || "";

  if (!classId || !textbookId) return { error: "반과 숙제를 선택해 주세요." };

  let startUnit = 1;
  if (startUnitRaw) {
    const parsed = Number.parseInt(startUnitRaw, 10);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return { error: "시작 unit 은 1 이상의 정수여야 합니다." };
    }
    startUnit = parsed;
  }

  let startDate: string | null = null;
  if (startDateRaw) {
    const v = validateStartDate(startDateRaw);
    if (!v.ok) return { error: v.error };
    startDate = v.value;
  }

  let homeworkDays: number[] = [];
  if (homeworkDaysRaw) {
    try {
      const parsed = JSON.parse(homeworkDaysRaw);
      if (!Array.isArray(parsed) || !parsed.every((d) => Number.isInteger(d))) {
        return { error: "요일 형식이 올바르지 않습니다." };
      }
      homeworkDays = normalizeHomeworkDays(parsed as number[]);
    } catch {
      return { error: "요일 형식이 올바르지 않습니다." };
    }
  }

  let skipDates: string[] = [];
  if (skipDatesRaw) {
    try {
      const parsed = JSON.parse(skipDatesRaw);
      if (!Array.isArray(parsed) || !parsed.every((d) => typeof d === "string")) {
        return { error: "예외일 형식이 올바르지 않습니다." };
      }
      skipDates = normalizeSkipDates(parsed as string[]);
    } catch {
      return { error: "예외일 형식이 올바르지 않습니다." };
    }
  }

  const supabase = createAdminClient();

  // Strict 검사일 검증: 반의 등원 요일 ∩ ¬휴원일 ∩ ¬예외일.
  if (startDate) {
    const gv = await validateGradingDateForClass(supabase, classId, startDate, skipDates);
    if (!gv.ok) return { error: gv.error };
  }

  const { data, error } = await supabase
    .from("class_homework_books")
    .insert({
      class_id: classId,
      textbook_id: textbookId,
      note,
      start_date: startDate,
      homework_days: homeworkDays,
      skip_dates: skipDates,
      start_unit: startUnit,
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
  // trigger tg_class_homework_book_seed_students 가 반의 활성 학생 전원을 자동 시드.
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
  if (payload.homeworkDays !== undefined) {
    update.homework_days = normalizeHomeworkDays(payload.homeworkDays);
  }
  if (payload.skipDates !== undefined) {
    update.skip_dates = normalizeSkipDates(payload.skipDates);
  }
  if (payload.startUnit !== undefined) {
    if (!Number.isInteger(payload.startUnit) || payload.startUnit < 1) {
      return { error: "시작 unit 은 1 이상의 정수여야 합니다." };
    }
    update.start_unit = payload.startUnit;
  }
  if (Object.keys(update).length === 0) return {};

  const supabase = createAdminClient();

  // Strict 검사일 검증: startDate 가 새로 들어왔거나 payload 에 명시된 경우에만 수행.
  // skipDates 가 payload 에 없으면 기존 row 값을 사용해서 검증한다.
  if (typeof update.start_date === "string") {
    const { data: chbRow, error: chbErr } = await supabase
      .from("class_homework_books")
      .select("class_id, skip_dates")
      .eq("id", id)
      .maybeSingle();
    if (chbErr || !chbRow) {
      logger.error(
        "[updateClassTextbookDays chb lookup]",
        chbErr?.message ?? "row not found"
      );
      return { error: chbErr?.message ?? "부여 정보를 찾을 수 없습니다." };
    }
    const effectiveSkipDates =
      payload.skipDates !== undefined
        ? normalizeSkipDates(payload.skipDates)
        : ((chbRow.skip_dates as string[] | null) ?? []);
    const gv = await validateGradingDateForClass(
      supabase,
      chbRow.class_id as string,
      update.start_date,
      effectiveSkipDates
    );
    if (!gv.ok) return { error: gv.error };
  }

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
      "id, class_student_id, class_homework_book_id, start_date, class_students!inner(student_id), class_homework_books(textbook_id, homework_books(title, level, publisher, series_rel:series_id(name, total_units, cover_image_url)))"
    )
    .eq("class_students.student_id", studentId)
    .eq("class_students.is_active", true)
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
    const sr = tb?.series_rel
      ? Array.isArray(tb.series_rel)
        ? tb.series_rel[0]
        : tb.series_rel
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
      level: tb?.level ?? null,
      series: sr?.name ?? null,
      publisher: tb?.publisher ?? null,
      cover_image_url: sr?.cover_image_url ?? null,
      total_units: sr?.total_units ?? 0,
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
