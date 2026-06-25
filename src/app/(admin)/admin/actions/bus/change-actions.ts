"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { verifyAdmin, verifyAuthenticated } from "../auth-helpers";
import { logger } from "@/lib/server/logger";
import { todayKst } from "@/lib/utils/date-kst";
import { isStopServed, getServedStopIdsByDay } from "./_helpers";
import { dowFromYmd, findUnassignedDays, formatWeekdayList } from "@/lib/bus/stop-validation";
import type { BusChangeType, StudentSubmittableChangeType } from "@/lib/bus/state";
import type { BusChangeRequest } from "@/lib/types";
import type { Database } from "@/lib/types/database.generated";

// ── 헬퍼 ──

async function upsertAttendanceForBusAbsence(
  supabase: ReturnType<typeof createAdminClient>,
  { studentId, date, recordedBy }: { studentId: string; date: string; recordedBy: string }
) {
  // attendance 의 UK 는 (student_id, attendance_date) 이므로 학생 1명당 1 row.
  // 학생이 어느 반에든 1개라도 속해있으면 절차상 등록 (소속 없는 학생은 skip).
  const { count } = await supabase
    .from("class_students")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId);
  if ((count ?? 0) > 0) {
    await supabase.from("attendance").upsert(
      [{
        student_id: studentId,
        attendance_date: date,
        status: "absent" as const,
        note: "버스 결석 자동 등록",
        recorded_by: recordedBy,
      }],
      { onConflict: "student_id,attendance_date", ignoreDuplicates: false }
    );
  }
}

// ── 변경 요청 관리 ──

