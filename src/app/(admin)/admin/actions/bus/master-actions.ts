"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdmin, verifyAuthenticated } from "../auth-helpers";
import { logger } from "@/lib/server/logger";
import type {
  BusNumber,
  BusTimeSlot,
  BusStop,
  BusStopDayAssignment,
  BusStopSchedule,
} from "@/lib/types";
import type { Database } from "@/lib/types/database.generated";
import { getServedStopBusesByDay } from "./_helpers";

// ── 호차 CRUD ──

export async function listBusNumbers(): Promise<BusNumber[]> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bus_numbers")
    .select("*")
    .eq("is_active", true)
    .order("label");
  if (error) {
    logger.error("[listBusNumbers]", error.message);
    return [];
  }
  return data as BusNumber[];
}

export async function createBusNumber(
  label: string
): Promise<{ error?: string; id?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const trimmed = label.trim();
  if (!trimmed) return { error: "호차 이름을 입력해 주세요." };

  const { data, error } = await supabase
    .from("bus_numbers")
    .insert({ label: trimmed })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "이미 존재하는 호차 이름입니다." };
    logger.error("[createBusNumber]", error.message);
    return { error: error.message };
  }
  return { id: data.id };
}

export async function updateBusNumber(
  id: string,
  label: string
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const trimmed = label.trim();
  if (!trimmed) return { error: "호차 이름을 입력해 주세요." };

  const { error } = await supabase
    .from("bus_numbers")
    .update({ label: trimmed, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") return { error: "이미 존재하는 호차 이름입니다." };
    logger.error("[updateBusNumber]", error.message);
    return { error: error.message };
  }
  return {};
}

export async function deleteBusNumber(id: string): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("bus_numbers")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    logger.error("[deleteBusNumber]", error.message);
    return { error: error.message };
  }
  return {};
}

// ── 버스 시간대 CRUD ──

// @auth-skip: 로그인 없이 쓰는 TV 모니터(/bus-monitor)가 호출하는 read-only 조회
export async function listBusTimeSlots(): Promise<BusTimeSlot[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bus_time_slots")
    .select("*")
    .eq("is_active", true)
    .order("time");
  if (error) {
    logger.error("[listBusTimeSlots]", error.message);
    return [];
  }
  return data as BusTimeSlot[];
}

export async function createBusTimeSlot(
  label: string,
  time: string,
  showEmptyStops: boolean = false
): Promise<{ error?: string; id?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const trimmed = label.trim();
  if (!trimmed) return { error: "시간대 이름을 입력해 주세요." };
  if (!time) return { error: "시간을 입력해 주세요." };

  const { data, error } = await supabase
    .from("bus_time_slots")
    .insert({ label: trimmed, time, show_empty_stops: showEmptyStops })
    .select("id")
    .single();
  if (error) {
    logger.error("[createBusTimeSlot]", error.message);
    return { error: error.message };
  }
  return { id: data.id };
}

export async function updateBusTimeSlot(
  id: string,
  label: string,
  time: string,
  showEmptyStops?: boolean
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const trimmed = label.trim();
  if (!trimmed) return { error: "시간대 이름을 입력해 주세요." };

  const patch: Database["public"]["Tables"]["bus_time_slots"]["Update"] = {
    label: trimmed,
    time,
    updated_at: new Date().toISOString(),
  };
  if (typeof showEmptyStops === "boolean") {
    patch.show_empty_stops = showEmptyStops;
  }

  const { error } = await supabase
    .from("bus_time_slots")
    .update(patch)
    .eq("id", id);
  if (error) {
    logger.error("[updateBusTimeSlot]", error.message);
    return { error: error.message };
  }
  return {};
}

export async function deleteBusTimeSlot(id: string): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("bus_time_slots")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    logger.error("[deleteBusTimeSlot]", error.message);
    return { error: error.message };
  }
  return {};
}

// ── 정류장 CRUD ──

export async function listBusStops(): Promise<BusStop[]> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bus_stops")
    .select("*")
    .eq("is_active", true)
    .order("name");
  if (error) {
    logger.error("[listBusStops]", error.message);
    return [];
  }
  return data as BusStop[];
}

export async function createBusStop(
  name: string
): Promise<{ error?: string; id?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const trimmed = name.trim();
  if (!trimmed) return { error: "정류장 이름을 입력해 주세요." };

  const { data, error } = await supabase
    .from("bus_stops")
    .insert({ name: trimmed })
    .select("id")
    .single();
  if (error) {
    logger.error("[createBusStop]", error.message);
    return { error: error.message };
  }
  return { id: data.id };
}

