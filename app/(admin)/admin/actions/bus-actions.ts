"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeEmail } from "@/lib/auth-utils";
import { verifyAdmin, verifyAuthenticated } from "./auth-helpers";
import type {
  BusNumber,
  BusTimeSlot,
  BusStaffProfile,
  BusStop,
  BusStopSchedule,
  BusDefaultAssignment,
  StudentBusDefault,
  BusChangeRequest,
  BusManifestGroup,
  BusManifestEntry,
  NoRideEntry,
} from "@/lib/types";

// ── 호차 CRUD ──

export async function listBusNumbers(): Promise<BusNumber[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bus_numbers")
    .select("*")
    .eq("is_active", true)
    .order("label");
  if (error) {
    console.error("[listBusNumbers]", error.message);
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
    console.error("[createBusNumber]", error.message);
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
    console.error("[updateBusNumber]", error.message);
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
    console.error("[deleteBusNumber]", error.message);
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
    .order("direction")
    .order("time");
  if (error) {
    console.error("[listBusTimeSlots]", error.message);
    return [];
  }
  return data as BusTimeSlot[];
}

export async function listAllActiveStudentNames(): Promise<
  { profile_id: string; korean_name: string | null; english_name: string | null; age: number | null }[]
> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("students")
    .select("profile_id, korean_name, english_name, age, profiles!inner(deleted_at)")
    .is("profiles.deleted_at", null);

  if (error) {
    console.error("[listAllActiveStudentNames]", error.message);
    return [];
  }

  return (data ?? []).map((s) => ({
    profile_id: s.profile_id,
    korean_name: s.korean_name,
    english_name: s.english_name,
    age: s.age ?? null,
  }));
}

export async function createBusTimeSlot(
  direction: "pickup" | "dropoff",
  label: string,
  time: string
): Promise<{ error?: string; id?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const trimmed = label.trim();
  if (!trimmed) return { error: "시간대 이름을 입력해 주세요." };
  if (!time) return { error: "시간을 입력해 주세요." };

  const { data, error } = await supabase
    .from("bus_time_slots")
    .insert({ direction, label: trimmed, time })
    .select("id")
    .single();
  if (error) {
    console.error("[createBusTimeSlot]", error.message);
    return { error: error.message };
  }
  return { id: data.id };
}

export async function updateBusTimeSlot(
  id: string,
  label: string,
  time: string
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const trimmed = label.trim();
  if (!trimmed) return { error: "시간대 이름을 입력해 주세요." };

  const { error } = await supabase
    .from("bus_time_slots")
    .update({ label: trimmed, time, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("[updateBusTimeSlot]", error.message);
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
    console.error("[deleteBusTimeSlot]", error.message);
    return { error: error.message };
  }
  return {};
}

// ── 학생 기본 배정 ──

export async function getStudentBusDefaults(
  studentProfileId: string
): Promise<StudentBusDefault[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("student_bus_defaults")
    .select("*")
    .eq("student_profile_id", studentProfileId)
    .order("day_of_week")
    .order("direction");
  if (error) {
    console.error("[getStudentBusDefaults]", error.message);
    return [];
  }

  const slotIds = [...new Set((data ?? []).map((d) => d.bus_time_slot_id))];
  const busIds = [...new Set((data ?? []).map((d) => d.bus_number_id))];
  const stopIds = [...new Set((data ?? []).filter((d) => d.bus_stop_id).map((d) => d.bus_stop_id))];

  let slotMap = new Map<string, { label: string; time: string }>();
  let busMap = new Map<string, string>();
  let stopMap = new Map<string, string>();

  if (slotIds.length) {
    const { data: slots } = await supabase
      .from("bus_time_slots")
      .select("id, label, time")
      .in("id", slotIds);
    slotMap = new Map((slots ?? []).map((s) => [s.id, { label: s.label, time: s.time }]));
  }
  if (busIds.length) {
    const { data: buses } = await supabase
      .from("bus_numbers")
      .select("id, label")
      .in("id", busIds);
    busMap = new Map((buses ?? []).map((b) => [b.id, b.label]));
  }
  if (stopIds.length) {
    const { data: stops } = await supabase
      .from("bus_stops")
      .select("id, name")
      .in("id", stopIds);
    stopMap = new Map((stops ?? []).map((s) => [s.id, s.name]));
  }

  return (data ?? []).map((d) => {
    const slot = slotMap.get(d.bus_time_slot_id);
    return {
      ...d,
      time_slot_label: slot?.label,
      time_slot_time: slot?.time,
      bus_label: busMap.get(d.bus_number_id),
      bus_stop_name: d.bus_stop_id ? (stopMap.get(d.bus_stop_id) ?? null) : null,
    };
  }) as StudentBusDefault[];
}

export async function upsertStudentBusDefault(
  studentProfileId: string,
  dayOfWeek: number,
  direction: "pickup" | "dropoff",
  busTimeSlotId: string,
  busNumberId: string,
  estimatedTime?: string,
  note?: string,
  busStopId?: string
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const { error } = await supabase.from("student_bus_defaults").upsert(
    {
      student_profile_id: studentProfileId,
      day_of_week: dayOfWeek,
      direction,
      bus_time_slot_id: busTimeSlotId,
      bus_number_id: busNumberId,
      estimated_time: estimatedTime || null,
      note: note?.trim() || null,
      bus_stop_id: busStopId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_profile_id,day_of_week,direction" }
  );
  if (error) {
    console.error("[upsertStudentBusDefault]", error.message);
    return { error: error.message };
  }
  return {};
}

export async function deleteStudentBusDefault(id: string): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("student_bus_defaults")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("[deleteStudentBusDefault]", error.message);
    return { error: error.message };
  }
  return {};
}

