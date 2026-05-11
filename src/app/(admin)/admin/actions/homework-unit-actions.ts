"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdmin, verifyAuthenticated } from "./auth-helpers";
import { logger } from "@/lib/server/logger";
import { getUnitSchedule } from "@/lib/utils/homework-schedule";
import type { Database } from "@/lib/types/database.generated";

type UnitProgressRow =
  Database["public"]["Tables"]["homework_unit_progress"]["Row"];

export type UnitStatus = "pending" | "completed" | "missed";

export type StudentTextbookUnits = {
  id: string;
  title: string;
  series_name: string | null;
  level: string | null;
  cover_image_url: string | null;
  total_units: number;
  /** 부여 origin: 'class' (반 부여) | 'student' (개인 부여). 둘 다면 'class' 우선. */
  source: "class" | "student";
  /** schedule 입력 여부. false 면 unit 의 expectedDate 모두 null. */
  hasSchedule: boolean;
  units: Array<{
    unitNumber: number;
    status: UnitStatus;
    expectedDate: string | null; // YYYY-MM-DD or null
    completedAt: string | null;
    note: string | null;
  }>;
};

export type StudentUnitProgressData = {
  textbooks: StudentTextbookUnits[];
  /** auth/permission 거부 시 message 채워짐. 빈 textbooks 와 구분. */
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
  /** key: `${studentId}::${textbookId}` → unit progress array */
  progressMap: Record<string, UnitProgressRow[]>;
  error?: string;
};

export type ClassUnitProgressDetailed = {
  students: { id: string; korean_name: string | null; english_name: string | null }[];
  /** key: studentId → 그 학생의 책별 unit grid 데이터 (StudentTextbookUnits 와 동일 shape) */
  byStudent: Record<string, StudentTextbookUnits[]>;
  error?: string;
};

const REVALIDATE_PATHS = [
  "/admin",
  "/admin/students",
  "/admin/classes",
  "/admin/homework",
  "/academy/student/homework",
  "/academy/teacher/homework",
] as const;

function revalidateAll() {
  for (const p of REVALIDATE_PATHS) revalidatePath(p);
}

const ALLOWED_STATUSES: ReadonlySet<UnitStatus> = new Set([
  "pending",
  "completed",
  "missed",
]);

// ── Internal helpers ────────────────────────────────────────────────────────

type RowMeta = {
  textbookId: string;
  title: string;
  seriesName: string | null;
  level: string | null;
  coverImageUrl: string | null;
  totalUnits: number;
  homeworkDays: number[];
  skipDates: string[];
  startDate: string | null;
  startUnit: number;
  source: "class" | "student";
};

type RawAssignmentRow = {
  textbook_id: string;
  homework_days: number[] | null;
  skip_dates: string[] | null;
  start_date: string | null;
  start_unit: number | null;
  textbooks: unknown;
};

function rowToMeta(
  row: RawAssignmentRow,
  source: "class" | "student"
): RowMeta | null {
  const tb = Array.isArray(row.textbooks)
    ? (row.textbooks[0] as Record<string, unknown> | undefined)
    : (row.textbooks as Record<string, unknown> | null);
  if (!tb || tb.is_active !== true) return null;
  const total = (tb.total_units as number | null) ?? 0;
  if (total <= 0) return null;
  const seriesField = tb.series;
  const series = seriesField
    ? Array.isArray(seriesField)
      ? (seriesField[0] as { name?: string | null } | undefined)
      : (seriesField as { name?: string | null })
    : null;
  return {
    textbookId: row.textbook_id,
    title: (tb.title as string | null) ?? "",
    seriesName: series?.name ?? null,
    level: (tb.level as string | null) ?? null,
    coverImageUrl: (tb.cover_image_url as string | null) ?? null,
    totalUnits: total,
    homeworkDays: row.homework_days ?? [],
    skipDates: row.skip_dates ?? [],
    startDate: row.start_date ?? null,
    startUnit: row.start_unit ?? 1,
    source,
  };
}

/**
 * class meta 가 schedule 비어 있으면 student meta 의 schedule 로 fallback.
 * source 는 class 유지 (부여 출처 표시).
 */
