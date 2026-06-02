"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdmin, verifyAuthenticated } from "../auth-helpers";
import { getUserRoles } from "@/lib/auth/user-roles";
import { logger } from "@/lib/server/logger";
import { buildStopToBusMaps, getServedStopIdsByDay, isStopServed } from "./_helpers";
import { getStudentRecordByProfileId, getStudentsByIds } from "@/lib/server/domain-helpers";
import type {
  BusDefaultAssignment,
  StudentBusDefault,
} from "@/lib/types";
import type { StopBusMaps } from "./_helpers";

// ── 전체 활성 학생 명단 (배정 UI용) ──

export async function listAllActiveStudentNames(): Promise<
  { profile_id: string; korean_name: string | null; english_name: string | null; age: number | null; group_type: string | null }[]
> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("students")
    .select("id, korean_name, english_name, age, profiles!inner(deleted_at)")
    .is("profiles.deleted_at", null);

  if (error) {
    logger.error("[listAllActiveStudentNames]", error.message);
    return [];
  }

  // group_type 조회: class_students → classes.group_type
  const studentIds = (data ?? []).map((s) => s.id);
  const groupMap = new Map<string, string>();
  if (studentIds.length) {
    const { data: classLinks } = await supabase
      .from("class_students")
      .select("student_id, classes!inner(group_type)")
      .in("student_id", studentIds);
    for (const link of classLinks ?? []) {
      const gt = (link.classes as unknown as { group_type: string | null })?.group_type;
      if (gt && !groupMap.has(link.student_id)) {
        groupMap.set(link.student_id, gt);
      }
    }
  }

  return (data ?? []).map((s) => ({
    profile_id: s.id,
    korean_name: s.korean_name,
    english_name: s.english_name,
    age: s.age ?? null,
    group_type: groupMap.get(s.id) ?? null,
  }));
}

// ── 정류장 운행(배정) 조회 ──

/**
 * 주어진 요일들 × 시간대에 운행되는 정류장 ID를 요일별로 반환한다.
 * 정류장 미배정 검증(경고/차단)에 사용. strict 기준(정확 slot OR null 기본)은 `_helpers` 참고.
 */
export async function listServedStopIds(
  daysOfWeek: number[],
  slotId: string
): Promise<Record<number, string[]>> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return {};
  const supabase = createAdminClient();
  return getServedStopIdsByDay(supabase, daysOfWeek, slotId);
}

// ── 학생 기본 배정 ──