// ── 일일 매니페스트 (동승자 뷰) ──

export async function getDailyBusManifest(
  date: string,
  direction: "pickup" | "dropoff"
): Promise<{ groups: BusManifestGroup[]; noRides: NoRideEntry[] }> {
  const supabase = createAdminClient();

  const d = new Date(date);
  const jsDay = d.getDay();
  const isoDay = jsDay === 0 ? 7 : jsDay;

  const { data: defaults } = await supabase
    .from("student_bus_defaults")
    .select("*")
    .eq("day_of_week", isoDay)
    .eq("direction", direction);

  const { data: changes } = await supabase
    .from("bus_change_requests")
    .select("*")
    .eq("request_date", date)
    .eq("direction", direction)
    .eq("status", "approved");

  const defaultRows = defaults ?? [];
  const changeRows = changes ?? [];

  if (!defaultRows.length && !changeRows.length) {
    return { groups: [], noRides: [] };
  }

  const allStudentIds = [
    ...new Set([
      ...defaultRows.map((d) => d.student_profile_id),
      ...changeRows.map((c) => c.student_profile_id),
    ]),
  ];
  const { data: studentsRaw } = await supabase
    .from("students")
    .select("profile_id, korean_name, english_name, student_number, age")
    .in("profile_id", allStudentIds);
  const studentMap = new Map(
    (studentsRaw ?? []).map((s) => [s.profile_id, s])
  );

  const allSlotIds = [
    ...new Set([
      ...defaultRows.map((d) => d.bus_time_slot_id),
      ...changeRows.filter((c) => c.new_bus_time_slot_id).map((c) => c.new_bus_time_slot_id),
    ]),
  ];
  const allBusIds = [
    ...new Set([
      ...defaultRows.map((d) => d.bus_number_id),
      ...changeRows.filter((c) => c.new_bus_number_id).map((c) => c.new_bus_number_id),
    ]),
  ];

  let slotMap = new Map<string, { label: string; time: string }>();
  let busMap = new Map<string, string>();

  if (allSlotIds.length) {
    const { data: slots } = await supabase
      .from("bus_time_slots")
      .select("id, label, time")
      .in("id", allSlotIds);
    slotMap = new Map(
      (slots ?? []).map((s) => [s.id, { label: s.label, time: s.time }])
    );
  }
  if (allBusIds.length) {
    const { data: buses } = await supabase
      .from("bus_numbers")
      .select("id, label")
      .in("id", allBusIds);
    busMap = new Map((buses ?? []).map((b) => [b.id, b.label]));
  }

  function getSlotTime(slotId: string): string {
    return slotMap.get(slotId)?.time ?? "";
  }

  const changeMap = new Map(changeRows.map((c) => [c.student_profile_id, c]));

  // 체크 기록 조회
  const { data: checkRecords } = await supabase
    .from("bus_check_records")
    .select("id, student_profile_id, boarded_at, checked_at")
    .eq("check_date", date)
    .eq("direction", direction);
  const checkMap = new Map(
    (checkRecords ?? []).map((r) => [r.student_profile_id, { boarded_at: r.boarded_at, checked_at: r.checked_at, id: r.id }])
  );

  // 정류장별 예상 시간 조회 (해당 요일 기준)
  const changeStopIds = changeRows.filter((c) => c.new_bus_stop_id).map((c) => c.new_bus_stop_id);
  const allStopIds = [
    ...new Set([
      ...defaultRows.filter((r) => r.bus_stop_id).map((r) => r.bus_stop_id),
      ...changeStopIds,
    ]),
  ];
  let stopScheduleMap = new Map<string, Map<string, string>>(); // stopId -> direction -> time
  let stopNameMap = new Map<string, string>();
  if (allStopIds.length) {
    const { data: stopSchedules } = await supabase
      .from("bus_stop_schedules")
      .select("bus_stop_id, direction, estimated_time")
      .in("bus_stop_id", allStopIds)
      .eq("day_of_week", isoDay);
    for (const ss of stopSchedules ?? []) {
      if (!stopScheduleMap.has(ss.bus_stop_id)) stopScheduleMap.set(ss.bus_stop_id, new Map());
      stopScheduleMap.get(ss.bus_stop_id)!.set(ss.direction, ss.estimated_time);
    }
    const { data: stopNames } = await supabase
      .from("bus_stops")
      .select("id, name")
      .in("id", allStopIds);
    stopNameMap = new Map((stopNames ?? []).map((s) => [s.id, s.name]));
  }

  const groupMap = new Map<string, { slotId: string; busId: string; students: BusManifestEntry[] }>();
  const noRides: NoRideEntry[] = [];

  for (const def of defaultRows) {
    const student = studentMap.get(def.student_profile_id);
    if (!student) continue;

    const change = changeMap.get(def.student_profile_id);
    const check = checkMap.get(def.student_profile_id);

    if (change) {
      // 미탑승: noRides로
      // 결석: bus 배정 있으면 해당 그룹에, 없으면 noRides
      if (change.change_type === "no_ride" || (change.change_type === "absent" && !change.new_bus_number_id)) {
        noRides.push({
          student_profile_id: def.student_profile_id,
          korean_name: student.korean_name,
          english_name: student.english_name,
          student_number: student.student_number,
          direction,
          original_slot_time: getSlotTime(def.bus_time_slot_id),
          original_bus_label: busMap.get(def.bus_number_id),
          change_type: change.change_type as "no_ride" | "absent",
          request_id: change.id,
        });
        continue;
      }
      const newSlotId = change.new_bus_time_slot_id!;
      const newBusId = change.new_bus_number_id!;
      const key = `${newSlotId}-${newBusId}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, { slotId: newSlotId, busId: newBusId, students: [] });
      }
      // 변경 학생: 새 정류장 우선, 없으면 원래 정류장
      const newStopId = change.new_bus_stop_id;
      const effectiveStopId = newStopId ?? def.bus_stop_id;
      const stopTime = effectiveStopId ? stopScheduleMap.get(effectiveStopId)?.get(direction) : undefined;
      const stopName = effectiveStopId ? stopNameMap.get(effectiveStopId) : undefined;
      groupMap.get(key)!.students.push({
        student_profile_id: def.student_profile_id,
        korean_name: student.korean_name,
        english_name: student.english_name,
        student_number: student.student_number,
        age: student.age ?? null,
        is_changed: true,
        estimated_time: stopTime ?? def.estimated_time,
        note: def.note,
        bus_stop_name: stopName ?? null,
        original_slot_time: getSlotTime(def.bus_time_slot_id),
        original_bus_label: busMap.get(def.bus_number_id),
        boarded_at: check?.boarded_at ?? null,
        checked_at: check?.checked_at ?? null,
        check_record_id: check?.id ?? null,
      });
    } else {
      const key = `${def.bus_time_slot_id}-${def.bus_number_id}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, { slotId: def.bus_time_slot_id, busId: def.bus_number_id, students: [] });
      }
      // 정류장 시간 우선, 없으면 개별 시간 사용
      const stopTime2 = def.bus_stop_id ? stopScheduleMap.get(def.bus_stop_id)?.get(direction) : undefined;
      const stopName2 = def.bus_stop_id ? stopNameMap.get(def.bus_stop_id) : undefined;
      groupMap.get(key)!.students.push({
        student_profile_id: def.student_profile_id,
        korean_name: student.korean_name,
        english_name: student.english_name,
        student_number: student.student_number,
        age: student.age ?? null,
        is_changed: false,
        estimated_time: stopTime2 ?? def.estimated_time,
        note: def.note,
        bus_stop_name: stopName2 ?? null,
        boarded_at: check?.boarded_at ?? null,
        checked_at: check?.checked_at ?? null,
        check_record_id: check?.id ?? null,
      });
    }
  }

  const groups: BusManifestGroup[] = [...groupMap.values()]
    .map((g) => ({
      bus_time_slot_id: g.slotId,
      slot_time: getSlotTime(g.slotId),
      slot_label: slotMap.get(g.slotId)?.label ?? "",
      bus_number_id: g.busId,
      bus_label: busMap.get(g.busId) ?? "",
      students: g.students,
    }))
    .sort((a, b) => {
      const timeCmp = a.slot_time.localeCompare(b.slot_time);
      if (timeCmp !== 0) return timeCmp;
      return a.bus_label.localeCompare(b.bus_label);
    });

  return { groups, noRides };
}

