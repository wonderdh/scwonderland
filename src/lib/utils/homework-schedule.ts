/**
 * 학생별 "숙제 있는 날" 계산 헬퍼.
 *
 * 정의: 학생이 속한 반의 class_textbooks + 학생 개인 student_textbooks 의
 *      homework_days (요일 패턴) 에 매칭되고 skip_dates 에 없는 일자.
 *
 * 모든 날짜는 KST 기준 `YYYY-MM-DD` 문자열.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.generated";

export type HomeworkDayInfo = {
  /** YYYY-MM-DD (KST) */
  date: string;
  /** 0=일 ~ 6=토 (KST) */
  weekday: number;
  /** 그 날 숙제 있는 책 ID 들 (반·개인 합집합, 중복 제거) */
  textbookIds: string[];
};

/** YYYY-MM-DD 문자열을 KST 의 weekday (0=일~6=토) 로 변환. */
export function ymdToKstWeekday(ymd: string): number {
  // YYYY-MM-DD → UTC 자정으로 만들어 getUTCDay() — 같은 날짜의 요일은 KST 기준과 동일
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** 해당 연/월의 일 수 (1~말일). */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** YYYY, MM, DD → "YYYY-MM-DD" */
function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 학생의 한 달 동안 "숙제 있는 날" 계산.
 *
 * @param supabase admin client (RLS 우회 필요 — class_students/class_textbooks 조회)
 * @param studentId profiles.id (= auth.uid())
 * @param year 4자리 연도 (예: 2026)
 * @param month 1~12
 * @returns 숙제가 있는 일자의 정보 배열, 날짜순 정렬
 */
export async function getStudentHomeworkDays(
  supabase: SupabaseClient<Database>,
  studentId: string,
  year: number,
  month: number
): Promise<HomeworkDayInfo[]> {
  // 1. 학생이 속한 active 반 ID
  const { data: memberships } = await supabase
    .from("class_students")
    .select("class_id, is_active")
    .eq("student_id", studentId)
    .eq("is_active", true);
  const classIds = (memberships ?? []).map((m) => m.class_id);

  // 2. 반 부여 textbook (homework_days, skip_dates)
  const classRows = classIds.length
    ? (
        await supabase
          .from("class_textbooks")
          .select("textbook_id, homework_days, skip_dates")
          .in("class_id", classIds)
      ).data ?? []
    : [];

  // 3. 개인 부여
  const { data: studentRows } = await supabase
    .from("student_textbooks")
    .select("textbook_id, homework_days, skip_dates")
    .eq("student_id", studentId);

  // 4. textbook 별로 (homework_days 합집합, skip_dates 합집합)
  type Entry = { days: Set<number>; skipDates: Set<string> };
  const map = new Map<string, Entry>();
  const allRows = [...classRows, ...(studentRows ?? [])];
  for (const row of allRows) {
    const e = map.get(row.textbook_id) ?? { days: new Set(), skipDates: new Set() };
    for (const d of row.homework_days ?? []) e.days.add(d);
    for (const d of row.skip_dates ?? []) e.skipDates.add(d);
    map.set(row.textbook_id, e);
  }

  // 5. 그 달의 모든 일자 순회
  const total = daysInMonth(year, month);
  const result: HomeworkDayInfo[] = [];
  for (let day = 1; day <= total; day++) {
    const dateStr = ymd(year, month, day);
    const weekday = ymdToKstWeekday(dateStr);
    const textbookIds: string[] = [];
    for (const [tbId, e] of map.entries()) {
      if (!e.days.has(weekday)) continue;
      if (e.skipDates.has(dateStr)) continue;
      textbookIds.push(tbId);
    }
    if (textbookIds.length > 0) {
      result.push({ date: dateStr, weekday, textbookIds });
    }
  }
  return result;
}

/** 한 학생-한 일자에 숙제가 있는지 빠르게 확인 (record/update 시 검증용). */
export async function isHomeworkDayForStudent(
  supabase: SupabaseClient<Database>,
  studentId: string,
  date: string
): Promise<boolean> {
  const [y, m] = date.split("-").map(Number);
  const days = await getStudentHomeworkDays(supabase, studentId, y, m);
  return days.some((d) => d.date === date);
}

// ── Schedule (start_date + start_unit + homework_days + skip_dates) ────────

export type UnitAssignment = {
  /** YYYY-MM-DD (KST) */
  date: string;
  /** 1-based unit number */
  unit: number;
};

/** YYYY-MM-DD 의 다음 날을 YYYY-MM-DD 로 반환 (KST 안전). */
function nextDay(ymdStr: string): string {
  const [y, m, d] = ymdStr.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

/** YYYY-MM-DD 비교 (a < b 이면 negative). */
function ymdCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * 한 textbook 의 unit schedule 을 동적 계산.
 *
 * 규칙:
 * - `startDate` 부터 시작 (포함)
 * - 그 일자의 weekday 가 `homeworkDays` 에 있고 `skipDates` 에 없으면 unit 배정
 * - 첫 unit 은 `startUnit`, 이후 매번 +1
 * - 종료: unit 이 `totalUnits` 를 넘기면 중단 (남은 unit 없음)
 * - 안전장치: 최대 730일 순회 (2년 한도)
 *
 * @returns date 순 정렬된 UnitAssignment 배열. fromDate/toDate 로 잘라낼 수 있음.
 */
export function getUnitSchedule(params: {
  startDate: string;
  startUnit: number;
  totalUnits: number;
  homeworkDays: number[];
  skipDates: string[];
  /** 결과의 date 가 이 값 이상인 것만 반환 (옵션). */
  fromDate?: string;
  /** 결과의 date 가 이 값 이하인 것만 반환 (옵션). */
  toDate?: string;
}): UnitAssignment[] {
  const {
    startDate,
    startUnit,
    totalUnits,
    homeworkDays,
    skipDates,
    fromDate,
    toDate,
  } = params;

  const result: UnitAssignment[] = [];
  if (!startDate || !homeworkDays?.length) return result;
  if (startUnit > totalUnits) return result;

  const daySet = new Set(homeworkDays);
  const skipSet = new Set(skipDates ?? []);

  let currentDate = startDate;
  let currentUnit = startUnit;
  const MAX_ITER = 730;

  for (let i = 0; i < MAX_ITER; i++) {
    if (currentUnit > totalUnits) break;

    // toDate 를 넘어가면 중단 (이후는 결과에 못 들어감)
    if (toDate && ymdCompare(currentDate, toDate) > 0) break;

    const weekday = ymdToKstWeekday(currentDate);
    if (daySet.has(weekday) && !skipSet.has(currentDate)) {
      // fromDate 미만은 push 안 함, 단 unit counter 는 진행
      const inRange =
        (!fromDate || ymdCompare(currentDate, fromDate) >= 0) &&
        (!toDate || ymdCompare(currentDate, toDate) <= 0);
      if (inRange) {
        result.push({ date: currentDate, unit: currentUnit });
      }
      currentUnit++;
    }
    currentDate = nextDay(currentDate);
  }

  return result;
}

// ── Student-month schedule (반·개인 합집합) ──────────────────────────────

export type StudentDayUnit = {
  textbookId: string;
  textbookTitle: string | null;
  unit: number;
};

export type StudentDayUnits = {
  /** YYYY-MM-DD (KST) */
  date: string;
  items: StudentDayUnit[];
};

/**
 * 한 학생의 한 달 schedule (반·개인 부여 합집합).
 *
 * - 각 부여 row 가 start_date / start_unit 을 가져야 schedule 생성 (없으면 그 row 는 skip)
 * - textbook 의 total_units 까지 unit 진행
 * - 같은 textbook 이 양쪽(반/개인) 부여된 경우는 양쪽 schedule 모두 표시 (현실적으로 거의 없음)
 */
export async function getStudentMonthSchedule(
  supabase: SupabaseClient<Database>,
  studentId: string,
  year: number,
  month: number
): Promise<StudentDayUnits[]> {
  const last = daysInMonth(year, month);
  const fromDate = ymd(year, month, 1);
  const toDate = ymd(year, month, last);

  // 1. 학생 active 반
  const { data: memberships } = await supabase
    .from("class_students")
    .select("class_id, is_active")
    .eq("student_id", studentId)
    .eq("is_active", true);
  const classIds = (memberships ?? []).map((m) => m.class_id);

  // 2. 반 부여 (start_date 가 있는 것만)
  const classRows = classIds.length
    ? (
        await supabase
          .from("class_textbooks")
          .select(
            "textbook_id, homework_days, skip_dates, start_date, start_unit, textbooks(title, total_units)"
          )
          .in("class_id", classIds)
          .not("start_date", "is", null)
      ).data ?? []
    : [];

  // 3. 개인 부여
  const { data: studentRows } = await supabase
    .from("student_textbooks")
    .select(
      "textbook_id, homework_days, skip_dates, start_date, start_unit, textbooks(title, total_units)"
    )
    .eq("student_id", studentId)
    .not("start_date", "is", null);

  // 4. 각 row 별로 schedule 계산 후 date 별 grouping
  const byDate = new Map<string, StudentDayUnit[]>();
  const allRows = [...classRows, ...(studentRows ?? [])];

  for (const row of allRows) {
    if (!row.start_date) continue;
    const tb = Array.isArray(row.textbooks) ? row.textbooks[0] : row.textbooks;
    const totalUnits = tb?.total_units ?? 0;
    if (totalUnits <= 0) continue;

    const sched = getUnitSchedule({
      startDate: row.start_date,
      startUnit: row.start_unit ?? 1,
      totalUnits,
      homeworkDays: row.homework_days ?? [],
      skipDates: row.skip_dates ?? [],
      fromDate,
      toDate,
    });

    for (const a of sched) {
      const list = byDate.get(a.date) ?? [];
      list.push({
        textbookId: row.textbook_id,
        textbookTitle: tb?.title ?? null,
        unit: a.unit,
      });
      byDate.set(a.date, list);
    }
  }

  // 5. 정렬된 배열로 반환
  const result: StudentDayUnits[] = [];
  const sortedDates = [...byDate.keys()].sort();
  for (const date of sortedDates) {
    result.push({ date, items: byDate.get(date)! });
  }
  return result;
}
