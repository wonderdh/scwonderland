"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAuthenticated, verifyAdmin, verifyTeacherOrAdmin } from "./auth-helpers";
import { logger } from "@/lib/logger";
import { sortStudentsByAgeAndName } from "@/lib/utils/student-sort";
import type { AttendanceRecord, AttendanceStats, StudentWithAttendance } from "@/lib/types";

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
    logger.error("[listAttendanceRecords]", error.message);
    return [];
  }

  return (data ?? []) as AttendanceRecord[];
}

/** 출결 기록 생성/수정 (upsert) — 교사/관리자 전용 */
export async function recordAttendance(
  studentProfileId: string,
  attendanceDate: string,
  status: string,
  note?: string
): Promise<{ error?: string }> {
  const auth = await verifyTeacherOrAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();

  if (!["present", "absent", "late", "excused", "early_leave"].includes(status)) {
    return { error: "올바른 출결 상태를 선택해 주세요." };
  }

  const { error } = await supabase.from("attendance").upsert(
    {
      student_profile_id: studentProfileId,
      attendance_date: attendanceDate,
      status,
      note: note?.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_profile_id,attendance_date" }
  );

  if (error) {
    logger.error("[recordAttendance]", error.message);
    return { error: error.message };
  }

  logger.info("[recordAttendance]", "출결 기록", { studentProfileId, attendanceDate, status });
  // 버스 연동은 DB 트리거(after_attendance_bus_sync)가 자동 처리
  revalidatePath("/admin/students");
  return {};
}

/** 특정 학생의 특정 날짜 출결 조회 */
export async function getStudentAttendanceByDate(
  studentProfileId: string,
  date: string
): Promise<{ status: string | null; note: string | null }> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return { status: null, note: null };
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("attendance")
    .select("status, note")
    .eq("student_profile_id", studentProfileId)
    .eq("attendance_date", date)
    .maybeSingle();
  return { status: data?.status ?? null, note: data?.note ?? null };
}

