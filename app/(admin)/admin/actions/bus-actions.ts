"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeEmail } from "@/lib/auth-utils";
import { verifyAdmin, verifyAuthenticated } from "./auth-helpers";
import type {
  BusNumber,
  BusTimeSlot,
  BusStaffProfile,
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

  let slotMap = new Map<string, { label: string; time: string }>();
  let busMap = new Map<string, string>();

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

  return (data ?? []).map((d) => {
    const slot = slotMap.get(d.bus_time_slot_id);
    return {
      ...d,
      time_slot_label: slot?.label,
      time_slot_time: slot?.time,
      bus_label: busMap.get(d.bus_number_id),
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
  note?: string
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
    .select("profile_id, korean_name, english_name, student_number")
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

  const groupMap = new Map<string, { slotId: string; busId: string; students: BusManifestEntry[] }>();
  const noRides: NoRideEntry[] = [];

  for (const def of defaultRows) {
    const student = studentMap.get(def.student_profile_id);
    if (!student) continue;

    const change = changeMap.get(def.student_profile_id);
    const check = checkMap.get(def.student_profile_id);

    if (change) {
      if (change.change_type === "no_ride") {
        noRides.push({
          student_profile_id: def.student_profile_id,
          korean_name: student.korean_name,
          english_name: student.english_name,
          student_number: student.student_number,
          direction,
          original_slot_time: getSlotTime(def.bus_time_slot_id),
          original_bus_label: busMap.get(def.bus_number_id),
        });
        continue;
      }
      const newSlotId = change.new_bus_time_slot_id!;
      const newBusId = change.new_bus_number_id!;
      const key = `${newSlotId}-${newBusId}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, { slotId: newSlotId, busId: newBusId, students: [] });
      }
      groupMap.get(key)!.students.push({
        student_profile_id: def.student_profile_id,
        korean_name: student.korean_name,
        english_name: student.english_name,
        student_number: student.student_number,
        is_changed: true,
        estimated_time: def.estimated_time,
        note: def.note,
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
      groupMap.get(key)!.students.push({
        student_profile_id: def.student_profile_id,
        korean_name: student.korean_name,
        english_name: student.english_name,
        student_number: student.student_number,
        is_changed: false,
        estimated_time: def.estimated_time,
        note: def.note,
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
