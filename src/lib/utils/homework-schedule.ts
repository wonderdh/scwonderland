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

// ── 검사일(grading date) 검증 ────────────────────────────────────────────────

export type GradingDateInvalidReason =
  | "weekend"
  | "not_meet_day"
  | "closed_day"
  | "skip_day";

export type GradingDateValidation =
  | { ok: true }
  | { ok: false; reason: GradingDateInvalidReason };

/** UI/서버 액션에서 그대로 쓸 수 있는 사용자 친화 한글 메시지. */
export const GRADING_DATE_ERROR_MESSAGES: Record<GradingDateInvalidReason, string> = {
  weekend: "검사일은 평일(월~금)이어야 합니다.",
  not_meet_day: "검사일은 반의 수업 요일 중에서 선택해야 합니다.",
  closed_day: "검사일이 학원 휴원일과 겹칩니다.",
  skip_day: "검사일이 이 책의 예외일(skip)과 겹칩니다.",
};

/**
 * 검사일(grading day) 유효성 검사 — 순수 함수.
 *
 *   - `weekend`: 토/일이면 무조건 reject.
 *   - `not_meet_day`: 반의 등원 요일(`meetDays`)에 속해야 함. 빈 배열은 "정보 없음" 으로 보고 통과시킴 (서버 진입점에서 별도로 보장).
 *   - `closed_day`: 학원 공통 휴원일 목록(`closedDates`)에 겹치면 reject.
 *   - `skip_day`: 이 책의 책별 예외일(`skipDates`)에 겹치면 reject.
 *
 * date 는 YYYY-MM-DD KST 라고 가정 (서버 액션의 `ISO_DATE_RE` 통과 후 호출).
 */
export function isValidGradingDate(
  date: string,
  meetDays: number[],
  closedDates: string[],
  skipDates: string[]
): GradingDateValidation {
  const wd = ymdToKstWeekday(date);
  if (wd === 0 || wd === 6) return { ok: false, reason: "weekend" };
  if (meetDays.length > 0 && !meetDays.includes(wd)) {
    return { ok: false, reason: "not_meet_day" };
  }
  if (closedDates.includes(date)) return { ok: false, reason: "closed_day" };
  if (skipDates.includes(date)) return { ok: false, reason: "skip_day" };
  return { ok: true };
}

