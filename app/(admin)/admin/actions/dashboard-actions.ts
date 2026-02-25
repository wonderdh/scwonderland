"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { DashboardStats } from "@/lib/types";

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = createAdminClient();
  const [students, teachers, classes, reports] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "teacher"),
    supabase.from("classes").select("id", { count: "exact", head: true }),
    supabase.from("report_cards").select("id", { count: "exact", head: true }),
  ]);
  return {
    studentCount: students.count ?? 0,
    teacherCount: teachers.count ?? 0,
    classCount: classes.count ?? 0,
    reportCardCount: reports.count ?? 0,
  };
}
