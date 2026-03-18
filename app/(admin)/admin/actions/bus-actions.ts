"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeEmail } from "@/lib/auth-utils";
import { verifyAdmin, verifyAuthenticated } from "./auth-helpers";
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
  NoRideEntry,
  AfterSchoolBusEntry,
  DropoffExportRow,
  DropoffExportData,
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
  { profile_id: string; korean_name: string | null; english_name: string | null; age: number | null; group_label: string | null }[]
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
  dayOfWeek: number,
  direction: "pickup" | "dropoff"
): Promise<StopBusMaps> {
  const { data, error } = await supabase
    .from("bus_stop_day_assignments")
    .select("bus_stop_id, bus_number_id, bus_time_slot_id, sort_order")
    .eq("day_of_week", dayOfWeek)
    .eq("direction", direction);

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
  const stopIds = [...new Set((data ?? []).filter((d) => d.bus_stop_id).map((d) => d.bus_stop_id))];

  // 요일+방향별 stop→bus 매핑 조회 (시간대별 정확한 매핑)
  const dayDirPairs = [...new Set((data ?? []).map((d) => `${d.day_of_week}-${d.direction}`))];

  const [slotResult, stopResult, ...stopBusMapsList] = await Promise.all([
    slotIds.length
      ? supabase.from("bus_time_slots").select("id, label, time").in("id", slotIds)
      : Promise.resolve({ data: [] as { id: string; label: string; time: string }[] }),
    stopIds.length
      ? supabase.from("bus_stops").select("id, name").in("id", stopIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ...dayDirPairs.map((pair) => {
      const [dayStr, dir] = pair.split("-");
      return buildStopToBusMaps(supabase, Number(dayStr), dir as "pickup" | "dropoff");
    }),
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

  // dayDir → stopBusMaps
  const dayDirBusMap = new Map<string, StopBusMaps>();
  dayDirPairs.forEach((pair, i) => {
    dayDirBusMap.set(pair, stopBusMapsList[i]);
  });

  return (data ?? []).map((d) => {
    const slot = slotMap.get(d.bus_time_slot_id);
    // 호차 파생: stop→bus 매핑에서 결정
    const pairKey = `${d.day_of_week}-${d.direction}`;
    const sbm = dayDirBusMap.get(pairKey);
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
  direction: "pickup" | "dropoff",
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
      direction,
      bus_time_slot_id: busTimeSlotId,
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
    console.error("[deleteStudentBusDefaults]", error.message);
    return { error: error.message };
  }
  return {};
}

// ── 일일 매니페스트 (동승자 뷰) ──

export async function getDailyBusManifest(
  date: string,
  direction: "pickup" | "dropoff"
): Promise<{ groups: BusManifestGroup[]; noRides: NoRideEntry[]; afterschoolStudents: AfterSchoolBusEntry[] }> {
  const supabase = createAdminClient();

  const d = new Date(date);
  const jsDay = d.getDay();
  const isoDay = jsDay === 0 ? 7 : jsDay;

  // ── Phase 1: 4개 독립 쿼리 병렬 실행 ──
  const isDropoffWeekday = direction === "dropoff" && isoDay >= 1 && isoDay <= 5;

  const [
    { data: defaults },
    { data: changes },
    afterschoolEnrollments,
    stopBusMaps,
  ] = await Promise.all([
    supabase
      .from("student_bus_defaults")
      .select("*")
      .eq("day_of_week", isoDay)
      .eq("direction", direction),
    supabase
      .from("bus_change_requests")
      .select("*")
      .eq("request_date", date)
      .eq("direction", direction)
      .eq("status", "approved"),
    isDropoffWeekday
      ? supabase
          .from("afterschool_enrollments")
          .select("student_profile_id")
          .eq("day_of_week", isoDay)
      : Promise.resolve({ data: null }),
    buildStopToBusMaps(supabase, isoDay, direction),
  ]);

  // 방과후 학생 ID 수집 (Phase 2에서 학생 정보 함께 조회)
  const enrolledIds = isDropoffWeekday && afterschoolEnrollments.data?.length
    ? [...new Set(afterschoolEnrollments.data.map((e) => e.student_profile_id))]
    : [];

  const defaultRows = defaults ?? [];
  const changeRows = changes ?? [];

  if (!defaultRows.length && !changeRows.length) {
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
    supabase
      .from("students")
      .select("profile_id, korean_name, english_name, student_number, age")
      .in("profile_id", allStudentIds),
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
      .eq("check_date", date)
      .eq("direction", direction),
    allStopIds.length
      ? supabase
          .from("bus_stop_schedules")
          .select("bus_stop_id, direction, estimated_time, bus_time_slot_id")
          .in("bus_stop_id", allStopIds)
          .eq("day_of_week", isoDay)
      : Promise.resolve({ data: [] as { bus_stop_id: string; direction: string; estimated_time: string; bus_time_slot_id: string | null }[] }),
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

  // stopId -> slotId|"_" -> direction -> time
  const stopScheduleMap = new Map<string, Map<string, Map<string, string>>>();
  for (const ss of stopSchedulesResult.data ?? []) {
    if (!stopScheduleMap.has(ss.bus_stop_id)) stopScheduleMap.set(ss.bus_stop_id, new Map());
    const slotKey = ss.bus_time_slot_id ?? "_";
    const slotMap2 = stopScheduleMap.get(ss.bus_stop_id)!;
    if (!slotMap2.has(slotKey)) slotMap2.set(slotKey, new Map());
    slotMap2.get(slotKey)!.set(ss.direction, ss.estimated_time);
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
  function getStopTime(stopId: string, slotId: string | null, dir: string): string | null {
    const bySlot = stopScheduleMap.get(stopId);
    if (!bySlot) return null;
    // 시간대 매칭
    if (slotId) {
      const matched = bySlot.get(slotId)?.get(dir);
      if (matched) return matched;
    }
    // fallback: slot=null 레코드
    return bySlot.get("_")?.get(dir) ?? null;
  }

  function getSlotTime(slotId: string): string {
    return slotMap.get(slotId)?.time ?? "";
  }

  const changeMap = new Map(changeRows.map((c) => [c.student_profile_id, c]));
  const groupMap = new Map<string, { slotId: string; busId: string; students: BusManifestEntry[] }>();
  const noRides: NoRideEntry[] = [];

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
          const key = `${def.bus_time_slot_id}-${derivedBusId}`;
          if (!groupMap.has(key)) {
            groupMap.set(key, { slotId: def.bus_time_slot_id, busId: derivedBusId, students: [] });
          }
          const stopName = def.bus_stop_id ? stopNameMap.get(def.bus_stop_id) : undefined;
          const stopTime = def.bus_stop_id ? getStopTime(def.bus_stop_id, def.bus_time_slot_id, direction) : undefined;
          groupMap.get(key)!.students.push({
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
            direction,
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
          direction,
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
      const key = `${newSlotId}-${newBusId}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, { slotId: newSlotId, busId: newBusId, students: [] });
      }
      const effectiveStopId = newStopId ?? def.bus_stop_id;
      const stopName = effectiveStopId ? stopNameMap.get(effectiveStopId) : undefined;
      const effectiveSlotId2 = change.new_bus_time_slot_id ?? def.bus_time_slot_id;
      const stopTime = newStopId
        ? getStopTime(newStopId, effectiveSlotId2, direction)
        : (def.bus_stop_id ? getStopTime(def.bus_stop_id, effectiveSlotId2, direction) : null);
      const estimatedTime = newStopId ? stopTime : (stopTime ?? def.estimated_time);
      groupMap.get(key)!.students.push({
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
      const key = `${def.bus_time_slot_id}-${derivedBusId}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, { slotId: def.bus_time_slot_id, busId: derivedBusId, students: [] });
      }
      const stopTime2 = def.bus_stop_id ? getStopTime(def.bus_stop_id, def.bus_time_slot_id, direction) : undefined;
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
        bus_stop_sort_order: def.bus_stop_id ? stopBusMaps.getSortOrder(def.bus_stop_id, def.bus_time_slot_id) : null,
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

  return { groups, noRides, afterschoolStudents };
}

// ── 탑승 체크 ──

export async function boardBusStudent(
  studentProfileId: string,
  checkDate: string,
  direction: "pickup" | "dropoff",
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
  const auth = await verifyAuthenticated();
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
  const auth = await verifyAuthenticated();
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

export async function listAllChangeRequests(): Promise<BusChangeRequest[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bus_change_requests")
    .select("*")
    .order("requested_at", { ascending: false });
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
      new_bus_stop_name: d.new_bus_stop_id ? stopMap.get(d.new_bus_stop_id) : undefined,
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
    .eq("id", requestId);
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

  const { error } = await supabase.from("bus_change_requests").insert({
    student_profile_id: studentProfileId,
    request_date: requestDate,
    direction,
    change_type: changeType,
    new_bus_time_slot_id: newBusTimeSlotId || null,
    new_bus_number_id: newBusNumberId || null,
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

  const supabase = createAdminClient();

  const finalSlotId = changeType === "change" ? (newBusTimeSlotId ?? null) : null;
  const finalBusId = changeType === "change" ? (newBusNumberId ?? null) : null;
  const finalStopId = newBusStopId || null;

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
  _studentProfileId: string,
  _requestDate: string,
  _direction: "pickup" | "dropoff",
  changeType: "change" | "no_ride" | "absent",
  newBusTimeSlotId?: string,
  newBusNumberId?: string,
  newBusStopId?: string,
  reason?: string
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const supabase = createAdminClient();

  const finalSlotId = changeType === "change" ? (newBusTimeSlotId ?? null) : null;
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
    console.error("[updateAdminBusChange]", error.message);
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

export async function listBusStops(): Promise<BusStop[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bus_stops")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");
  if (error) {
    console.error("[listBusStops]", error.message);
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
    console.error("[createBusStop]", error.message);
    return { error: error.message };
  }
  return { id: data.id };
}

// ── 요일별 정류장-호차 배정 ──

export async function listBusStopDayAssignments(
  day: number,
  direction?: "pickup" | "dropoff",
  busTimeSlotId?: string
): Promise<BusStopDayAssignment[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("bus_stop_day_assignments")
    .select("*")
    .eq("day_of_week", day);
  if (direction) query = query.eq("direction", direction);
  if (busTimeSlotId) {
    query = query.eq("bus_time_slot_id", busTimeSlotId);
  } else {
    query = query.is("bus_time_slot_id", null);
  }
  const { data, error } = await query.order("sort_order");
  if (error) {
    console.error("[listBusStopDayAssignments]", error.message);
    return [];
  }
  return data as BusStopDayAssignment[];
}

export async function saveBusStopDayAssignments(
  day: number,
  assignments: { bus_stop_id: string; bus_number_id: string; sort_order: number }[],
  direction?: "pickup" | "dropoff",
  busTimeSlotId?: string
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();

  // 1. Delete existing assignments for this day + direction + timeSlot
  let delQuery = supabase
    .from("bus_stop_day_assignments")
    .delete()
    .eq("day_of_week", day);
  if (direction) delQuery = delQuery.eq("direction", direction);
  if (busTimeSlotId) {
    delQuery = delQuery.eq("bus_time_slot_id", busTimeSlotId);
  } else {
    delQuery = delQuery.is("bus_time_slot_id", null);
  }
  const { error: delErr } = await delQuery;
  if (delErr) {
    console.error("[saveBusStopDayAssignments] delete", delErr.message);
    return { error: delErr.message };
  }

  // 2. Insert new assignments with sort_order
  if (assignments.length) {
    const now = new Date().toISOString();
    const rows = assignments.map((a) => ({
      bus_stop_id: a.bus_stop_id,
      bus_number_id: a.bus_number_id,
      day_of_week: day,
      direction: direction ?? "pickup",
      bus_time_slot_id: busTimeSlotId ?? null,
      sort_order: a.sort_order,
      updated_at: now,
    }));
    const { error: insErr } = await supabase
      .from("bus_stop_day_assignments")
      .insert(rows);
    if (insErr) {
      console.error("[saveBusStopDayAssignments] insert", insErr.message);
      return { error: insErr.message };
    }
  }
  return {};
}

export async function listBusStopSchedulesBulk(
  day: number,
  direction: "pickup" | "dropoff",
  slotId?: string
): Promise<BusStopSchedule[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("bus_stop_schedules")
    .select("*")
    .eq("day_of_week", day)
    .eq("direction", direction);
  if (slotId) {
    // Show schedules for selected slot OR fallback to NULL (전체 기본)
    query = query.or(`bus_time_slot_id.eq.${slotId},bus_time_slot_id.is.null`);
  } else {
    query = query.is("bus_time_slot_id", null);
  }
  const { data, error } = await query;
  if (error) {
    console.error("[listBusStopSchedulesBulk]", error.message);
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
    console.error("[updateBusStop]", error.message);
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
    console.error("[deleteBusStop] day_assignments", dayAssignErr.message);
    return { error: dayAssignErr.message };
  }

  // 2. bus_stop_schedules 삭제
  const { error: schedulesErr } = await supabase
    .from("bus_stop_schedules")
    .delete()
    .eq("bus_stop_id", id);
  if (schedulesErr) {
    console.error("[deleteBusStop] schedules", schedulesErr.message);
    return { error: schedulesErr.message };
  }

  // 3. student_bus_defaults 참조 null 처리
  const { error: defaultsErr } = await supabase
    .from("student_bus_defaults")
    .update({ bus_stop_id: null, updated_at: new Date().toISOString() })
    .eq("bus_stop_id", id);
  if (defaultsErr) {
    console.error("[deleteBusStop] defaults", defaultsErr.message);
    return { error: defaultsErr.message };
  }

  // 4. bus_stops 소프트 삭제
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
    .eq("day_of_week", dayOfWeek)
    .eq("direction", direction);
  if (slotIds.length === 1) {
    fetchQuery = fetchQuery.eq("bus_time_slot_id", slotIds[0]);
  } else if (slotIds.length > 1) {
    fetchQuery = fetchQuery.in("bus_time_slot_id", slotIds);
  }
  // If no assignments and no slotIds, we still need to handle removal
  // In that case, don't filter by slot — but only delete unassigned students
  const { data: existing, error: fetchErr } = await fetchQuery;
  if (fetchErr) {
    console.error("[saveBulkBusDefaults] fetch", fetchErr.message);
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
      bus_stop_id: a.bus_stop_id ?? null,
      note: a.note ?? null,
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

  // batch fetch students + stop→bus 매핑 병렬
  const profileIds = [...new Set(defaults.map((d) => d.student_profile_id))];
  const stopIds = [...new Set(defaults.filter((d) => d.bus_stop_id).map((d) => d.bus_stop_id))];

  const [studentsResult, stopBusMaps, stopsResult] = await Promise.all([
    supabase
      .from("students")
      .select("profile_id, korean_name, english_name, age")
      .in("profile_id", profileIds),
    buildStopToBusMaps(supabase, dayOfWeek, direction),
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
  busStopId: string,
  busTimeSlotId?: string
): Promise<BusStopSchedule[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("bus_stop_schedules")
    .select("*")
    .eq("bus_stop_id", busStopId)
    .order("day_of_week")
    .order("direction");
  if (busTimeSlotId) {
    query = query.eq("bus_time_slot_id", busTimeSlotId);
  }
  const { data, error } = await query;
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
      direction,
      estimated_time: estimatedTime,
      bus_time_slot_id: busTimeSlotId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "bus_stop_id,day_of_week,direction,bus_time_slot_id" }
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
  direction: "pickup" | "dropoff",
  busTimeSlotId?: string
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();

  let query = supabase
    .from("bus_stop_schedules")
    .delete()
    .eq("bus_stop_id", busStopId)
    .eq("day_of_week", dayOfWeek)
    .eq("direction", direction);
  if (busTimeSlotId) {
    query = query.eq("bus_time_slot_id", busTimeSlotId);
  } else {
    query = query.is("bus_time_slot_id", null);
  }
  const { error } = await query;
  if (error) {
    console.error("[deleteBusStopSchedule]", error.message);
    return { error: error.message };
  }
  return {};
}


export async function getWeeklyDropoffExportData(): Promise<
  DropoffExportData | { error: string }
> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const supabase = createAdminClient();

  // 1. 하원 시간대 전체 조회
  const { data: slotData, error: slotError } = await supabase
    .from("bus_time_slots")
    .select("*")
    .eq("direction", "dropoff")
    .eq("is_active", true)
    .order("time");
  if (slotError) {
    console.error("[getWeeklyDropoffExportData] slots", slotError.message);
    return { error: slotError.message };
  }
  const slots = (slotData ?? []) as BusTimeSlot[];

  // 2. 활성 학생 전체 조회
  const { data: studentData, error: studentError } = await supabase
    .from("students")
    .select("profile_id, korean_name, english_name, age, profiles!inner(deleted_at)")
    .is("profiles.deleted_at", null);
  if (studentError) {
    console.error("[getWeeklyDropoffExportData] students", studentError.message);
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
          .eq("direction", "dropoff")
          .in("bus_time_slot_id", slotIds)
      : Promise.resolve({ data: [], error: null }),
    slotIds.length > 0
      ? supabase
          .from("bus_stop_day_assignments")
          .select("bus_stop_id, bus_number_id, bus_time_slot_id, day_of_week")
          .eq("direction", "dropoff")
          .in("bus_time_slot_id", slotIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (allDefaultsError) {
    console.error("[getWeeklyDropoffExportData] defaults", allDefaultsError.message);
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
