"use server";

/**
 * Unit-level homework progress.
 *
 * Schema (20260518~20260520):
 *   class_homework_books (class × homework_book pair)
 *     └─ student_homework_books (class_student × class_homework_book — auto seeded)
 *          └─ student_homework_progress (unit_number, status — per-unit row)
 *
 * 호출부 식별자 컨벤션:
 *   - studentId  = profiles.id (= students.id)
 *   - textbookId = class_homework_books.id  ← UI 의 tb.id
 */
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAuthenticated, verifyTeacherOrAdmin } from "./auth-helpers";
import { logger } from "@/lib/server/logger";
import { getUnitSchedule } from "@/lib/utils/homework-schedule";

export type UnitStatus = "pending" | "completed" | "missed";

export type StudentTextbookUnits = {
  id: string;
  title: string;
  series_name: string | null;
  level: string | null;
  cover_image_url: string | null;
  total_units: number;
  source: "class" | "student";
  hasSchedule: boolean;
  units: Array<{
    unitNumber: number;
    status: UnitStatus;
    expectedDate: string | null;
    completedAt: string | null;
    note: string | null;
  }>;
};

export type StudentUnitProgressData = {
  textbooks: StudentTextbookUnits[];
  error?: string;
};

export type ClassUnitOverview = {
  students: { id: string; korean_name: string | null; english_name: string | null }[];
  textbooks: {
    id: string;
    title: string;
    series_name: string | null;
    level: string | null;
    total_units: number;
  }[];
  progressMap: Record<string, never[]>;
  error?: string;
};

export type ClassUnitProgressDetailed = {
  students: { id: string; korean_name: string | null; english_name: string | null }[];
  byStudent: Record<string, StudentTextbookUnits[]>;
  /** 반이 만나는 요일 (class_schedules.day_of_week distinct, 1=월~5=금). */
  classDays: number[];
  error?: string;
};

const REVALIDATE_PATHS = [
  "/admin/homework",
  "/m/homework",
  "/academy/teacher/homework",
  "/academy/student/homework",
] as const;

function revalidateAll() {
  for (const path of REVALIDATE_PATHS) revalidatePath(path);
}

function isUnitStatus(s: string): s is UnitStatus {
  return s === "pending" || s === "completed" || s === "missed";
}

// ── Reads ────────────────────────────────────────────────────────────────────

