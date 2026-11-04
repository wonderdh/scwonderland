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
import {
  getUnitSchedule,
  isValidGradingDate,
} from "@/lib/utils/homework-schedule";

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
  /** 이 부여의 숙제 요일 (0=일~6=토). */
  homeworkDays: number[];
  units: Array<{
    unitNumber: number;
    status: UnitStatus;
    expectedDate: string | null;
    /** 제출일(issue, 숙제 나가는 날). 검사일=expectedDate. */
    submitDate: string | null;
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
  /** 반의 등원 요일 (0=일~6=토). 채점일 계산용. EditDaysModal preview 도 사용. */
  meetDays: number[];
  error?: string;
};

/** 보드(시리즈·레벨)용 학생 1명 + 그 시리즈·레벨에 해당하는 책들. */
export type BoardStudent = {
  id: string; // students.id (= profiles.id)
  korean_name: string | null;
  english_name: string | null;
  className: string; // 영어이름 중복 구분용. 여러 반이면 " · " 로 join.
};

export type SeriesLevelProgress = {
  students: BoardStudent[]; // english_name 가나다(알파벳)순 정렬
  byStudent: Record<string, StudentTextbookUnits[]>;
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

/**
 * 학원 공통 쉬는날(휴원일) 날짜 배열. getUnitSchedule 의 closedDates 인자로 전달되어
 * 검사일 계산에서만 제외된다(제출은 진행). 책별 skip_dates 와는 별개 (closed-days-actions.ts 참고).
 */
async function getClosedDates(
  supabase: ReturnType<typeof createAdminClient>
): Promise<string[]> {
  const { data, error } = await supabase
    .from("academy_closed_days")
    .select("closed_date");
  if (error) {
    logger.error("[getClosedDates]", error.message);
    return [];
  }
  return (data ?? []).map((r) => r.closed_date as string);
}

// ── Reads ────────────────────────────────────────────────────────────────────

export async function listClassUnitProgressDetailed(
  classId: string
): Promise<ClassUnitProgressDetailed> {
  const auth = await verifyAuthenticated();
  if ("error" in auth)
    return { students: [], byStudent: {}, meetDays: [], error: auth.error };

  const supabase = createAdminClient();

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
      meetDays: [],
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

  // 1b. 반 등원일 (= 채점 후보일)
  const { data: scheduleRows, error: scheduleErr } = await supabase
    .from("class_schedules")
    .select("day_of_week")
    .eq("class_id", classId);
  if (scheduleErr) {
    logger.error("[listClassUnitProgressDetailed schedules]", scheduleErr.message);
  }
  const meetDays = Array.from(
    new Set(((scheduleRows ?? []).map((r) => r.day_of_week as number)))
  ).sort((a, b) => a - b);

  if (roster.length === 0) {
    return { students: [], byStudent: {}, meetDays };
  }

  // 2. 반의 모든 책 (class_homework_books × homework_books) — 책마다 homework_days/skip_dates/start_unit 보유
  const { data: bookRows, error: bookErr } = await supabase
    .from("class_homework_books")
    .select(
      "id, textbook_id, start_date, homework_days, skip_dates, start_unit, homework_books!inner(title, level, series_id, series_rel:series_id(name, total_units, cover_image_url))"
    )
    .eq("class_id", classId);

  if (bookErr) {
    logger.error("[listClassUnitProgressDetailed books]", bookErr.message);
    return {
      students,
      byStudent: {},
      meetDays,
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
    homework_days: number[];
    skip_dates: string[];
    start_unit: number;
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
    const days = Array.from(
      new Set(((row.homework_days as number[] | null | undefined) ?? []) as number[])
    ).sort((a, b) => a - b);
    const skips = Array.from(
      new Set(((row.skip_dates as string[] | null | undefined) ?? []) as string[])
    ).sort();
    return {
      chbId: row.id as string,
      title: hb?.title ?? "",
      series_name: seriesRel?.name ?? null,
      level: hb?.level ?? null,
      cover_image_url: seriesRel?.cover_image_url ?? null,
      total_units: seriesRel?.total_units ?? 0,
      start_date: (row.start_date as string | null) ?? null,
      homework_days: days,
      skip_dates: skips,
      start_unit: (row.start_unit as number | null) ?? 1,
    };
  });

  // 학원 공통 쉬는날 — getUnitSchedule 의 closedDates 로 전달, 검사일에서만 제외(제출은 진행).
  const closedDates = await getClosedDates(supabase);

  // 책별 unit→채점일 맵 한 번만 계산 (책마다 다른 요일/예외일/start_unit 가능).
  // 등원일(meetDays) 이 비어 있으면 schedule 비활성 → 빈 맵.
  const expectedByBook = new Map<string, Map<number, { grading: string; issue: string }>>();
  for (const b of books) {
    if (
      !b.start_date ||
      b.homework_days.length === 0 ||
      meetDays.length === 0 ||
      b.total_units <= 0
    )
      continue;
    // Strict boundary 가드: invalid 검사일은 silent shift 하지 않고 expectedDate 를 비워 둔다.
    const gv = isValidGradingDate(b.start_date, meetDays, closedDates, b.skip_dates);
    if (!gv.ok) {
      logger.warn(
        "[listClassUnitProgressDetailed]",
        `invalid grading date chb=${b.chbId} date=${b.start_date} reason=${gv.reason}`
      );
      continue;
    }
    const schedule = getUnitSchedule({
      startDate: b.start_date,
      startUnit: b.start_unit,
      totalUnits: b.total_units,
      homeworkDays: b.homework_days,
      meetDays,
      skipDates: b.skip_dates,
      closedDates,
    });
    const m = new Map<number, { grading: string; issue: string }>();
    for (const s of schedule) m.set(s.unit, { grading: s.date, issue: s.issueDate });
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
      meetDays,
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

  // 4. byStudent 조립 — 학생마다 반의 모든 책 노출. 항상 unit 1 ~ total_units 전체 표시.
  //    start_unit 이전 unit 은 getUnitSchedule 가 시작일에서 역산해 expectedDate 를 채워준다.
  const byStudent: Record<string, StudentTextbookUnits[]> = {};
  for (const r of roster) {
    byStudent[r.student_id] = books.map((b) => {
      const m = progressMap.get(keyOf(r.student_id, b.chbId));
      const exp = expectedByBook.get(b.chbId);
      const hasSchedule =
        !!b.start_date && b.homework_days.length > 0 && meetDays.length > 0;
      const lastUnit = b.total_units;
      const unitsCount = Math.max(0, lastUnit);
      const units = Array.from({ length: unitsCount }, (_, i) => {
        const unitNumber = i + 1;
        const status = m?.get(unitNumber) ?? ("pending" as UnitStatus);
        const e = exp?.get(unitNumber);
        return {
          unitNumber,
          status,
          expectedDate: e?.grading ?? null,
          submitDate: e?.issue ?? null,
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
        homeworkDays: b.homework_days,
        units,
      };
    });
  }

  return { students, byStudent, meetDays };
}

export async function listSeriesLevelProgress(
  seriesId: string,
  level?: string
): Promise<SeriesLevelProgress> {
  const auth = await verifyTeacherOrAdmin();
  if ("error" in auth) return { students: [], byStudent: {}, error: auth.error };

  const supabase = createAdminClient();

  // 1. series + (선택) level 에 해당하는 homework_books id 들
  let hbQuery = supabase
    .from("homework_books")
    .select("id, level, series_rel:series_id(name, total_units, cover_image_url)")
    .eq("series_id", seriesId);
  if (level !== undefined) hbQuery = hbQuery.eq("level", level);
  const { data: hbRows, error: hbErr } = await hbQuery;
  if (hbErr) {
    logger.error("[listSeriesLevelProgress hb]", hbErr.message);
    return { students: [], byStudent: {}, error: hbErr.message };
  }
  const homeworkBookIds = (hbRows ?? []).map((r) => r.id as string);
  if (homeworkBookIds.length === 0) return { students: [], byStudent: {} };

  // 2. 이 책들이 부여된 모든 반의 class_homework_books
  const { data: chbRows, error: chbErr } = await supabase
    .from("class_homework_books")
    .select(
      "id, class_id, textbook_id, start_date, homework_days, skip_dates, start_unit, classes!inner(name), homework_books!inner(title, level, series_rel:series_id(name, total_units, cover_image_url))"
    )
    .in("textbook_id", homeworkBookIds);
  if (chbErr) {
    logger.error("[listSeriesLevelProgress chb]", chbErr.message);
    return { students: [], byStudent: {}, error: chbErr.message };
  }

  type BookMeta = {
    chbId: string;
    classId: string;
    className: string;
    title: string;
    series_name: string | null;
    level: string | null;
    cover_image_url: string | null;
    total_units: number;
    start_date: string | null;
    homework_days: number[];
    skip_dates: string[];
    start_unit: number;
  };
  const books: BookMeta[] = (chbRows ?? []).map((row) => {
    const hb = Array.isArray(row.homework_books) ? row.homework_books[0] : row.homework_books;
    const seriesRel = hb?.series_rel
      ? Array.isArray(hb.series_rel)
        ? hb.series_rel[0]
        : hb.series_rel
      : null;
    const cls = Array.isArray(row.classes) ? row.classes[0] : row.classes;
    const days = Array.from(
      new Set(((row.homework_days as number[] | null | undefined) ?? []) as number[])
    ).sort((a, b) => a - b);
    const skips = Array.from(
      new Set(((row.skip_dates as string[] | null | undefined) ?? []) as string[])
    ).sort();
    return {
      chbId: row.id as string,
      classId: row.class_id as string,
      className: (cls as { name?: string } | null)?.name ?? "",
      title: hb?.title ?? "",
      series_name: seriesRel?.name ?? null,
      level: hb?.level ?? null,
      cover_image_url: seriesRel?.cover_image_url ?? null,
      total_units: seriesRel?.total_units ?? 0,
      start_date: (row.start_date as string | null) ?? null,
      homework_days: days,
      skip_dates: skips,
      start_unit: (row.start_unit as number | null) ?? 1,
    };
  });
  if (books.length === 0) return { students: [], byStudent: {} };

  // 3. 반별 등원일(meetDays) 맵 (채점일 계산용) — listUnitProgressByStudent 패턴
  const classIds = Array.from(new Set(books.map((b) => b.classId)));
  const meetDaysByClass = new Map<string, number[]>();
  {
    const { data: scheduleRows, error: scheduleErr } = await supabase
      .from("class_schedules")
      .select("class_id, day_of_week")
      .in("class_id", classIds);
    if (scheduleErr) logger.error("[listSeriesLevelProgress schedules]", scheduleErr.message);
    for (const r of scheduleRows ?? []) {
      const cid = r.class_id as string;
      const arr = meetDaysByClass.get(cid) ?? [];
      arr.push(r.day_of_week as number);
      meetDaysByClass.set(cid, arr);
    }
    for (const [k, v] of meetDaysByClass) {
      meetDaysByClass.set(k, Array.from(new Set(v)).sort((a, b) => a - b));
    }
  }

  const closedDates = await getClosedDates(supabase);

  // 4. 책별 unit→채점일 맵 (listClassUnitProgressDetailed 와 동일, meetDays 만 반별)
  const expectedByBook = new Map<string, Map<number, { grading: string; issue: string }>>();
  for (const b of books) {
    const meetDays = meetDaysByClass.get(b.classId) ?? [];
    if (!b.start_date || b.homework_days.length === 0 || meetDays.length === 0 || b.total_units <= 0)
      continue;
    const gv = isValidGradingDate(b.start_date, meetDays, closedDates, b.skip_dates);
    if (!gv.ok) {
      logger.warn(
        "[listSeriesLevelProgress]",
        `invalid grading date chb=${b.chbId} date=${b.start_date} reason=${gv.reason}`
      );
      continue;
    }
    const schedule = getUnitSchedule({
      startDate: b.start_date,
      startUnit: b.start_unit,
      totalUnits: b.total_units,
      homeworkDays: b.homework_days,
      meetDays,
      skipDates: b.skip_dates,
      closedDates,
    });
    const m = new Map<number, { grading: string; issue: string }>();
    for (const s of schedule) m.set(s.unit, { grading: s.date, issue: s.issueDate });
    expectedByBook.set(b.chbId, m);
  }

  // 5. 이 책들의 student_homework_books + 학생 + progress
  const chbIds = books.map((b) => b.chbId);
  const { data: shbRows, error: shbErr } = await supabase
    .from("student_homework_books")
    .select(
      "id, class_homework_book_id, class_students!inner(student_id, students!inner(id, korean_name, english_name)), student_homework_progress(unit_number, status)"
    )
    .in("class_homework_book_id", chbIds)
    .eq("class_students.is_active", true);
  if (shbErr) {
    logger.error("[listSeriesLevelProgress shb]", shbErr.message);
    return { students: [], byStudent: {}, error: shbErr.message };
  }

  const bookByChb = new Map(books.map((b) => [b.chbId, b]));
  const studentMeta = new Map<string, BoardStudent>();
  const classNamesByStudent = new Map<string, Set<string>>();
  const byStudent: Record<string, StudentTextbookUnits[]> = {};

  for (const shb of shbRows ?? []) {
    const chbId = shb.class_homework_book_id as string;
    const b = bookByChb.get(chbId);
    if (!b) continue;
    const cs = Array.isArray(shb.class_students) ? shb.class_students[0] : shb.class_students;
    const stu = cs?.students
      ? Array.isArray(cs.students)
        ? cs.students[0]
        : cs.students
      : null;
    const studentId = (stu as { id?: string } | null)?.id;
    if (!studentId) continue;

    if (!studentMeta.has(studentId)) {
      studentMeta.set(studentId, {
        id: studentId,
        korean_name: (stu as { korean_name?: string | null }).korean_name ?? null,
        english_name: (stu as { english_name?: string | null }).english_name ?? null,
        className: "",
      });
    }
    const cn = classNamesByStudent.get(studentId) ?? new Set<string>();
    if (b.className) cn.add(b.className);
    classNamesByStudent.set(studentId, cn);

    // progress map
    const statusByUnit = new Map<number, UnitStatus>();
    const progress = Array.isArray(shb.student_homework_progress)
      ? shb.student_homework_progress
      : shb.student_homework_progress
        ? [shb.student_homework_progress]
        : [];
    for (const p of progress) {
      const status = (p as { status: string }).status;
      const unit = (p as { unit_number: number }).unit_number;
      if (typeof unit === "number" && isUnitStatus(status)) statusByUnit.set(unit, status);
    }

    const exp = expectedByBook.get(chbId);
    const hasSchedule =
      !!b.start_date &&
      b.homework_days.length > 0 &&
      (meetDaysByClass.get(b.classId)?.length ?? 0) > 0;
    const units = Array.from({ length: Math.max(0, b.total_units) }, (_, i) => {
      const unitNumber = i + 1;
      const e = exp?.get(unitNumber);
      return {
        unitNumber,
        status: statusByUnit.get(unitNumber) ?? ("pending" as UnitStatus),
        expectedDate: e?.grading ?? null,
        submitDate: e?.issue ?? null,
        completedAt: null,
        note: null,
      };
    });

    const tbEntry: StudentTextbookUnits = {
      id: b.chbId,
      title: b.title,
      series_name: b.series_name,
      level: b.level,
      cover_image_url: b.cover_image_url,
      total_units: b.total_units,
      source: "class",
      hasSchedule,
      homeworkDays: b.homework_days,
      units,
    };
    (byStudent[studentId] ??= []).push(tbEntry);
  }

  // 6. className 합치기 + english_name 정렬
  for (const [studentId, meta] of studentMeta) {
    meta.className = Array.from(classNamesByStudent.get(studentId) ?? [])
      .sort()
      .join(" · ");
  }
  const students = Array.from(studentMeta.values()).sort((a, b) => {
    const ae = (a.english_name ?? "").toLowerCase();
    const be = (b.english_name ?? "").toLowerCase();
    if (ae && be && ae !== be) return ae.localeCompare(be);
    if (ae !== be) return ae ? -1 : 1; // 영어이름 있는 쪽 먼저
    return (a.korean_name ?? "").localeCompare(b.korean_name ?? "", "ko");
  });

  return { students, byStudent };
}

export async function listUnitProgressByStudent(
  studentId: string
): Promise<StudentUnitProgressData> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return { textbooks: [], error: auth.error };

  const supabase = createAdminClient();

  // 학생의 student_homework_books + class_homework_book(+homework_book) + progress
  // 요일은 class_homework_books.homework_days 사용 (책별로 다를 수 있음)
  const { data: shbRows, error: shbErr } = await supabase
    .from("student_homework_books")
    .select(
      "id, class_homework_book_id, class_student_id, class_students!inner(student_id, class_id), class_homework_books!inner(id, start_date, homework_days, skip_dates, start_unit, homework_books!inner(title, level, series_id, series_rel:series_id(name, total_units, cover_image_url))), student_homework_progress(unit_number, status)"
    )
    .eq("class_students.student_id", studentId)
    .eq("class_students.is_active", true);

  if (shbErr) {
    logger.error("[listUnitProgressByStudent shb]", shbErr.message);
    return { textbooks: [], error: shbErr.message };
  }

  type ShbRow = NonNullable<typeof shbRows>[number];
  const rows: ShbRow[] = shbRows ?? [];

  // row 별 class_id 를 모아 한 번에 등원일 조회 (채점일 계산용).
  function pickClassId(row: ShbRow): string | null {
    const cs = Array.isArray(row.class_students)
      ? row.class_students[0]
      : row.class_students;
    const cid = (cs as { class_id?: string | null } | null)?.class_id;
    return cid ?? null;
  }

  const classIds = Array.from(
    new Set(rows.map(pickClassId).filter((v): v is string => !!v))
  );
  const meetDaysByClass = new Map<string, number[]>();
  if (classIds.length > 0) {
    const { data: scheduleRows, error: scheduleErr } = await supabase
      .from("class_schedules")
      .select("class_id, day_of_week")
      .in("class_id", classIds);
    if (scheduleErr) {
      logger.error("[listUnitProgressByStudent schedules]", scheduleErr.message);
    }
    for (const r of scheduleRows ?? []) {
      const cid = r.class_id as string;
      const wd = r.day_of_week as number;
      const arr = meetDaysByClass.get(cid) ?? [];
      arr.push(wd);
      meetDaysByClass.set(cid, arr);
    }
    for (const [k, v] of meetDaysByClass) {
      meetDaysByClass.set(k, Array.from(new Set(v)).sort((a, b) => a - b));
    }
  }

  // 학원 공통 쉬는날 — getUnitSchedule 의 closedDates 로 전달, 검사일에서만 제외(제출은 진행).
  const closedDates = await getClosedDates(supabase);

  const textbooks: StudentTextbookUnits[] = rows.map((row) => {
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
    const totalUnits = (seriesRel?.total_units as number | undefined) ?? 0;
    const startUnit = (((chb as { start_unit?: number | null } | null)?.start_unit) as number | null) ?? 1;
    const homeworkDays = Array.from(
      new Set(
        (((chb as { homework_days?: number[] | null } | null)?.homework_days ?? []) as number[])
      )
    ).sort((a, b) => a - b);
    const skipDates = Array.from(
      new Set(
        (((chb as { skip_dates?: string[] | null } | null)?.skip_dates ?? []) as string[])
      )
    ).sort();

    const classId = pickClassId(row);
    const meetDays = classId ? meetDaysByClass.get(classId) ?? [] : [];

    const expectedByUnit = new Map<number, { grading: string; issue: string }>();
    if (
      startDate &&
      homeworkDays.length > 0 &&
      meetDays.length > 0 &&
      totalUnits > 0
    ) {
      // Strict boundary 가드: invalid 검사일은 expectedDate 를 비워 둔다 (silent shift 금지).
      const gv = isValidGradingDate(startDate, meetDays, closedDates, skipDates);
      if (gv.ok) {
        for (const s of getUnitSchedule({
          startDate,
          startUnit,
          totalUnits,
          homeworkDays,
          meetDays,
          skipDates,
          closedDates,
        })) {
          expectedByUnit.set(s.unit, { grading: s.date, issue: s.issueDate });
        }
      } else {
        logger.warn(
          "[listUnitProgressByStudent]",
          `invalid grading date chb=${chb?.id ?? "?"} date=${startDate} reason=${gv.reason}`
        );
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

    // 항상 unit 1 ~ total_units 전체 표시. start_unit 이전 unit 의 expectedDate 는
    // getUnitSchedule 가 시작일에서 역산해 채워준다.
    const unitsCount = Math.max(0, totalUnits);
    const units = Array.from({ length: unitsCount }, (_, i) => {
      const unitNumber = i + 1;
      const e = expectedByUnit.get(unitNumber);
      return {
        unitNumber,
        status: statusByUnit.get(unitNumber) ?? ("pending" as UnitStatus),
        expectedDate: e?.grading ?? null,
        submitDate: e?.issue ?? null,
        completedAt: null,
        note: null,
      };
    });

    return {
      id: chb?.id as string,
      title: hb?.title ?? "",
      series_name: seriesRel?.name ?? null,
      level: hb?.level ?? null,
      cover_image_url: seriesRel?.cover_image_url ?? null,
      total_units: totalUnits,
      source: "class" as const,
      hasSchedule:
        !!startDate && homeworkDays.length > 0 && meetDays.length > 0,
      homeworkDays,
      units,
    };
  });

  return { textbooks };
}

// ── Mutations ────────────────────────────────────────────────────────────────

export async function bulkMarkUnits(
  records: Array<{
    studentId: string;
    textbookId: string;
    unitNumber: number;
    status: UnitStatus;
    note?: string | null;
  }>,
  options?: { excludeAbsentOn?: string /* YYYY-MM-DD KST */ }
): Promise<{ error?: string; saved: number; skippedAbsent: number }> {
  const auth = await verifyTeacherOrAdmin();
  if ("error" in auth) return { error: auth.error, saved: 0, skippedAbsent: 0 };

  if (records.length === 0) return { saved: 0, skippedAbsent: 0 };

  const supabase = createAdminClient();

  // excludeAbsentOn 이 주어지면 그 날짜 결석자 student_id set 조회
  let absentStudentIds = new Set<string>();
  if (options?.excludeAbsentOn) {
    const { data: absentRows, error: absentErr } = await supabase
      .from("attendance")
      .select("student_id")
      .eq("attendance_date", options.excludeAbsentOn)
      .eq("status", "absent");
    if (absentErr) {
      logger.error("[bulkMarkUnits absent lookup]", absentErr.message);
    } else {
      absentStudentIds = new Set((absentRows ?? []).map((r) => r.student_id as string));
    }
  }

  const filteredRecords = records.filter((r) => !absentStudentIds.has(r.studentId));
  const skippedAbsent = records.length - filteredRecords.length;

  if (filteredRecords.length === 0) return { saved: 0, skippedAbsent };

  // (studentId, textbookId) 별로 student_homework_book.id 한 번에 모음
  const pairs = Array.from(
    new Set(filteredRecords.map((r) => `${r.studentId}::${r.textbookId}`))
  ).map((k) => {
    const [studentId, textbookId] = k.split("::");
    return { studentId, textbookId };
  });

  // SHB lookup 을 batch 로 (이전 직렬 N+1 → 단일 query). textbookIds 로만 in()
  // 필터링하고 결과를 클라이언트에서 (studentId, textbookId) 로 group. 한 반의
  // SHB row 수는 작아서 over-fetch 무시 가능.
  const textbookIds = Array.from(new Set(pairs.map((p) => p.textbookId)));
  const wantedPairs = new Set(pairs.map((p) => `${p.studentId}::${p.textbookId}`));

  const lookupMap = new Map<string, string>(); // key → shb.id
  const { data: shbRows, error: shbErr } = await supabase
    .from("student_homework_books")
    .select("id, class_homework_book_id, class_students!inner(student_id)")
    .in("class_homework_book_id", textbookIds)
    .eq("class_students.is_active", true);
  if (shbErr) {
    logger.error("[bulkMarkUnits lookup]", shbErr.message);
  } else {
    for (const row of shbRows ?? []) {
      // !inner join 결과는 단일 객체 형태이지만 PostgREST 타입 추론은 배열일 수
      // 있어 둘 다 방어.
      const cs = row.class_students as
        | { student_id: string }
        | { student_id: string }[]
        | null;
      const sid = Array.isArray(cs) ? cs[0]?.student_id : cs?.student_id;
      const tbid = row.class_homework_book_id;
      if (!sid || !tbid) continue;
      const key = `${sid}::${tbid}`;
      if (wantedPairs.has(key)) lookupMap.set(key, row.id as string);
    }
  }

  const rows = filteredRecords
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

  if (rows.length === 0) return { saved: 0, skippedAbsent };

  const { error } = await supabase
    .from("student_homework_progress")
    .upsert(rows, { onConflict: "student_homework_book_id,unit_number" });

  if (error) {
    logger.error("[bulkMarkUnits upsert]", error.message);
    return { error: error.message, saved: 0, skippedAbsent };
  }

  revalidateAll();
  return { saved: rows.length, skippedAbsent };
}

/** 특정 날짜(KST YYYY-MM-DD) 결석자 student_id 배열 조회 */
export async function getAbsentStudentIds(
  date: string
): Promise<{ studentIds: string[]; error?: string }> {
  const auth = await verifyTeacherOrAdmin();
  if ("error" in auth) return { studentIds: [], error: auth.error };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("attendance")
    .select("student_id")
    .eq("attendance_date", date)
    .eq("status", "absent");

  if (error) {
    logger.error("[getAbsentStudentIds]", error.message);
    return { studentIds: [], error: error.message };
  }

  return { studentIds: (data ?? []).map((r) => r.student_id as string) };
}