// ── 탑승 체크 ──

export async function boardBusStudent(
  studentProfileId: string,
  checkDate: string,
  direction: "pickup" | "dropoff",
  busTimeSlotId: string,
  busNumberId: string
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const { error } = await supabase.from("bus_check_records").upsert(
    {
      student_profile_id: studentProfileId,
      check_date: checkDate,
      direction,
      bus_time_slot_id: busTimeSlotId,
      bus_number_id: busNumberId,
      boarded_at: new Date().toISOString(),
    },
    { onConflict: "student_profile_id,check_date,direction" }
  );
  if (error) {
    console.error("[boardBusStudent]", error.message);
    return { error: error.message };
  }
  return {};
}

export async function unboardBusStudent(
  studentProfileId: string,
  checkDate: string,
  direction: "pickup" | "dropoff"
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();

  // 기존 레코드 확인
  const { data: record } = await supabase
    .from("bus_check_records")
    .select("id, checked_at")
    .eq("student_profile_id", studentProfileId)
    .eq("check_date", checkDate)
    .eq("direction", direction)
    .maybeSingle();

  if (!record) return {};

  // checked_at도 null이면 레코드 삭제 (불필요 레코드 정리)
  if (!record.checked_at) {
    const { error } = await supabase
      .from("bus_check_records")
      .delete()
      .eq("id", record.id);
    if (error) {
      console.error("[unboardBusStudent]", error.message);
      return { error: error.message };
    }
  } else {
    // checked_at이 있으면 boarded_at만 null로
    const { error } = await supabase
      .from("bus_check_records")
      .update({ boarded_at: null })
      .eq("id", record.id);
    if (error) {
      console.error("[unboardBusStudent]", error.message);
      return { error: error.message };
    }
  }

  return {};
}