export async function listClassUnitProgressDetailed(
  classId: string
): Promise<ClassUnitProgressDetailed> {
  const auth = await verifyAuthenticated();
  if ("error" in auth)
    return { students: [], byStudent: {}, classDays: [], error: auth.error };

  const supabase = createAdminClient();

  // 0. 반이 만나는 요일 — class_schedules.day_of_week distinct (1=월~5=금)
  const { data: scheduleRows, error: schedErr } = await supabase
    .from("class_schedules")
    .select("day_of_week")
    .eq("class_id", classId);
  if (schedErr) {
    logger.error("[listClassUnitProgressDetailed schedules]", schedErr.message);
  }
  const classDays = Array.from(
    new Set((scheduleRows ?? []).map((r) => r.day_of_week as number))
  ).sort((a, b) => a - b);

  // 1. 활성 학생
  const { data: rosterRows, error: rosterErr } = await supabase
    .from("class_students")
    .select("id, student_id, students!inner(id, korean_name, english_name)")
    .eq("class_id", classId)
    .eq("is_active", true);

  if (rosterErr) {
    logger.error("[listClassUnitProgressDetailed roster]", rosterErr.message);
    return {
      students: [],
      byStudent: {},
      classDays,
      error: rosterErr.message,
    };
  }

  const roster = (rosterRows ?? []).map((r) => {
    const s = Array.isArray(r.students) ? r.students[0] : r.students;
    return {
      class_student_id: r.id as string,
      student_id: r.student_id as string,
      korean_name: s?.korean_name ?? null,
      english_name: s?.english_name ?? null,
    };
  });

  const students = roster.map((r) => ({
    id: r.student_id,
    korean_name: r.korean_name,
    english_name: r.english_name,
  }));

  if (roster.length === 0) {
    return { students: [], byStudent: {}, classDays };
  }

  // 2. 반의 모든 책 (class_homework_books × homework_books)
  const { data: bookRows, error: bookErr } = await supabase
    .from("class_homework_books")
    .select(
      "id, textbook_id, start_date, homework_books!inner(title, level, total_units, cover_image_url, series, series_id, series_rel:series_id(name))"
    )
    .eq("class_id", classId);

  if (bookErr) {
    logger.error("[listClassUnitProgressDetailed books]", bookErr.message);
    return {
      students,
      byStudent: {},
      classDays,
      error: bookErr.message,
    };
  }

  type BookMeta = {
    chbId: string;
    title: string;
    series_name: string | null;
    level: string | null;
    cover_image_url: string | null;
    total_units: number;
    start_date: string | null;
  };
  const books: BookMeta[] = (bookRows ?? []).map((row) => {
    const hb = Array.isArray(row.homework_books)
      ? row.homework_books[0]
      : row.homework_books;
    const seriesRel = hb?.series_rel
      ? Array.isArray(hb.series_rel)
        ? hb.series_rel[0]
        : hb.series_rel
      : null;
    return {
      chbId: row.id as string,
      title: hb?.title ?? "",
      series_name: seriesRel?.name ?? hb?.series ?? null,
      level: hb?.level ?? null,
      cover_image_url: hb?.cover_image_url ?? null,
      total_units: hb?.total_units ?? 0,
      start_date: (row.start_date as string | null) ?? null,
    };
  });

  // 책별 unit→expectedDate 맵 한 번만 계산 (반 전체 공유)
  const expectedByBook = new Map<string, Map<number, string>>();
  for (const b of books) {
    if (!b.start_date || classDays.length === 0 || b.total_units <= 0) continue;
    const schedule = getUnitSchedule({
      startDate: b.start_date,
      startUnit: 1,
      totalUnits: b.total_units,
      homeworkDays: classDays,
      skipDates: [],
    });
    const m = new Map<number, string>();
    for (const s of schedule) m.set(s.unit, s.date);
    expectedByBook.set(b.chbId, m);
  }

  // 3. student_homework_books → progress 한 번에
  const classStudentIds = roster.map((r) => r.class_student_id);
  const { data: shbRows, error: shbErr } = await supabase
    .from("student_homework_books")
    .select(
      "id, class_student_id, class_homework_book_id, student_homework_progress(unit_number, status)"
    )
    .in("class_student_id", classStudentIds);

  if (shbErr) {
    logger.error("[listClassUnitProgressDetailed shb]", shbErr.message);
    return {
      students,
      byStudent: {},
      classDays,
      error: shbErr.message,
    };
  }

  // class_student_id → student_id 매핑
  const csToStudent = new Map<string, string>();
  for (const r of roster) csToStudent.set(r.class_student_id, r.student_id);

  // student_id × chbId → progress map
  type ProgressByUnit = Map<number, UnitStatus>;
  const progressMap = new Map<string, ProgressByUnit>();
  const keyOf = (studentId: string, chbId: string) => `${studentId}::${chbId}`;

  for (const shb of shbRows ?? []) {
    const studentId = csToStudent.get(shb.class_student_id as string);
    if (!studentId) continue;
    const k = keyOf(studentId, shb.class_homework_book_id as string);
    const m: ProgressByUnit = new Map();
    const progress = Array.isArray(shb.student_homework_progress)
      ? shb.student_homework_progress
      : shb.student_homework_progress
        ? [shb.student_homework_progress]
        : [];
    for (const p of progress) {
      const status = (p as { status: string }).status;
      const unit = (p as { unit_number: number }).unit_number;
      if (typeof unit === "number" && isUnitStatus(status)) {
        m.set(unit, status);
      }
    }
    progressMap.set(k, m);
  }

  // 4. byStudent 조립 — 학생마다 반의 모든 책 노출
  const byStudent: Record<string, StudentTextbookUnits[]> = {};
  for (const r of roster) {
    byStudent[r.student_id] = books.map((b) => {
      const m = progressMap.get(keyOf(r.student_id, b.chbId));
      const exp = expectedByBook.get(b.chbId);
      const hasSchedule = !!b.start_date && classDays.length > 0;
      const units = Array.from({ length: b.total_units }, (_, i) => {
        const unitNumber = i + 1;
        const status = m?.get(unitNumber) ?? ("pending" as UnitStatus);
        return {
          unitNumber,
          status,
          expectedDate: exp?.get(unitNumber) ?? null,
          completedAt: null,
          note: null,
        };
      });
      return {
        id: b.chbId,
        title: b.title,
        series_name: b.series_name,
        level: b.level,
        cover_image_url: b.cover_image_url,
        total_units: b.total_units,
        source: "class" as const,
        hasSchedule,
        units,
      };
    });
  }

  return { students, byStudent, classDays };
}