export async function listAllChangeRequests(
  statusFilter?: "pending" | "completed",
): Promise<BusChangeRequest[]> {
  const auth = await verifyAdmin();
  if ("error" in auth) return [];
  const supabase = createAdminClient();
  let query = supabase
    .from("bus_change_requests")
    .select("*")
    .order("requested_at", { ascending: false });

  if (statusFilter === "pending") {
    query = query.eq("status", "pending");
  } else if (statusFilter === "completed") {
    query = query.neq("status", "pending");
  }

  const { data, error } = await query;
  if (error) {
    logger.error("[listPendingChangeRequests]", error.message);
    return [];
  }

  const studentIds = [...new Set((data ?? []).map((d) => d.student_id))];
  let studentMap = new Map<string, { korean_name: string | null; english_name: string | null }>();
  if (studentIds.length) {
    const { data: students } = await supabase
      .from("students")
      .select("id, korean_name, english_name")
      .in("id", studentIds);
    studentMap = new Map((students ?? []).map((s) => [s.id, s]));
  }

  const slotIds = [...new Set((data ?? []).map((d) => d.new_bus_time_slot_id).filter((v): v is string => v !== null))];
  const busIds = [...new Set((data ?? []).map((d) => d.new_bus_number_id).filter((v): v is string => v !== null))];
  const stopIds = [...new Set((data ?? []).map((d) => d.new_bus_stop_id).filter((v): v is string => v !== null))];
  let slotMap = new Map<string, { label: string; time: string }>();
  let busMap = new Map<string, string>();
  let stopMap = new Map<string, string>();

  if (slotIds.length) {
    const { data: slots } = await supabase.from("bus_time_slots").select("id, label, time").in("id", slotIds);
    slotMap = new Map((slots ?? []).map((s) => [s.id, { label: s.label, time: s.time }]));
  }
  if (busIds.length) {
    const { data: buses } = await supabase.from("bus_numbers").select("id, label").in("id", busIds);
    busMap = new Map((buses ?? []).map((b) => [b.id, b.label]));
  }
  if (stopIds.length) {
    const { data: stops } = await supabase.from("bus_stops").select("id, name").in("id", stopIds);
    stopMap = new Map((stops ?? []).map((s) => [s.id, s.name]));
  }

  // new_bus_time_slot_id 없는 경우 학생 기본 배정에서 시간대 fallback
  const needsDefaultSlot = (data ?? []).filter((d) => !d.new_bus_time_slot_id);
  const defaultSlotMap = new Map<string, { label: string; time: string }>();
  if (needsDefaultSlot.length > 0) {
    const defStudentIds = [...new Set(needsDefaultSlot.map((d) => d.student_id))];
    const { data: defaults } = await supabase
      .from("student_bus_defaults")
      .select("student_id, bus_time_slot_id")
      .in("student_id", defStudentIds)
      .eq("direction", "dropoff");
    if (defaults?.length) {
      const defSlotIds = [...new Set(defaults.map((d) => d.bus_time_slot_id).filter(Boolean))];
      if (defSlotIds.length) {
        const { data: defSlots } = await supabase.from("bus_time_slots").select("id, label, time").in("id", defSlotIds);
        const defSlotLookup = new Map((defSlots ?? []).map((s) => [s.id, { label: s.label, time: s.time }]));
        for (const d of defaults) {
          if (!d.bus_time_slot_id) continue;
          const key = d.student_id;
          if (defaultSlotMap.has(key)) continue;
          const slotInfo = defSlotLookup.get(d.bus_time_slot_id);
          if (slotInfo) defaultSlotMap.set(key, slotInfo);
        }
      }
    }
  }

  // 기존 일정 조회 (student_bus_defaults에서 해당 요일)
  const origDefaults = new Map<string, { slot_id: string; stop_id: string | null }>();
  if (studentIds.length && data?.length) {
    // request_date에서 요일 계산
    const { data: origData } = await supabase
      .from("student_bus_defaults")
      .select("student_id, day_of_week, bus_time_slot_id, bus_stop_id")
      .in("student_id", studentIds)
      .eq("direction", "dropoff");
    for (const o of origData ?? []) {
      origDefaults.set(
        `${o.student_id}:${o.day_of_week}`,
        { slot_id: o.bus_time_slot_id, stop_id: o.bus_stop_id }
      );
    }
  }

  // 기존 일정의 슬롯/정류장 정보 조회
  const origSlotIds = new Set<string>();
  const origStopIds = new Set<string>();
  for (const v of origDefaults.values()) {
    if (v.slot_id) origSlotIds.add(v.slot_id);
    if (v.stop_id) origStopIds.add(v.stop_id);
  }
  // 이미 조회한 slotMap/stopMap에 없는 것만 추가 조회
  const missingSlotIds = [...origSlotIds].filter((id) => !slotMap.has(id));
  const missingStopIds = [...origStopIds].filter((id) => !stopMap.has(id));
  if (missingSlotIds.length) {
    const { data: extraSlots } = await supabase.from("bus_time_slots").select("id, label, time").in("id", missingSlotIds);
    for (const s of extraSlots ?? []) slotMap.set(s.id, { label: s.label, time: s.time });
  }
  if (missingStopIds.length) {
    const { data: extraStops } = await supabase.from("bus_stops").select("id, name").in("id", missingStopIds);
    for (const s of extraStops ?? []) stopMap.set(s.id, s.name);
  }

  // 기존 일정의 호차 조회 (bus_stop_day_assignments에서 stop→bus 매핑)
  const origBusLabelMap = new Map<string, string>(); // "student:day" → busLabel
  const origStopIdsForBus = [...origDefaults.entries()].filter(([, v]) => v.stop_id).map(([k, v]) => ({ key: k, stop_id: v.stop_id! }));
  if (origStopIdsForBus.length) {
    const stopIdsForBusQuery = [...new Set(origStopIdsForBus.map((o) => o.stop_id))];
    const { data: stopAssigns } = await supabase
      .from("bus_stop_day_assignments")
      .select("bus_stop_id, bus_number_id, day_of_week")
      .in("bus_stop_id", stopIdsForBusQuery);
    // stopId:day → busNumberId
    const stopBusMap = new Map<string, string>();
    for (const sa of stopAssigns ?? []) {
      stopBusMap.set(`${sa.bus_stop_id}:${sa.day_of_week}`, sa.bus_number_id);
    }
    // busNumberId → label (기존 busMap + 추가)
    const missingBusIds = [...new Set([...(stopAssigns ?? []).map((sa) => sa.bus_number_id)])].filter((id) => !busMap.has(id));
    if (missingBusIds.length) {
      const { data: extraBuses } = await supabase.from("bus_numbers").select("id, label").in("id", missingBusIds);
      for (const b of extraBuses ?? []) busMap.set(b.id, b.label);
    }
    for (const { key, stop_id } of origStopIdsForBus) {
      const [, dayStr] = key.split(":");
      const busNumId = stopBusMap.get(`${stop_id}:${dayStr}`);
      if (busNumId) origBusLabelMap.set(key, busMap.get(busNumId) ?? "");
    }
  }

  return (data ?? []).map((d) => {
    const student = studentMap.get(d.student_id);
    const slot = d.new_bus_time_slot_id
      ? slotMap.get(d.new_bus_time_slot_id)
      : defaultSlotMap.get(d.student_id);

    // 기존 일정
    const dow = new Date(d.request_date + "T00:00:00").getDay();
    const isoDay = dow === 0 ? 7 : dow;
    const origKey = `${d.student_id}:${isoDay}`;
    const orig = origDefaults.get(origKey);
    const origSlot = orig?.slot_id ? slotMap.get(orig.slot_id) : undefined;
    const origStop = orig?.stop_id ? stopMap.get(orig.stop_id) : undefined;
    const origBus = origBusLabelMap.get(origKey);

    return {
      ...d,
      student_profile_id: d.student_id,
      korean_name: student?.korean_name ?? null,
      english_name: student?.english_name ?? null,

      new_time_slot_label: slot?.label,
      new_time_slot_time: slot?.time,
      new_bus_label: d.new_bus_number_id ? busMap.get(d.new_bus_number_id) : undefined,
      new_bus_stop_name: d.new_bus_stop_id ? stopMap.get(d.new_bus_stop_id) : undefined,
      orig_time_slot_time: origSlot?.time,
      orig_time_slot_label: origSlot?.label,
      orig_bus_label: origBus,
      orig_bus_stop_name: origStop,
    };
  }) as BusChangeRequest[];
}

