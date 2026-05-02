"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdmin, verifyAuthenticated } from "../auth-helpers";
import { getUserRoles } from "@/lib/auth/user-roles";
import { logger } from "@/lib/server/logger";
import { buildStopToBusMaps } from "./_helpers";
import { getStudentRecordByProfileId, getStudentsByIds } from "@/lib/server/domain-helpers";
import type {
  BusDefaultAssignment,
  StudentBusDefault,
} from "@/lib/types";
import type { StopBusMaps } from "./_helpers";

// ── 전체 활성 학생 명단 (배정 UI용) ──

export async function listAllActiveStudentNames(): Promise<
  { profile_id: string; korean_name: string | null; english_name: string | null; age: number | null; group_label: string | null }[]
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

  // group_label 조회: class_students → classes.group_label
  const studentIds = (data ?? []).map((s) => s.id);
  const groupMap = new Map<string, string>();
  if (studentIds.length) {
    const { data: classLinks } = await supabase
      .from("class_students")
      .select("student_id, classes!inner(group_label)")
      .in("student_id", studentIds);
    for (const link of classLinks ?? []) {
      const gl = (link.classes as unknown as { group_label: string | null })?.group_label;
      if (gl && !groupMap.has(link.student_id)) {
        groupMap.set(link.student_id, gl);
      }
    }
  }

  return (data ?? []).map((s) => ({
    profile_id: s.id,
    korean_name: s.korean_name,
    english_name: s.english_name,
    age: s.age ?? null,
    group_label: groupMap.get(s.id) ?? null,
  }));
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
  const { error } = await supabase.from("student_bus_defaults").upsert(
    {
      student_id: student.id,
      day_of_week: dayOfWeek,
      bus_time_slot_id: busTimeSlotId,
      estimated_time: estimatedTime || null,
      note: note?.trim() || null,
      bus_stop_id: busStopId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id,day_of_week" }
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
    .select("id, student_id, bus_time_slot_id")
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

  // 2. 삭제: 같은 시간대 배정 중 새 목록에 없는 학생만 삭제
  const toDelete = (existing ?? []).filter((e) => !newMap.has(e.student_id)).map((e) => e.id);
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
  if (normalized.length) {
    const now = new Date().toISOString();
    const rows = normalized.map((a) => ({
      student_id: a.student_id,
      day_of_week: dayOfWeek,
      bus_time_slot_id: a.bus_time_slot_id,
      bus_stop_id: a.bus_stop_id ?? null,
      note: a.note ?? null,
      updated_at: now,
    }));
    const { error: upsertErr } = await supabase
      .from("student_bus_defaults")
      .upsert(rows, { onConflict: "student_id,day_of_week" });
    if (upsertErr) {
      logger.error("[saveBulkBusDefaults] upsert", upsertErr.message);
      return { error: upsertErr.message };
    }
  }

  return { saved: normalized.length + toDelete.length };
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
      id: d.id,
      student_profile_id: student?.profile_id ?? "",
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
