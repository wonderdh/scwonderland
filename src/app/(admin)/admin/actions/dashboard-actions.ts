"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdmin } from "./auth-helpers";
import { todayKst } from "@/lib/utils/date-kst";
import type { DashboardStats } from "@/lib/types";
import { getUserIdsByRole } from "@/lib/server/domain-helpers";

export async function getTodayStats(): Promise<{
  pendingBusChangeCount: number;
  todayAttendanceCount: number;
}> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { pendingBusChangeCount: 0, todayAttendanceCount: 0 };

  const supabase = createAdminClient();
  const today = todayKst();

  const [{ count: pendingBusChangeCount }, { count: todayAttendanceCount }] = await Promise.all([
    supabase.from("bus_change_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("attendance").select("*", { count: "exact", head: true }).eq("attendance_date", today),
  ]);

  return {
    pendingBusChangeCount: pendingBusChangeCount ?? 0,
    todayAttendanceCount: todayAttendanceCount ?? 0,
  };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { studentCount: 0, teacherCount: 0, classCount: 0, reportCardCount: 0, noticeCount: 0 };

  const supabase = createAdminClient();
  const [studentRoleIds, teacherRoleIds] = await Promise.all([
    getUserIdsByRole(supabase, "student"),
    getUserIdsByRole(supabase, "teacher"),
  ]);

  const [
    { count: studentCount },
    { count: teacherCount },
    { count: classCount },
    { count: reportCardCount },
    { count: noticeCount },
  ] = await Promise.all([
    studentRoleIds.length
      ? supabase.from("profiles").select("*", { count: "exact", head: true }).in("id", studentRoleIds).is("deleted_at", null)
      : Promise.resolve({ count: 0 }),
    teacherRoleIds.length
      ? supabase.from("profiles").select("*", { count: "exact", head: true }).in("id", teacherRoleIds).is("deleted_at", null)
      : Promise.resolve({ count: 0 }),
    supabase.from("classes").select("*", { count: "exact", head: true }),
    supabase.from("report_cards").select("*", { count: "exact", head: true }),
    supabase.from("notices").select("*", { count: "exact", head: true }),
  ]);

  return {
    studentCount: studentCount ?? 0,
    teacherCount: teacherCount ?? 0,
    classCount: classCount ?? 0,
    reportCardCount: reportCardCount ?? 0,
    noticeCount: noticeCount ?? 0,
  };
}