export async function listChangeRequestsByDate(date: string): Promise<BusChangeRequest[]> {
  const auth = await verifyAdmin();
  if ("error" in auth) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bus_change_requests")
    .select("*")
    .eq("request_date", date)
    .order("requested_at", { ascending: false });
  if (error) {
    logger.error("[listChangeRequestsByDate]", error.message);
    return [];
  }

  const studentIds = [...new Set((data ?? []).map((d) => d.student_id))];
  let studentMap = new Map<string, { korean_name: string | null; english_name: string | null }>();
  if (studentIds.length) {
    const { data: students } = await supabase
      .from("students")
      .select("id, korean_name, english_name")
      .in("id", studentIds);
    studentMap = new Map((students ?? []).map((s) => [s.id, s]));
  }

  const slotIds = [...new Set((data ?? []).map((d) => d.new_bus_time_slot_id).filter((v): v is string => v !== null))];
  const busIds = [...new Set((data ?? []).map((d) => d.new_bus_number_id).filter((v): v is string => v !== null))];
  const stopIds = [...new Set((data ?? []).map((d) => d.new_bus_stop_id).filter((v): v is string => v !== null))];
  let slotMap = new Map<string, { label: string; time: string }>();
  let busMap = new Map<string, string>();
  let stopMap = new Map<string, string>();

  if (slotIds.length) {
    const { data: slots } = await supabase.from("bus_time_slots").select("id, label, time").in("id", slotIds);
    slotMap = new Map((slots ?? []).map((s) => [s.id, { label: s.label, time: s.time }]));
  }
  if (busIds.length) {
    const { data: buses } = await supabase.from("bus_numbers").select("id, label").in("id", busIds);
    busMap = new Map((buses ?? []).map((b) => [b.id, b.label]));
  }
  if (stopIds.length) {
    const { data: stops } = await supabase.from("bus_stops").select("id, name").in("id", stopIds);
    stopMap = new Map((stops ?? []).map((s) => [s.id, s.name]));
  }

  // new_bus_time_slot_id 없는 경우 학생 기본 배정에서 시간대 fallback
  const needsDefaultSlot = (data ?? []).filter((d) => !d.new_bus_time_slot_id);
  const defaultSlotMap = new Map<string, { label: string; time: string }>();
  if (needsDefaultSlot.length > 0) {
    const defStudentIds = [...new Set(needsDefaultSlot.map((d) => d.student_id))];
    const { data: defaults } = await supabase
      .from("student_bus_defaults")
      .select("student_id, bus_time_slot_id")
      .in("student_id", defStudentIds)
      .eq("direction", "dropoff");
    if (defaults?.length) {
      const defSlotIds = [...new Set(defaults.map((d) => d.bus_time_slot_id).filter(Boolean))];
      if (defSlotIds.length) {
        const { data: defSlots } = await supabase.from("bus_time_slots").select("id, label, time").in("id", defSlotIds);
        const defSlotLookup = new Map((defSlots ?? []).map((s) => [s.id, { label: s.label, time: s.time }]));
        for (const d of defaults) {
          if (!d.bus_time_slot_id) continue;
          const key = d.student_id;
          if (defaultSlotMap.has(key)) continue;
          const slotInfo = defSlotLookup.get(d.bus_time_slot_id);
          if (slotInfo) defaultSlotMap.set(key, slotInfo);
        }
      }
    }
  }

  // 기존 일정 조회 (student_bus_defaults에서 해당 요일)
  const origDefaults = new Map<string, { slot_id: string; stop_id: string | null }>();
  if (studentIds.length && data?.length) {
    const { data: origData } = await supabase
      .from("student_bus_defaults")
      .select("student_id, day_of_week, bus_time_slot_id, bus_stop_id")
      .in("student_id", studentIds)
      .eq("direction", "dropoff");
    for (const o of origData ?? []) {
      origDefaults.set(
        `${o.student_id}:${o.day_of_week}`,
        { slot_id: o.bus_time_slot_id, stop_id: o.bus_stop_id }
      );
    }
  }

  // 기존 일정의 슬롯/정류장 정보 조회
  const origSlotIds = new Set<string>();
  const origStopIds = new Set<string>();
  for (const v of origDefaults.values()) {
    if (v.slot_id) origSlotIds.add(v.slot_id);
    if (v.stop_id) origStopIds.add(v.stop_id);
  }
  const missingSlotIds = [...origSlotIds].filter((id) => !slotMap.has(id));
  const missingStopIds = [...origStopIds].filter((id) => !stopMap.has(id));
  if (missingSlotIds.length) {
    const { data: extraSlots } = await supabase.from("bus_time_slots").select("id, label, time").in("id", missingSlotIds);
    for (const s of extraSlots ?? []) slotMap.set(s.id, { label: s.label, time: s.time });
  }
  if (missingStopIds.length) {
    const { data: extraStops } = await supabase.from("bus_stops").select("id, name").in("id", missingStopIds);
    for (const s of extraStops ?? []) stopMap.set(s.id, s.name);
  }

  // 기존 일정의 호차 조회
  const origBusLabelMap = new Map<string, string>();
  const origStopIdsForBus = [...origDefaults.entries()].filter(([, v]) => v.stop_id).map(([k, v]) => ({ key: k, stop_id: v.stop_id! }));
  if (origStopIdsForBus.length) {
    const stopIdsForBusQuery = [...new Set(origStopIdsForBus.map((o) => o.stop_id))];
    const { data: stopAssigns } = await supabase
      .from("bus_stop_day_assignments")
      .select("bus_stop_id, bus_number_id, day_of_week")
      .in("bus_stop_id", stopIdsForBusQuery);
    const stopBusMap = new Map<string, string>();
    for (const sa of stopAssigns ?? []) {
      stopBusMap.set(`${sa.bus_stop_id}:${sa.day_of_week}`, sa.bus_number_id);
    }
    const missingBusIds = [...new Set([...(stopAssigns ?? []).map((sa) => sa.bus_number_id)])].filter((id) => !busMap.has(id));
    if (missingBusIds.length) {
      const { data: extraBuses } = await supabase.from("bus_numbers").select("id, label").in("id", missingBusIds);
      for (const b of extraBuses ?? []) busMap.set(b.id, b.label);
    }
    for (const { key, stop_id } of origStopIdsForBus) {
      const [, dayStr] = key.split(":");
      const busNumId = stopBusMap.get(`${stop_id}:${dayStr}`);
      if (busNumId) origBusLabelMap.set(key, busMap.get(busNumId) ?? "");
    }
  }

  return (data ?? []).map((d) => {
    const student = studentMap.get(d.student_id);
    const slot = d.new_bus_time_slot_id
      ? slotMap.get(d.new_bus_time_slot_id)
      : defaultSlotMap.get(d.student_id);

    const dow = new Date(d.request_date + "T00:00:00").getDay();
    const isoDay = dow === 0 ? 7 : dow;
    const origKey = `${d.student_id}:${isoDay}`;
    const orig = origDefaults.get(origKey);
    const origSlot = orig?.slot_id ? slotMap.get(orig.slot_id) : undefined;
    const origStop = orig?.stop_id ? stopMap.get(orig.stop_id) : undefined;
    const origBus = origBusLabelMap.get(origKey);

    return {
      ...d,
      student_profile_id: d.student_id,
      korean_name: student?.korean_name ?? null,
      english_name: student?.english_name ?? null,

      new_time_slot_label: slot?.label,
      new_time_slot_time: slot?.time,
      new_bus_label: d.new_bus_number_id ? busMap.get(d.new_bus_number_id) : undefined,
      new_bus_stop_name: d.new_bus_stop_id ? stopMap.get(d.new_bus_stop_id) : undefined,
      orig_time_slot_time: origSlot?.time,
      orig_time_slot_label: origSlot?.label,
      orig_bus_label: origBus,
      orig_bus_stop_name: origStop,
    };
  }) as BusChangeRequest[];
}

