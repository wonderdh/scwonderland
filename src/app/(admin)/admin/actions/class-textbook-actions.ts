"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdmin, verifyAuthenticated, verifyTeacherOrAdmin } from "./auth-helpers";
import { logger } from "@/lib/server/logger";
import {
  getStudentMonthSchedule,
  type StudentDayUnits,
} from "@/lib/utils/homework-schedule";
import type { Database } from "@/lib/types/database.generated";

type ClassTextbookRow = Database["public"]["Tables"]["class_textbooks"]["Row"];
type StudentTextbookRow = Database["public"]["Tables"]["student_textbooks"]["Row"];

export type ClassTextbookWithDetails = ClassTextbookRow & {
  title: string;
  series: string | null;
  publisher: string | null;
  cover_image_url: string | null;
  total_units: number;
};
// skip_dates 는 ClassTextbookRow 에 이미 포함됨 (string[] / date[] -> string[]).

export type StudentTextbookWithDetails = StudentTextbookRow & {
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
  for (const path of REVALIDATE_PATHS) {
    revalidatePath(path);
  }
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

function parseHomeworkDays(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n >= 0 && n <= 6);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validateSkipDates(dates: string[]): { ok: true; value: string[] } | { ok: false; error: string } {
  const cleaned: string[] = [];
  for (const d of dates) {
    const trimmed = d.trim();
    if (!ISO_DATE.test(trimmed)) {
      return { ok: false, error: `날짜 형식이 올바르지 않습니다: ${d}` };
    }
    if (!cleaned.includes(trimmed)) cleaned.push(trimmed);
  }
  cleaned.sort();
  return { ok: true, value: cleaned };
}

type DaysPayload = {
  homeworkDays?: number[];
  skipDates?: string[];
  note?: string | null;
  /** 숙제 일정 시작일 (YYYY-MM-DD). null 명시 시 schedule 비활성. */
  startDate?: string | null;
  /** 시작 unit (≥1). default 1. */
  startUnit?: number;
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateStartDate(s: string): { ok: true; value: string } | { ok: false; error: string } {
  if (!ISO_DATE_RE.test(s)) return { ok: false, error: "시작 날짜 형식이 올바르지 않습니다." };
  // 토(6)/일(0) 거부
  const [y, m, d] = s.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  if (wd === 0 || wd === 6) {
    return { ok: false, error: "시작 날짜는 평일(월~금)만 가능합니다." };
  }
  return { ok: true, value: s };
}

// ── 반별 숙제 ──

export async function listClassTextbooks(
  classId: string
): Promise<ClassTextbookWithDetails[]> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("class_textbooks")
    .select(
      "id, class_id, textbook_id, homework_days, skip_dates, start_date, start_unit, assigned_by, assigned_at, note, textbooks(title, series, publisher, cover_image_url, total_units)"
    )
    .eq("class_id", classId)
    .order("assigned_at", { ascending: true });
  if (error) {
    logger.error("[listClassTextbooks]", error.message);
    return [];
  }
  return (data ?? []).map((row) => {
    const tb = Array.isArray(row.textbooks) ? row.textbooks[0] : row.textbooks;
    return {
      id: row.id,
      class_id: row.class_id,
      textbook_id: row.textbook_id,
      homework_days: row.homework_days,
      skip_dates: row.skip_dates ?? [],
      start_date: row.start_date ?? null,
      start_unit: row.start_unit ?? 1,
      assigned_by: row.assigned_by,
      assigned_at: row.assigned_at,
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
  // 부여 권한: 관리자만. 한국 교사는 요일 수정만 가능 (academy/teacher 에서 updateClassTextbookDays 사용)
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const classId = (formData.get("classId") as string)?.trim();
  const textbookId = (formData.get("textbookId") as string)?.trim();
  // 부여 시 요일은 비어있음. 한국 교사가 academy/teacher 에서 나중에 설정.
  const homeworkDays = parseHomeworkDays(formData.get("homeworkDays") as string);
  const note = (formData.get("note") as string)?.trim() || null;

  if (!classId || !textbookId) return { error: "반과 숙제를 선택해 주세요." };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("class_textbooks")
    .insert({
      class_id: classId,
      textbook_id: textbookId,
      homework_days: homeworkDays,
      assigned_by: auth.userId,
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

  const update: Database["public"]["Tables"]["class_textbooks"]["Update"] = {};
  if (payload.homeworkDays !== undefined) {
    update.homework_days = payload.homeworkDays.filter((n) => n >= 0 && n <= 6);
  }
  if (payload.skipDates !== undefined) {
    const v = validateSkipDates(payload.skipDates);
    if (!v.ok) return { error: v.error };
    update.skip_dates = v.value;
  }
  if (payload.note !== undefined) {
    update.note = payload.note ?? null;
  }
  if (payload.startDate !== undefined) {
    if (payload.startDate === null) {
      update.start_date = null;
    } else {
      const v = validateStartDate(payload.startDate);
      if (!v.ok) return { error: v.error };
      update.start_date = v.value;
    }
  }
  if (payload.startUnit !== undefined) {
    if (payload.startUnit < 1) return { error: "시작 unit 은 1 이상이어야 합니다." };
    update.start_unit = payload.startUnit;
  }
  if (Object.keys(update).length === 0) return {};

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("class_textbooks")
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
  // 제거 권한: 관리자만
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const supabase = createAdminClient();
  const { error } = await supabase.from("class_textbooks").delete().eq("id", id);
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
    .from("student_textbooks")
    .select(
      "id, student_id, textbook_id, homework_days, skip_dates, start_date, start_unit, assigned_by, assigned_at, note, textbooks(title, series, publisher, cover_image_url, total_units)"
    )
    .eq("student_id", studentId)
    .order("assigned_at", { ascending: true });
  if (error) {
    logger.error("[listStudentTextbooks]", error.message);
    return [];
  }
  return (data ?? []).map((row) => {
    const tb = Array.isArray(row.textbooks) ? row.textbooks[0] : row.textbooks;
    return {
      id: row.id,
      student_id: row.student_id,
      textbook_id: row.textbook_id,
      homework_days: row.homework_days,
      skip_dates: row.skip_dates ?? [],
      start_date: row.start_date ?? null,
      start_unit: row.start_unit ?? 1,
      assigned_by: row.assigned_by,
      assigned_at: row.assigned_at,
      note: row.note,
      title: tb?.title ?? "",
      series: tb?.series ?? null,
      publisher: tb?.publisher ?? null,
      cover_image_url: tb?.cover_image_url ?? null,
      total_units: tb?.total_units ?? 0,
    };
  });
}

export async function assignStudentTextbook(
  formData: FormData
): Promise<{ error?: string; id?: string }> {
  // 부여 권한: 관리자만. 한국 교사는 요일 수정만 가능.
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const studentId = (formData.get("studentId") as string)?.trim();
  const textbookId = (formData.get("textbookId") as string)?.trim();
  // 부여 시 요일은 비어있음. 한국 교사가 academy/teacher 에서 나중에 설정.
  const homeworkDays = parseHomeworkDays(formData.get("homeworkDays") as string);
  const note = (formData.get("note") as string)?.trim() || null;

  if (!studentId || !textbookId) return { error: "학생과 숙제를 선택해 주세요." };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("student_textbooks")
    .insert({
      student_id: studentId,
      textbook_id: textbookId,
      homework_days: homeworkDays,
      assigned_by: auth.userId,
      note,
    })
    .select("id")
    .single();
  if (error) {
    logger.error("[assignStudentTextbook]", error.message);
    if (error.code === "23505") {
      return { error: "이미 이 학생에게 부여된 숙제입니다." };
    }
    return { error: error.message };
  }
  revalidateAll();
  return { id: data.id };
}

export async function updateStudentTextbookDays(
  id: string,
  payload: DaysPayload
): Promise<{ error?: string }> {
  const auth = await verifyTeacherOrAdmin();
  if ("error" in auth) return { error: auth.error };

  const guard = await assertKoreanTeacherOrAdmin(auth.userId, auth.role);
  if (guard.error) return { error: guard.error };

  const update: Database["public"]["Tables"]["student_textbooks"]["Update"] = {};
  if (payload.homeworkDays !== undefined) {
    update.homework_days = payload.homeworkDays.filter((n) => n >= 0 && n <= 6);
  }
  if (payload.skipDates !== undefined) {
    const v = validateSkipDates(payload.skipDates);
    if (!v.ok) return { error: v.error };
    update.skip_dates = v.value;
  }
  if (payload.note !== undefined) {
    update.note = payload.note ?? null;
  }
  if (payload.startDate !== undefined) {
    if (payload.startDate === null) {
      update.start_date = null;
    } else {
      const v = validateStartDate(payload.startDate);
      if (!v.ok) return { error: v.error };
      update.start_date = v.value;
    }
  }
  if (payload.startUnit !== undefined) {
    if (payload.startUnit < 1) return { error: "시작 unit 은 1 이상이어야 합니다." };
    update.start_unit = payload.startUnit;
  }
  if (Object.keys(update).length === 0) return {};

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("student_textbooks")
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
  // 제거 권한: 관리자만
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const supabase = createAdminClient();
  const { error } = await supabase.from("student_textbooks").delete().eq("id", id);
  if (error) {
    logger.error("[unassignStudentTextbook]", error.message);
    return { error: error.message };
  }
  revalidateAll();
  return {};
}

// ── Schedule (월별 unit 자동 배정) ──

/**
 * 한 학생의 한 달 unit schedule (반·개인 부여 합집합).
 * UI 캘린더 의 셀 별 unit 번호 표시에 사용.
 */
export async function listStudentScheduleByMonth(
  studentId: string,
  year: number,
  month: number
): Promise<StudentDayUnits[]> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return [];
  const supabase = createAdminClient();

  // 본인 OR staff 만
  if (auth.userId !== studentId) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", auth.userId)
      .maybeSingle();
    if (!prof || !["admin", "teacher"].includes(prof.role ?? "")) return [];
  }

  return getStudentMonthSchedule(supabase, studentId, year, month);
}
