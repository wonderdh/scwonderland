/**
 * KST (Asia/Seoul) 기준 날짜/시간 헬퍼.
 *
 * 프로젝트 규칙:
 * - DB의 `DATE` 컬럼(attendance_date 등)은 KST 달력 기준 `YYYY-MM-DD` 문자열로 저장.
 * - DB의 `TIMESTAMPTZ` 컬럼(created_at/updated_at 등)은 서버·클라이언트 모두 KST로 표시.
 * - 절대로 `new Date().toISOString().slice(0,10)`처럼 UTC 기반 계산을 쓰지 말 것
 *   (서버가 KST가 아니거나 자정 경계에서 하루가 밀림).
 */

const KST = "Asia/Seoul";

const YMD_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: KST,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const DATETIME_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  timeZone: KST,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  timeZone: KST,
  year: "numeric",
  month: "long",
  day: "numeric",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  timeZone: KST,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function toDate(input?: Date | string | number | null): Date {
  if (input == null) return new Date();
  if (input instanceof Date) return input;
  return new Date(input);
}

/**
 * KST 기준 `YYYY-MM-DD` 문자열. DB `DATE` 컬럼에 insert 할 때 반드시 사용.
 * @example todayKst() // "2026-04-09"
 */
export function todayKst(): string {
  return formatDateYmdKst(new Date());
}

/**
 * 임의의 Date/ISO 문자열을 KST 기준 `YYYY-MM-DD`로 포맷.
 */
export function formatDateYmdKst(input?: Date | string | number | null): string {
  // en-CA 로케일은 항상 `YYYY-MM-DD` 포맷을 반환한다.
  return YMD_FORMATTER.format(toDate(input));
}

/**
 * KST 기준 사람이 읽기 좋은 날짜/시간 (`2026. 04. 09. 15:30`).
 */
export function formatDateTimeKst(input?: Date | string | number | null): string {
  return DATETIME_FORMATTER.format(toDate(input));
}

/**
 * KST 기준 사람이 읽기 좋은 날짜 (`2026년 4월 9일`).
 */
export function formatDateKst(input?: Date | string | number | null): string {
  return DATE_FORMATTER.format(toDate(input));
}

/**
 * KST 기준 시분 (`15:30`).
 */
export function formatTimeKst(input?: Date | string | number | null): string {
  return TIME_FORMATTER.format(toDate(input));
}

/**
 * KST 기준 현재 연/월/일. (getMonth는 1-based로 반환)
 */
export function nowKstParts(): { year: number; month: number; day: number } {
  const parts = YMD_FORMATTER.formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  return { year, month, day };
}

/**
 * MultiDatePicker 초기값용 Date 배열. 평일이면 `[오늘]`, 주말이면 `[]`.
 * 출결/버스 등 날짜 선택 폼에서 기본값으로 사용.
 */
export function todayWeekdayArray(): Date[] {
  const { year, month, day } = nowKstParts();
  const d = new Date(year, month - 1, day);
  const dow = d.getDay(); // 0=일, 6=토
  if (dow === 0 || dow === 6) return [];
  return [d];
}
