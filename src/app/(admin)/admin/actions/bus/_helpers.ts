/**
 * 버스 도메인 Server Actions 공유 헬퍼.
 *
 * 여러 bus-*.ts 파일에서 재사용되는 stop→bus 매핑 빌더 및 관련 타입.
 * 이 파일은 실제로 Server Action이 아니므로 "use server" 선언을 하지 않음 —
 * Server Action 파일에서 import하여 사용.
 *
 * export type은 "use server" 파일에서 금지되므로 여기(`_helpers.ts`)에서 정의하고
 * 필요한 곳에서 `import type`으로 가져간다.
 *
 * 정류장은 여러 호차가 공유할 수 있다 (같은 요일·시간대에 2대 이상).
 * 학생 호차는 `student_bus_defaults.bus_number_id` 가 정본이고, 정류장 역추적은
 * 그 값이 null 일 때 + 정류장을 운행하는 호차가 정확히 1대일 때만 폴백으로 쓴다.
 */
import type { createAdminClient } from "@/lib/supabase/admin";
import { toServedStopIds } from "@/lib/bus/stop-validation";

export type StopBusMaps = {
  /** 정류장을 운행하는 호차 목록 (해석 우선순위 1→2 중 처음 매칭되는 단계의 호차들). */
  getBusesBySlot: (stopId: string, slotId: string | null) => string[];
  /** 학생 호차 해석: 저장된 호차 우선, 없으면 정류장 운행 호차가 1대일 때만 그 호차. 공유 정류장은 null(추측 안 함). */
  resolveBus: (storedBusId: string | null | undefined, stopId: string | null, slotId: string | null) => string | null;
  /** (호차, 정류장) 의 운행 순서. 같은 해석 우선순위 적용. */
  getSortOrder: (busId: string, stopId: string, slotId: string | null) => number | null;
  allBusIds: string[];
};

type AssignmentRow = { bus_stop_id: string; bus_number_id: string; bus_time_slot_id: string; sort_order: number | null };

/**
 * 시간대별 stop→buses 매핑 + (호차, 정류장) sort_order를 단일 쿼리로 로드한다.
 * 해당 요일의 bus_stop_day_assignments를 모두 읽어 정류장별 행 목록을 구성.
 *
 * 해석 우선순위 (정류장 단위):
 *  1) 요청한 slotId와 동일한 slot 매핑이 있으면 그것들
 *  2) 아무 slot의 매핑들 (마지막 수단)
 */
export async function buildStopToBusMaps(
  supabase: ReturnType<typeof createAdminClient>,
  dayOfWeek: number
): Promise<StopBusMaps> {
  const { data, error } = await supabase
    .from("bus_stop_day_assignments")
    .select("bus_stop_id, bus_number_id, bus_time_slot_id, sort_order")
    .eq("day_of_week", dayOfWeek);

  const rowsByStop = new Map<string, AssignmentRow[]>();
  for (const row of error ? [] : (data ?? [])) {
    const list = rowsByStop.get(row.bus_stop_id) ?? [];
    list.push(row);
    rowsByStop.set(row.bus_stop_id, list);
  }

  function resolveRows(stopId: string, slotId: string | null): AssignmentRow[] {
    const rows = rowsByStop.get(stopId) ?? [];
    if (slotId) {
      const exact = rows.filter((r) => r.bus_time_slot_id === slotId);
      if (exact.length) return exact;
    }
    return rows;
  }

  function getBusesBySlot(stopId: string, slotId: string | null): string[] {
    return [...new Set(resolveRows(stopId, slotId).map((r) => r.bus_number_id))];
  }

  return {
    getBusesBySlot,
    resolveBus: (storedBusId, stopId, slotId) => {
      if (storedBusId) return storedBusId;
      if (!stopId) return null;
      const buses = getBusesBySlot(stopId, slotId);
      return buses.length === 1 ? buses[0] : null;
    },
    getSortOrder: (busId, stopId, slotId) => {
      const row = resolveRows(stopId, slotId).find((r) => r.bus_number_id === busId);
      return row ? (row.sort_order ?? 0) : null;
    },
    allBusIds: [...new Set((data ?? []).map((r) => r.bus_number_id))],
  };
}

/**
 * strict 배정 판정용: 주어진 요일들 × 시간대에 정류장별 "운행 호차 목록" 을 요일별로 반환한다.
 *
 * "배정됨" = 그 요일에 `bus_time_slot_id = slotId` 인 `bus_stop_day_assignments` 행이 존재.
 * `buildStopToBusMaps` 의 "임의 slot 폴백"(2순위)은 **적용하지 않는다** — 정류장 미배정 검증은
 * "해당 시간대" 특정성을 유지해야 하므로.
 *
 * slotId 가 빈 문자열이거나 요일이 없으면 `{}` 반환(판정 불가 신호).
 */
export async function getServedStopBusesByDay(
  supabase: ReturnType<typeof createAdminClient>,
  daysOfWeek: number[],
  slotId: string
): Promise<Record<number, Record<string, string[]>>> {
  const uniqueDays = [...new Set(daysOfWeek)].filter((d) => Number.isFinite(d));
  if (uniqueDays.length === 0 || !slotId) return {};

  const { data, error } = await supabase
    .from("bus_stop_day_assignments")
    .select("bus_stop_id, bus_number_id, day_of_week")
    .in("day_of_week", uniqueDays)
    .eq("bus_time_slot_id", slotId);

  const result: Record<number, Record<string, string[]>> = {};
  for (const d of uniqueDays) result[d] = {};
  for (const row of error ? [] : (data ?? [])) {
    const buses = (result[row.day_of_week][row.bus_stop_id] ??= []);
    if (!buses.includes(row.bus_number_id)) buses.push(row.bus_number_id);
  }
  return result;
}

/** 요일별 운행 정류장 ID (호차 무관). `getServedStopBusesByDay` 의 정류장 키만. */
export async function getServedStopIdsByDay(
  supabase: ReturnType<typeof createAdminClient>,
  daysOfWeek: number[],
  slotId: string
): Promise<Record<number, string[]>> {
  return toServedStopIds(await getServedStopBusesByDay(supabase, daysOfWeek, slotId));
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

/** 단일 (요일, 시간대, 정류장) 을 **그 호차가** 운행하는지 strict 판정. */
export async function isStopServedByBus(
  supabase: ReturnType<typeof createAdminClient>,
  dayOfWeek: number,
  slotId: string,
  stopId: string,
  busId: string
): Promise<boolean> {
  const served = await getServedStopBusesByDay(supabase, [dayOfWeek], slotId);
  return (served[dayOfWeek]?.[stopId] ?? []).includes(busId);
}
