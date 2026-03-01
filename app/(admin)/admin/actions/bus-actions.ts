"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  BusNumber,
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

  const periodIds = [...new Set((data ?? []).map((d) => d.academy_period_id))];
  const busIds = [...new Set((data ?? []).map((d) => d.bus_number_id))];

  let periodMap = new Map<string, { name: string; start_time: string; end_time: string }>();
  let busMap = new Map<string, string>();

  if (periodIds.length) {
    const { data: periods } = await supabase
      .from("academy_periods")
      .select("id, name, start_time, end_time")
      .in("id", periodIds);
    periodMap = new Map((periods ?? []).map((p) => [p.id, { name: p.name, start_time: p.start_time, end_time: p.end_time }]));
  }
  if (busIds.length) {
    const { data: buses } = await supabase
      .from("bus_numbers")
      .select("id, label")
      .in("id", busIds);
    busMap = new Map((buses ?? []).map((b) => [b.id, b.label]));
  }

  return (data ?? []).map((d) => {
    const period = periodMap.get(d.academy_period_id);
    const periodTime = d.direction === "pickup" ? period?.start_time : period?.end_time;
    return {
      ...d,
      period_name: period?.name,
      period_time: periodTime,
      bus_label: busMap.get(d.bus_number_id),
    };
  }) as StudentBusDefault[];
}

export async function upsertStudentBusDefault(
  studentProfileId: string,
  dayOfWeek: number,
  direction: "pickup" | "dropoff",
  academyPeriodId: string,
  busNumberId: string,
  estimatedTime?: string,
  note?: string
): Promise<{ error?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("student_bus_defaults").upsert(
    {
      student_profile_id: studentProfileId,
      day_of_week: dayOfWeek,
      direction,
      academy_period_id: academyPeriodId,
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

  const allPeriodIds = [
    ...new Set([
      ...defaultRows.map((d) => d.academy_period_id),
      ...changeRows.filter((c) => c.new_academy_period_id).map((c) => c.new_academy_period_id),
    ]),
  ];
  const allBusIds = [
    ...new Set([
      ...defaultRows.map((d) => d.bus_number_id),
      ...changeRows.filter((c) => c.new_bus_number_id).map((c) => c.new_bus_number_id),
    ]),
  ];

  let periodMap = new Map<string, { name: string; start_time: string; end_time: string }>();
  let busMap = new Map<string, string>();

  if (allPeriodIds.length) {
    const { data: periods } = await supabase
      .from("academy_periods")
      .select("id, name, start_time, end_time")
      .in("id", allPeriodIds);
    periodMap = new Map(
      (periods ?? []).map((p) => [p.id, { name: p.name, start_time: p.start_time, end_time: p.end_time }])
    );
  }
  if (allBusIds.length) {
    const { data: buses } = await supabase
      .from("bus_numbers")
      .select("id, label")
      .in("id", allBusIds);
    busMap = new Map((buses ?? []).map((b) => [b.id, b.label]));
  }

  function getPeriodTime(periodId: string): string {
    const p = periodMap.get(periodId);
    if (!p) return "";
    return direction === "pickup" ? p.start_time : p.end_time;
  }

  const changeMap = new Map(changeRows.map((c) => [c.student_profile_id, c]));

  const groupMap = new Map<string, { periodId: string; busId: string; students: BusManifestEntry[] }>();
  const noRides: NoRideEntry[] = [];

  for (const def of defaultRows) {
    const student = studentMap.get(def.student_profile_id);
    if (!student) continue;

    const change = changeMap.get(def.student_profile_id);

    if (change) {
      if (change.change_type === "no_ride") {
        noRides.push({
          student_profile_id: def.student_profile_id,
          korean_name: student.korean_name,
          english_name: student.english_name,
          student_number: student.student_number,
          direction,
          original_period_time: getPeriodTime(def.academy_period_id),
          original_bus_label: busMap.get(def.bus_number_id),
        });
        continue;
      }
      const newPeriodId = change.new_academy_period_id!;
      const newBusId = change.new_bus_number_id!;
      const key = `${newPeriodId}-${newBusId}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, { periodId: newPeriodId, busId: newBusId, students: [] });
      }
      groupMap.get(key)!.students.push({
        student_profile_id: def.student_profile_id,
        korean_name: student.korean_name,
        english_name: student.english_name,
        student_number: student.student_number,
        is_changed: true,
        estimated_time: def.estimated_time,
        note: def.note,
        original_period_time: getPeriodTime(def.academy_period_id),
        original_bus_label: busMap.get(def.bus_number_id),
      });
    } else {
      const key = `${def.academy_period_id}-${def.bus_number_id}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, { periodId: def.academy_period_id, busId: def.bus_number_id, students: [] });
      }
      groupMap.get(key)!.students.push({
        student_profile_id: def.student_profile_id,
        korean_name: student.korean_name,
        english_name: student.english_name,
        student_number: student.student_number,
        is_changed: false,
        estimated_time: def.estimated_time,
        note: def.note,
      });
    }
  }

  const groups: BusManifestGroup[] = [...groupMap.values()]
    .map((g) => ({
      academy_period_id: g.periodId,
      period_time: getPeriodTime(g.periodId),
      period_name: periodMap.get(g.periodId)?.name ?? "",
      bus_number_id: g.busId,
      bus_label: busMap.get(g.busId) ?? "",
      students: g.students,
    }))
    .sort((a, b) => {
      const timeCmp = a.period_time.localeCompare(b.period_time);
      if (timeCmp !== 0) return timeCmp;
      return a.bus_label.localeCompare(b.bus_label);
    });

  return { groups, noRides };
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

  const periodIds = [...new Set((data ?? []).filter((d) => d.new_academy_period_id).map((d) => d.new_academy_period_id))];
  const busIds = [...new Set((data ?? []).filter((d) => d.new_bus_number_id).map((d) => d.new_bus_number_id))];
  let periodMap = new Map<string, { name: string; start_time: string; end_time: string }>();
  let busMap = new Map<string, string>();

  if (periodIds.length) {
    const { data: periods } = await supabase.from("academy_periods").select("id, name, start_time, end_time").in("id", periodIds);
    periodMap = new Map((periods ?? []).map((p) => [p.id, { name: p.name, start_time: p.start_time, end_time: p.end_time }]));
  }
  if (busIds.length) {
    const { data: buses } = await supabase.from("bus_numbers").select("id, label").in("id", busIds);
    busMap = new Map((buses ?? []).map((b) => [b.id, b.label]));
  }

  return (data ?? []).map((d) => {
    const student = studentMap.get(d.student_profile_id);
    const period = d.new_academy_period_id ? periodMap.get(d.new_academy_period_id) : undefined;
    const periodTime = period ? (d.direction === "pickup" ? period.start_time : period.end_time) : undefined;
    return {
      ...d,
      korean_name: student?.korean_name ?? null,
      english_name: student?.english_name ?? null,
      student_number: student?.student_number ?? null,
      new_period_name: period?.name,
      new_period_time: periodTime,
      new_bus_label: d.new_bus_number_id ? busMap.get(d.new_bus_number_id) : undefined,
    };
  }) as BusChangeRequest[];
}

