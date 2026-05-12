/**
 * (Deprecated) 학생별 "숙제 있는 날" / unit schedule 계산.
 *
 * 의존하던 컬럼 (`homework_days`, `skip_dates`, `start_unit`) 이
 * 20260515000000 마이그레이션에서 제거됨.
 *
 * 호출부 호환을 위해 함수 시그너처는 유지하지만, DB 쿼리 기반 함수들은
 * 항상 빈 배열을 반환한다. unit ↔ 날짜 매핑은 재설계 후 별도 PR 에서 복원.
 *
 * 순수 함수 `getUnitSchedule` 는 입력만 받으면 동작하므로 그대로 유지.
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
 * @deprecated homework_days/skip_dates 컬럼 제거 — 항상 빈 배열 반환.
 */
export async function getStudentHomeworkDays(
  _supabase: SupabaseClient<Database>,
  _studentId: string,
  _year: number,
  _month: number
): Promise<HomeworkDayInfo[]> {
  return [];
}

/** @deprecated 항상 false 반환. */
export async function isHomeworkDayForStudent(
  _supabase: SupabaseClient<Database>,
  _studentId: string,
  _date: string
): Promise<boolean> {
  return false;
}

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

function ymdCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * 순수 함수 — 입력만 받으면 unit ↔ 날짜 매핑 계산.
 * DB 의존성 없음. UI preview 등에서 사용 가능.
 */
export function getUnitSchedule(params: {
  startDate: string;
  startUnit: number;
  totalUnits: number;
  homeworkDays: number[];
  skipDates: string[];
  fromDate?: string;
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
    if (toDate && ymdCompare(currentDate, toDate) > 0) break;

    const weekday = ymdToKstWeekday(currentDate);
    if (daySet.has(weekday) && !skipSet.has(currentDate)) {
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
 * @deprecated homework_days/skip_dates/start_unit 컬럼 제거 — 항상 빈 배열 반환.
 */
export async function getStudentMonthSchedule(
  _supabase: SupabaseClient<Database>,
  _studentId: string,
  _year: number,
  _month: number
): Promise<StudentDayUnits[]> {
  // 사용 ID 들이 unused warning 회피용
  void ymd;
  void daysInMonth;
  return [];
}