function mergeScheduleFallback(
  classMeta: RowMeta,
  studentMeta: RowMeta | undefined
): RowMeta {
  const classHasSchedule =
    !!classMeta.startDate && classMeta.homeworkDays.length > 0;
  if (classHasSchedule) return classMeta;
  if (
    !studentMeta ||
    !studentMeta.startDate ||
    studentMeta.homeworkDays.length === 0
  ) {
    return classMeta;
  }
  return {
    ...classMeta,
    homeworkDays: studentMeta.homeworkDays,
    skipDates: studentMeta.skipDates,
    startDate: studentMeta.startDate,
    startUnit: studentMeta.startUnit,
  };
}

function buildUnits(
  meta: RowMeta,
  progressByKey: Map<
    string,
    { status: UnitStatus; completedAt: string | null; note: string | null }
  >,
  studentId: string
): StudentTextbookUnits {
  const hasSchedule = !!meta.startDate && meta.homeworkDays.length > 0;
  let dateByUnit = new Map<number, string>();
  if (hasSchedule && meta.startDate) {
    const sched = getUnitSchedule({
      startDate: meta.startDate,
      startUnit: meta.startUnit,
      totalUnits: meta.totalUnits,
      homeworkDays: meta.homeworkDays,
      skipDates: meta.skipDates,
    });
    dateByUnit = new Map(sched.map((s) => [s.unit, s.date]));
  }
  const units: StudentTextbookUnits["units"] = [];
  for (let n = 1; n <= meta.totalUnits; n++) {
    const prog = progressByKey.get(`${studentId}::${meta.textbookId}::${n}`);
    units.push({
      unitNumber: n,
      status: prog?.status ?? "pending",
      expectedDate: dateByUnit.get(n) ?? null,
      completedAt: prog?.completedAt ?? null,
      note: prog?.note ?? null,
    });
  }
  return {
    id: meta.textbookId,
    title: meta.title,
    series_name: meta.seriesName,
    level: meta.level,
    cover_image_url: meta.coverImageUrl,
    total_units: meta.totalUnits,
    source: meta.source,
    hasSchedule,
    units,
  };
}