// ── 하차 체크 ──

export async function checkBusStudent(
  studentProfileId: string,
  checkDate: string,
  direction: "pickup" | "dropoff",
  busTimeSlotId: string,
  busNumberId: string,
  checkedBy: string
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const { error } = await supabase.from("bus_check_records").upsert(
    {
      student_profile_id: studentProfileId,
      check_date: checkDate,
      direction,
      bus_time_slot_id: busTimeSlotId,
      bus_number_id: busNumberId,
      checked_at: new Date().toISOString(),
      checked_by: checkedBy,
    },
    { onConflict: "student_profile_id,check_date,direction" }
  );
  if (error) {
    console.error("[checkBusStudent]", error.message);
    return { error: error.message };
  }
  return {};
}

export async function uncheckBusStudent(
  studentProfileId: string,
  checkDate: string,
  direction: "pickup" | "dropoff"
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();

  // boarded_at이 있으면 checked_at만 null로 (탑승 상태로 복귀)
  // boarded_at도 없으면 레코드 삭제
  const { data: record } = await supabase
    .from("bus_check_records")
    .select("id, boarded_at")
    .eq("student_profile_id", studentProfileId)
    .eq("check_date", checkDate)
    .eq("direction", direction)
    .maybeSingle();

  if (!record) return {};

  if (record.boarded_at) {
    const { error } = await supabase
      .from("bus_check_records")
      .update({ checked_at: null, checked_by: null })
      .eq("id", record.id);
    if (error) {
      console.error("[uncheckBusStudent]", error.message);
      return { error: error.message };
    }
  } else {
    const { error } = await supabase
      .from("bus_check_records")
      .delete()
      .eq("id", record.id);
    if (error) {
      console.error("[uncheckBusStudent]", error.message);
      return { error: error.message };
    }
  }

  return {};
}

// ── 변경 요청 관리 ──

export async function listPendingChangeRequests(): Promise<BusChangeRequest[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bus_change_requests")
    .select("*")
    .eq("status", "pending")
    .order("requested_at", { ascending: true });
  if (error) {
    console.error("[listPendingChangeRequests]", error.message);
    return [];
  }

  const studentIds = [...new Set((data ?? []).map((d) => d.student_profile_id))];
  let studentMap = new Map<string, { korean_name: string | null; english_name: string | null; student_number: string | null }>();
  if (studentIds.length) {
    const { data: students } = await supabase
      .from("students")
      .select("profile_id, korean_name, english_name, student_number")
      .in("profile_id", studentIds);
    studentMap = new Map((students ?? []).map((s) => [s.profile_id, s]));
  }

  const slotIds = [...new Set((data ?? []).filter((d) => d.new_bus_time_slot_id).map((d) => d.new_bus_time_slot_id))];
  const busIds = [...new Set((data ?? []).filter((d) => d.new_bus_number_id).map((d) => d.new_bus_number_id))];
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
    const student = studentMap.get(d.student_profile_id);
    const slot = d.new_bus_time_slot_id ? slotMap.get(d.new_bus_time_slot_id) : undefined;
    return {
      ...d,
      korean_name: student?.korean_name ?? null,
      english_name: student?.english_name ?? null,
      student_number: student?.student_number ?? null,
      new_time_slot_label: slot?.label,
      new_time_slot_time: slot?.time,
      new_bus_label: d.new_bus_number_id ? busMap.get(d.new_bus_number_id) : undefined,
    };
  }) as BusChangeRequest[];
}

