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

  const patch: Record<string, unknown> = {
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
    .order("sort_order")
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

  // auto sort_order: max + 1 (globally)
  const { data: existing } = await supabase
    .from("bus_stops")
    .select("sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("bus_stops")
    .insert({ name: trimmed, sort_order: nextOrder })
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
  name: string,
  sortOrder?: number
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const trimmed = name.trim();
  if (!trimmed) return { error: "정류장 이름을 입력해 주세요." };

  const updateData: Record<string, unknown> = { name: trimmed, updated_at: new Date().toISOString() };
  if (sortOrder !== undefined) updateData.sort_order = sortOrder;

  const { error } = await supabase.from("bus_stops").update(updateData).eq("id", id);
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
    .update({ bus_stop_id: null, updated_at: new Date().toISOString() })
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

export async function listBusStopDayAssignments(
  day: number,
  busTimeSlotId?: string
): Promise<BusStopDayAssignment[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("bus_stop_day_assignments")
    .select("*")
    .eq("day_of_week", day);
  if (busTimeSlotId) {
    query = query.eq("bus_time_slot_id", busTimeSlotId);
  } else {
    query = query.is("bus_time_slot_id", null);
  }
  const { data, error } = await query.order("sort_order");
  if (error) {
    logger.error("[listBusStopDayAssignments]", error.message);
    return [];
  }
  return data as BusStopDayAssignment[];
}

export async function saveBusStopDayAssignments(
  day: number,
  assignments: { bus_stop_id: string; bus_number_id: string; sort_order: number }[],
  busTimeSlotId?: string
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();

  // 1. Delete existing assignments for this day + timeSlot
  let delQuery = supabase
    .from("bus_stop_day_assignments")
    .delete()
    .eq("day_of_week", day);
  if (busTimeSlotId) {
    delQuery = delQuery.eq("bus_time_slot_id", busTimeSlotId);
  } else {
    delQuery = delQuery.is("bus_time_slot_id", null);
  }
  const { error: delErr } = await delQuery;
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
      day_of_week: day,
      bus_time_slot_id: busTimeSlotId ?? null,
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
  return {};
}

export async function listBusStopSchedulesBulk(
  day: number,
  slotId?: string
): Promise<BusStopSchedule[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("bus_stop_schedules")
    .select("*")
    .eq("day_of_week", day);
  if (slotId) {
    // Show schedules for selected slot OR fallback to NULL (전체 기본)
    query = query.or(`bus_time_slot_id.eq.${slotId},bus_time_slot_id.is.null`);
  } else {
    query = query.is("bus_time_slot_id", null);
  }
  const { data, error } = await query;
  if (error) {
    logger.error("[listBusStopSchedulesBulk]", error.message);
    return [];
  }
  // If a slot is selected, prefer slot-specific over NULL fallback (per stop)
  if (slotId && data) {
    const byStop = new Map<string, typeof data[0]>();
    for (const row of data) {
      const existing = byStop.get(row.bus_stop_id);
      // Prefer the one with matching slot ID over NULL
      if (!existing || (row.bus_time_slot_id === slotId)) {
        byStop.set(row.bus_stop_id, row);
      }
    }
    return Array.from(byStop.values()) as BusStopSchedule[];
  }
  return data as BusStopSchedule[];
}

// ── 정류장 시간표 (요일별 예상 시간) ──

export async function listBusStopSchedules(
  busStopId: string,
  busTimeSlotId?: string
): Promise<BusStopSchedule[]> {
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

export async function upsertBusStopSchedule(
  busStopId: string,
  dayOfWeek: number,
  estimatedTime: string,
  busTimeSlotId?: string
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();

  if (dayOfWeek < 1 || dayOfWeek > 5) return { error: "유효하지 않은 요일입니다." };
  if (!estimatedTime) return { error: "시간을 입력해 주세요." };

  const { error } = await supabase.from("bus_stop_schedules").upsert(
    {
      bus_stop_id: busStopId,
      day_of_week: dayOfWeek,
      estimated_time: estimatedTime,
      bus_time_slot_id: busTimeSlotId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "bus_stop_id,day_of_week,bus_time_slot_id" }
  );
  if (error) {
    logger.error("[upsertBusStopSchedule]", error.message);
    return { error: error.message };
  }
  return {};
}

export async function deleteBusStopSchedule(
  busStopId: string,
  dayOfWeek: number,
  busTimeSlotId?: string
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();

  let query = supabase
    .from("bus_stop_schedules")
    .delete()
    .eq("bus_stop_id", busStopId)
    .eq("day_of_week", dayOfWeek);
  if (busTimeSlotId) {
    query = query.eq("bus_time_slot_id", busTimeSlotId);
  } else {
    query = query.is("bus_time_slot_id", null);
  }
  const { error } = await query;
  if (error) {
    logger.error("[deleteBusStopSchedule]", error.message);
    return { error: error.message };
  }
  return {};
}

// 요일·시간대 단위 일괄 복사 — 모든 호차의 정류장 배정 + 스케줄 시간을 다른 요일들로 덮어쓰기
export async function copyBusDayDataToOtherDays(
  sourceDay: number,
  targetDays: number[],
  busTimeSlotId?: string
): Promise<{ error?: string; copied?: number }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();

  const cleanTargets = targetDays.filter((d) => d !== sourceDay && d >= 1 && d <= 5);
  if (cleanTargets.length === 0) return { error: "복사 대상 요일이 없습니다." };

  // 1. 원본 데이터 로드
  let assignQuery = supabase
    .from("bus_stop_day_assignments")
    .select("bus_stop_id, bus_number_id, sort_order")
    .eq("day_of_week", sourceDay);
  assignQuery = busTimeSlotId
    ? assignQuery.eq("bus_time_slot_id", busTimeSlotId)
    : assignQuery.is("bus_time_slot_id", null);
  const { data: srcAssignments, error: srcAErr } = await assignQuery;
  if (srcAErr) {
    logger.error("[copyBusDayDataToOtherDays] load assignments", srcAErr.message);
    return { error: srcAErr.message };
  }

  let schedQuery = supabase
    .from("bus_stop_schedules")
    .select("bus_stop_id, estimated_time")
    .eq("day_of_week", sourceDay);
  schedQuery = busTimeSlotId
    ? schedQuery.eq("bus_time_slot_id", busTimeSlotId)
    : schedQuery.is("bus_time_slot_id", null);
  const { data: srcSchedules, error: srcSErr } = await schedQuery;
  if (srcSErr) {
    logger.error("[copyBusDayDataToOtherDays] load schedules", srcSErr.message);
    return { error: srcSErr.message };
  }

  const slotValue = busTimeSlotId ?? null;
  const now = new Date().toISOString();

  // 2. 대상 요일 각각: 기존 데이터 삭제 후 새로 삽입
  for (const targetDay of cleanTargets) {
    let delAssignQ = supabase
      .from("bus_stop_day_assignments")
      .delete()
      .eq("day_of_week", targetDay);
    delAssignQ = busTimeSlotId
      ? delAssignQ.eq("bus_time_slot_id", busTimeSlotId)
      : delAssignQ.is("bus_time_slot_id", null);
    const { error: delAErr } = await delAssignQ;
    if (delAErr) {
      logger.error("[copyBusDayDataToOtherDays] delete assignments", delAErr.message);
      return { error: `${targetDay}요일 기존 배정 삭제 실패: ${delAErr.message}` };
    }

    let delSchedQ = supabase
      .from("bus_stop_schedules")
      .delete()
      .eq("day_of_week", targetDay);
    delSchedQ = busTimeSlotId
      ? delSchedQ.eq("bus_time_slot_id", busTimeSlotId)
      : delSchedQ.is("bus_time_slot_id", null);
    const { error: delSErr } = await delSchedQ;
    if (delSErr) {
      logger.error("[copyBusDayDataToOtherDays] delete schedules", delSErr.message);
      return { error: `${targetDay}요일 기존 시간 삭제 실패: ${delSErr.message}` };
    }

    if (srcAssignments && srcAssignments.length) {
      const rows = srcAssignments.map((a) => ({
        bus_stop_id: a.bus_stop_id,
        bus_number_id: a.bus_number_id,
        day_of_week: targetDay,
        bus_time_slot_id: slotValue,
        sort_order: a.sort_order,
        updated_at: now,
      }));
      const { error: insAErr } = await supabase
        .from("bus_stop_day_assignments")
        .insert(rows);
      if (insAErr) {
        logger.error("[copyBusDayDataToOtherDays] insert assignments", insAErr.message);
        return { error: `${targetDay}요일 배정 삽입 실패: ${insAErr.message}` };
      }
    }

    if (srcSchedules && srcSchedules.length) {
      const rows = srcSchedules.map((s) => ({
        bus_stop_id: s.bus_stop_id,
        day_of_week: targetDay,
        bus_time_slot_id: slotValue,
        estimated_time: s.estimated_time,
        updated_at: now,
      }));
      const { error: insSErr } = await supabase
        .from("bus_stop_schedules")
        .insert(rows);
      if (insSErr) {
        logger.error("[copyBusDayDataToOtherDays] insert schedules", insSErr.message);
        return { error: `${targetDay}요일 시간 삽입 실패: ${insSErr.message}` };
      }
    }
  }

  return { copied: cleanTargets.length };
}

// 요일·시간대별 기존 배정/시간 행 수 (월~금) — 복사 모달의 충돌 미리보기용
export async function getBusDayDataCounts(
  busTimeSlotId?: string
): Promise<Record<number, { assignments: number; schedules: number }>> {
  const supabase = createAdminClient();
  const result: Record<number, { assignments: number; schedules: number }> = {
    1: { assignments: 0, schedules: 0 },
    2: { assignments: 0, schedules: 0 },
    3: { assignments: 0, schedules: 0 },
    4: { assignments: 0, schedules: 0 },
    5: { assignments: 0, schedules: 0 },
  };

  let aQuery = supabase
    .from("bus_stop_day_assignments")
    .select("day_of_week");
  aQuery = busTimeSlotId
    ? aQuery.eq("bus_time_slot_id", busTimeSlotId)
    : aQuery.is("bus_time_slot_id", null);
  const { data: aData, error: aErr } = await aQuery;
  if (aErr) {
    logger.error("[getBusDayDataCounts] assignments", aErr.message);
  } else if (aData) {
    for (const row of aData) {
      const d = row.day_of_week;
      if (d >= 1 && d <= 5) result[d].assignments += 1;
    }
  }

  let sQuery = supabase
    .from("bus_stop_schedules")
    .select("day_of_week");
  sQuery = busTimeSlotId
    ? sQuery.eq("bus_time_slot_id", busTimeSlotId)
    : sQuery.is("bus_time_slot_id", null);
  const { data: sData, error: sErr } = await sQuery;
  if (sErr) {
    logger.error("[getBusDayDataCounts] schedules", sErr.message);
  } else if (sData) {
    for (const row of sData) {
      const d = row.day_of_week;
      if (d >= 1 && d <= 5) result[d].schedules += 1;
    }
  }

  return result;
}
