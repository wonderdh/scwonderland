"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAuthenticated } from "./auth-helpers";
import type { AttendanceRecord, AttendanceStats } from "@/lib/types";

/** 학생의 출결 기록 목록 (최신순) */
export async function listAttendanceRecords(
  studentProfileId: string,
  year?: number,
  month?: number
): Promise<AttendanceRecord[]> {
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
  return {};
}

/** 반 학생들의 특정 날짜 출결 조회 (교사용) */
export async function getClassAttendanceByDate(
  classId: string,
  date: string
): Promise<{ studentProfileId: string; status: string | null; note: string | null }[]> {
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