/** YYYY-MM-DD 의 다음 날을 YYYY-MM-DD 로 반환 (KST 안전). */
function nextDay(ymdStr: string): string {
  const [y, m, d] = ymdStr.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

/** YYYY-MM-DD 의 전날을 YYYY-MM-DD 로 반환 (KST 안전). */
function prevDay(ymdStr: string): string {
  const [y, m, d] = ymdStr.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d - 1));
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}-${String(prev.getUTCDate()).padStart(2, "0")}`;
}

function ymdCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * 순수 함수 — 입력만 받으면 unit ↔ **채점일** 매핑 계산.
 * DB 의존성 없음. UI preview 등에서 사용 가능.
 *
 * 의미 (★채점일 기준★):
 *  - `startDate` 는 **`startUnit` 을 채점하는 날**이다 ("이 날까지 해 와라" 의 그 날).
 *  - unit 은 `homeworkDays`(부여 요일)에 1씩 부여되고,
 *    그 부여분의 채점일 = 부여일의 **다음 등원일**(`meetDays`, skipDates 제외).
 *  - 즉 반환 `date` 는 채점일, `unit` 은 그 채점일에 채점하는 unit.
 *  - `startDate` 가 채점일 달력에 정확히 없으면, startDate **이후 첫 채점일**에 startUnit 을 앉힌다.
 *  - `meetDays` 또는 `homeworkDays` 가 비어 있으면 schedule 비활성 (빈 배열).
 *  - `skipDates` 는 부여일·채점일 양쪽에서 제외.
 *  - `fromDate`/`toDate` 비교는 채점일 기준.
 */
export function getUnitSchedule(params: {
  startDate: string;
  startUnit: number;
  totalUnits: number;
  /** unit 이 "부여되는" 요일 (0=일~6=토, KST). */
  homeworkDays: number[];
  /** 학생이 학원에 오는(=채점 후보) 요일 (0=일~6=토, KST). */
  meetDays: number[];
  skipDates: string[];
  /** fromDate/toDate 비교는 채점일 기준. */
  fromDate?: string;
  toDate?: string;
}): UnitAssignment[] {
  const {
    startDate,
    startUnit,
    totalUnits,
    homeworkDays,
    meetDays,
    skipDates,
    fromDate,
    toDate,
  } = params;

  const result: UnitAssignment[] = [];
  if (!startDate || !homeworkDays?.length || !meetDays?.length) return result;
  if (
    !Number.isInteger(startUnit) ||
    startUnit < 1 ||
    startUnit > totalUnits
  ) {
    return result;
  }

  const hwSet = new Set(homeworkDays);
  const meetSet = new Set(meetDays);
  const skipSet = new Set(skipDates ?? []);
  const MAX_ITER = 730;

  /** fromYmd(포함)부터 가장 가까운 등원일(skip 제외). 없으면 null. */
  function nextMeetDay(fromYmd: string): string | null {
    let cur = fromYmd;
    for (let i = 0; i < MAX_ITER; i++) {
      const wd = ymdToKstWeekday(cur);
      if (meetSet.has(wd) && !skipSet.has(cur)) return cur;
      cur = nextDay(cur);
    }
    return null;
  }

  /** 부여일 → 채점일 (부여일 다음 등원일). */
  function gradingDayFor(issueYmd: string): string | null {
    return nextMeetDay(nextDay(issueYmd));
  }

  function inRange(date: string): boolean {
    return (
      (!fromDate || ymdCompare(date, fromDate) >= 0) &&
      (!toDate || ymdCompare(date, toDate) <= 0)
    );
  }

  /** fromYmd 에서 direction(+1/-1) 방향으로 부여 요일(skip 제외)을 max 개 수집. */
  function collectIssueDays(
    fromYmd: string,
    direction: 1 | -1,
    max: number
  ): string[] {
    const days: string[] = [];
    let cur = fromYmd;
    for (let i = 0; i < MAX_ITER && days.length < max; i++) {
      const wd = ymdToKstWeekday(cur);
      if (hwSet.has(wd) && !skipSet.has(cur)) days.push(cur);
      cur = direction > 0 ? nextDay(cur) : prevDay(cur);
    }
    return days;
  }

  // unit 1 ~ totalUnits 를 모두 덮을 만큼 부여일을 앞뒤로 수집.
  const maxNeeded = totalUnits + 2;
  const backward = collectIssueDays(prevDay(startDate), -1, maxNeeded); // 최근→과거
  const forward = collectIssueDays(startDate, 1, maxNeeded); // startDate 포함→미래
  const issueDays = [...backward.reverse(), ...forward]; // 시간순(오름차순)

  // 부여일 → 채점일 이벤트 (시간순). 채점일 계산 불가한 건 제외.
  const events = issueDays
    .map((issue) => ({ issue, grading: gradingDayFor(issue) }))
    .filter((e): e is { issue: string; grading: string } => e.grading !== null);

  if (events.length === 0) return result;

  // 앵커: 채점일이 startDate 이상인 첫 이벤트 = startUnit.
  const anchorIdx = events.findIndex(
    (e) => ymdCompare(e.grading, startDate) >= 0
  );
  if (anchorIdx === -1) return result;

  for (let k = 0; k < events.length; k++) {
    const unit = startUnit + (k - anchorIdx);
    if (unit < 1 || unit > totalUnits) continue;
    const date = events[k].grading;
    if (inRange(date)) result.push({ date, unit });
  }

  result.sort((a, b) => a.unit - b.unit);
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