export async function approveChangeRequest(
  requestId: string,
  reviewerId: string,
  reviewNote?: string
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("bus_change_requests")
    .update({
      status: "approved",
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      review_note: reviewNote?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "pending");
  if (error) {
    console.error("[approveChangeRequest]", error.message);
    return { error: error.message };
  }
  return {};
}

export async function rejectChangeRequest(
  requestId: string,
  reviewerId: string,
  reviewNote?: string
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
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
    .eq("id", requestId)
    .eq("status", "pending");
  if (error) {
    console.error("[rejectChangeRequest]", error.message);
    return { error: error.message };
  }
  return {};
}

export async function getStudentChangeRequests(
  studentProfileId: string
): Promise<BusChangeRequest[]> {
  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("bus_change_requests")
    .select("*")
    .eq("student_profile_id", studentProfileId)
    .gte("request_date", today)
    .order("request_date");
  if (error) {
    console.error("[getStudentChangeRequests]", error.message);
    return [];
  }

  const slotIds = [...new Set((data ?? []).filter((d) => d.new_bus_time_slot_id).map((d) => d.new_bus_time_slot_id))];
  const busIds = [...new Set((data ?? []).filter((d) => d.new_bus_number_id).map((d) => d.new_bus_number_id))];
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
  direction: "pickup" | "dropoff",
  changeType: "change" | "no_ride",
  newBusTimeSlotId?: string,
  newBusNumberId?: string,
  reason?: string
): Promise<{ error?: string }> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();

  if (changeType === "change" && (!newBusTimeSlotId || !newBusNumberId)) {
    return { error: "변경할 시간대와 호차를 선택해 주세요." };
  }

  const { error } = await supabase.from("bus_change_requests").insert({
    student_profile_id: studentProfileId,
    request_date: requestDate,
    direction,
    change_type: changeType,
    new_bus_time_slot_id: changeType === "change" ? newBusTimeSlotId : null,
    new_bus_number_id: changeType === "change" ? newBusNumberId : null,
    reason: reason?.trim() || null,
  });

  if (error) {
    if (error.code === "23505") return { error: "해당 날짜에 이미 변경 요청이 있습니다." };
    console.error("[submitBusChangeRequest]", error.message);
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
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("bus_change_requests")
    .delete()
    .eq("id", requestId)
    .eq("student_profile_id", studentProfileId)
    .eq("status", "pending");
  if (error) {
    console.error("[cancelBusChangeRequest]", error.message);
    return { error: error.message };
  }
  return {};
}

// ── 관리자 당일 변경/결석 ──

// 결석 시 특수 호차 + 결석 정류장 자동 조회
async function resolveAbsentBusInfo(
  supabase: ReturnType<typeof createAdminClient>,
  studentProfileId: string,
  requestDate: string,
  direction: "pickup" | "dropoff"
): Promise<{ slotId: string | null; busId: string | null; stopId: string | null }> {
  // 특수 호차 찾기
  const { data: busRow } = await supabase
    .from("bus_numbers")
    .select("id")
    .eq("label", "특수")
    .eq("is_active", true)
    .maybeSingle();
  if (!busRow) return { slotId: null, busId: null, stopId: null };

  // 결석 정류장 찾기
  const { data: stopRow } = await supabase
    .from("bus_stops")
    .select("id")
    .eq("bus_number_id", busRow.id)
    .eq("name", "결석")
    .eq("is_active", true)
    .maybeSingle();

  // 학생의 원래 시간대 가져오기
  const d = new Date(requestDate);
  const jsDay = d.getDay();
  const isoDay = jsDay === 0 ? 7 : jsDay;
  const { data: defRow } = await supabase
    .from("student_bus_defaults")
    .select("bus_time_slot_id")
    .eq("student_profile_id", studentProfileId)
    .eq("day_of_week", isoDay)
    .eq("direction", direction)
    .maybeSingle();

  return {
    slotId: defRow?.bus_time_slot_id ?? null,
    busId: busRow.id,
    stopId: stopRow?.id ?? null,
  };
}

export async function createAdminBusChange(
  studentProfileId: string,
  requestDate: string,
  direction: "pickup" | "dropoff",
  changeType: "change" | "no_ride" | "absent",
  newBusTimeSlotId?: string,
  newBusNumberId?: string,
  newBusStopId?: string,
  reason?: string
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  if (changeType === "change" && (!newBusTimeSlotId || !newBusNumberId)) {
    return { error: "변경할 시간대와 호차를 선택해 주세요." };
  }

  const supabase = createAdminClient();

  let finalSlotId = changeType === "change" ? (newBusTimeSlotId ?? null) : null;
  let finalBusId = changeType === "change" ? (newBusNumberId ?? null) : null;
  let finalStopId = changeType === "change" ? (newBusStopId || null) : null;

  // 결석 → 특수 호차 + 결석 정류장 자동 배정
  if (changeType === "absent") {
    const info = await resolveAbsentBusInfo(supabase, studentProfileId, requestDate, direction);
    finalSlotId = info.slotId;
    finalBusId = info.busId;
    finalStopId = info.stopId;
  }

  const { error } = await supabase.from("bus_change_requests").insert({
    student_profile_id: studentProfileId,
    request_date: requestDate,
    direction,
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
    console.error("[createAdminBusChange]", error.message);
    return { error: error.message };
  }
  return {};
}

export async function updateAdminBusChange(
  requestId: string,
  studentProfileId: string,
  requestDate: string,
  direction: "pickup" | "dropoff",
  changeType: "change" | "no_ride" | "absent",
  newBusTimeSlotId?: string,
  newBusNumberId?: string,
  newBusStopId?: string,
  reason?: string
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  if (changeType === "change" && (!newBusTimeSlotId || !newBusNumberId)) {
    return { error: "변경할 시간대와 호차를 선택해 주세요." };
  }

  const supabase = createAdminClient();

  let finalSlotId = changeType === "change" ? (newBusTimeSlotId ?? null) : null;
  let finalBusId = changeType === "change" ? (newBusNumberId ?? null) : null;
  let finalStopId = changeType === "change" ? (newBusStopId || null) : null;

  if (changeType === "absent") {
    const info = await resolveAbsentBusInfo(supabase, studentProfileId, requestDate, direction);
    finalSlotId = info.slotId;
    finalBusId = info.busId;
    finalStopId = info.stopId;
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
    console.error("[updateAdminBusChange]", error.message);
    return { error: error.message };
  }
  return {};
}

export async function getExistingBusChange(
  studentProfileId: string,
  requestDate: string,
  direction: "pickup" | "dropoff"
): Promise<{
  id: string;
  change_type: "change" | "no_ride" | "absent";
  new_bus_time_slot_id: string | null;
  new_bus_number_id: string | null;
  new_bus_stop_id: string | null;
  reason: string | null;
} | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("bus_change_requests")
    .select("id, change_type, new_bus_time_slot_id, new_bus_number_id, new_bus_stop_id, reason")
    .eq("student_profile_id", studentProfileId)
    .eq("request_date", requestDate)
    .eq("direction", direction)
    .eq("status", "approved")
    .maybeSingle();
  return data as typeof data & { change_type: "change" | "no_ride" | "absent" } | null;
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
    console.error("[deleteAdminBusChange]", error.message);
    return { error: error.message };
  }
  return {};
}

