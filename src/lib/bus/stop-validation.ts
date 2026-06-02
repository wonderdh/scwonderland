/**
 * 정류장 미배정 검증용 순수 유틸 (클라이언트/서버 공용, DB 의존 없음).
 *
 * "배정됨" 판정 데이터(`servedByDay`)는 `listServedStopIds` 서버 액션이 제공한다.
 * 여기서는 선택된 요일들에 대해 선택 정류장이 미배정인 요일을 가려낸다.
 *
 * 런타임 import 없는 self-contained 순수 모듈로 유지(단위 테스트 용이). 요일 라벨은
 * `@/lib/constants/date` 의 `WEEKDAY_NAMES_5` 와 동일.
 */
const WEEKDAY_LABELS = ["월", "화", "수", "목", "금"] as const;

/** "YYYY-MM-DD" → ISO 요일(1=월 ~ 7=일). 버스 `day_of_week`(1~5) 컨벤션과 동일. */
export function dowFromYmd(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  const dow = new Date(y, (m ?? 1) - 1, d ?? 1).getDay(); // 0=일 ~ 6=토
  return dow === 0 ? 7 : dow;
}

/**
 * 선택 정류장이 미배정인 요일 목록을 반환한다. 비어 있으면 통과(저장 허용).
 *
 * - `stopId` 가 비면 검증 대상 아님 → `[]`.
 * - `servedByDay` 에 해당 요일 키가 없으면(미조회/판정 불가) 그 요일은 보류(통과 처리).
 */
export function findUnassignedDays(
  servedByDay: Record<number, string[]>,
  days: number[],
  stopId: string
): number[] {
  if (!stopId) return [];
  return [...new Set(days)].filter((d) => {
    const served = servedByDay[d];
    if (served === undefined) return false; // 판정 보류
    return !served.includes(stopId);
  });
}

/** 요일 번호 목록 → "화·목" 형태 라벨. */
export function formatWeekdayList(days: number[]): string {
  return [...new Set(days)]
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_LABELS[d - 1] ?? String(d))
    .join("·");
}
