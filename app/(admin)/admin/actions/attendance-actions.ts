"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAuthenticated } from "./auth-helpers";
import type { AttendanceRecord, AttendanceStats } from "@/lib/types";

/** 학생의 출결 기록 목록 (최신순) */
export async function listAttendanceRecords(
  studentProfileId: string,
  year?: number,
  month?: number
): Promise<AttendanceRecord[]> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return [];
  if (year !== undefined && month !== undefined && (month < 1 || month > 12 || year < 2020 || year > 2100)) return [];
  const supabase = createAdminClient();
  let query = supabase
    .from("attendance")
    .select("*")
    .eq("student_profile_id", studentProfileId)
    .order("attendance_date", { ascending: false });

  if (year && month) {
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate =
      month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, "0")}-01`;
    query = query.gte("attendance_date", startDate).lt("attendance_date", endDate);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[listAttendanceRecords]", error.message);
    return [];
  }

  // 반 이름 조인
  const classIds = [...new Set((data ?? []).map((d) => d.class_id))];
  let classMap = new Map<string, string>();
  if (classIds.length) {
    const { data: classes } = await supabase
      .from("classes")
      .select("id, name")
      .in("id", classIds);
    classMap = new Map((classes ?? []).map((c) => [c.id, c.name]));
  }

  return (data ?? []).map((r) => ({
    ...r,
    class_name: classMap.get(r.class_id) ?? "",
  })) as AttendanceRecord[];
}

/** 출결 기록 생성/수정 (upsert) */
export async function recordAttendance(
  studentProfileId: string,
  classId: string,
  attendanceDate: string,
  status: string,
  note?: string
): Promise<{ error?: string }> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();

  if (!["present", "absent", "late", "excused"].includes(status)) {
    return { error: "올바른 출결 상태를 선택해 주세요." };
  }

  const { error } = await supabase.from("attendance").upsert(
    {
      student_profile_id: studentProfileId,
      class_id: classId,
      attendance_date: attendanceDate,
      status,
      note: note?.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_profile_id,class_id,attendance_date" }
  );

  if (error) {
    console.error("[recordAttendance]", error.message);
    return { error: error.message };
  }

  // 결석 처리 시 등·하원 버스 변경 요청 자동 생성 (approved)
  // 결석 취소 시 자동 생성된 변경 요청 삭제
  const dateObj = new Date(attendanceDate);
  const dayOfWeek = dateObj.getDay(); // 0=일, 1=월 ~ 5=금
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    const ABSENT_REASON = "출결 결석 자동 등록";
    if (status === "absent") {
      await supabase.from("bus_change_requests").upsert(
        [
          { student_profile_id: studentProfileId, request_date: attendanceDate, direction: "pickup",  change_type: "absent", status: "approved", reason: ABSENT_REASON, new_bus_time_slot_id: null, new_bus_number_id: null, new_bus_stop_id: null },
          { student_profile_id: studentProfileId, request_date: attendanceDate, direction: "dropoff", change_type: "absent", status: "approved", reason: ABSENT_REASON, new_bus_time_slot_id: null, new_bus_number_id: null, new_bus_stop_id: null },
        ],
        { onConflict: "student_profile_id,request_date,direction" }
      );
    } else {
      // 결석 취소: 자동 생성된 항목만 삭제 (수동 생성 변경 요청은 유지)
      await supabase
        .from("bus_change_requests")
        .delete()
        .eq("student_profile_id", studentProfileId)
        .eq("request_date", attendanceDate)
        .eq("change_type", "absent")
        .eq("reason", ABSENT_REASON);
    }
  }

  revalidatePath("/admin/students");
  return {};
}

/** 출결 기록 삭제 */
export async function deleteAttendance(
  recordId: string
): Promise<{ error?: string }> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("attendance")
    .delete()
    .eq("id", recordId);
  if (error) {
    console.error("[deleteAttendance]", error.message);
    return { error: error.message };
  }
  revalidatePath("/admin/students");
  return {};
}

/** 반 학생들의 특정 날짜 출결 조회 (교사용) */
export async function getClassAttendanceByDate(
  classId: string,
  date: string
): Promise<{ studentProfileId: string; status: string | null; note: string | null }[]> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return [];
  const supabase = createAdminClient();

  // 반 학생 목록
  const { data: members } = await supabase
    .from("class_students")
    .select("student_profile_id")
    .eq("class_id", classId);
  if (!members?.length) return [];

  const studentIds = members.map((m) => m.student_profile_id);

  // 해당 날짜 출결 기록
  const { data: records } = await supabase
    .from("attendance")
    .select("student_profile_id, status, note")
    .eq("class_id", classId)
    .eq("attendance_date", date)
    .in("student_profile_id", studentIds);

  const recordMap = new Map(
    (records ?? []).map((r) => [r.student_profile_id, r])
  );

  return studentIds.map((sid) => {
    const r = recordMap.get(sid);
    return {
      studentProfileId: sid,
      status: r?.status ?? null,
      note: r?.note ?? null,
    };
  });
}

/** 학생의 월별 출결 통계 */
export async function getAttendanceStats(
  studentProfileId: string,
  year: number,
  month: number
): Promise<AttendanceStats> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return { total: 0, present: 0, absent: 0, late: 0, excused: 0 };
  const supabase = createAdminClient();

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const { data } = await supabase
    .from("attendance")
    .select("status")
    .eq("student_profile_id", studentProfileId)
    .gte("attendance_date", startDate)
    .lt("attendance_date", endDate);

  const records = data ?? [];
  return {
    total: records.length,
    present: records.filter((r) => r.status === "present").length,
    absent: records.filter((r) => r.status === "absent").length,
    late: records.filter((r) => r.status === "late").length,
    excused: records.filter((r) => r.status === "excused").length,
  };
}