// ── 정류장 CRUD ──

export async function listBusStops(busNumberId?: string): Promise<BusStop[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("bus_stops")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");
  if (busNumberId) {
    query = query.eq("bus_number_id", busNumberId);
  }
  const { data, error } = await query;
  if (error) {
    console.error("[listBusStops]", error.message);
    return [];
  }
  return data as BusStop[];
}

export async function createBusStop(
  busNumberId: string,
  name: string
): Promise<{ error?: string; id?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const trimmed = name.trim();
  if (!trimmed) return { error: "정류장 이름을 입력해 주세요." };

  // auto sort_order: max + 1
  const { data: existing } = await supabase
    .from("bus_stops")
    .select("sort_order")
    .eq("bus_number_id", busNumberId)
    .eq("is_active", true)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("bus_stops")
    .insert({ bus_number_id: busNumberId, name: trimmed, sort_order: nextOrder })
    .select("id")
    .single();
  if (error) {
    console.error("[createBusStop]", error.message);
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
    console.error("[updateBusStop]", error.message);
    return { error: error.message };
  }
  return {};
}

export async function deleteBusStop(id: string): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();

  // null out student_bus_defaults references
  await supabase
    .from("student_bus_defaults")
    .update({ bus_stop_id: null, updated_at: new Date().toISOString() })
    .eq("bus_stop_id", id);

  const { error } = await supabase
    .from("bus_stops")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("[deleteBusStop]", error.message);
    return { error: error.message };
  }
  return {};
}

