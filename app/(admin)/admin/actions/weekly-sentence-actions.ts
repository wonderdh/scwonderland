"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { verifyAdmin } from "./auth-helpers";
import { logger } from "@/lib/logger";
import { computeAutoWeekNumber } from "@/lib/utils/weekly-sentence-week";
import { SHEET_LEVEL_MAP } from "@/lib/weekly-sentence-levels";
import type { WeeklySentence, WeeklySentenceConfig } from "@/lib/types";
// xlsx는 default export가 없으므로 bulk import 함수에서만 동적 import로 사용

// ── Public (팝업용) ──

/** 현재 활성 주차의 4개 레벨 문장 조회 (RLS public read) */
export async function getCurrentWeeklySentences(): Promise<{
  weekNumber: number;
  items: Array<{ level: number; english: string; korean: string; answer: string | null }>;
} | null> {
  const supabase = await createClient();
  const { data: cfg } = await supabase
    .from("weekly_sentence_config")
    .select("mode, manual_week, auto_base_week, auto_base_sunday")
    .eq("id", 1)
    .maybeSingle();

  const weekNumber =
    cfg?.mode === "manual" && cfg?.manual_week
      ? cfg.manual_week
      : computeAutoWeekNumber(
          cfg?.auto_base_week ?? 1,
          cfg?.auto_base_sunday ?? "2026-04-12",
        );

  const { data: items } = await supabase
    .from("weekly_sentences")
    .select("level, english, korean, answer")
    .eq("week_number", weekNumber)
    .order("level", { ascending: true });

  if (!items || items.length === 0) return null;
  return { weekNumber, items };
}

// ── Admin CRUD ──

/** 전체 문장 목록 (관리자 테이블) */
export async function listAllWeeklySentences(): Promise<WeeklySentence[]> {
  const auth = await verifyAdmin();
  if ("error" in auth) return [];

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("weekly_sentences")
    .select("*")
    .order("week_number")
    .order("level");

  if (error) {
    logger.error("[listAllWeeklySentences]", error.message);
    return [];
  }
  return (data ?? []) as WeeklySentence[];
}

/** 문장 upsert (week_number + level 기준) */
export async function upsertWeeklySentence(
  weekNumber: number,
  level: number,
  english: string,
  korean: string,
  example?: string,
  answer?: string,
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  if (!english.trim()) return { error: "영어 문장을 입력해 주세요." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("weekly_sentences")
    .upsert(
      {
        week_number: weekNumber,
        level,
        english: english.trim(),
        korean: korean?.trim() || null,
        example: example?.trim() || null,
        answer: answer?.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "week_number,level" },
    );

  if (error) {
    logger.error("[upsertWeeklySentence]", error.message);
    return { error: error.message };
  }
  revalidatePath("/");
  revalidatePath("/admin/weekly-sentences");
  return {};
}

/** 문장 삭제 */
export async function deleteWeeklySentence(
  id: string,
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("weekly_sentences")
    .delete()
    .eq("id", id);

  if (error) {
    logger.error("[deleteWeeklySentence]", error.message);
    return { error: error.message };
  }
  revalidatePath("/");
  revalidatePath("/admin/weekly-sentences");
  return {};
}

/** Excel(XLSX) 일괄 업로드 → 208행 upsert */
export async function bulkImportWeeklySentences(
  formData: FormData,
): Promise<{ error?: string; count?: number }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const file = formData.get("file") as File;
  if (!file || file.size === 0) return { error: "파일을 선택해 주세요." };

  try {
    const XLSX = await import("xlsx");
    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer" });

    const rows: {
      week_number: number;
      level: number;
      english: string;
      korean: string;
      example: string | null;
    }[] = [];

    for (const sheetName of wb.SheetNames) {
      const level = SHEET_LEVEL_MAP[sheetName];
      if (!level) continue;
      const ws = wb.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
      for (const row of json) {
        const week = Number(row["Week"]);
        const english = String(row["English Sentence"] ?? "").trim();
        const korean = String(row["한글 뜻"] ?? "").trim();
        const example = String(row["활용 예시"] ?? "").trim() || null;
        if (!week || !english) continue;
        rows.push({ week_number: week, level, english, korean, example });
      }
    }

    if (rows.length === 0) return { error: "유효한 데이터를 찾을 수 없습니다." };

    const supabase = createAdminClient();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("weekly_sentences")
      .upsert(
        rows.map((r) => ({ ...r, updated_at: now })),
        { onConflict: "week_number,level" },
      );

    if (error) {
      logger.error("[bulkImportWeeklySentences]", error.message);
      return { error: error.message };
    }

    logger.info("[bulkImportWeeklySentences]", `${rows.length}행 업서트 완료`);
    revalidatePath("/");
    revalidatePath("/admin/weekly-sentences");
    return { count: rows.length };
  } catch (err) {
    logger.error("[bulkImportWeeklySentences]", "파싱 실패", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "파일 파싱에 실패했습니다. XLSX 형식을 확인해 주세요." };
  }
}

// ── Config (자동/수동) ──

export async function getWeeklySentenceConfig(): Promise<WeeklySentenceConfig | null> {
  const auth = await verifyAdmin();
  if ("error" in auth) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("weekly_sentence_config")
    .select("*")
    .eq("id", 1)
    .single();

  return (data as WeeklySentenceConfig) ?? null;
}

export async function updateWeeklySentenceConfig(
  mode: "auto" | "manual",
  manualWeek?: number | null,
  autoBaseWeek?: number,
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const { getCurrentSunday } = await import("@/lib/utils/weekly-sentence-week");

  const updateData: Record<string, unknown> = {
    mode,
    manual_week: mode === "manual" ? (manualWeek ?? null) : null,
    updated_at: new Date().toISOString(),
  };

  // 기준 주차 변경: "지금이 N주차" → 이번 주 일요일을 base로 저장
  if (autoBaseWeek && autoBaseWeek >= 1 && autoBaseWeek <= 48) {
    updateData.auto_base_week = autoBaseWeek;
    updateData.auto_base_sunday = getCurrentSunday();
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("weekly_sentence_config")
    .update(updateData)
    .eq("id", 1);

  if (error) {
    logger.error("[updateWeeklySentenceConfig]", error.message);
    return { error: error.message };
  }
  revalidatePath("/");
  revalidatePath("/admin/weekly-sentences");
  return {};
}