export async function getStudentBusDefaults(
  studentProfileId: string
): Promise<StudentBusDefault[]> {
  // 본인/admin/teacher만 조회 허용 (IDOR 방지). 비인증은 빈 배열.
  const auth = await verifyAuthenticated();
  if ("error" in auth) return [];
  const supabase = createAdminClient();
  if (studentProfileId !== auth.userId) {
    const { roles } = await getUserRoles(supabase, auth.userId);
    if (!roles.includes("admin") && !roles.includes("teacher")) {
      logger.warn("[getStudentBusDefaults]", "권한 없음", { requestedBy: auth.userId });
      return [];
    }
  }

  const student = await getStudentRecordByProfileId(supabase, studentProfileId);
  if (!student) return [];

  const { data, error } = await supabase
    .from("student_bus_defaults")
    .select("*")
    .eq("student_id", student.id)
    .eq("direction", "dropoff")
    .order("day_of_week");
  if (error) {
    logger.error("[getStudentBusDefaults]", error.message);
    return [];
  }

  const slotIds = [...new Set((data ?? []).map((d) => d.bus_time_slot_id))];
  const stopIds = [...new Set((data ?? []).map((d) => d.bus_stop_id).filter((v): v is string => v !== null))];

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
      direction: 'dropoff' as const,
      student_profile_id: student.profile_id,
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
  const student = await getStudentRecordByProfileId(supabase, studentProfileId);
  if (!student) return { error: "학생 정보를 찾을 수 없습니다." };
  // 정류장 미배정 가드: 해당 요일·시간대에 배정 안 된 정류장은 거부.
  if (busStopId && busTimeSlotId && !(await isStopServed(supabase, dayOfWeek, busTimeSlotId, busStopId))) {
    return { error: "선택한 정류장이 해당 요일·시간대에 배정되어 있지 않습니다." };
  }
  const { error } = await supabase.from("student_bus_defaults").upsert(
    {
      student_id: student.id,
      direction: 'dropoff' as const,
      day_of_week: dayOfWeek,
      bus_time_slot_id: busTimeSlotId,
      note: note?.trim() || null,
      bus_stop_id: busStopId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id,direction,day_of_week" }
  );
  if (error) {
    logger.error("[upsertStudentBusDefault]", error.message);
    return { error: error.message };
  }
  return {};
}

// student_bus_defaults 는 composite PK (student_id, bus_time_slot_id, direction, day_of_week)
// 라서 단일 id 컬럼 없음. 기존 호출 시그니처 유지하면서 composite key 직렬화 문자열로 동작.
// 직렬화 포맷: `${student_id}|${bus_time_slot_id}|${direction}|${day_of_week}`
function parseDefaultKey(key: string): {
  student_id: string;
  bus_time_slot_id: string;
  direction: "pickup" | "dropoff";
  day_of_week: number;
} | null {
  const parts = key.split("|");
  if (parts.length !== 4) return null;
  const day = Number.parseInt(parts[3], 10);
  if (!Number.isFinite(day)) return null;
  if (parts[2] !== "pickup" && parts[2] !== "dropoff") return null;
  return {
    student_id: parts[0],
    bus_time_slot_id: parts[1],
    direction: parts[2],
    day_of_week: day,
  };
}

export async function deleteStudentBusDefault(id: string): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const parsed = parseDefaultKey(id);
  if (!parsed) return { error: "잘못된 키 형식입니다." };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("student_bus_defaults")
    .delete()
    .eq("student_id", parsed.student_id)
    .eq("bus_time_slot_id", parsed.bus_time_slot_id)
    .eq("direction", parsed.direction)
    .eq("day_of_week", parsed.day_of_week);
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
  for (const id of ids) {
    const parsed = parseDefaultKey(id);
    if (!parsed) continue;
    const { error } = await supabase
      .from("student_bus_defaults")
      .delete()
      .eq("student_id", parsed.student_id)
      .eq("bus_time_slot_id", parsed.bus_time_slot_id)
      .eq("direction", parsed.direction)
      .eq("day_of_week", parsed.day_of_week);
    if (error) {
      logger.error("[deleteStudentBusDefaults]", error.message);
      return { error: error.message };
    }
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
    .select("student_id, bus_time_slot_id")
    .eq("direction", "dropoff")
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

  const studentRecords = await Promise.all(
    assignments.map((assignment) => getStudentRecordByProfileId(supabase, assignment.student_profile_id))
  );
  const normalized = assignments.flatMap((assignment, index) => {
    const student = studentRecords[index];
    if (!student) return [];
    return [{
      student_id: student.id,
      student_profile_id: student.profile_id,
      bus_time_slot_id: assignment.bus_time_slot_id,
      bus_stop_id: assignment.bus_stop_id ?? null,
      note: assignment.note ?? null,
    }];
  });
  const newMap = new Map(normalized.map((a) => [a.student_id, a]));

  // 2. 삭제: 같은 시간대 배정 중 새 목록에 없는 학생만 삭제 (composite key 매칭)
  const toDeleteStudentIds = (existing ?? [])
    .filter((e) => !newMap.has(e.student_id))
    .map((e) => e.student_id);
  if (toDeleteStudentIds.length) {
    let delQuery = supabase
      .from("student_bus_defaults")
      .delete()
      .eq("direction", "dropoff")
      .eq("day_of_week", dayOfWeek)
      .in("student_id", toDeleteStudentIds);
    if (slotIds.length === 1) {
      delQuery = delQuery.eq("bus_time_slot_id", slotIds[0]);
    } else if (slotIds.length > 1) {
      delQuery = delQuery.in("bus_time_slot_id", slotIds);
    }
    const { error: delErr } = await delQuery;
    if (delErr) {
      logger.error("[saveBulkBusDefaults] delete", delErr.message);
      return { error: delErr.message };
    }
  }

  // 3. Upsert: 새 목록의 모든 배정
  if (normalized.length) {
    const now = new Date().toISOString();
    const rows = normalized.map((a) => ({
      student_id: a.student_id,
      direction: 'dropoff' as const,
      day_of_week: dayOfWeek,
      bus_time_slot_id: a.bus_time_slot_id,
      bus_stop_id: a.bus_stop_id ?? null,
      note: a.note ?? null,
      updated_at: now,
    }));
    const { error: upsertErr } = await supabase
      .from("student_bus_defaults")
      .upsert(rows, { onConflict: "student_id,direction,day_of_week" });
    if (upsertErr) {
      logger.error("[saveBulkBusDefaults] upsert", upsertErr.message);
      return { error: upsertErr.message };
    }
  }

  return { saved: normalized.length + toDeleteStudentIds.length };
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
    .eq("direction", "dropoff")
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
  const studentDomainIds = [...new Set(defaults.map((d) => d.student_id))];
  const stopIds = [...new Set(defaults.map((d) => d.bus_stop_id).filter((v): v is string => v !== null))];

  const [studentsMap, stopBusMaps, stopsResult] = await Promise.all([
    getStudentsByIds(supabase, studentDomainIds),
    buildStopToBusMaps(supabase, dayOfWeek),
    stopIds.length
      ? supabase.from("bus_stops").select("id, name").in("id", stopIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const stopMap = new Map((stopsResult.data ?? []).map((s) => [s.id, s.name]));

  return defaults.map((d) => {
    const student = studentsMap.get(d.student_id);
    const derivedBusId = d.bus_stop_id
      ? stopBusMaps.getBySlot(d.bus_stop_id, d.bus_time_slot_id ?? null)
      : null;
    return {
      id: `${d.student_id}-${d.bus_time_slot_id}`,
      student_profile_id: student?.profile_id ?? "",
      korean_name: student?.korean_name ?? null,
      english_name: student?.english_name ?? null,
      age: student?.age ?? null,
      bus_number_id: derivedBusId ?? null,
      bus_stop_id: d.bus_stop_id ?? null,
      bus_stop_name: d.bus_stop_id ? (stopMap.get(d.bus_stop_id) ?? null) : null,
      bus_time_slot_id: d.bus_time_slot_id,
      estimated_time: null,
      note: d.note ?? null,
    };
  });
}
