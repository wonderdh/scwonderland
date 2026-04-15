"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdmin } from "./auth-helpers";
import { logger } from "@/lib/server/logger";
import { todayKst, formatDateYmdKst } from "@/lib/utils/date-kst";

export type ReservationAttendance = {
  id: string;
  student_profile_id: string;
  student_name: string;
  attendance_date: string;
  status: string;
  note: string | null;
};

export type ReservationBusChange = {
  id: string;
  student_profile_id: string;
  student_name: string;
  request_date: string;
  change_type: string;
  status: string;
  reason: string | null;
  new_bus_number_label?: string | null;
  new_bus_time_slot_label?: string | null;
};

/** 향후 예약된 출결 + 버스 변경 통합 조회 (관리자 전용) */
export async function getUpcomingReservations(
  daysAhead: number = 30,
): Promise<{
  attendance: ReservationAttendance[];
  busChanges: ReservationBusChange[];
}> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { attendance: [], busChanges: [] };

  const supabase = createAdminClient();
  const today = todayKst();

  // KST 기준 내일~N일 후 (toISOString은 UTC로 밀리므로 formatDateYmdKst 사용)
  const tomorrowDate = formatDateYmdKst(
    new Date(new Date(`${today}T00:00:00+09:00`).getTime() + 86_400_000),
  );
  const futureEnd = formatDateYmdKst(
    new Date(new Date(`${today}T00:00:00+09:00`).getTime() + daysAhead * 86_400_000),
  );

  // 1. 미래 출결 예약 (내일~)
  const { data: attData, error: attError } = await supabase
    .from("attendance")
    .select("id, student_profile_id, attendance_date, status, note")
    .gte("attendance_date", tomorrowDate)
    .lte("attendance_date", futureEnd)
    .order("attendance_date");

  if (attError) {
    logger.error("[getUpcomingReservations:attendance]", attError.message);
  }

  // 2. 미래 버스 변경 (내일~)
  const { data: busData, error: busError } = await supabase
    .from("bus_change_requests")
    .select("id, student_profile_id, request_date, change_type, status, reason, new_bus_number_id, new_bus_time_slot_id")
    .gte("request_date", tomorrowDate)
    .lte("request_date", futureEnd)
    .order("request_date");

  if (busError) {
    logger.error("[getUpcomingReservations:bus]", busError.message);
  }

  // 학생 이름 조인
  const allStudentIds = new Set<string>();
  for (const a of attData ?? []) allStudentIds.add(a.student_profile_id);
  for (const b of busData ?? []) allStudentIds.add(b.student_profile_id);

  const ids = [...allStudentIds];
  let nameMap = new Map<string, string>();
  if (ids.length > 0) {
    const { data: students } = await supabase
      .from("students")
      .select("profile_id, korean_name")
      .in("profile_id", ids);
    nameMap = new Map(
      (students ?? []).map((s) => [s.profile_id, s.korean_name ?? "이름 없음"]),
    );
  }

  // 버스 호차/시간대 이름
  let busNumberMap = new Map<string, string>();
  let busSlotMap = new Map<string, string>();
  const busNumberIds = new Set<string>();
  const busSlotIds = new Set<string>();
  for (const b of busData ?? []) {
    if (b.new_bus_number_id) busNumberIds.add(b.new_bus_number_id);
    if (b.new_bus_time_slot_id) busSlotIds.add(b.new_bus_time_slot_id);
  }
  if (busNumberIds.size > 0) {
    const { data } = await supabase
      .from("bus_numbers")
      .select("id, label")
      .in("id", [...busNumberIds]);
    busNumberMap = new Map((data ?? []).map((b) => [b.id, b.label]));
  }
  if (busSlotIds.size > 0) {
    const { data } = await supabase
      .from("bus_time_slots")
      .select("id, label")
      .in("id", [...busSlotIds]);
    busSlotMap = new Map((data ?? []).map((s) => [s.id, s.label]));
  }

  const attendance: ReservationAttendance[] = (attData ?? []).map((a) => ({
    id: a.id,
    student_profile_id: a.student_profile_id,
    student_name: nameMap.get(a.student_profile_id) ?? "이름 없음",
    attendance_date: a.attendance_date,
    status: a.status,
    note: a.note,
  }));

  const busChanges: ReservationBusChange[] = (busData ?? []).map((b) => ({
    id: b.id,
    student_profile_id: b.student_profile_id,
    student_name: nameMap.get(b.student_profile_id) ?? "이름 없음",
    request_date: b.request_date,
    change_type: b.change_type,
    status: b.status,
    reason: b.reason,
    new_bus_number_label: b.new_bus_number_id
      ? busNumberMap.get(b.new_bus_number_id) ?? null
      : null,
    new_bus_time_slot_label: b.new_bus_time_slot_id
      ? busSlotMap.get(b.new_bus_time_slot_id) ?? null
      : null,
  }));

  return { attendance, busChanges };
}