export async function listPendingChangeRequests(): Promise<BusChangeRequest[]> {
  const all = await listAllChangeRequests();
  return all.filter((r) => r.status === "pending");
}

export async function approveChangeRequest(
  requestId: string,
  overrides?: {
    changeType?: BusChangeType;
    newBusTimeSlotId?: string;
    newBusNumberId?: string;
    newBusStopId?: string;
    reviewNote?: string;
  }
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  // reviewer 신원은 클라이언트 입력이 아니라 인증 세션에서 가져온다 (감사추적 위조 방지).
  const reviewerId = auth.userId;
  const supabase = createAdminClient();

  // 정류장 미배정 가드: 정류장(change) 으로 승인하면서 정류장+시간대를 지정한 경우.
  if (overrides?.changeType === "change" && overrides?.newBusStopId && overrides?.newBusTimeSlotId) {
    const { data: reqRow } = await supabase
      .from("bus_change_requests")
      .select("request_date")
      .eq("id", requestId)
      .single();
    if (reqRow) {
      const dow = dowFromYmd(String(reqRow.request_date).slice(0, 10));
      if (!(await isStopServed(supabase, dow, overrides.newBusTimeSlotId, overrides.newBusStopId))) {
        return { error: "선택한 정류장이 해당 요일·시간대에 배정되어 있지 않습니다." };
      }
    }
  }

  const updateData: Database["public"]["Tables"]["bus_change_requests"]["Update"] = {
    status: "approved",
    reviewed_by: reviewerId,
    reviewed_at: new Date().toISOString(),
    review_note: overrides?.reviewNote?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  if (overrides?.changeType !== undefined) {
    updateData.change_type = overrides.changeType;
  }
  if (overrides?.newBusTimeSlotId !== undefined) {
    updateData.new_bus_time_slot_id = overrides.newBusTimeSlotId || null;
  }
  if (overrides?.newBusNumberId !== undefined) {
    updateData.new_bus_number_id = overrides.newBusNumberId || null;
  }
  if (overrides?.newBusStopId !== undefined) {
    updateData.new_bus_stop_id = overrides.newBusStopId || null;
  }

  // update + returning 한 번에 (pre-select 제거). updated row 가 없으면 명시적 에러.
  const { data: updated, error } = await supabase
    .from("bus_change_requests")
    .update(updateData)
    .eq("id", requestId)
    .select("student_id, request_date, change_type")
    .single();
  if (error || !updated) {
    logger.error("[approveChangeRequest]", error?.message ?? "row not found", { requestId });
    return { error: error?.message ?? "변경 요청을 찾을 수 없습니다." };
  }

  // 결석으로 승인 시 출결도 자동 반영. updated.change_type 은 update 적용 후 값.
  if (updated.change_type === "absent") {
    await upsertAttendanceForBusAbsence(supabase, {
      studentId: updated.student_id,
      date: updated.request_date,
      recordedBy: reviewerId,
    });
  }

  logger.info("[approveChangeRequest]", "변경 요청 승인", { requestId, reviewerId });
  return {};
}

export async function rejectChangeRequest(
  requestId: string,
  reviewNote?: string
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  // reviewer 신원은 인증 세션에서 (클라이언트 입력 신뢰 금지).
  const reviewerId = auth.userId;
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("bus_change_requests")
    .update({
      status: "rejected",
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      review_note: reviewNote?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);
  if (error) {
    logger.error("[rejectChangeRequest]", error.message);
    return { error: error.message };
  }
  logger.info("[rejectChangeRequest]", "변경 요청 거절", { requestId, reviewerId });
  return {};
}

export async function getStudentChangeRequests(
  studentProfileId: string
): Promise<BusChangeRequest[]> {
  // 본인/admin/teacher만 조회 허용 (IDOR 방지).
  const auth = await verifyAuthenticated();
  if ("error" in auth) return [];
  const supabase = createAdminClient();
  if (studentProfileId !== auth.userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", auth.userId)
      .single();
    if (!profile || !["admin", "teacher"].includes(profile.role ?? "")) {
      logger.warn("[getStudentChangeRequests]", "권한 없음", { requestedBy: auth.userId });
      return [];
    }
  }
  const today = todayKst();
  const { data, error } = await supabase
    .from("bus_change_requests")
    .select("*")
    .eq("student_id", studentProfileId)
    .gte("request_date", today)
    .order("request_date");
  if (error) {
    logger.error("[getStudentChangeRequests]", error.message);
    return [];
  }

  const slotIds = [...new Set((data ?? []).map((d) => d.new_bus_time_slot_id).filter((v): v is string => v !== null))];
  const busIds = [...new Set((data ?? []).map((d) => d.new_bus_number_id).filter((v): v is string => v !== null))];
  let slotMap = new Map<string, { label: string; time: string }>();
  let busMap = new Map<string, string>();

  if (slotIds.length) {
    const { data: slots } = await supabase.from("bus_time_slots").select("id, label, time").in("id", slotIds);
    slotMap = new Map((slots ?? []).map((s) => [s.id, { label: s.label, time: s.time }]));
  }
  if (busIds.length) {
    const { data: buses } = await supabase.from("bus_numbers").select("id, label").in("id", busIds);
    busMap = new Map((buses ?? []).map((b) => [b.id, b.label]));
  }

  return (data ?? []).map((d) => {
    const slot = d.new_bus_time_slot_id ? slotMap.get(d.new_bus_time_slot_id) : undefined;
    return {
      ...d,
      new_time_slot_label: slot?.label,
      new_time_slot_time: slot?.time,
      new_bus_label: d.new_bus_number_id ? busMap.get(d.new_bus_number_id) : undefined,
    };
  }) as BusChangeRequest[];
}

export async function submitBusChangeRequest(
  studentProfileId: string,
  requestDate: string,
  changeType: StudentSubmittableChangeType,
  newBusTimeSlotId?: string,
  newBusNumberId?: string,
  reason?: string
): Promise<{ error?: string }> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return { error: auth.error };
  // 본인 요청만 허용 (IDOR 방지: 다른 학생의 버스 노선을 바꾸지 못하도록)
  if (studentProfileId !== auth.userId) {
    return { error: "본인 요청만 제출할 수 있습니다." };
  }
  const supabase = createAdminClient();

  const { error } = await supabase.from("bus_change_requests").insert({
    student_id: studentProfileId,
    request_date: requestDate,
    change_type: changeType,
    new_bus_time_slot_id: newBusTimeSlotId || null,
    new_bus_number_id: newBusNumberId || null,
    reason: reason?.trim() || null,
  });

  if (error) {
    if (error.code === "23505") return { error: "해당 날짜에 이미 변경 요청이 있습니다." };
    logger.error("[submitBusChangeRequest]", error.message);
    return { error: error.message };
  }
  return {};
}

export async function cancelBusChangeRequest(
  requestId: string,
  studentProfileId: string
): Promise<{ error?: string }> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return { error: auth.error };
  // 본인 pending 요청만 취소 가능 (IDOR 방지: 다른 학생 요청 취소 차단)
  if (studentProfileId !== auth.userId) {
    return { error: "본인 요청만 취소할 수 있습니다." };
  }
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("bus_change_requests")
    .delete()
    .eq("id", requestId)
    .eq("student_id", studentProfileId)
    .eq("status", "pending");
  if (error) {
    logger.error("[cancelBusChangeRequest]", error.message);
    return { error: error.message };
  }
  return {};
}

