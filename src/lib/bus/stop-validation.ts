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

/** `listServedStopBuses` 결과(요일 → 정류장 → 호차들) → `findUnassignedDays` 용 요일 → 정류장 ID 목록. */
export function toServedStopIds(
  servedBusesByDay: Record<number, Record<string, string[]>>
): Record<number, string[]> {
  const result: Record<number, string[]> = {};
  for (const [d, byStop] of Object.entries(servedBusesByDay)) result[Number(d)] = Object.keys(byStop);
  return result;
}

/** `listBusRouteRows` 결과 1행 = (요일, 호차, 정류장) 노선 배정. */
export type BusRouteRow = {
  day_of_week: number;
  bus_number_id: string;
  bus_stop_id: string;
  stop_name: string;
  sort_order: number | null;
};

/**
 * 호차 먼저 입력 UI 용 정류장 목록: 선택 호차가 선택 요일 **모두**에 운행하는 정류장만.
 * 정렬 = 가장 이른 요일의 노선 순서(sort_order), 동순위는 정류장 이름순.
 */
export function busRouteStops(
  rows: BusRouteRow[],
  busId: string,
  days: number[]
): { id: string; name: string }[] {
  const ds = [...new Set(days)];
  if (!busId || ds.length === 0) return [];
  const mine = rows.filter((r) => r.bus_number_id === busId);
  const firstDay = Math.min(...ds);
  return mine
    .filter(
      (r) =>
        r.day_of_week === firstDay &&
        ds.every((d) => mine.some((m) => m.day_of_week === d && m.bus_stop_id === r.bus_stop_id))
    )
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.stop_name.localeCompare(b.stop_name, "ko"))
    .map((r) => ({ id: r.bus_stop_id, name: r.stop_name }));
}

/**
 * 호차 미지정(레거시: 정류장만 저장된 행) 일 때 정류장을 선택 요일 모두에 운행하는 호차가 1대면 그 호차로 간주.
 * 호차가 지정돼 있거나 후보가 0·2대 이상이면 `busId` 그대로.
 */
export function inferRouteBus(rows: BusRouteRow[], busId: string, stopId: string, days: number[]): string {
  if (busId || !stopId) return busId;
  const ds = [...new Set(days)];
  const buses = [...new Set(rows.filter((r) => r.bus_stop_id === stopId).map((r) => r.bus_number_id))].filter((b) =>
    ds.every((d) => rows.some((r) => r.day_of_week === d && r.bus_number_id === b && r.bus_stop_id === stopId))
  );
  return buses.length === 1 ? buses[0] : busId;
}

/**
 * 서버 mutation 용 호차 확정 (strict). `buses` = 그 요일·시간대에 정류장을 운행하는 호차들.
 * - 운행 호차 없음 → 미배정 에러
 * - 요청 호차가 있으면 운행 호차 중 하나여야 함
 * - 요청 없고 1대면 자동 지정, 2대 이상이면 선택 요구
 */
export function pickServedBus(
  buses: string[] | undefined,
  requestedBusId?: string | null
): { busId: string } | { error: string } {
  if (!buses?.length) return { error: "선택한 정류장이 해당 요일·시간대에 배정되어 있지 않습니다." };
  if (requestedBusId) {
    return buses.includes(requestedBusId)
      ? { busId: requestedBusId }
      : { error: "선택한 호차가 해당 요일·시간대에 이 정류장을 운행하지 않습니다." };
  }
  if (buses.length === 1) return { busId: buses[0] };
  return { error: "여러 호차가 운행하는 정류장입니다. 호차를 선택해 주세요." };
}