export async function updateBusStop(
  id: string,
  name: string
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const trimmed = name.trim();
  if (!trimmed) return { error: "정류장 이름을 입력해 주세요." };

  const { error } = await supabase
    .from("bus_stops")
    .update({ name: trimmed, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    logger.error("[updateBusStop]", error.message);
    return { error: error.message };
  }
  return {};
}

export async function deleteBusStop(id: string): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();

  // 1. bus_stop_day_assignments 삭제
  const { error: dayAssignErr } = await supabase
    .from("bus_stop_day_assignments")
    .delete()
    .eq("bus_stop_id", id);
  if (dayAssignErr) {
    logger.error("[deleteBusStop] day_assignments", dayAssignErr.message);
    return { error: dayAssignErr.message };
  }

  // 2. bus_stop_schedules 삭제
  const { error: schedulesErr } = await supabase
    .from("bus_stop_schedules")
    .delete()
    .eq("bus_stop_id", id);
  if (schedulesErr) {
    logger.error("[deleteBusStop] schedules", schedulesErr.message);
    return { error: schedulesErr.message };
  }

  // 3. student_bus_defaults 참조 null 처리
  const { error: defaultsErr } = await supabase
    .from("student_bus_defaults")
    .update({ bus_stop_id: null, bus_number_id: null, updated_at: new Date().toISOString() })
    .eq("bus_stop_id", id);
  if (defaultsErr) {
    logger.error("[deleteBusStop] defaults", defaultsErr.message);
    return { error: defaultsErr.message };
  }

  // 4. bus_stops 소프트 삭제
  const { error } = await supabase
    .from("bus_stops")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    logger.error("[deleteBusStop]", error.message);
    return { error: error.message };
  }
  return {};
}

// ── 요일별 정류장-호차 배정 ──
// 한 정류장이 같은 요일·시간대에 여러 호차에 배정될 수 있다 (호차별 1행, sort_order 는 호차 내 순서).
// day 에 배열을 주면 여러 요일을 한 번에 조회/저장한다 (월수금·화목 편집기).

function toDays(day: number | number[]): number[] {
  return Array.isArray(day) ? day : [day];
}

export async function listBusStopDayAssignments(
  day: number | number[],
  busTimeSlotId: string
): Promise<BusStopDayAssignment[]> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return [];
  if (!busTimeSlotId) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bus_stop_day_assignments")
    .select("*")
    .in("day_of_week", toDays(day))
    .eq("bus_time_slot_id", busTimeSlotId)
    .order("sort_order");
  if (error) {
    logger.error("[listBusStopDayAssignments]", error.message);
    return [];
  }
  return data as BusStopDayAssignment[];
}

// day 의 (요일, 시간대) 배정을 통째로 교체. day 가 배열이면 각 행에 day_of_week 필수.
export async function saveBusStopDayAssignments(
  day: number | number[],
  assignments: { bus_stop_id: string; bus_number_id: string; sort_order: number; day_of_week?: number }[],
  busTimeSlotId: string
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  if (!busTimeSlotId) return { error: "시간대를 선택해 주세요." };
  const supabase = createAdminClient();

  const days = toDays(day);
  if (days.length === 0 || days.some((d) => d < 1 || d > 5)) return { error: "유효하지 않은 요일입니다." };
  const rowDay = (a: { day_of_week?: number }) => a.day_of_week ?? (Array.isArray(day) ? undefined : day);
  if (assignments.some((a) => !days.includes(rowDay(a) ?? -1))) {
    return { error: "배정 행의 요일이 저장 대상 요일과 다릅니다." };
  }

  // 1. Delete existing assignments for these days + timeSlot
  const { error: delErr } = await supabase
    .from("bus_stop_day_assignments")
    .delete()
    .in("day_of_week", days)
    .eq("bus_time_slot_id", busTimeSlotId);
  if (delErr) {
    logger.error("[saveBusStopDayAssignments] delete", delErr.message);
    return { error: delErr.message };
  }

  // 2. Insert new assignments with sort_order
  if (assignments.length) {
    const now = new Date().toISOString();
    const rows = assignments.map((a) => ({
      bus_stop_id: a.bus_stop_id,
      bus_number_id: a.bus_number_id,
      day_of_week: rowDay(a)!,
      bus_time_slot_id: busTimeSlotId,
      sort_order: a.sort_order,
      updated_at: now,
    }));
    const { error: insErr } = await supabase
      .from("bus_stop_day_assignments")
      .insert(rows);
    if (insErr) {
      logger.error("[saveBusStopDayAssignments] insert", insErr.message);
      return { error: insErr.message };
    }
  }
  return reconcileStudentBuses(supabase, days);
}

/**
 * 정류장 배정이 바뀐 요일의 학생 호차(student_bus_defaults.bus_number_id)를 맞춘다.
 * 학생 호차가 더 이상 그 정류장을 돌지 않으면: 남은 운행 호차가 1대면 그 호차, 아니면 null(미지정).
 * 비어 있는데 운행 호차가 1대뿐이면 그 호차로 채운다.
 */