// ── 관리자 당일 변경/결석 ──

export async function createAdminBusChange(
  studentProfileId: string,
  requestDate: string,
  changeType: BusChangeType,
  newBusTimeSlotId?: string,
  newBusNumberId?: string,
  newBusStopId?: string,
  reason?: string
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const supabase = createAdminClient();

  const finalSlotId = newBusTimeSlotId ?? null;
  const finalBusId = changeType === "change" ? (newBusNumberId ?? null) : null;
  const finalStopId = newBusStopId || null;

  // 정류장 미배정 가드: 정류장 모드에서 해당 요일·시간대에 배정 안 된 정류장은 거부.
  if (changeType === "change" && finalStopId && finalSlotId) {
    if (!(await isStopServed(supabase, dowFromYmd(requestDate), finalSlotId, finalStopId))) {
      return { error: "선택한 정류장이 해당 요일·시간대에 배정되어 있지 않습니다." };
    }
  }

  const { error } = await supabase.from("bus_change_requests").insert({
    student_id: studentProfileId,
    request_date: requestDate,
    change_type: changeType,
    new_bus_time_slot_id: finalSlotId,
    new_bus_number_id: finalBusId,
    new_bus_stop_id: finalStopId,
    reason: reason?.trim() || null,
    status: "approved",
    reviewed_by: auth.userId,
    reviewed_at: new Date().toISOString(),
  });

  if (error) {
    if (error.code === "23505") return { error: "해당 날짜에 이미 변경 요청이 있습니다." };
    logger.error("[createAdminBusChange]", error.message);
    return { error: error.message };
  }

  // 결석 시 출결도 자동 반영
  if (changeType === "absent") {
    await upsertAttendanceForBusAbsence(supabase, {
      studentId: studentProfileId,
      date: requestDate,
      recordedBy: auth.userId,
    });
  }

  return {};
}

