"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ReportCard, ReportCardListItem } from "@/lib/types";

/** 선택한 학생·년·월의 리포트카드 1건 조회 (없으면 null). admin/선생/해당 학생만 조회 가능(RLS). */
export async function getReportCard(
  studentProfileId: string,
  year: number,
  month: number
): Promise<ReportCard | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("report_cards")
    .select("id, student_profile_id, year, month, author_id, content, reply, created_at, updated_at")
    .eq("student_profile_id", studentProfileId)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();
  if (error) {
    console.error("[getReportCard]", error.message, { studentProfileId, year, month });
    return null;
  }
  return data as ReportCard | null;
}

/** 해당 학생의 리포트카드 목록 (년·월 내림차순). admin/선생/해당 학생만 조회 가능(RLS). */
export async function listReportCardsByStudent(
  studentProfileId: string
): Promise<ReportCardListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("report_cards")
    .select("id, year, month")
    .eq("student_profile_id", studentProfileId)
    .order("year", { ascending: false })
    .order("month", { ascending: false });
  if (error) {
    console.error("[listReportCardsByStudent]", error.message, { studentProfileId });
    return [];
  }
  return (data ?? []) as ReportCardListItem[];
}

/** 리포트카드 본문 작성/수정. 선생 또는 admin만 가능. author_id는 현재 로그인 사용자. */
export async function upsertReportCard(
  studentProfileId: string,
  year: number,
  month: number,
  content: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["admin", "teacher"].includes(profile.role ?? "")) {
    return { error: "리포트카드 작성 권한이 없습니다." };
  }

  const y = Number(year);
  const m = Number(month);
  if (y < 2000 || y > 2100 || m < 1 || m > 12) {
    return { error: "년도 또는 월이 올바르지 않습니다." };
  }

  const { error } = await supabase.from("report_cards").upsert(
    {
      student_profile_id: studentProfileId,
      year: y,
      month: m,
      author_id: user.id,
      content: content.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_profile_id,year,month" }
  );
  if (error) {
    console.error("[upsertReportCard]", error.message, { studentProfileId, year, month });
    return { error: error.message };
  }
  revalidatePath("/academy");
  return {};
}

/** 학생이 자신의 리포트카드에 답글만 작성/수정. 본문이 있을 때만 허용. */
export async function updateReportCardReply(
  reportCardId: string,
  reply: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { data: row } = await supabase
    .from("report_cards")
    .select("id, student_profile_id, content")
    .eq("id", reportCardId)
    .single();
  if (!row) return { error: "리포트카드를 찾을 수 없습니다." };
  if (row.student_profile_id !== user.id) return { error: "본인 리포트카드만 답글을 달 수 있습니다." };
  if (row.content == null || row.content === "") {
    return { error: "본문이 작성된 후에 답글을 남길 수 있습니다." };
  }

  const { error } = await supabase
    .from("report_cards")
    .update({ reply: reply.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", reportCardId);
  if (error) {
    console.error("[updateReportCardReply]", error.message, { reportCardId });
    return { error: error.message };
  }
  revalidatePath("/academy");
  return {};
}
