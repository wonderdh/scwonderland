"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdmin } from "./auth-helpers";
import type { DashboardStats } from "@/lib/types";

export async function getDashboardStats(): Promise<DashboardStats> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { studentCount: 0, teacherCount: 0, classCount: 0, reportCardCount: 0, noticeCount: 0 };

  const supabase = createAdminClient();
  const [students, teachers, classes, reports, notices] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student").is("deleted_at", null),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "teacher").is("deleted_at", null),
    supabase.from("classes").select("id", { count: "exact", head: true }),
    supabase.from("report_cards").select("id", { count: "exact", head: true }),
    supabase.from("notices").select("id", { count: "exact", head: true }),
  ]);
  return {
    studentCount: students.count ?? 0,
    teacherCount: teachers.count ?? 0,
    classCount: classes.count ?? 0,
    reportCardCount: reports.count ?? 0,
    noticeCount: notices.count ?? 0,
  };
}