export async function updateAdminBusChange(
  requestId: string,
  changeType: BusChangeType,
  newBusTimeSlotId?: string,
  newBusNumberId?: string,
  newBusStopId?: string,
  reason?: string
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const supabase = createAdminClient();

  const finalSlotId = newBusTimeSlotId ?? null;
  const finalBusId = changeType === "change" ? (newBusNumberId ?? null) : null;
  const finalStopId = newBusStopId || null;

  const { data: existing } = await supabase
    .from("bus_change_requests")
    .select("student_id, request_date")
    .eq("id", requestId)
    .single();

  // 정류장 미배정 가드
  if (changeType === "change" && finalStopId && finalSlotId && existing) {
    if (!(await isStopServed(supabase, dowFromYmd(String(existing.request_date).slice(0, 10)), finalSlotId, finalStopId))) {
      return { error: "선택한 정류장이 해당 요일·시간대에 배정되어 있지 않습니다." };
    }
  }

  const { error } = await supabase
    .from("bus_change_requests")
    .update({
      change_type: changeType,
      new_bus_time_slot_id: finalSlotId,
      new_bus_number_id: finalBusId,
      new_bus_stop_id: finalStopId,
      reason: reason?.trim() || null,
      reviewed_by: auth.userId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error) {
    logger.error("[updateAdminBusChange]", error.message);
    return { error: error.message };
  }

  // 결석으로 변경 시 출결도 자동 반영
  if (changeType === "absent" && existing) {
    await upsertAttendanceForBusAbsence(supabase, {
      studentId: existing.student_id,
      date: existing.request_date,
      recordedBy: auth.userId,
    });
  }

  return {};
}

export async function getExistingBusChange(
  studentProfileId: string,
  requestDate: string
): Promise<{
  id: string;
  change_type: BusChangeType;
  new_bus_time_slot_id: string | null;
  new_bus_number_id: string | null;
  new_bus_stop_id: string | null;
  reason: string | null;
} | null> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("bus_change_requests")
    .select("id, change_type, new_bus_time_slot_id, new_bus_number_id, new_bus_stop_id, reason")
    .eq("student_id", studentProfileId)
    .eq("request_date", requestDate)
    .eq("status", "approved")
    .maybeSingle();
  return data as typeof data & { change_type: BusChangeType } | null;
}