/** 출결 기록 삭제 — 교사/관리자 전용 */
export async function deleteAttendance(
  recordId: string
): Promise<{ error?: string }> {
  const auth = await verifyTeacherOrAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("attendance")
    .delete()
    .eq("id", recordId);
  if (error) {
    logger.error("[deleteAttendance]", error.message);
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

/** 반 학생 목록 + 특정 날짜 출결 상태 (관리자용 일괄 처리) */
export async function getClassStudentsWithAttendance(
  classId: string,
  date: string
): Promise<StudentWithAttendance[]> {
  const auth = await verifyAdmin();
  if ("error" in auth) return [];
  const supabase = createAdminClient();

  const { data: membersData, error: membersError } = await supabase
    .from("class_students")
    .select("student_profile_id")
    .eq("class_id", classId);

  if (membersError) {
    logger.error("[getClassStudentsWithAttendance] members:", membersError.message);
    return [];
  }

  const profileIds = (membersData ?? []).map((m) => m.student_profile_id);
  if (!profileIds.length) return [];

  const attendanceResult = await supabase
    .from("attendance")
    .select("student_profile_id, status, note")
    .eq("attendance_date", date)
    .in("student_profile_id", profileIds);

  const { data: studentsData, error: studentsError } = await supabase
    .from("students")
    .select("profile_id, korean_name, english_name, age")
    .in("profile_id", profileIds);

  if (studentsError) {
    logger.error("[getClassStudentsWithAttendance] students:", studentsError.message);
    return [];
  }

  const studentMap = new Map(
    (studentsData ?? []).map((s) => [s.profile_id, s])
  );

  const attendanceMap = new Map(
    (attendanceResult.data ?? []).map((r) => [r.student_profile_id, r])
  );

  const result: StudentWithAttendance[] = profileIds.map((profileId) => {
    const s = studentMap.get(profileId);
    const att = attendanceMap.get(profileId);
    return {
      student_profile_id: profileId,
      korean_name: s?.korean_name ?? null,
      english_name: s?.english_name ?? null,
      age: s?.age ?? null,
      status: (att?.status as StudentWithAttendance["status"]) ?? null,
      note: att?.note ?? null,
    };
  });

  // 나이순 → 이름순 정렬 (공통 유틸 사용)
  return sortStudentsByAgeAndName(result);
}

/** 반 출결 일괄 저장 (관리자용 upsert) */
export async function bulkRecordAttendance(
  records: {
    student_profile_id: string;
    date: string;
    status: string;
    note?: string | null;
  }[]
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  if (!records.length) return { error: "저장할 출결 데이터가 없습니다." };

  const validStatuses = ["present", "absent", "late", "excused", "early_leave"];
  for (const r of records) {
    if (!validStatuses.includes(r.status)) {
      return { error: "올바른 출결 상태를 선택해 주세요." };
    }
  }

  const supabase = createAdminClient();
  const rows = records.map((r) => ({
    student_profile_id: r.student_profile_id,
    attendance_date: r.date,
    status: r.status,
    note: r.note?.trim() || null,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("attendance")
    .upsert(rows, { onConflict: "student_profile_id,attendance_date" });

  if (error) {
    logger.error("[bulkRecordAttendance]", error.message);
    return { error: error.message };
  }

  revalidatePath("/admin/attendance");
  revalidatePath("/m/attendance");
  return {};
}

/** 학생의 월별 출결 통계 */
export async function getAttendanceStats(
  studentProfileId: string,
  year: number,
  month: number
): Promise<AttendanceStats> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return { total: 0, present: 0, absent: 0, late: 0, excused: 0, early_leave: 0 };
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
    early_leave: records.filter((r) => r.status === "early_leave").length,
  };
}

/** 다중 날짜 출결 일괄 예약 (관리자 전용) */
export async function bulkReserveAttendance(
  studentProfileId: string,
  dates: string[],
  status: string,
  note?: string,
  autoBusNoRide?: boolean,
): Promise<{ error?: string; count?: number; busCount?: number }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const validStatuses = ["present", "absent", "late", "excused", "early_leave"];
  if (!validStatuses.includes(status)) {
    return { error: "올바른 출결 상태를 선택해 주세요." };
  }
  if (!dates.length) return { error: "날짜를 선택해 주세요." };

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const rows = dates.map((d) => ({
    student_profile_id: studentProfileId,
    attendance_date: d,
    status,
    note: note?.trim() || null,
    updated_at: now,
  }));

  const { error } = await supabase
    .from("attendance")
    .upsert(rows, { onConflict: "student_profile_id,attendance_date" });

  if (error) {
    logger.error("[bulkReserveAttendance]", error.message);
    return { error: error.message };
  }

  // 결석 시 버스 미탑승 자동 연동
  let busCount = 0;
  if (autoBusNoRide && status === "absent") {
    const busRows = dates.map((d) => ({
      student_profile_id: studentProfileId,
      request_date: d,
      change_type: "absent",
      status: "approved",
      reason: "출결 예약 연동 (결석)",
      requested_at: now,
      updated_at: now,
    }));

    const { data: inserted, error: busError } = await supabase
      .from("bus_change_requests")
      .upsert(busRows, {
        onConflict: "student_profile_id,request_date",
        ignoreDuplicates: true,
      })
      .select("id");

    if (busError) {
      logger.error("[bulkReserveAttendance:bus]", busError.message);
    } else {
      busCount = inserted?.length ?? 0;
    }
  }

  logger.info("[bulkReserveAttendance]", `${dates.length}일 출결 예약`, {
    studentProfileId,
    status,
    busCount,
  });
  revalidatePath("/admin/attendance");
  revalidatePath("/admin/reservations");
  revalidatePath("/admin/bus");
  return { count: dates.length, busCount };
}