async function reconcileStudentBuses(
  supabase: ReturnType<typeof createAdminClient>,
  days: number[]
): Promise<{ error?: string }> {
  const { data: students, error } = await supabase
    .from("student_bus_defaults")
    .select("student_id, direction, day_of_week, bus_time_slot_id, bus_stop_id, bus_number_id")
    .in("day_of_week", days)
    .not("bus_stop_id", "is", null);
  if (error) {
    logger.error("[reconcileStudentBuses] load", error.message);
    return { error: error.message };
  }

  const servedBySlot = new Map<string, Record<number, Record<string, string[]>>>();
  const now = new Date().toISOString();
  for (const s of students ?? []) {
    let served = servedBySlot.get(s.bus_time_slot_id);
    if (!served) {
      served = await getServedStopBusesByDay(supabase, days, s.bus_time_slot_id);
      servedBySlot.set(s.bus_time_slot_id, served);
    }
    const buses = served[s.day_of_week]?.[s.bus_stop_id!] ?? [];
    const next =
      s.bus_number_id && buses.includes(s.bus_number_id)
        ? s.bus_number_id
        : buses.length === 1 ? buses[0] : null;
    if (next === s.bus_number_id) continue;
    const { error: upErr } = await supabase
      .from("student_bus_defaults")
      .update({ bus_number_id: next, updated_at: now })
      .eq("student_id", s.student_id)
      .eq("direction", s.direction)
      .eq("day_of_week", s.day_of_week);
    if (upErr) {
      logger.error("[reconcileStudentBuses] update", upErr.message);
      return { error: upErr.message };
    }
  }
  return {};
}

// (요일, 정류장, 호차) 별 도착 예정 시간 — 해당 시간대 행만.
export async function listBusStopSchedulesBulk(
  day: number | number[],
  slotId: string
): Promise<BusStopSchedule[]> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return [];
  if (!slotId) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bus_stop_schedules")
    .select("*")
    .in("day_of_week", toDays(day))
    .eq("bus_time_slot_id", slotId);
  if (error) {
    logger.error("[listBusStopSchedulesBulk]", error.message);
    return [];
  }
  return data as BusStopSchedule[];
}

// ── 정류장 시간표 (요일별 예상 시간) ──

export async function listBusStopSchedules(
  busStopId: string,
  busTimeSlotId?: string
): Promise<BusStopSchedule[]> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return [];
  const supabase = createAdminClient();
  let query = supabase
    .from("bus_stop_schedules")
    .select("*")
    .eq("bus_stop_id", busStopId)
    .order("day_of_week");
  if (busTimeSlotId) {
    query = query.eq("bus_time_slot_id", busTimeSlotId);
  }
  const { data, error } = await query;
  if (error) {
    logger.error("[listBusStopSchedules]", error.message);
    return [];
  }
  return data as BusStopSchedule[];
}

// 도착 예정 시간 일괄 저장 — (정류장, 요일, 시간대, 호차) 단위.
// estimated_time 이 있으면 upsert, null/빈 문자열이면 해당 행 삭제.
export async function saveBusStopSchedules(
  changes: { bus_stop_id: string; day_of_week: number; bus_number_id: string; estimated_time: string | null }[],
  busTimeSlotId: string
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  if (!busTimeSlotId) return { error: "시간대를 선택해 주세요." };
  const supabase = createAdminClient();

  if (changes.some((c) => c.day_of_week < 1 || c.day_of_week > 5)) return { error: "유효하지 않은 요일입니다." };
  const now = new Date().toISOString();

  const upserts = changes.filter((c) => c.estimated_time);
  if (upserts.length) {
    const { error } = await supabase.from("bus_stop_schedules").upsert(
      upserts.map((c) => ({
        bus_stop_id: c.bus_stop_id,
        day_of_week: c.day_of_week,
        bus_number_id: c.bus_number_id,
        estimated_time: c.estimated_time!,
        bus_time_slot_id: busTimeSlotId,
        updated_at: now,
      })),
      { onConflict: "bus_stop_id,day_of_week,bus_time_slot_id,bus_number_id" }
    );
    if (error) {
      logger.error("[saveBusStopSchedules] upsert", error.message);
      return { error: error.message };
    }
  }

  for (const c of changes.filter((c) => !c.estimated_time)) {
    const { error } = await supabase
      .from("bus_stop_schedules")
      .delete()
      .eq("bus_stop_id", c.bus_stop_id)
      .eq("day_of_week", c.day_of_week)
      .eq("bus_number_id", c.bus_number_id)
      .eq("bus_time_slot_id", busTimeSlotId);
    if (error) {
      logger.error("[saveBusStopSchedules] delete", error.message);
      return { error: error.message };
    }
  }
  return {};
}
