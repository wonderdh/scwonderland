"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeEmail } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";
import { verifyAdmin, verifyAuthenticated } from "./auth-helpers";
import { logger } from "@/lib/logger";
import { todayKst } from "@/lib/utils/date-kst";
import type {
  BusNumber,
  BusTimeSlot,
  BusStaffProfile,
  BusStop,
  BusStopDayAssignment,
  BusStopSchedule,
  BusDefaultAssignment,
  StudentBusDefault,
  BusChangeRequest,
  BusManifestGroup,
  BusManifestEntry,
  BusManifestExtraStop,
  NoRideEntry,
  AfterSchoolBusEntry,
  DropoffExportRow,
  DropoffExportData,
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

export async function listAllActiveStudentNames(): Promise<
  { profile_id: string; korean_name: string | null; english_name: string | null; age: number | null; group_label: string | null }[]
> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("students")
    .select("profile_id, korean_name, english_name, age, profiles!inner(deleted_at)")
    .is("profiles.deleted_at", null);

  if (error) {
    logger.error("[listAllActiveStudentNames]", error.message);
    return [];
  }

  // group_label 조회: class_students → classes.group_label
  const profileIds = (data ?? []).map((s) => s.profile_id);
  let groupMap = new Map<string, string>();
  if (profileIds.length) {
    const { data: classLinks } = await supabase
      .from("class_students")
      .select("student_profile_id, classes!inner(group_label)")
      .in("student_profile_id", profileIds);
    for (const link of classLinks ?? []) {
      const gl = (link.classes as unknown as { group_label: string | null })?.group_label;
      if (gl && !groupMap.has(link.student_profile_id)) {
        groupMap.set(link.student_profile_id, gl);
      }
    }
  }

  return (data ?? []).map((s) => ({
    profile_id: s.profile_id,
    korean_name: s.korean_name,
    english_name: s.english_name,
    age: s.age ?? null,
    group_label: groupMap.get(s.profile_id) ?? null,
  }));
}

// 시간대별 정확한 stop→bus 매핑 + sort_order (단일 쿼리로 모든 슬롯 처리)
type StopBusInfo = { busId: string; sortOrder: number };
type StopBusMaps = {
  getBySlot: (stopId: string, slotId: string | null) => string | null;
  getSortOrder: (stopId: string, slotId: string | null) => number | null;
  allBusIds: string[];
};

