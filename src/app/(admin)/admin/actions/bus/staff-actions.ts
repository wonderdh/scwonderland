"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeEmail } from "@/lib/auth/auth-utils";
import { verifyAdmin } from "../auth-helpers";
import { logger } from "@/lib/server/logger";
import type {
  BusStaffProfile,
  BusNumber,
  BusTimeSlot,
  DropoffExportRow,
  DropoffExportData,
} from "@/lib/types";

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