export async function listUnitProgressByStudent(
  studentId: string
): Promise<StudentUnitProgressData> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return { textbooks: [], error: auth.error };

  const supabase = createAdminClient();

  // 학생의 student_homework_books + class_homework_book(+homework_book, +class) + progress
  const { data: shbRows, error: shbErr } = await supabase
    .from("student_homework_books")
    .select(
      "id, class_homework_book_id, class_student_id, class_students!inner(student_id, class_id), class_homework_books!inner(id, start_date, homework_books!inner(title, level, total_units, cover_image_url, series, series_id, series_rel:series_id(name))), student_homework_progress(unit_number, status)"
    )
    .eq("class_students.student_id", studentId);

  if (shbErr) {
    logger.error("[listUnitProgressByStudent shb]", shbErr.message);
    return { textbooks: [], error: shbErr.message };
  }

  type ShbRow = NonNullable<typeof shbRows>[number];
  const rows: ShbRow[] = shbRows ?? [];

  // 각 반의 class_schedules 한 번씩만 fetch
  const classIds = Array.from(
    new Set(
      rows
        .map((r) => {
          const cs = Array.isArray(r.class_students)
            ? r.class_students[0]
            : r.class_students;
          return cs?.class_id as string | undefined;
        })
        .filter((id): id is string => !!id)
    )
  );

  const classDaysMap = new Map<string, number[]>();
  if (classIds.length > 0) {
    const { data: scheduleRows, error: schedErr } = await supabase
      .from("class_schedules")
      .select("class_id, day_of_week")
      .in("class_id", classIds);
    if (schedErr) {
      logger.error("[listUnitProgressByStudent schedules]", schedErr.message);
    }
    for (const s of scheduleRows ?? []) {
      const cid = s.class_id as string;
      const dow = s.day_of_week as number;
      const arr = classDaysMap.get(cid) ?? [];
      if (!arr.includes(dow)) arr.push(dow);
      classDaysMap.set(cid, arr);
    }
    for (const arr of classDaysMap.values()) arr.sort((a, b) => a - b);
  }

  const textbooks: StudentTextbookUnits[] = rows.map((row) => {
    const cs = Array.isArray(row.class_students)
      ? row.class_students[0]
      : row.class_students;
    const chb = Array.isArray(row.class_homework_books)
      ? row.class_homework_books[0]
      : row.class_homework_books;
    const hb = chb?.homework_books
      ? Array.isArray(chb.homework_books)
        ? chb.homework_books[0]
        : chb.homework_books
      : null;
    const seriesRel = hb?.series_rel
      ? Array.isArray(hb.series_rel)
        ? hb.series_rel[0]
        : hb.series_rel
      : null;

    const startDate = (chb?.start_date as string | null) ?? null;
    const totalUnits = (hb?.total_units as number | undefined) ?? 0;
    const classDays = classDaysMap.get(cs?.class_id as string) ?? [];

    const expectedByUnit = new Map<number, string>();
    if (startDate && classDays.length > 0 && totalUnits > 0) {
      for (const s of getUnitSchedule({
        startDate,
        startUnit: 1,
        totalUnits,
        homeworkDays: classDays,
        skipDates: [],
      })) {
        expectedByUnit.set(s.unit, s.date);
      }
    }

    const statusByUnit = new Map<number, UnitStatus>();
    const progress = Array.isArray(row.student_homework_progress)
      ? row.student_homework_progress
      : row.student_homework_progress
        ? [row.student_homework_progress]
        : [];
    for (const p of progress) {
      const status = (p as { status: string }).status;
      const unit = (p as { unit_number: number }).unit_number;
      if (typeof unit === "number" && isUnitStatus(status)) {
        statusByUnit.set(unit, status);
      }
    }

    const units = Array.from({ length: totalUnits }, (_, i) => {
      const unitNumber = i + 1;
      return {
        unitNumber,
        status: statusByUnit.get(unitNumber) ?? ("pending" as UnitStatus),
        expectedDate: expectedByUnit.get(unitNumber) ?? null,
        completedAt: null,
        note: null,
      };
    });

    return {
      id: chb?.id as string,
      title: hb?.title ?? "",
      series_name: seriesRel?.name ?? hb?.series ?? null,
      level: hb?.level ?? null,
      cover_image_url: hb?.cover_image_url ?? null,
      total_units: totalUnits,
      source: "class" as const,
      hasSchedule: !!startDate && classDays.length > 0,
      units,
    };
  });

  return { textbooks };
}

export async function listUnitProgressByClass(
  _classId: string
): Promise<ClassUnitOverview> {
  return { students: [], textbooks: [], progressMap: {} };
}

// ── Mutations ────────────────────────────────────────────────────────────────