export async function deleteAdminBusChange(
  requestId: string
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("bus_change_requests")
    .delete()
    .eq("id", requestId);
  if (error) {
    logger.error("[deleteAdminBusChange]", error.message);
    return { error: error.message };
  }
  return {};
}

/** 다중 날짜 버스 변경 일괄 등록 (관리자 전용) */
export async function bulkCreateBusChanges(
  studentProfileId: string,
  dates: string[],
  changeType: BusChangeType,
  newBusTimeSlotId?: string,
  newBusNumberId?: string,
  newBusStopId?: string,
  reason?: string,
): Promise<{ error?: string; created?: number; skipped?: number }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  if (!dates.length) return { error: "날짜를 선택해 주세요." };

  const supabase = createAdminClient();

  // 정류장 미배정 가드: 선택 날짜들의 요일 중 정류장 미배정 요일이 있으면 거부.
  if (changeType === "change" && newBusStopId && newBusTimeSlotId) {
    const dows = [...new Set(dates.map((d) => dowFromYmd(d)))];
    const served = await getServedStopIdsByDay(supabase, dows, newBusTimeSlotId);
    const bad = findUnassignedDays(served, dows, newBusStopId);
    if (bad.length) {
      return { error: `선택한 정류장이 ${formatWeekdayList(bad)}요일 해당 시간대에 배정되어 있지 않습니다.` };
    }
  }

  const now = new Date().toISOString();

  const rows = dates.map((d) => ({
    student_id: studentProfileId,
    request_date: d,
    change_type: changeType,
    new_bus_time_slot_id: newBusTimeSlotId || null,
    new_bus_number_id: newBusNumberId || null,
    new_bus_stop_id: newBusStopId || null,
    reason: reason?.trim() || null,
    status: "approved" as const,
    requested_at: now,
    updated_at: now,
  }));

  // UNIQUE (student_profile_id, request_date) 충돌 시 skip
  const { data: inserted, error } = await supabase
    .from("bus_change_requests")
    .upsert(rows, {
      onConflict: "student_id,request_date",
      ignoreDuplicates: true,
    })
    .select("id");

  if (error) {
    logger.error("[bulkCreateBusChanges]", error.message);
    return { error: error.message };
  }

  const created = inserted?.length ?? 0;
  const skipped = dates.length - created;

  logger.info("[bulkCreateBusChanges]", `${created}건 생성, ${skipped}건 건너뜀`, {
    studentProfileId,
    changeType,
  });
  revalidatePath("/admin/bus");
  revalidatePath("/admin/reservations");
  return { created, skipped };
}