// ── 일괄 배정 저장 ──

export async function saveBulkBusDefaults(
  dayOfWeek: number,
  direction: "pickup" | "dropoff",
  assignments: { student_profile_id: string; bus_number_id: string; bus_time_slot_id: string; bus_stop_id?: string | null }[]
): Promise<{ error?: string; saved?: number }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();

  // 1. 기존 배정 전부 조회
  const { data: existing, error: fetchErr } = await supabase
    .from("student_bus_defaults")
    .select("id, student_profile_id")
    .eq("day_of_week", dayOfWeek)
    .eq("direction", direction);
  if (fetchErr) {
    console.error("[saveBulkBusDefaults] fetch", fetchErr.message);
    return { error: fetchErr.message };
  }

  const newMap = new Map(assignments.map((a) => [a.student_profile_id, a]));
  const existingMap = new Map((existing ?? []).map((e) => [e.student_profile_id, e.id]));

  // 2. 삭제: 서버에 있지만 새 목록에 없는 배정
  const toDelete = (existing ?? []).filter((e) => !newMap.has(e.student_profile_id)).map((e) => e.id);
  if (toDelete.length) {
    const { error: delErr } = await supabase
      .from("student_bus_defaults")
      .delete()
      .in("id", toDelete);
    if (delErr) {
      console.error("[saveBulkBusDefaults] delete", delErr.message);
      return { error: delErr.message };
    }
  }

  // 3. Upsert: 새 목록의 모든 배정
  if (assignments.length) {
    const now = new Date().toISOString();
    const rows = assignments.map((a) => ({
      student_profile_id: a.student_profile_id,
      day_of_week: dayOfWeek,
      direction,
      bus_time_slot_id: a.bus_time_slot_id,
      bus_number_id: a.bus_number_id,
      bus_stop_id: a.bus_stop_id ?? null,
      updated_at: now,
    }));
    const { error: upsertErr } = await supabase
      .from("student_bus_defaults")
      .upsert(rows, { onConflict: "student_profile_id,day_of_week,direction" });
    if (upsertErr) {
      console.error("[saveBulkBusDefaults] upsert", upsertErr.message);
      return { error: upsertErr.message };
    }
  }

  return { saved: assignments.length + toDelete.length };
}

// ── 일괄 배정 조회 ──

export async function getBulkBusDefaults(
  dayOfWeek: number,
  direction: "pickup" | "dropoff",
  busTimeSlotId?: string
): Promise<BusDefaultAssignment[]> {
  const auth = await verifyAdmin();
  if ("error" in auth) return [];
  const supabase = createAdminClient();

  let query = supabase
    .from("student_bus_defaults")
    .select("*")
    .eq("day_of_week", dayOfWeek)
    .eq("direction", direction);
  if (busTimeSlotId) {
    query = query.eq("bus_time_slot_id", busTimeSlotId);
  }

  const { data: defaults, error } = await query;
  if (error) {
    console.error("[getBulkBusDefaults]", error.message);
    return [];
  }
  if (!defaults?.length) return [];

  // batch fetch students
  const profileIds = [...new Set(defaults.map((d) => d.student_profile_id))];
  const { data: students } = await supabase
    .from("students")
    .select("profile_id, korean_name, english_name, age")
    .in("profile_id", profileIds);
  const studentMap = new Map((students ?? []).map((s) => [s.profile_id, s]));

  // batch fetch bus stops
  const stopIds = [...new Set(defaults.filter((d) => d.bus_stop_id).map((d) => d.bus_stop_id))];
  let stopMap = new Map<string, string>();
  if (stopIds.length) {
    const { data: stops } = await supabase
      .from("bus_stops")
      .select("id, name")
      .in("id", stopIds);
    stopMap = new Map((stops ?? []).map((s) => [s.id, s.name]));
  }

  return defaults.map((d) => {
    const student = studentMap.get(d.student_profile_id);
    return {
      id: d.id,
      student_profile_id: d.student_profile_id,
      korean_name: student?.korean_name ?? null,
      english_name: student?.english_name ?? null,
      age: student?.age ?? null,
      bus_number_id: d.bus_number_id,
      bus_stop_id: d.bus_stop_id ?? null,
      bus_stop_name: d.bus_stop_id ? (stopMap.get(d.bus_stop_id) ?? null) : null,
      bus_time_slot_id: d.bus_time_slot_id,
      estimated_time: d.estimated_time ?? null,
      note: d.note ?? null,
    };
  });
}

// ── 버스 담당자 CRUD ──