async function buildStopToBusMaps(
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

// ── 학생 기본 배정 ──

export async function getStudentBusDefaults(
  studentProfileId: string
): Promise<StudentBusDefault[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("student_bus_defaults")
    .select("*")
    .eq("student_profile_id", studentProfileId)
    .order("day_of_week");
  if (error) {
    logger.error("[getStudentBusDefaults]", error.message);
    return [];
  }

  const slotIds = [...new Set((data ?? []).map((d) => d.bus_time_slot_id))];
  const stopIds = [...new Set((data ?? []).filter((d) => d.bus_stop_id).map((d) => d.bus_stop_id))];

  // 요일별 stop→bus 매핑 조회 (시간대별 정확한 매핑)
  const dayKeys = [...new Set((data ?? []).map((d) => `${d.day_of_week}`))];

  const [slotResult, stopResult, ...stopBusMapsList] = await Promise.all([
    slotIds.length
      ? supabase.from("bus_time_slots").select("id, label, time").in("id", slotIds)
      : Promise.resolve({ data: [] as { id: string; label: string; time: string }[] }),
    stopIds.length
      ? supabase.from("bus_stops").select("id, name").in("id", stopIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ...dayKeys.map((dayStr) => buildStopToBusMaps(supabase, Number(dayStr))),
  ]);

  const slotMap = new Map((slotResult.data ?? []).map((s) => [s.id, { label: s.label, time: s.time }]));
  const stopMap = new Map((stopResult.data ?? []).map((s) => [s.id, s.name]));

  // stopBusMapsList에서 파생된 bus ID 수집 → 라벨 조회
  const derivedBusIds = new Set<string>();
  for (const sbm of stopBusMapsList) {
    for (const busId of sbm.allBusIds) {
      derivedBusIds.add(busId);
    }
  }
  const busIds = [...derivedBusIds];
  const busResult = busIds.length
    ? await supabase.from("bus_numbers").select("id, label").in("id", busIds)
    : { data: [] as { id: string; label: string }[] };
  const busMap = new Map((busResult.data ?? []).map((b) => [b.id, b.label]));

  // day → stopBusMaps
  const dayBusMap = new Map<string, StopBusMaps>();
  dayKeys.forEach((dayStr, i) => {
    dayBusMap.set(dayStr, stopBusMapsList[i]);
  });

  return (data ?? []).map((d) => {
    const slot = slotMap.get(d.bus_time_slot_id);
    // 호차 파생: stop→bus 매핑에서 결정
    const dayKey = `${d.day_of_week}`;
    const sbm = dayBusMap.get(dayKey);
    const derivedBusId = d.bus_stop_id
      ? (sbm?.getBySlot(d.bus_stop_id, d.bus_time_slot_id) ?? null)
      : null;
    return {
      ...d,
      time_slot_label: slot?.label,
      time_slot_time: slot?.time,
      bus_label: derivedBusId ? busMap.get(derivedBusId) : undefined,
      bus_stop_name: d.bus_stop_id ? (stopMap.get(d.bus_stop_id) ?? null) : null,
    };
  }) as StudentBusDefault[];
}

export async function upsertStudentBusDefault(
  studentProfileId: string,
  dayOfWeek: number,
  busTimeSlotId: string,
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
      bus_time_slot_id: busTimeSlotId,
      estimated_time: estimatedTime || null,
      note: note?.trim() || null,
      bus_stop_id: busStopId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_profile_id,day_of_week" }
  );
  if (error) {
    logger.error("[upsertStudentBusDefault]", error.message);
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
    logger.error("[deleteStudentBusDefault]", error.message);
    return { error: error.message };
  }
  return {};
}

export async function deleteStudentBusDefaults(ids: string[]): Promise<{ error?: string }> {
  if (ids.length === 0) return {};
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("student_bus_defaults")
    .delete()
    .in("id", ids);
  if (error) {
    logger.error("[deleteStudentBusDefaults]", error.message);
    return { error: error.message };
  }
  return {};
}

// ── 일일 매니페스트 (동승자 뷰) ──

export async function getDailyBusManifest(
  date: string
): Promise<{ groups: BusManifestGroup[]; noRides: NoRideEntry[]; afterschoolStudents: AfterSchoolBusEntry[] }> {
  const supabase = createAdminClient();

  const d = new Date(date);
  const jsDay = d.getDay();
  const isoDay = jsDay === 0 ? 7 : jsDay;

  // ── Phase 1: 4개 독립 쿼리 병렬 실행 ──
  const isWeekday = isoDay >= 1 && isoDay <= 5;

  const [
    { data: defaults },
    { data: changes },
    afterschoolEnrollments,
    stopBusMaps,
    { data: flaggedSlotsRaw },
  ] = await Promise.all([
    supabase
      .from("student_bus_defaults")
      .select("*")
      .eq("day_of_week", isoDay),
    supabase
      .from("bus_change_requests")
      .select("*")
      .eq("request_date", date)
      .eq("status", "approved"),
    isWeekday
      ? supabase
          .from("afterschool_enrollments")
          .select("student_profile_id")
          .eq("day_of_week", isoDay)
      : Promise.resolve({ data: null }),
    buildStopToBusMaps(supabase, isoDay),
    supabase
      .from("bus_time_slots")
      .select("id, label, time")
      .eq("is_active", true)
      .eq("show_empty_stops", true),
  ]);

  // 학생 배정 여부와 무관하게 정류장을 표시해야 하는 시간대 (오후반 등)
  const flaggedSlotIds = new Set<string>(
    (flaggedSlotsRaw ?? []).map((s) => s.id as string)
  );

  // 방과후 학생 ID 수집 (Phase 2에서 학생 정보 함께 조회)
  const enrolledIds = isWeekday && afterschoolEnrollments.data?.length
    ? [...new Set(afterschoolEnrollments.data.map((e) => e.student_profile_id))]
    : [];

  const defaultRows = defaults ?? [];
  const changeRows = changes ?? [];

  if (!defaultRows.length && !changeRows.length && flaggedSlotIds.size === 0) {
    // 방과후 학생만 있는 경우에도 조회 필요
    let afterschoolStudents: AfterSchoolBusEntry[] = [];
    if (enrolledIds.length) {
      const { data: students } = await supabase
        .from("students")
        .select("profile_id, korean_name, english_name, age")
        .in("profile_id", enrolledIds);
      afterschoolStudents = (students ?? []).map((s) => ({
        student_profile_id: s.profile_id,
        korean_name: s.korean_name,
        english_name: s.english_name,
        age: s.age ?? null,
      }));
    }
    return { groups: [], noRides: [], afterschoolStudents };
  }

  // ID 수집 (Phase 2 쿼리용)
  const allStudentIds = [
    ...new Set([
      ...defaultRows.map((d) => d.student_profile_id),
      ...changeRows.map((c) => c.student_profile_id),
    ]),
  ];
  const allSlotIds = [
    ...new Set([
      ...defaultRows.map((d) => d.bus_time_slot_id),
      ...changeRows.filter((c) => c.new_bus_time_slot_id).map((c) => c.new_bus_time_slot_id),
    ]),
  ];
  const allBusIds: string[] = [
    ...changeRows.filter((c) => c.new_bus_number_id).map((c) => c.new_bus_number_id),
    ...stopBusMaps.allBusIds,
  ];
  const uniqueBusIds = [...new Set(allBusIds)];
  const changeStopIds = changeRows.filter((c) => c.new_bus_stop_id).map((c) => c.new_bus_stop_id);
  const allStopIds = [
    ...new Set([
      ...defaultRows.filter((r) => r.bus_stop_id).map((r) => r.bus_stop_id),
      ...changeStopIds,
    ]),
  ];
  // 방과후 학생 중 bus default에 없는 ID도 조회 대상에 포함
  const afterschoolOnlyIds = enrolledIds.filter((id) => !allStudentIds.includes(id));

  // ── Phase 2: 6개 독립 쿼리 병렬 실행 ──
  const [
    { data: studentsRaw },
    { data: afterschoolStudentsRaw },
    slotsResult,
    busesResult,
    { data: checkRecords },
    stopSchedulesResult,
    stopNamesResult,
  ] = await Promise.all([
    allStudentIds.length
      ? supabase
          .from("students")
          .select("profile_id, korean_name, english_name, student_number, age")
          .in("profile_id", allStudentIds)
      : Promise.resolve({ data: [] as { profile_id: string; korean_name: string; english_name: string; student_number: string; age: number | null }[] }),
    afterschoolOnlyIds.length
      ? supabase
          .from("students")
          .select("profile_id, korean_name, english_name, age")
          .in("profile_id", afterschoolOnlyIds)
      : Promise.resolve({ data: [] as { profile_id: string; korean_name: string; english_name: string; age: number | null }[] }),
    allSlotIds.length
      ? supabase.from("bus_time_slots").select("id, label, time").in("id", allSlotIds)
      : Promise.resolve({ data: [] as { id: string; label: string; time: string }[] }),
    supabase.from("bus_numbers").select("id, label").eq("is_active", true),
    supabase
      .from("bus_check_records")
      .select("id, student_profile_id, boarded_at, checked_at")
      .eq("check_date", date),
    allStopIds.length
      ? supabase
          .from("bus_stop_schedules")
          .select("bus_stop_id, estimated_time, bus_time_slot_id")
          .in("bus_stop_id", allStopIds)
          .eq("day_of_week", isoDay)
      : Promise.resolve({ data: [] as { bus_stop_id: string; estimated_time: string; bus_time_slot_id: string | null }[] }),
    allStopIds.length
      ? supabase.from("bus_stops").select("id, name").in("id", allStopIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  // ── 맵 구축 ──
  const studentMap = new Map(
    (studentsRaw ?? []).map((s) => [s.profile_id, s])
  );

  const slotMap = new Map(
    (slotsResult.data ?? []).map((s) => [s.id, { label: s.label, time: s.time }])
  );

  // bus_numbers 전체 조회 → busMap
  const allBuses = busesResult.data ?? [];
  const busMap = new Map(allBuses.map((b) => [b.id, b.label]));

  const checkMap = new Map(
    (checkRecords ?? []).map((r) => [r.student_profile_id, { boarded_at: r.boarded_at, checked_at: r.checked_at, id: r.id }])
  );

  // stopId -> slotId|"_" -> time
  const stopScheduleMap = new Map<string, Map<string, string>>();
  for (const ss of stopSchedulesResult.data ?? []) {
    if (!stopScheduleMap.has(ss.bus_stop_id)) stopScheduleMap.set(ss.bus_stop_id, new Map());
    const slotKey = ss.bus_time_slot_id ?? "_";
    stopScheduleMap.get(ss.bus_stop_id)!.set(slotKey, ss.estimated_time);
  }
  const stopNameMap = new Map((stopNamesResult.data ?? []).map((s) => [s.id, s.name]));

  // 방과후 학생 목록 조합
  let afterschoolStudents: AfterSchoolBusEntry[] = [];
  if (enrolledIds.length) {
    // bus default에 포함된 학생은 studentMap에서, 나머지는 afterschoolStudentsRaw에서
    afterschoolStudents = enrolledIds
      .map((id) => {
        const fromMain = studentMap.get(id);
        if (fromMain) return {
          student_profile_id: fromMain.profile_id,
          korean_name: fromMain.korean_name,
          english_name: fromMain.english_name,
          age: fromMain.age ?? null,
        };
        const fromAfter = (afterschoolStudentsRaw ?? []).find((s) => s.profile_id === id);
        if (fromAfter) return {
          student_profile_id: fromAfter.profile_id,
          korean_name: fromAfter.korean_name,
          english_name: fromAfter.english_name,
          age: fromAfter.age ?? null,
        };
        return null;
      })
      .filter((s): s is AfterSchoolBusEntry => s !== null);
  }

  // 정류장 시간 조회 헬퍼: 시간대 매칭 → fallback null 슬롯
  function getStopTime(stopId: string, slotId: string | null): string | null {
    const bySlot = stopScheduleMap.get(stopId);
    if (!bySlot) return null;
    // 시간대 매칭
    if (slotId) {
      const matched = bySlot.get(slotId);
      if (matched) return matched;
    }
    // fallback: slot=null 레코드
    return bySlot.get("_") ?? null;
  }

  function getSlotTime(slotId: string): string {
    return slotMap.get(slotId)?.time ?? "";
  }

  const changeMap = new Map(changeRows.map((c) => [c.student_profile_id, c]));
  type GroupBucket = {
    slotId: string;
    busId: string;
    students: BusManifestEntry[];
    takenStopIds: Set<string>;
    extraStops?: BusManifestExtraStop[];
  };
  const groupMap = new Map<string, GroupBucket>();
  const noRides: NoRideEntry[] = [];

  function ensureGroup(slotId: string, busId: string): GroupBucket {
    const key = `${slotId}-${busId}`;
    let group = groupMap.get(key);
    if (!group) {
      group = { slotId, busId, students: [], takenStopIds: new Set() };
      groupMap.set(key, group);
    }
    return group;
  }

  for (const def of defaultRows) {
    const student = studentMap.get(def.student_profile_id);
    if (!student) continue;

    const change = changeMap.get(def.student_profile_id);
    const check = checkMap.get(def.student_profile_id);

    // 호차 파생: stop→bus 매핑에서 시간대별로 결정
    const derivedBusId = def.bus_stop_id
      ? (stopBusMaps.getBySlot(def.bus_stop_id, def.bus_time_slot_id) ?? null)
      : null;

    if (change) {
      // 결석: new_bus_stop_id 유무와 관계없이 항상 원래 호차 그룹에 is_absent=true로 추가
      if (change.change_type === "absent") {
        if (derivedBusId) {
          const absentGroup = ensureGroup(def.bus_time_slot_id, derivedBusId);
          if (def.bus_stop_id) absentGroup.takenStopIds.add(def.bus_stop_id);
          const stopName = def.bus_stop_id ? stopNameMap.get(def.bus_stop_id) : undefined;
          const stopTime = def.bus_stop_id ? getStopTime(def.bus_stop_id, def.bus_time_slot_id) : undefined;
          absentGroup.students.push({
            student_profile_id: def.student_profile_id,
            korean_name: student.korean_name,
            english_name: student.english_name,
            student_number: student.student_number,
            age: student.age ?? null,
            is_changed: false,
            is_absent: true,
            estimated_time: stopTime ?? def.estimated_time,
            note: "결석",
            bus_stop_name: stopName ?? null,
            bus_stop_sort_order: def.bus_stop_id ? stopBusMaps.getSortOrder(def.bus_stop_id, def.bus_time_slot_id) : null,
            boarded_at: null,
            checked_at: null,
            check_record_id: null,
          });
        } else {
          noRides.push({
            student_profile_id: def.student_profile_id,
            korean_name: student.korean_name,
            english_name: student.english_name,
            student_number: student.student_number,
            original_slot_time: getSlotTime(def.bus_time_slot_id),
            original_bus_label: undefined,
            change_type: "absent",
            request_id: change.id,
          });
        }
        continue;
      }
      // 미탑승
      if (change.change_type === "no_ride" && !change.new_bus_stop_id) {
        noRides.push({
          student_profile_id: def.student_profile_id,
          korean_name: student.korean_name,
          english_name: student.english_name,
          student_number: student.student_number,
          original_slot_time: getSlotTime(def.bus_time_slot_id),
          original_bus_label: derivedBusId ? busMap.get(derivedBusId) : undefined,
          change_type: "no_ride",
          request_id: change.id,
        });
        continue;
      }
      // 변경: 새 정류장 → 파생 호차, 없으면 change에 지정된 호차
      const newStopId = change.new_bus_stop_id;
      const newSlotId = change.new_bus_time_slot_id ?? def.bus_time_slot_id;
      const newBusId = newStopId
        ? (stopBusMaps.getBySlot(newStopId, newSlotId) ?? change.new_bus_number_id ?? derivedBusId)
        : (change.new_bus_number_id ?? derivedBusId);
      if (!newBusId) continue; // 미배정 — 그룹에 넣지 않음
      const changedGroup = ensureGroup(newSlotId, newBusId);
      const effectiveStopId = newStopId ?? def.bus_stop_id;
      if (effectiveStopId) changedGroup.takenStopIds.add(effectiveStopId);
      const stopName = effectiveStopId ? stopNameMap.get(effectiveStopId) : undefined;
      const effectiveSlotId2 = change.new_bus_time_slot_id ?? def.bus_time_slot_id;
      const stopTime = newStopId
        ? getStopTime(newStopId, effectiveSlotId2)
        : (def.bus_stop_id ? getStopTime(def.bus_stop_id, effectiveSlotId2) : null);
      const estimatedTime = newStopId ? stopTime : (stopTime ?? def.estimated_time);
      changedGroup.students.push({
        student_profile_id: def.student_profile_id,
        korean_name: student.korean_name,
        english_name: student.english_name,
        student_number: student.student_number,
        age: student.age ?? null,
        is_changed: true,
        estimated_time: estimatedTime,
        note: change.reason || def.note,
        bus_stop_name: stopName ?? null,
        bus_stop_sort_order: effectiveStopId ? stopBusMaps.getSortOrder(effectiveStopId, newSlotId) : null,
        original_slot_time: getSlotTime(def.bus_time_slot_id),
        original_bus_label: derivedBusId ? busMap.get(derivedBusId) : undefined,
        boarded_at: check?.boarded_at ?? null,
        checked_at: check?.checked_at ?? null,
        check_record_id: check?.id ?? null,
      });
    } else {
      // 미배정(호차 파생 불가) → 미배정 그룹 처리하지 않고 건너뜀
      if (!derivedBusId) continue;
      const defaultGroup = ensureGroup(def.bus_time_slot_id, derivedBusId);
      if (def.bus_stop_id) defaultGroup.takenStopIds.add(def.bus_stop_id);
      const stopTime2 = def.bus_stop_id ? getStopTime(def.bus_stop_id, def.bus_time_slot_id) : undefined;
      const stopName2 = def.bus_stop_id ? stopNameMap.get(def.bus_stop_id) : undefined;
      defaultGroup.students.push({
        student_profile_id: def.student_profile_id,
        korean_name: student.korean_name,
        english_name: student.english_name,
        student_number: student.student_number,
        age: student.age ?? null,
        is_changed: false,
        estimated_time: stopTime2 ?? def.estimated_time,
        note: def.note,
        bus_stop_name: stopName2 ?? null,
        bus_stop_sort_order: def.bus_stop_id ? stopBusMaps.getSortOrder(def.bus_stop_id, def.bus_time_slot_id) : null,
        boarded_at: check?.boarded_at ?? null,
        checked_at: check?.checked_at ?? null,
        check_record_id: check?.id ?? null,
      });
    }
  }

  // ── Phase 3: show_empty_stops 시간대 보강 ──
  // 학생 배정 없는 호차·정류장도 카드/헤더로 노출. 오후반처럼 수시 변동 노선에서 사용.
  if (flaggedSlotIds.size > 0) {
    const flaggedSlotArr = [...flaggedSlotIds];

    const { data: allDayAssignments } = await supabase
      .from("bus_stop_day_assignments")
      .select("bus_stop_id, bus_number_id, bus_time_slot_id, sort_order")
      .eq("day_of_week", isoDay);
    const assignmentRows = allDayAssignments ?? [];

    // 누락된 정류장 이름·스케줄·시간대 정보 보강 로드
    const neededStopIds = new Set<string>();
    for (const row of assignmentRows) neededStopIds.add(row.bus_stop_id);
    const missingStopIds = [...neededStopIds].filter((id) => !stopNameMap.has(id));
    const missingSlotIds = flaggedSlotArr.filter((id) => !slotMap.has(id));

    const [
      extraStopNamesRes,
      extraStopSchedulesRes,
      extraSlotsRes,
    ] = await Promise.all([
      missingStopIds.length
        ? supabase.from("bus_stops").select("id, name").in("id", missingStopIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      missingStopIds.length
        ? supabase
            .from("bus_stop_schedules")
            .select("bus_stop_id, estimated_time, bus_time_slot_id")
            .in("bus_stop_id", missingStopIds)
            .eq("day_of_week", isoDay)
        : Promise.resolve({ data: [] as { bus_stop_id: string; estimated_time: string; bus_time_slot_id: string | null }[] }),
      missingSlotIds.length
        ? supabase.from("bus_time_slots").select("id, label, time").in("id", missingSlotIds)
        : Promise.resolve({ data: [] as { id: string; label: string; time: string }[] }),
    ]);

    for (const s of extraStopNamesRes.data ?? []) stopNameMap.set(s.id, s.name);
    for (const ss of extraStopSchedulesRes.data ?? []) {
      if (!stopScheduleMap.has(ss.bus_stop_id)) stopScheduleMap.set(ss.bus_stop_id, new Map());
      const slotKey = ss.bus_time_slot_id ?? "_";
      stopScheduleMap.get(ss.bus_stop_id)!.set(slotKey, ss.estimated_time);
    }
    for (const s of extraSlotsRes.data ?? []) slotMap.set(s.id, { label: s.label, time: s.time });

    // 각 flagged slot 에 대해 (stopId → busId) 를 slot-specific 우선, null fallback 으로 해석
    for (const slotId of flaggedSlotArr) {
      const resolved = new Map<string, { busId: string; sortOrder: number }>();
      // 1차: slot-specific
      for (const row of assignmentRows) {
        if (row.bus_time_slot_id === slotId) {
          resolved.set(row.bus_stop_id, {
            busId: row.bus_number_id,
            sortOrder: row.sort_order ?? 0,
          });
        }
      }
      // 2차: null fallback (slot-specific 이 없는 경우만)
      for (const row of assignmentRows) {
        if (row.bus_time_slot_id === null && !resolved.has(row.bus_stop_id)) {
          resolved.set(row.bus_stop_id, {
            busId: row.bus_number_id,
            sortOrder: row.sort_order ?? 0,
          });
        }
      }

      // busId 별로 정류장 리스트
      const byBus = new Map<string, { stopId: string; sortOrder: number }[]>();
      for (const [stopId, info] of resolved) {
        if (!byBus.has(info.busId)) byBus.set(info.busId, []);
        byBus.get(info.busId)!.push({ stopId, sortOrder: info.sortOrder });
      }

      for (const [busId, stops] of byBus) {
        const group = ensureGroup(slotId, busId);
        const extras: BusManifestExtraStop[] = [];
        for (const s of stops) {
          if (group.takenStopIds.has(s.stopId)) continue;
          const name = stopNameMap.get(s.stopId);
          if (!name) continue;
          const time = getStopTime(s.stopId, slotId);
          extras.push({
            bus_stop_id: s.stopId,
            bus_stop_name: name,
            bus_stop_sort_order: s.sortOrder,
            estimated_time: time,
          });
        }
        if (extras.length) {
          extras.sort((a, b) => {
            const orderA = a.bus_stop_sort_order ?? Number.MAX_SAFE_INTEGER;
            const orderB = b.bus_stop_sort_order ?? Number.MAX_SAFE_INTEGER;
            if (orderA !== orderB) return orderA - orderB;
            const timeA = a.estimated_time ?? "99:99";
            const timeB = b.estimated_time ?? "99:99";
            if (timeA !== timeB) return timeA.localeCompare(timeB);
            return a.bus_stop_name.localeCompare(b.bus_stop_name);
          });
          group.extraStops = extras;
        }
      }
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
      extra_stops: g.extraStops?.length ? g.extraStops : undefined,
    }))
    .sort((a, b) => {
      const timeCmp = a.slot_time.localeCompare(b.slot_time);
      if (timeCmp !== 0) return timeCmp;
      return a.bus_label.localeCompare(b.bus_label);
    });

  return { groups, noRides, afterschoolStudents };
}

// ── 탑승 체크 ──

export async function boardBusStudent(
  studentProfileId: string,
  checkDate: string,
  busTimeSlotId: string,
  busNumberId: string
): Promise<{ error?: string }> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const { error } = await supabase.from("bus_check_records").upsert(
    {
      student_profile_id: studentProfileId,
      check_date: checkDate,
      bus_time_slot_id: busTimeSlotId,
      bus_number_id: busNumberId,
      boarded_at: new Date().toISOString(),
    },
    { onConflict: "student_profile_id,check_date" }
  );
  if (error) {
    logger.error("[boardBusStudent]", error.message);
    return { error: error.message };
  }
  logger.info("[boardBusStudent]", "탑승 처리", { studentProfileId, checkDate });
  return {};
}

export async function unboardBusStudent(
  studentProfileId: string,
  checkDate: string
): Promise<{ error?: string }> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();

  // 기존 레코드 확인
  const { data: record } = await supabase
    .from("bus_check_records")
    .select("id, checked_at")
    .eq("student_profile_id", studentProfileId)
    .eq("check_date", checkDate)
    .maybeSingle();

  if (!record) return {};

  // checked_at도 null이면 레코드 삭제 (불필요 레코드 정리)
  if (!record.checked_at) {
    const { error } = await supabase
      .from("bus_check_records")
      .delete()
      .eq("id", record.id);
    if (error) {
      logger.error("[unboardBusStudent]", error.message);
      return { error: error.message };
    }
  } else {
    // checked_at이 있으면 boarded_at만 null로
    const { error } = await supabase
      .from("bus_check_records")
      .update({ boarded_at: null })
      .eq("id", record.id);
    if (error) {
      logger.error("[unboardBusStudent]", error.message);
      return { error: error.message };
    }
  }

  return {};
}

// ── 하차 체크 ──

export async function checkBusStudent(
  studentProfileId: string,
  checkDate: string,
  busTimeSlotId: string,
  busNumberId: string,
  checkedBy: string
): Promise<{ error?: string }> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const { error } = await supabase.from("bus_check_records").upsert(
    {
      student_profile_id: studentProfileId,
      check_date: checkDate,
      bus_time_slot_id: busTimeSlotId,
      bus_number_id: busNumberId,
      checked_at: new Date().toISOString(),
      checked_by: checkedBy,
    },
    { onConflict: "student_profile_id,check_date" }
  );
  if (error) {
    logger.error("[checkBusStudent]", error.message);
    return { error: error.message };
  }
  logger.info("[checkBusStudent]", "하차 체크", { studentProfileId, checkDate });
  return {};
}

export async function uncheckBusStudent(
  studentProfileId: string,
  checkDate: string
): Promise<{ error?: string }> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();

  // boarded_at이 있으면 checked_at만 null로 (탑승 상태로 복귀)
  // boarded_at도 없으면 레코드 삭제
  const { data: record } = await supabase
    .from("bus_check_records")
    .select("id, boarded_at")
    .eq("student_profile_id", studentProfileId)
    .eq("check_date", checkDate)
    .maybeSingle();

  if (!record) return {};

  if (record.boarded_at) {
    const { error } = await supabase
      .from("bus_check_records")
      .update({ checked_at: null, checked_by: null })
      .eq("id", record.id);
    if (error) {
      logger.error("[uncheckBusStudent]", error.message);
      return { error: error.message };
    }
  } else {
    const { error } = await supabase
      .from("bus_check_records")
      .delete()
      .eq("id", record.id);
    if (error) {
      logger.error("[uncheckBusStudent]", error.message);
      return { error: error.message };
    }
  }

  return {};
}