export async function markUnit(
  formData: FormData
): Promise<{ error?: string }> {
  const auth = await verifyTeacherOrAdmin();
  if ("error" in auth) return { error: auth.error };

  const studentId = (formData.get("studentId") as string)?.trim();
  const textbookId = (formData.get("textbookId") as string)?.trim();
  const unitNumberRaw = (formData.get("unitNumber") as string)?.trim();
  const statusRaw = (formData.get("status") as string)?.trim();

  const unitNumber = Number.parseInt(unitNumberRaw, 10);
  if (!studentId || !textbookId || !Number.isFinite(unitNumber) || unitNumber < 1) {
    return { error: "잘못된 요청입니다." };
  }
  if (!isUnitStatus(statusRaw)) {
    return { error: "잘못된 상태입니다." };
  }

  const supabase = createAdminClient();

  // (studentId, class_homework_book_id) → student_homework_book.id
  const { data: shb, error: shbErr } = await supabase
    .from("student_homework_books")
    .select("id, class_students!inner(student_id)")
    .eq("class_homework_book_id", textbookId)
    .eq("class_students.student_id", studentId)
    .maybeSingle();

  if (shbErr) {
    logger.error("[markUnit shb lookup]", shbErr.message);
    return { error: shbErr.message };
  }
  if (!shb) {
    return { error: "이 학생에게 부여되지 않은 책입니다." };
  }

  const { error: upErr } = await supabase
    .from("student_homework_progress")
    .upsert(
      {
        student_homework_book_id: shb.id,
        unit_number: unitNumber,
        status: statusRaw,
      },
      { onConflict: "student_homework_book_id,unit_number" }
    );

  if (upErr) {
    logger.error("[markUnit upsert]", upErr.message);
    return { error: upErr.message };
  }

  revalidateAll();
  return {};
}

export async function bulkMarkUnits(
  records: Array<{
    studentId: string;
    textbookId: string;
    unitNumber: number;
    status: UnitStatus;
    note?: string | null;
  }>
): Promise<{ error?: string; saved: number }> {
  const auth = await verifyTeacherOrAdmin();
  if ("error" in auth) return { error: auth.error, saved: 0 };

  if (records.length === 0) return { saved: 0 };

  const supabase = createAdminClient();

  // (studentId, textbookId) 별로 student_homework_book.id 한 번에 모음
  const pairs = Array.from(
    new Set(records.map((r) => `${r.studentId}::${r.textbookId}`))
  ).map((k) => {
    const [studentId, textbookId] = k.split("::");
    return { studentId, textbookId };
  });

  const lookupMap = new Map<string, string>(); // key → shb.id
  for (const p of pairs) {
    const { data, error } = await supabase
      .from("student_homework_books")
      .select("id, class_students!inner(student_id)")
      .eq("class_homework_book_id", p.textbookId)
      .eq("class_students.student_id", p.studentId)
      .maybeSingle();
    if (error) {
      logger.error("[bulkMarkUnits lookup]", error.message);
      continue;
    }
    if (data?.id) lookupMap.set(`${p.studentId}::${p.textbookId}`, data.id);
  }

  const rows = records
    .map((r) => {
      const shbId = lookupMap.get(`${r.studentId}::${r.textbookId}`);
      if (!shbId) return null;
      return {
        student_homework_book_id: shbId,
        unit_number: r.unitNumber,
        status: r.status,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) return { saved: 0 };

  const { error } = await supabase
    .from("student_homework_progress")
    .upsert(rows, { onConflict: "student_homework_book_id,unit_number" });

  if (error) {
    logger.error("[bulkMarkUnits upsert]", error.message);
    return { error: error.message, saved: 0 };
  }

  revalidateAll();
  return { saved: rows.length };
}

export async function clearUnit(
  studentId: string,
  textbookId: string,
  unitNumber: number
): Promise<{ error?: string }> {
  const auth = await verifyTeacherOrAdmin();
  if ("error" in auth) return { error: auth.error };

  const supabase = createAdminClient();

  const { data: shb, error: shbErr } = await supabase
    .from("student_homework_books")
    .select("id, class_students!inner(student_id)")
    .eq("class_homework_book_id", textbookId)
    .eq("class_students.student_id", studentId)
    .maybeSingle();

  if (shbErr) return { error: shbErr.message };
  if (!shb) return { error: "이 학생에게 부여되지 않은 책입니다." };

  const { error } = await supabase
    .from("student_homework_progress")
    .update({ status: "pending" })
    .eq("student_homework_book_id", shb.id)
    .eq("unit_number", unitNumber);

  if (error) {
    logger.error("[clearUnit]", error.message);
    return { error: error.message };
  }

  revalidateAll();
  return {};
}