export async function createBusStaff(
  formData: FormData
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const email = normalizeEmail((formData.get("email") as string) ?? "");
  const password = (formData.get("password") as string) ?? "";
  const name = (formData.get("name") as string)?.trim() ?? "";
  const busNumberId = (formData.get("bus_number_id") as string) || null;

  if (!email || !password || !name) {
    return { error: "아이디, 비밀번호, 이름을 입력해 주세요." };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: name,
      last_name: "",
      role: "bus",
      name,
    },
  });

  if (error) {
    console.error("[createBusStaff]", error.message, { email });
    return { error: error.message };
  }
  if (!data.user) {
    return { error: "사용자 생성에 실패했습니다." };
  }

  // 트리거가 bus_staff 레코드를 자동 생성 → bus_number_id 업데이트
  if (busNumberId) {
    await supabase
      .from("bus_staff")
      .update({ bus_number_id: busNumberId, updated_at: new Date().toISOString() })
      .eq("profile_id", data.user.id);
  }

  return {};
}

export async function listBusStaff(): Promise<BusStaffProfile[]> {
  const supabase = createAdminClient();

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, first_name")
    .eq("role", "bus")
    .is("deleted_at", null);

  if (profilesError) {
    console.error("[listBusStaff]", profilesError.message);
    return [];
  }
  if (!profiles?.length) return [];

  const ids = profiles.map((p) => p.id);

  // Auth 이메일 조회
  const { data: users } = await supabase.auth.admin.listUsers();
  const userMap = new Map(
    (users?.users ?? []).filter((u) => ids.includes(u.id)).map((u) => [u.id, u])
  );

  // bus_staff 조인
  const { data: staffRows } = await supabase
    .from("bus_staff")
    .select("id, profile_id, name, bus_number_id, created_at")
    .in("profile_id", ids);
  const staffMap = new Map(
    (staffRows ?? []).map((s) => [s.profile_id, s])
  );

  // bus_numbers 조인
  const busIds = [...new Set((staffRows ?? []).filter((s) => s.bus_number_id).map((s) => s.bus_number_id))];
  let busMap = new Map<string, string>();
  if (busIds.length) {
    const { data: buses } = await supabase
      .from("bus_numbers")
      .select("id, label")
      .in("id", busIds);
    busMap = new Map((buses ?? []).map((b) => [b.id, b.label]));
  }

  return profiles.map((p) => {
    const u = userMap.get(p.id);
    const s = staffMap.get(p.id);
    return {
      id: s?.id ?? "",
      profile_id: p.id,
      email: u?.email ?? "",
      name: s?.name ?? p.first_name ?? "",
      bus_number_id: s?.bus_number_id ?? null,
      bus_label: s?.bus_number_id ? (busMap.get(s.bus_number_id) ?? null) : null,
      created_at: s?.created_at ?? "",
    };
  }) as BusStaffProfile[];
}

export async function updateBusStaff(
  profileId: string,
  name: string,
  busNumberId: string | null
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const trimmed = name.trim();
  if (!trimmed) return { error: "이름을 입력해 주세요." };

  const supabase = createAdminClient();

  const { error: staffError } = await supabase
    .from("bus_staff")
    .update({
      name: trimmed,
      bus_number_id: busNumberId || null,
      updated_at: new Date().toISOString(),
    })
    .eq("profile_id", profileId);

  if (staffError) {
    console.error("[updateBusStaff]", staffError.message);
    return { error: staffError.message };
  }

  // profiles.first_name도 동기화
  await supabase
    .from("profiles")
    .update({ first_name: trimmed })
    .eq("id", profileId);

  return {};
}

// ── 정류장 시간표 (요일별 예상 시간) ──

export async function listBusStopSchedules(
  busStopId: string
): Promise<BusStopSchedule[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bus_stop_schedules")
    .select("*")
    .eq("bus_stop_id", busStopId)
    .order("day_of_week")
    .order("direction");
  if (error) {
    console.error("[listBusStopSchedules]", error.message);
    return [];
  }
  return data as BusStopSchedule[];
}

export async function upsertBusStopSchedule(
  busStopId: string,
  dayOfWeek: number,
  direction: "pickup" | "dropoff",
  estimatedTime: string
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
      direction,
      estimated_time: estimatedTime,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "bus_stop_id,day_of_week,direction" }
  );
  if (error) {
    console.error("[upsertBusStopSchedule]", error.message);
    return { error: error.message };
  }
  return {};
}

export async function deleteBusStopSchedule(
  busStopId: string,
  dayOfWeek: number,
  direction: "pickup" | "dropoff"
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("bus_stop_schedules")
    .delete()
    .eq("bus_stop_id", busStopId)
    .eq("day_of_week", dayOfWeek)
    .eq("direction", direction);
  if (error) {
    console.error("[deleteBusStopSchedule]", error.message);
    return { error: error.message };
  }
  return {};
}