export async function approveChangeRequest(
  requestId: string,
  reviewerId: string,
  reviewNote?: string
): Promise<{ error?: string }> {
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

  const periodIds = [...new Set((data ?? []).filter((d) => d.new_academy_period_id).map((d) => d.new_academy_period_id))];
  const busIds = [...new Set((data ?? []).filter((d) => d.new_bus_number_id).map((d) => d.new_bus_number_id))];
  let periodMap = new Map<string, { name: string; start_time: string; end_time: string }>();
  let busMap = new Map<string, string>();

  if (periodIds.length) {
    const { data: periods } = await supabase.from("academy_periods").select("id, name, start_time, end_time").in("id", periodIds);
    periodMap = new Map((periods ?? []).map((p) => [p.id, { name: p.name, start_time: p.start_time, end_time: p.end_time }]));
  }
  if (busIds.length) {
    const { data: buses } = await supabase.from("bus_numbers").select("id, label").in("id", busIds);
    busMap = new Map((buses ?? []).map((b) => [b.id, b.label]));
  }

  return (data ?? []).map((d) => {
    const period = d.new_academy_period_id ? periodMap.get(d.new_academy_period_id) : undefined;
    const periodTime = period ? (d.direction === "pickup" ? period.start_time : period.end_time) : undefined;
    return {
      ...d,
      new_period_name: period?.name,
      new_period_time: periodTime,
      new_bus_label: d.new_bus_number_id ? busMap.get(d.new_bus_number_id) : undefined,
    };
  }) as BusChangeRequest[];
}

export async function submitBusChangeRequest(
  studentProfileId: string,
  requestDate: string,
  direction: "pickup" | "dropoff",
  changeType: "change" | "no_ride",
  newAcademyPeriodId?: string,
  newBusNumberId?: string,
  reason?: string
): Promise<{ error?: string }> {
  const supabase = createAdminClient();

  if (changeType === "change" && (!newAcademyPeriodId || !newBusNumberId)) {
    return { error: "변경할 수업 시간대와 호차를 선택해 주세요." };
  }

  const { error } = await supabase.from("bus_change_requests").insert({
    student_profile_id: studentProfileId,
    request_date: requestDate,
    direction,
    change_type: changeType,
    new_academy_period_id: changeType === "change" ? newAcademyPeriodId : null,
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