// ── 배치 탑승/하차 처리 ──

export async function batchBusCheckRecord(
  items: {
    action: "board" | "unboard" | "check" | "uncheck";
    studentProfileId: string;
    busTimeSlotId: string;
    busNumberId: string;
  }[],
  checkDate: string,
  checkedBy: string
): Promise<{ error?: string }> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const boardItems = items.filter((i) => i.action === "board");
  const checkItems = items.filter((i) => i.action === "check");
  const unboardItems = items.filter((i) => i.action === "unboard");
  const uncheckItems = items.filter((i) => i.action === "uncheck");

  // 탑승: 배치 upsert
  if (boardItems.length > 0) {
    const { error } = await supabase.from("bus_check_records").upsert(
      boardItems.map((i) => ({
        student_profile_id: i.studentProfileId,
        check_date: checkDate,
        bus_time_slot_id: i.busTimeSlotId,
        bus_number_id: i.busNumberId,
        boarded_at: now,
      })),
      { onConflict: "student_profile_id,check_date" }
    );
    if (error) {
      logger.error("[batchBusCheckRecord:board]", error.message);
      return { error: error.message };
    }
  }

  // 하차: 배치 upsert
  if (checkItems.length > 0) {
    const { error } = await supabase.from("bus_check_records").upsert(
      checkItems.map((i) => ({
        student_profile_id: i.studentProfileId,
        check_date: checkDate,
        bus_time_slot_id: i.busTimeSlotId,
        bus_number_id: i.busNumberId,
        checked_at: now,
        checked_by: checkedBy,
      })),
      { onConflict: "student_profile_id,check_date" }
    );
    if (error) {
      logger.error("[batchBusCheckRecord:check]", error.message);
      return { error: error.message };
    }
  }

  // 탑승 취소: UPDATE + 빈 레코드 삭제
  if (unboardItems.length > 0) {
    const ids = unboardItems.map((i) => i.studentProfileId);
    const { error: unboardErr } = await supabase
      .from("bus_check_records")
      .update({ boarded_at: null })
      .eq("check_date", checkDate)
      .in("student_profile_id", ids);
    if (unboardErr) {
      logger.error("[batchBusCheckRecord:unboard]", unboardErr.message);
      return { error: unboardErr.message };
    }
    const { error: unboardDelErr } = await supabase
      .from("bus_check_records")
      .delete()
      .eq("check_date", checkDate)
      .in("student_profile_id", ids)
      .is("boarded_at", null)
      .is("checked_at", null);
    if (unboardDelErr) {
      logger.error("[batchBusCheckRecord:unboard:delete]", unboardDelErr.message);
      return { error: unboardDelErr.message };
    }
  }

  // 하차 취소: UPDATE + 빈 레코드 삭제
  if (uncheckItems.length > 0) {
    const ids = uncheckItems.map((i) => i.studentProfileId);
    const { error: uncheckErr } = await supabase
      .from("bus_check_records")
      .update({ checked_at: null, checked_by: null })
      .eq("check_date", checkDate)
      .in("student_profile_id", ids);
    if (uncheckErr) {
      logger.error("[batchBusCheckRecord:uncheck]", uncheckErr.message);
      return { error: uncheckErr.message };
    }
    const { error: uncheckDelErr } = await supabase
      .from("bus_check_records")
      .delete()
      .eq("check_date", checkDate)
      .in("student_profile_id", ids)
      .is("boarded_at", null)
      .is("checked_at", null);
    if (uncheckDelErr) {
      logger.error("[batchBusCheckRecord:uncheck:delete]", uncheckDelErr.message);
      return { error: uncheckDelErr.message };
    }
  }

  logger.info("[batchBusCheckRecord]", "배치 처리 완료", {
    checkDate,
    board: boardItems.length,
    check: checkItems.length,
    unboard: unboardItems.length,
    uncheck: uncheckItems.length,
  });
  return {};
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
  const stopIds = [...new Set((data ?? []).filter((d) => d.new_bus_stop_id).map((d) => d.new_bus_stop_id))];
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
  let defaultSlotMap = new Map<string, { label: string; time: string }>();
  if (needsDefaultSlot.length > 0) {
    const defStudentIds = [...new Set(needsDefaultSlot.map((d) => d.student_profile_id))];
    const { data: defaults } = await supabase
      .from("student_bus_defaults")
      .select("student_profile_id, bus_time_slot_id")
      .in("student_profile_id", defStudentIds);
    if (defaults?.length) {
      const defSlotIds = [...new Set(defaults.map((d) => d.bus_time_slot_id).filter(Boolean))];
      if (defSlotIds.length) {
        const { data: defSlots } = await supabase.from("bus_time_slots").select("id, label, time").in("id", defSlotIds);
        const defSlotLookup = new Map((defSlots ?? []).map((s) => [s.id, { label: s.label, time: s.time }]));
        for (const d of defaults) {
          if (!d.bus_time_slot_id) continue;
          const key = d.student_profile_id;
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
      .select("student_profile_id, day_of_week, bus_time_slot_id, bus_stop_id")
      .in("student_profile_id", studentIds);
    for (const o of origData ?? []) {
      origDefaults.set(
        `${o.student_profile_id}:${o.day_of_week}`,
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
    const student = studentMap.get(d.student_profile_id);
    const slot = d.new_bus_time_slot_id
      ? slotMap.get(d.new_bus_time_slot_id)
      : defaultSlotMap.get(d.student_profile_id);

    // 기존 일정
    const dow = new Date(d.request_date + "T00:00:00").getDay();
    const isoDay = dow === 0 ? 7 : dow;
    const origKey = `${d.student_profile_id}:${isoDay}`;
    const orig = origDefaults.get(origKey);
    const origSlot = orig?.slot_id ? slotMap.get(orig.slot_id) : undefined;
    const origStop = orig?.stop_id ? stopMap.get(orig.stop_id) : undefined;
    const origBus = origBusLabelMap.get(origKey);

    return {
      ...d,
      korean_name: student?.korean_name ?? null,
      english_name: student?.english_name ?? null,
      student_number: student?.student_number ?? null,
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
  const stopIds = [...new Set((data ?? []).filter((d) => d.new_bus_stop_id).map((d) => d.new_bus_stop_id))];
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
  let defaultSlotMap = new Map<string, { label: string; time: string }>();
  if (needsDefaultSlot.length > 0) {
    const defStudentIds = [...new Set(needsDefaultSlot.map((d) => d.student_profile_id))];
    const { data: defaults } = await supabase
      .from("student_bus_defaults")
      .select("student_profile_id, bus_time_slot_id")
      .in("student_profile_id", defStudentIds);
    if (defaults?.length) {
      const defSlotIds = [...new Set(defaults.map((d) => d.bus_time_slot_id).filter(Boolean))];
      if (defSlotIds.length) {
        const { data: defSlots } = await supabase.from("bus_time_slots").select("id, label, time").in("id", defSlotIds);
        const defSlotLookup = new Map((defSlots ?? []).map((s) => [s.id, { label: s.label, time: s.time }]));
        for (const d of defaults) {
          if (!d.bus_time_slot_id) continue;
          const key = d.student_profile_id;
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
      .select("student_profile_id, day_of_week, bus_time_slot_id, bus_stop_id")
      .in("student_profile_id", studentIds);
    for (const o of origData ?? []) {
      origDefaults.set(
        `${o.student_profile_id}:${o.day_of_week}`,
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
    const student = studentMap.get(d.student_profile_id);
    const slot = d.new_bus_time_slot_id
      ? slotMap.get(d.new_bus_time_slot_id)
      : defaultSlotMap.get(d.student_profile_id);

    const dow = new Date(d.request_date + "T00:00:00").getDay();
    const isoDay = dow === 0 ? 7 : dow;
    const origKey = `${d.student_profile_id}:${isoDay}`;
    const orig = origDefaults.get(origKey);
    const origSlot = orig?.slot_id ? slotMap.get(orig.slot_id) : undefined;
    const origStop = orig?.stop_id ? stopMap.get(orig.stop_id) : undefined;
    const origBus = origBusLabelMap.get(origKey);

    return {
      ...d,
      korean_name: student?.korean_name ?? null,
      english_name: student?.english_name ?? null,
      student_number: student?.student_number ?? null,
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
  reviewerId: string,
  overrides?: {
    changeType?: "change" | "no_ride" | "absent";
    newBusTimeSlotId?: string;
    newBusNumberId?: string;
    newBusStopId?: string;
    reviewNote?: string;
  }
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();

  const updateData: Record<string, unknown> = {
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

  const { error } = await supabase
    .from("bus_change_requests")
    .update(updateData)
    .eq("id", requestId);
  if (error) {
    logger.error("[approveChangeRequest]", error.message);
    return { error: error.message };
  }
  logger.info("[approveChangeRequest]", "변경 요청 승인", { requestId, reviewerId });
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
  const supabase = createAdminClient();
  const today = todayKst();
  const { data, error } = await supabase
    .from("bus_change_requests")
    .select("*")
    .eq("student_profile_id", studentProfileId)
    .gte("request_date", today)
    .order("request_date");
  if (error) {
    logger.error("[getStudentChangeRequests]", error.message);
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
  changeType: "change" | "no_ride",
  newBusTimeSlotId?: string,
  newBusNumberId?: string,
  reason?: string
): Promise<{ error?: string }> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();

  const { error } = await supabase.from("bus_change_requests").insert({
    student_profile_id: studentProfileId,
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
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("bus_change_requests")
    .delete()
    .eq("id", requestId)
    .eq("student_profile_id", studentProfileId)
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
  changeType: "change" | "no_ride" | "absent",
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

  const { error } = await supabase.from("bus_change_requests").insert({
    student_profile_id: studentProfileId,
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
    const { data: classStudents } = await supabase
      .from("class_students")
      .select("class_id")
      .eq("student_profile_id", studentProfileId);
    if (classStudents?.length) {
      await supabase.from("attendance").upsert(
        classStudents.map((cs) => ({
          student_profile_id: studentProfileId,
          class_id: cs.class_id,
          attendance_date: requestDate,
          status: "absent",
          note: "버스 결석 자동 등록",
          recorded_by: auth.userId,
        })),
        { onConflict: "student_profile_id,class_id,attendance_date", ignoreDuplicates: false }
      );
    }
  }

  return {};
}

export async function updateAdminBusChange(
  requestId: string,
  changeType: "change" | "no_ride" | "absent",
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
    .select("student_profile_id, request_date")
    .eq("id", requestId)
    .single();

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
    const { data: classStudents } = await supabase
      .from("class_students")
      .select("class_id")
      .eq("student_profile_id", existing.student_profile_id);
    if (classStudents?.length) {
      await supabase.from("attendance").upsert(
        classStudents.map((cs) => ({
          student_profile_id: existing.student_profile_id,
          class_id: cs.class_id,
          attendance_date: existing.request_date,
          status: "absent",
          note: "버스 결석 자동 등록",
          recorded_by: auth.userId,
        })),
        { onConflict: "student_profile_id,class_id,attendance_date", ignoreDuplicates: false }
      );
    }
  }

  return {};
}

export async function getExistingBusChange(
  studentProfileId: string,
  requestDate: string
): Promise<{
  id: string;
  change_type: "change" | "no_ride" | "absent";
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
    .eq("student_profile_id", studentProfileId)
    .eq("request_date", requestDate)
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
    logger.error("[deleteAdminBusChange]", error.message);
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

// ── 일괄 배정 저장 ──

export async function saveBulkBusDefaults(
  dayOfWeek: number,
  assignments: { student_profile_id: string; bus_time_slot_id: string; bus_stop_id?: string | null; note?: string | null }[]
): Promise<{ error?: string; saved?: number }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();

  // Determine which time slot IDs are involved in this save
  const slotIds = [...new Set(assignments.map((a) => a.bus_time_slot_id))];

  // 1. 기존 배정 조회 — 저장 대상 시간대만 (다른 시간대 배정은 건드리지 않음)
  let fetchQuery = supabase
    .from("student_bus_defaults")
    .select("id, student_profile_id, bus_time_slot_id")
    .eq("day_of_week", dayOfWeek);
  if (slotIds.length === 1) {
    fetchQuery = fetchQuery.eq("bus_time_slot_id", slotIds[0]);
  } else if (slotIds.length > 1) {
    fetchQuery = fetchQuery.in("bus_time_slot_id", slotIds);
  }
  // If no assignments and no slotIds, we still need to handle removal
  // In that case, don't filter by slot — but only delete unassigned students
  const { data: existing, error: fetchErr } = await fetchQuery;
  if (fetchErr) {
    logger.error("[saveBulkBusDefaults] fetch", fetchErr.message);
    return { error: fetchErr.message };
  }

  const newMap = new Map(assignments.map((a) => [a.student_profile_id, a]));

  // 2. 삭제: 같은 시간대 배정 중 새 목록에 없는 학생만 삭제
  const toDelete = (existing ?? []).filter((e) => !newMap.has(e.student_profile_id)).map((e) => e.id);
  if (toDelete.length) {
    const { error: delErr } = await supabase
      .from("student_bus_defaults")
      .delete()
      .in("id", toDelete);
    if (delErr) {
      logger.error("[saveBulkBusDefaults] delete", delErr.message);
      return { error: delErr.message };
    }
  }

  // 3. Upsert: 새 목록의 모든 배정
  if (assignments.length) {
    const now = new Date().toISOString();
    const rows = assignments.map((a) => ({
      student_profile_id: a.student_profile_id,
      day_of_week: dayOfWeek,
      bus_time_slot_id: a.bus_time_slot_id,
      bus_stop_id: a.bus_stop_id ?? null,
      note: a.note ?? null,
      updated_at: now,
    }));
    const { error: upsertErr } = await supabase
      .from("student_bus_defaults")
      .upsert(rows, { onConflict: "student_profile_id,day_of_week" });
    if (upsertErr) {
      logger.error("[saveBulkBusDefaults] upsert", upsertErr.message);
      return { error: upsertErr.message };
    }
  }

  return { saved: assignments.length + toDelete.length };
}

// ── 일괄 배정 조회 ──

export async function getBulkBusDefaults(
  dayOfWeek: number,
  busTimeSlotId?: string
): Promise<BusDefaultAssignment[]> {
  const auth = await verifyAdmin();
  if ("error" in auth) return [];
  const supabase = createAdminClient();

  let query = supabase
    .from("student_bus_defaults")
    .select("*")
    .eq("day_of_week", dayOfWeek);
  if (busTimeSlotId) {
    query = query.eq("bus_time_slot_id", busTimeSlotId);
  }

  const { data: defaults, error } = await query;
  if (error) {
    logger.error("[getBulkBusDefaults]", error.message);
    return [];
  }
  if (!defaults?.length) return [];

  // batch fetch students + stop→bus 매핑 병렬
  const profileIds = [...new Set(defaults.map((d) => d.student_profile_id))];
  const stopIds = [...new Set(defaults.filter((d) => d.bus_stop_id).map((d) => d.bus_stop_id))];

  const [studentsResult, stopBusMaps, stopsResult] = await Promise.all([
    supabase
      .from("students")
      .select("profile_id, korean_name, english_name, age")
      .in("profile_id", profileIds),
    buildStopToBusMaps(supabase, dayOfWeek),
    stopIds.length
      ? supabase.from("bus_stops").select("id, name").in("id", stopIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const studentMap = new Map((studentsResult.data ?? []).map((s) => [s.profile_id, s]));
  const stopMap = new Map((stopsResult.data ?? []).map((s) => [s.id, s.name]));

  return defaults.map((d) => {
    const student = studentMap.get(d.student_profile_id);
    // 호차 파생: stop→bus 매핑에서 결정 (행별 슬롯 ID로 정확히 매칭)
    const derivedBusId = d.bus_stop_id
      ? stopBusMaps.getBySlot(d.bus_stop_id, d.bus_time_slot_id ?? null)
      : null;
    return {
      id: d.id,
      student_profile_id: d.student_profile_id,
      korean_name: student?.korean_name ?? null,
      english_name: student?.english_name ?? null,
      age: student?.age ?? null,
      bus_number_id: derivedBusId ?? null,
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
    logger.error("[createBusStaff]", error.message, { email });
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
    logger.error("[listBusStaff]", profilesError.message);
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
    logger.error("[updateBusStaff]", staffError.message);
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


export async function getWeeklyDropoffExportData(): Promise<
  DropoffExportData | { error: string }
> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const supabase = createAdminClient();

  // 1. 시간대 전체 조회
  const { data: slotData, error: slotError } = await supabase
    .from("bus_time_slots")
    .select("*")
    .eq("is_active", true)
    .order("time");
  if (slotError) {
    logger.error("[getWeeklyDropoffExportData] slots", slotError.message);
    return { error: slotError.message };
  }
  const slots = (slotData ?? []) as BusTimeSlot[];

  // 2. 활성 학생 전체 조회
  const { data: studentData, error: studentError } = await supabase
    .from("students")
    .select("profile_id, korean_name, english_name, age, profiles!inner(deleted_at)")
    .is("profiles.deleted_at", null);
  if (studentError) {
    logger.error("[getWeeklyDropoffExportData] students", studentError.message);
    return { error: studentError.message };
  }
  const allStudents = (studentData ?? []).map((s) => ({
    profile_id: s.profile_id as string,
    korean_name: s.korean_name as string | null,
    english_name: s.english_name as string | null,
    age: (s.age as number | null) ?? null,
  }));
  const allStudentIds = new Set(allStudents.map((s) => s.profile_id));

  // 3. 호차 전체 조회
  const { data: busData } = await supabase
    .from("bus_numbers")
    .select("*")
    .eq("is_active", true)
    .order("label");
  const busNumbers = (busData ?? []) as BusNumber[];
  const busMap = new Map(busNumbers.map((b) => [b.id, b.label]));

  // 4. 정류장 전체 조회
  const { data: stopsAll } = await supabase
    .from("bus_stops")
    .select("id, name, sort_order")
    .eq("is_active", true);
  const stopInfoMap = new Map(
    (stopsAll ?? []).map((s) => [
      s.id as string,
      { name: s.name as string, sort_order: s.sort_order as number },
    ])
  );

  // 5. 슬롯 ID 목록 수집 후 student_bus_defaults / bus_stop_day_assignments 1회 병렬 조회
  const slotIds = slots.map((s) => s.id);

  const [
    { data: allDefaultsRaw, error: allDefaultsError },
    { data: allAssignmentsRaw },
  ] = await Promise.all([
    slotIds.length > 0
      ? supabase
          .from("student_bus_defaults")
          .select("student_profile_id, bus_stop_id, bus_time_slot_id, day_of_week, note")
          .in("bus_time_slot_id", slotIds)
      : Promise.resolve({ data: [], error: null }),
    slotIds.length > 0
      ? supabase
          .from("bus_stop_day_assignments")
          .select("bus_stop_id, bus_number_id, bus_time_slot_id, day_of_week")
          .in("bus_time_slot_id", slotIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (allDefaultsError) {
    logger.error("[getWeeklyDropoffExportData] defaults", allDefaultsError.message);
    return { error: allDefaultsError.message };
  }

  // 6. 학생 정보 맵 (step 2에서 이미 조회한 allStudents 재활용)
  const studMap = new Map(
    allStudents.map((s) => [s.profile_id, s])
  );

  // 7. 메모리 필터링을 위한 (day, slotId) 키 기반 맵 구성
  type DefaultRow = {
    student_profile_id: string;
    bus_stop_id: string | null;
    bus_time_slot_id: string;
    day_of_week: number;
    note: string | null;
  };
  const defaultsByDaySlot = new Map<string, DefaultRow[]>();
  for (const d of allDefaultsRaw ?? []) {
    const key = `${d.day_of_week as number}:${d.bus_time_slot_id as string}`;
    const list = defaultsByDaySlot.get(key) ?? [];
    list.push({
      student_profile_id: d.student_profile_id as string,
      bus_stop_id: d.bus_stop_id as string | null,
      bus_time_slot_id: d.bus_time_slot_id as string,
      day_of_week: d.day_of_week as number,
      note: d.note as string | null,
    });
    defaultsByDaySlot.set(key, list);
  }

  const assignmentsByDaySlot = new Map<string, Map<string, string>>();
  for (const a of allAssignmentsRaw ?? []) {
    const key = `${a.day_of_week as number}:${a.bus_time_slot_id as string}`;
    const stopToBus = assignmentsByDaySlot.get(key) ?? new Map<string, string>();
    stopToBus.set(a.bus_stop_id as string, a.bus_number_id as string);
    assignmentsByDaySlot.set(key, stopToBus);
  }

  const rows: DropoffExportRow[] = [];
  const unassigned: DropoffExportData["unassigned"] = [];

  for (let day = 1; day <= 5; day++) {
    // 이 날 배정된 student_profile_id 추적
    const assignedIds = new Set<string>();

    // 각 시간대별로 메모리 필터링
    for (const slot of slots) {
      const key = `${day}:${slot.id}`;
      const defaults = defaultsByDaySlot.get(key);
      if (!defaults?.length) continue;

      const stopToBusId = assignmentsByDaySlot.get(key) ?? new Map<string, string>();

      for (const d of defaults) {
        const pid = d.student_profile_id;
        assignedIds.add(pid);
        if (!allStudentIds.has(pid)) continue; // 삭제된 학생 스킵

        const stud = studMap.get(pid);
        const stopId = d.bus_stop_id;
        const busId = stopId ? (stopToBusId.get(stopId) ?? null) : null;
        const stopInfo = stopId ? stopInfoMap.get(stopId) : undefined;

        rows.push({
          day,
          profile_id: pid,
          slotLabel: slot.label,
          slotTime: slot.time,
          busLabel: busId ? (busMap.get(busId) ?? "미지정") : "미지정",
          stopName: stopInfo?.name ?? "",
          stopSortOrder: stopInfo?.sort_order ?? 9999,
          korean_name: stud?.korean_name ?? null,
          english_name: stud?.english_name ?? null,
          age: stud?.age ?? null,
          note: d.note,
        });
      }
    }

    // 미배정 학생: 하원 기본 배정이 없는 학생
    for (const s of allStudents) {
      if (!assignedIds.has(s.profile_id)) {
        unassigned.push({
          day,
          profile_id: s.profile_id,
          korean_name: s.korean_name,
          english_name: s.english_name,
          age: s.age,
        });
      }
    }
  }

  // 방과후 수강 현황 조회
  const { data: afterschoolData } = await supabase
    .from("afterschool_enrollments")
    .select("student_profile_id, day_of_week");
  const afterschoolEnrollments = (afterschoolData ?? []).map((e) => ({
    profile_id: e.student_profile_id as string,
    day: e.day_of_week as number,
  }));

  return { rows, unassigned, slots, busNumbers, afterschoolEnrollments };
}

/** 다중 날짜 버스 변경 일괄 등록 (관리자 전용) */
export async function bulkCreateBusChanges(
  studentProfileId: string,
  dates: string[],
  changeType: "change" | "no_ride" | "absent",
  newBusTimeSlotId?: string,
  newBusNumberId?: string,
  newBusStopId?: string,
  reason?: string,
): Promise<{ error?: string; created?: number; skipped?: number }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  if (!dates.length) return { error: "날짜를 선택해 주세요." };

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const rows = dates.map((d) => ({
    student_profile_id: studentProfileId,
    request_date: d,
    change_type: changeType,
    new_bus_time_slot_id: newBusTimeSlotId || null,
    new_bus_number_id: newBusNumberId || null,
    new_bus_stop_id: newBusStopId || null,
    reason: reason?.trim() || null,
    status: "approved",
    requested_at: now,
    updated_at: now,
  }));

  // UNIQUE (student_profile_id, request_date) 충돌 시 skip
  const { data: inserted, error } = await supabase
    .from("bus_change_requests")
    .upsert(rows, {
      onConflict: "student_profile_id,request_date",
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