async function userIsStaff(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<boolean> {
  const { data: prof } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return !!prof && ["admin", "teacher"].includes(prof.role ?? "");
}

// ── Read ────────────────────────────────────────────────────────────────────

/**
 * 한 학생의 부여된 모든 책 + unit 진도 + schedule (반/개인 부여 합집합).
 *
 * 본인 OR staff 만 조회. 권한 거부 시 `error` 필드 채워짐.
 *
 * 쿼리: 4-5 (class_students → Promise.all([class_textbooks, student_textbooks, progress])).
 */
export async function listUnitProgressByStudent(
  studentId: string
): Promise<StudentUnitProgressData> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return { textbooks: [], error: auth.error };
  const supabase = createAdminClient();

  // 본인 OR staff 검증
  if (auth.userId !== studentId) {
    const isStaff = await userIsStaff(supabase, auth.userId);
    if (!isStaff) {
      logger.warn("[listUnitProgressByStudent]", "권한 없음", {
        userId: auth.userId,
        studentId,
      });
      return { textbooks: [], error: "권한이 없습니다." };
    }
  }

  // 1. 학생 active 반 (→ classIds 필요)
  const { data: memberships } = await supabase
    .from("class_students")
    .select("class_id")
    .eq("student_id", studentId)
    .eq("is_active", true);
  const classIds = (memberships ?? []).map((m) => m.class_id);

  // 2. 병렬: 반 부여 / 개인 부여 / 학생의 모든 progress
  const [classTbResult, studentTbResult, progressResult] = await Promise.all([
    classIds.length
      ? supabase
          .from("class_textbooks")
          .select(
            "textbook_id, homework_days, skip_dates, start_date, start_unit, textbooks(id, title, level, cover_image_url, total_units, is_active, series:series_id(name))"
          )
          .in("class_id", classIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("student_textbooks")
      .select(
        "textbook_id, homework_days, skip_dates, start_date, start_unit, textbooks(id, title, level, cover_image_url, total_units, is_active, series:series_id(name))"
      )
      .eq("student_id", studentId),
    supabase
      .from("homework_unit_progress")
      .select("textbook_id, unit_number, status, completed_at, note")
      .eq("student_id", studentId),
  ]);

  const classRows = (classTbResult.data ?? []) as RawAssignmentRow[];
  const studentRows = (studentTbResult.data ?? []) as RawAssignmentRow[];
  const progressRows = progressResult.data ?? [];

  // 3. textbookId → meta (class 우선, schedule 비면 student fallback)
  const classMetaByTb = new Map<string, RowMeta>();
  for (const row of classRows) {
    const meta = rowToMeta(row, "class");
    if (meta && !classMetaByTb.has(meta.textbookId)) {
      classMetaByTb.set(meta.textbookId, meta);
    }
  }
  const studentMetaByTb = new Map<string, RowMeta>();
  for (const row of studentRows) {
    const meta = rowToMeta(row, "student");
    if (meta && !studentMetaByTb.has(meta.textbookId)) {
      studentMetaByTb.set(meta.textbookId, meta);
    }
  }

  const finalByTb = new Map<string, RowMeta>();
  for (const [tbId, classMeta] of classMetaByTb) {
    finalByTb.set(tbId, mergeScheduleFallback(classMeta, studentMetaByTb.get(tbId)));
  }
  for (const [tbId, studentMeta] of studentMetaByTb) {
    if (!finalByTb.has(tbId)) finalByTb.set(tbId, studentMeta);
  }

  if (finalByTb.size === 0) return { textbooks: [] };

  // 4. progress 인덱싱
  const progressByKey = new Map<
    string,
    { status: UnitStatus; completedAt: string | null; note: string | null }
  >();
  for (const r of progressRows) {
    progressByKey.set(`${studentId}::${r.textbook_id}::${r.unit_number}`, {
      status: r.status as UnitStatus,
      completedAt: r.completed_at,
      note: r.note,
    });
  }

  // 5. 결과 빌드
  const result: StudentTextbookUnits[] = [];
  for (const meta of finalByTb.values()) {
    result.push(buildUnits(meta, progressByKey, studentId));
  }

  return { textbooks: result };
}

/**
 * 반 단위 unit overview (간단 — progressMap 만 반환).
 * 풍부한 grid 데이터가 필요하면 `listClassUnitProgressDetailed` 사용.
 */
export async function listUnitProgressByClass(
  classId: string
): Promise<ClassUnitOverview> {
  const auth = await verifyAuthenticated();
  if ("error" in auth)
    return { students: [], textbooks: [], progressMap: {}, error: auth.error };
  const supabase = createAdminClient();

  const isStaff = await userIsStaff(supabase, auth.userId);
  if (!isStaff) {
    return {
      students: [],
      textbooks: [],
      progressMap: {},
      error: "권한이 없습니다.",
    };
  }

  const { data: members } = await supabase
    .from("class_students")
    .select("student_id, is_active")
    .eq("class_id", classId)
    .eq("is_active", true);
  const studentIds = (members ?? []).map((m) => m.student_id);

  if (!studentIds.length) {
    return { students: [], textbooks: [], progressMap: {} };
  }

  const { data: students } = await supabase
    .from("students")
    .select("id, korean_name, english_name")
    .in("id", studentIds);
  const studentRows = (students ?? []).map((s) => ({
    id: s.id,
    korean_name: s.korean_name,
    english_name: s.english_name,
  }));

  const { data: classTextbooks } = await supabase
    .from("class_textbooks")
    .select(
      "textbook_id, textbooks(id, title, level, total_units, is_active, series:series_id(name))"
    )
    .eq("class_id", classId);

  const textbookRows = (classTextbooks ?? [])
    .map((row) => {
      const tb = Array.isArray(row.textbooks) ? row.textbooks[0] : row.textbooks;
      if (!tb || !tb.is_active) return null;
      const series = tb.series
        ? Array.isArray(tb.series)
          ? tb.series[0]
          : tb.series
        : null;
      return {
        id: row.textbook_id,
        title: tb.title ?? "",
        series_name: series?.name ?? null,
        level: tb.level ?? null,
        total_units: tb.total_units ?? 0,
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  const textbookIds = textbookRows.map((t) => t.id);
  const progressMap: Record<string, UnitProgressRow[]> = {};
  if (textbookIds.length) {
    const { data: progress } = await supabase
      .from("homework_unit_progress")
      .select("*")
      .in("student_id", studentIds)
      .in("textbook_id", textbookIds);
    for (const p of progress ?? []) {
      const key = `${p.student_id}::${p.textbook_id}`;
      const arr = progressMap[key] ?? [];
      arr.push(p);
      progressMap[key] = arr;
    }
  }

  return { students: studentRows, textbooks: textbookRows, progressMap };
}

/**
 * 반 단위 detailed unit progress — admin 의 「반별 체크」 탭에서 사용.
 *
 * 한 번에 가져오는 데이터:
 * - 학생 목록 (active)
 * - 학생별: 부여된 책 (반/개인 합집합) + 각 책의 unit 배열 (status/expectedDate/completedAt/note)
 *
 * 쿼리 횟수: 5 (class_students 1 → Promise.all([class_textbooks, student_textbooks, progress]) 3 → student_id 인덱싱).
 * Class 우선 + schedule 비면 student schedule fallback.
 */
export async function listClassUnitProgressDetailed(
  classId: string
): Promise<ClassUnitProgressDetailed> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return { students: [], byStudent: {}, error: auth.error };
  const supabase = createAdminClient();

  const isStaff = await userIsStaff(supabase, auth.userId);
  if (!isStaff) {
    return { students: [], byStudent: {}, error: "권한이 없습니다." };
  }

  // 1. 학생 목록 (active) — 후속 쿼리에 student_ids 필요
  const { data: members } = await supabase
    .from("class_students")
    .select("student_id, students:students!inner(id, korean_name, english_name)")
    .eq("class_id", classId)
    .eq("is_active", true);
  const studentIds = (members ?? []).map((m) => m.student_id);
  const students = (members ?? [])
    .map((m) => {
      const s = Array.isArray(m.students) ? m.students[0] : m.students;
      return s
        ? {
            id: s.id,
            korean_name: s.korean_name,
            english_name: s.english_name,
          }
        : null;
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) =>
      (a.korean_name ?? "").localeCompare(b.korean_name ?? "", "ko")
    );

  if (!studentIds.length) return { students: [], byStudent: {} };

  // 2. 병렬: 반 textbooks / 개인 textbooks / unit progress
  const [classTbResult, studentTbResult, progressResult] = await Promise.all([
    supabase
      .from("class_textbooks")
      .select(
        "textbook_id, homework_days, skip_dates, start_date, start_unit, textbooks(id, title, level, cover_image_url, total_units, is_active, series:series_id(name))"
      )
      .eq("class_id", classId),
    supabase
      .from("student_textbooks")
      .select(
        "student_id, textbook_id, homework_days, skip_dates, start_date, start_unit, textbooks(id, title, level, cover_image_url, total_units, is_active, series:series_id(name))"
      )
      .in("student_id", studentIds),
    supabase
      .from("homework_unit_progress")
      .select("student_id, textbook_id, unit_number, status, completed_at, note")
      .in("student_id", studentIds),
  ]);

  const classRows = (classTbResult.data ?? []) as RawAssignmentRow[];
  const studentRowsRaw =
    (studentTbResult.data ?? []) as Array<RawAssignmentRow & { student_id: string }>;
  const progressRows = progressResult.data ?? [];

  // 3. progress 인덱싱
  const progressByKey = new Map<
    string,
    { status: UnitStatus; completedAt: string | null; note: string | null }
  >();
  for (const p of progressRows) {
    progressByKey.set(`${p.student_id}::${p.textbook_id}::${p.unit_number}`, {
      status: p.status as UnitStatus,
      completedAt: p.completed_at,
      note: p.note,
    });
  }

  // 4. 반 부여 → 모든 학생에게 적용
  const classMetaByTb = new Map<string, RowMeta>();
  for (const r of classRows) {
    const meta = rowToMeta(r, "class");
    if (meta && !classMetaByTb.has(meta.textbookId)) {
      classMetaByTb.set(meta.textbookId, meta);
    }
  }

  // 5. 개인 부여: studentId → textbookId → meta
  const studentMetaMap = new Map<string, Map<string, RowMeta>>();
  for (const r of studentRowsRaw) {
    const meta = rowToMeta(r, "student");
    if (!meta) continue;
    const inner = studentMetaMap.get(r.student_id) ?? new Map();
    if (!inner.has(meta.textbookId)) inner.set(meta.textbookId, meta);
    studentMetaMap.set(r.student_id, inner);
  }

  // 6. 학생별 책 합집합 (class 우선 + schedule fallback)
  const byStudent: Record<string, StudentTextbookUnits[]> = {};
  for (const student of students) {
    const personal = studentMetaMap.get(student.id);
    const merged = new Map<string, RowMeta>();

    // 반 부여 + schedule fallback
    for (const [tbId, classMeta] of classMetaByTb) {
      merged.set(tbId, mergeScheduleFallback(classMeta, personal?.get(tbId)));
    }
    // 개인 부여 (반에 없는 것만)
    if (personal) {
      for (const [tbId, meta] of personal.entries()) {
        if (!merged.has(tbId)) merged.set(tbId, meta);
      }
    }

    const list: StudentTextbookUnits[] = [];
    for (const meta of merged.values()) {
      list.push(buildUnits(meta, progressByKey, student.id));
    }
    byStudent[student.id] = list;
  }

  return { students, byStudent };
}

// ── Write ───────────────────────────────────────────────────────────────────

/**
 * 한 학생의 한 unit 의 status 변경 (admin only).
 *
 * Audit/UX 규칙:
 * - status='completed' → completed_at = now()
 * - status='pending' / 'missed' → completed_at = null
 * - marked_by = admin profile id (status 변경 추적용)
 * - note: FormData 에 "note" 키가 있을 때만 갱신. 없으면 기존 값 보존.
 *
 * row 가 없으면 insert (방어적). 정상 흐름은 트리거가 미리 만들어 둔 row 를 update.
 */
export async function markUnit(
  formData: FormData
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const studentId = (formData.get("studentId") as string)?.trim();
  const textbookId = (formData.get("textbookId") as string)?.trim();
  const unitNumberRaw = formData.get("unitNumber");
  const status = (formData.get("status") as string)?.trim() as UnitStatus;

  if (!studentId || !textbookId) {
    return { error: "학생과 책을 지정해 주세요." };
  }
  const unitNumber = unitNumberRaw ? parseInt(unitNumberRaw as string, 10) : NaN;
  if (!Number.isFinite(unitNumber) || unitNumber < 1) {
    return { error: "unit 번호가 올바르지 않습니다." };
  }
  if (!ALLOWED_STATUSES.has(status)) {
    return { error: "상태가 올바르지 않습니다." };
  }

  // note: FormData 에 명시 입력 시에만 갱신 (기존 값 보존)
  const noteProvided = formData.has("note");
  const noteRaw = formData.get("note");
  const noteValue: string | null = noteProvided
    ? typeof noteRaw === "string"
      ? noteRaw.trim() || null
      : null
    : null;

  const supabase = createAdminClient();

  // 기존 row 가 있으면 note 보존을 위해 미리 조회
  let existingNote: string | null = null;
  let rowExists = false;
  if (!noteProvided) {
    const { data: existing } = await supabase
      .from("homework_unit_progress")
      .select("note")
      .eq("student_id", studentId)
      .eq("textbook_id", textbookId)
      .eq("unit_number", unitNumber)
      .maybeSingle();
    if (existing) {
      rowExists = true;
      existingNote = existing.note;
    }
  }

  const finalNote = noteProvided ? noteValue : existingNote;
  const now = new Date().toISOString();

  type Upsert =
    Database["public"]["Tables"]["homework_unit_progress"]["Insert"];
  const payload: Upsert = {
    student_id: studentId,
    textbook_id: textbookId,
    unit_number: unitNumber,
    status,
    completed_at: status === "completed" ? now : null,
    marked_by: auth.userId,
    note: finalNote,
  };

  const { error } = await supabase
    .from("homework_unit_progress")
    .upsert(payload, { onConflict: "student_id,textbook_id,unit_number" });
  if (error) {
    logger.error("[markUnit]", error.message, { studentId, textbookId, unitNumber });
    return { error: error.message };
  }
  // rowExists 는 마커만 — 사이드 이펙트 없음
  void rowExists;
  revalidateAll();
  return {};
}

/**
 * 일괄 unit 마킹 (예: 한 책의 여러 unit 동시 변경).
 * note 는 보존 — 일괄 변경 시 status 만 바뀜.
 */
export async function bulkMarkUnits(
  records: Array<{
    studentId: string;
    textbookId: string;
    unitNumber: number;
    status: UnitStatus;
    note?: string | null;
  }>
): Promise<{ error?: string; saved: number }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error, saved: 0 };

  if (!records.length) return { saved: 0 };

  const now = new Date().toISOString();
  const supabase = createAdminClient();

  // note 가 명시되지 않은 record 들의 기존 값 미리 조회 (note 보존)
  const fetchKeys = records.filter((r) => r.note === undefined);
  const noteMap = new Map<string, string | null>();
  if (fetchKeys.length) {
    // 효율화: 학생/책 쌍별로 묶어서 조회
    const studentIds = [...new Set(fetchKeys.map((r) => r.studentId))];
    const textbookIds = [...new Set(fetchKeys.map((r) => r.textbookId))];
    const { data: existing } = await supabase
      .from("homework_unit_progress")
      .select("student_id, textbook_id, unit_number, note")
      .in("student_id", studentIds)
      .in("textbook_id", textbookIds);
    for (const e of existing ?? []) {
      noteMap.set(`${e.student_id}::${e.textbook_id}::${e.unit_number}`, e.note);
    }
  }

  const payloads: Database["public"]["Tables"]["homework_unit_progress"]["Insert"][] =
    [];
  for (const r of records) {
    if (!r.studentId || !r.textbookId) continue;
    if (!Number.isFinite(r.unitNumber) || r.unitNumber < 1) continue;
    if (!ALLOWED_STATUSES.has(r.status)) continue;
    const finalNote =
      r.note === undefined
        ? noteMap.get(`${r.studentId}::${r.textbookId}::${r.unitNumber}`) ?? null
        : r.note;
    payloads.push({
      student_id: r.studentId,
      textbook_id: r.textbookId,
      unit_number: r.unitNumber,
      status: r.status,
      completed_at: r.status === "completed" ? now : null,
      marked_by: auth.userId,
      note: finalNote,
    });
  }
  if (!payloads.length) return { saved: 0 };

  const { error, count } = await supabase
    .from("homework_unit_progress")
    .upsert(payloads, {
      onConflict: "student_id,textbook_id,unit_number",
      count: "exact",
    });
  if (error) {
    logger.error("[bulkMarkUnits]", error.message);
    return { error: error.message, saved: 0 };
  }
  revalidateAll();
  return { saved: count ?? payloads.length };
}

/**
 * unit 을 다시 pending 으로 되돌림 (row 는 보존 — archiving 정책).
 * note 는 보존.
 */
export async function clearUnit(
  studentId: string,
  textbookId: string,
  unitNumber: number
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  if (!studentId || !textbookId) return { error: "학생과 책을 지정해 주세요." };
  if (!Number.isFinite(unitNumber) || unitNumber < 1) {
    return { error: "unit 번호가 올바르지 않습니다." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("homework_unit_progress")
    .update({
      status: "pending",
      completed_at: null,
      marked_by: auth.userId,
    })
    .eq("student_id", studentId)
    .eq("textbook_id", textbookId)
    .eq("unit_number", unitNumber);
  if (error) {
    logger.error("[clearUnit]", error.message);
    return { error: error.message };
  }
  revalidateAll();
  return {};
}
