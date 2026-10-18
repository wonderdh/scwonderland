"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdmin } from "../auth-helpers";
import { logger } from "@/lib/server/logger";
import { buildStopToBusMaps } from "./_helpers";
import type {
  BusStaffProfile,
  BusNumber,
  BusTimeSlot,
  DropoffExportRow,
  DropoffExportData,
} from "@/lib/types";

// ── 버스 담당자 CRUD ──

// 신 스키마(user_role enum)에서 "bus" 역할이 제거됐고 bus_staff 테이블도 사라졌습니다.
// 버스 기사 도메인 재도입 결정이 날 때까지 list/create 는 비활성화 stub.

export async function createBusStaff(
  _formData: FormData
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  return {
    error:
      "버스 기사 계정 생성 기능은 현재 비활성화되어 있습니다. (스키마 재정비 중)",
  };
}

export async function listBusStaff(): Promise<BusStaffProfile[]> {
  const auth = await verifyAdmin();
  if ("error" in auth) return [];
  return [];
}

export async function updateBusStaff(
  profileId: string,
  name: string,
  _busNumberId: string | null
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const trimmed = name.trim();
  if (!trimmed) return { error: "이름을 입력해 주세요." };

  const supabase = createAdminClient();

  // profiles.username 업데이트
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ username: trimmed })
    .eq("id", profileId);

  if (profileError) {
    logger.error("[updateBusStaff]", profileError.message);
    return { error: profileError.message };
  }

  return {};
}

// ── 주간 하원 배정 Excel 내보내기용 데이터 조회 ──

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
    .select("id, korean_name, english_name, age, profiles!inner(deleted_at)")
    .is("profiles.deleted_at", null);
  if (studentError) {
    logger.error("[getWeeklyDropoffExportData] students", studentError.message);
    return { error: studentError.message };
  }
  const allStudents = (studentData ?? []).map((s) => ({
    student_id: s.id as string,
    profile_id: s.id as string, // students.id = profiles.id (shared PK)
    korean_name: s.korean_name as string | null,
    english_name: s.english_name as string | null,
    age: (s.age as number | null) ?? null,
  }));
  const allStudentIds = new Set(allStudents.map((s) => s.student_id));

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

  // 5. 슬롯 ID 목록 수집 후 student_bus_defaults 조회 + 요일별 stop→bus 매핑(호차 폴백·정류장 순서) 병렬
  const slotIds = slots.map((s) => s.id);

  const [
    { data: allDefaultsRaw, error: allDefaultsError },
    ...stopBusMapsByDay
  ] = await Promise.all([
    slotIds.length > 0
      ? supabase
          .from("student_bus_defaults")
          .select("student_id, bus_stop_id, bus_number_id, bus_time_slot_id, day_of_week, note")
          .in("bus_time_slot_id", slotIds)
          .eq("direction", "dropoff")
      : Promise.resolve({ data: [], error: null }),
    ...[1, 2, 3, 4, 5].map((day) => buildStopToBusMaps(supabase, day)),
  ]);

  if (allDefaultsError) {
    logger.error("[getWeeklyDropoffExportData] defaults", allDefaultsError.message);
    return { error: allDefaultsError.message };
  }

  // 6. 학생 정보 맵 (step 2에서 이미 조회한 allStudents 재활용)
  const studMap = new Map(
    allStudents.map((s) => [s.student_id, s])
  );

  // 7. 메모리 필터링을 위한 (day, slotId) 키 기반 맵 구성
  type DefaultRow = {
    student_id: string;
    bus_stop_id: string | null;
    bus_number_id: string | null;
    bus_time_slot_id: string;
    day_of_week: number;
    note: string | null;
  };
  const defaultsByDaySlot = new Map<string, DefaultRow[]>();
  for (const d of allDefaultsRaw ?? []) {
    const key = `${d.day_of_week as number}:${d.bus_time_slot_id as string}`;
    const list = defaultsByDaySlot.get(key) ?? [];
    list.push({
      student_id: d.student_id as string,
      bus_stop_id: d.bus_stop_id as string | null,
      bus_number_id: d.bus_number_id as string | null,
      bus_time_slot_id: d.bus_time_slot_id as string,
      day_of_week: d.day_of_week as number,
      note: d.note as string | null,
    });
    defaultsByDaySlot.set(key, list);
  }

  const rows: DropoffExportRow[] = [];
  const unassigned: DropoffExportData["unassigned"] = [];

  for (let day = 1; day <= 5; day++) {
    // 이 날 배정된 student_id 추적
    const assignedIds = new Set<string>();

    // 각 시간대별로 메모리 필터링
    for (const slot of slots) {
      const key = `${day}:${slot.id}`;
      const defaults = defaultsByDaySlot.get(key);
      if (!defaults?.length) continue;

      const stopBusMaps = stopBusMapsByDay[day - 1];

      for (const d of defaults) {
        const studentId = d.student_id;
        assignedIds.add(studentId);
        if (!allStudentIds.has(studentId)) continue; // 삭제된 학생 스킵

        const stud = studMap.get(studentId);
        const stopId = d.bus_stop_id;
        // 호차: 저장값 우선, 없으면 정류장 단일 운행 호차
        const busId = stopBusMaps.resolveBus(d.bus_number_id, stopId, slot.id);
        const stopInfo = stopId ? stopInfoMap.get(stopId) : undefined;

        rows.push({
          day,
          profile_id: stud?.profile_id ?? studentId,
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
    .select("student_id, day_of_week");
  const afterschoolEnrollments = (afterschoolData ?? []).map((e) => ({
    profile_id: allStudents.find((student) => student.student_id === (e.student_id as string))?.profile_id ?? (e.student_id as string),
    day: e.day_of_week as number,
  }));

  return { rows, unassigned, slots, busNumbers, afterschoolEnrollments };
}
