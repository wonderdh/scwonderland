/**
 * 버스 도메인 Server Actions 공유 헬퍼.
 *
 * 여러 bus-*.ts 파일에서 재사용되는 stop→bus 매핑 빌더 및 관련 타입.
 * 이 파일은 실제로 Server Action이 아니므로 "use server" 선언을 하지 않음 —
 * Server Action 파일에서 import하여 사용.
 *
 * export type은 "use server" 파일에서 금지되므로 여기(`_helpers.ts`)에서 정의하고
 * 필요한 곳에서 `import type`으로 가져간다.
 */
import type { createAdminClient } from "@/lib/supabase/admin";

export type StopBusInfo = { busId: string; sortOrder: number };

export type StopBusMaps = {
  getBySlot: (stopId: string, slotId: string | null) => string | null;
  getSortOrder: (stopId: string, slotId: string | null) => number | null;
  allBusIds: string[];
};

/**
 * 시간대별 정확한 stop→bus 매핑 + sort_order를 단일 쿼리로 로드한다.
 * 해당 요일의 bus_stop_day_assignments를 모두 읽어 slot별/null 매핑을 구성.
 *
 * 해석 우선순위:
 *  1) 요청한 slotId와 동일한 slot 매핑이 있으면 그것
 *  2) slot=null 폴백 매핑
 *  3) 아무 slot의 매핑 (마지막 수단)
 */
export async function buildStopToBusMaps(
  supabase: ReturnType<typeof createAdminClient>,
  dayOfWeek: number
): Promise<StopBusMaps> {
  const { data, error } = await supabase
    .from("bus_stop_day_assignments")
    .select("bus_stop_id, bus_number_id, bus_time_slot_id, sort_order")
    .eq("day_of_week", dayOfWeek);

  if (error || !data) return { getBySlot: () => null, getSortOrder: () => null, allBusIds: [] };

  const slotMaps = new Map<string, Map<string, StopBusInfo>>();
  const nullSlotMap = new Map<string, StopBusInfo>();
  const busIdSet = new Set<string>();

  for (const row of data) {
    busIdSet.add(row.bus_number_id);
    const info: StopBusInfo = { busId: row.bus_number_id, sortOrder: row.sort_order ?? 0 };
    if (row.bus_time_slot_id) {
      if (!slotMaps.has(row.bus_time_slot_id)) slotMaps.set(row.bus_time_slot_id, new Map());
      slotMaps.get(row.bus_time_slot_id)!.set(row.bus_stop_id, info);
    } else {
      nullSlotMap.set(row.bus_stop_id, info);
    }
  }

  function resolve(stopId: string, slotId: string | null): StopBusInfo | null {
    if (slotId) {
      const m = slotMaps.get(slotId);
      if (m?.has(stopId)) return m.get(stopId)!;
    }
    if (nullSlotMap.has(stopId)) return nullSlotMap.get(stopId)!;
    for (const [, m] of slotMaps) {
      if (m.has(stopId)) return m.get(stopId)!;
    }
    return null;
  }

  return {
    getBySlot: (stopId, slotId) => resolve(stopId, slotId)?.busId ?? null,
    getSortOrder: (stopId, slotId) => resolve(stopId, slotId)?.sortOrder ?? null,
    allBusIds: [...busIdSet],
  };
}

/**
 * strict 배정 판정용: 주어진 요일들 × 시간대에 "운행되는 정류장 ID" 를 요일별로 반환한다.
 *
 * "배정됨" = 그 요일에 `bus_time_slot_id = slotId` **또는** `bus_time_slot_id IS NULL`(기본 슬롯)
 * 인 `bus_stop_day_assignments` 행이 존재. `buildStopToBusMaps` 의 resolve 가 갖는 "임의 slot
 * 폴백"(3순위)은 **적용하지 않는다** — 정류장 미배정 검증은 "해당 시간대" 특정성을 유지해야 하므로.
 *
 * slotId 가 빈 문자열이거나 요일이 없으면 `{}` 반환(판정 불가 신호).
 */
export async function getServedStopIdsByDay(
  supabase: ReturnType<typeof createAdminClient>,
  daysOfWeek: number[],
  slotId: string
): Promise<Record<number, string[]>> {
  const uniqueDays = [...new Set(daysOfWeek)].filter((d) => Number.isFinite(d));
  if (uniqueDays.length === 0 || !slotId) return {};

  const { data, error } = await supabase
    .from("bus_stop_day_assignments")
    .select("bus_stop_id, bus_time_slot_id, day_of_week")
    .in("day_of_week", uniqueDays);

  const sets = new Map<number, Set<string>>(uniqueDays.map((d) => [d, new Set<string>()]));
  if (!error && data) {
    for (const row of data) {
      if (row.bus_time_slot_id === slotId || row.bus_time_slot_id === null) {
        sets.get(row.day_of_week)?.add(row.bus_stop_id);
      }
    }
  }

  const result: Record<number, string[]> = {};
  for (const d of uniqueDays) result[d] = [...(sets.get(d) ?? [])];
  return result;
}

/**
 * 단일 (요일, 시간대, 정류장) strict 배정 여부. 서버 mutation 가드용.
 * slotId/stopId 미지정이면 판정 불가 → `true`(통과).
 */
export async function isStopServed(
  supabase: ReturnType<typeof createAdminClient>,
  dayOfWeek: number,
  slotId: string,
  stopId: string
): Promise<boolean> {
  if (!slotId || !stopId) return true;
  const served = await getServedStopIdsByDay(supabase, [dayOfWeek], slotId);
  return (served[dayOfWeek] ?? []).includes(stopId);
}
