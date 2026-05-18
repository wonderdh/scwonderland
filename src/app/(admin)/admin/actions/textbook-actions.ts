"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdmin, verifyAuthenticated } from "./auth-helpers";
import { logger } from "@/lib/server/logger";
import type { Database } from "@/lib/types/database.generated";

type TextbookRow = Database["public"]["Tables"]["homework_books"]["Row"];

/**
 * 시리즈 + 시리즈-레벨 조인. `homework_books` row 는 "시리즈 × 레벨" 인스턴스.
 * series.total_units / series.cover_image_url 가 owner — flatten 해서 노출한다.
 */
export type TextbookWithSeries = TextbookRow & {
  series_name: string | null;
  total_units: number;
  cover_image_url: string | null;
};

const REVALIDATE_PATH = "/admin/homework";

/** 활성 (또는 전체) 레벨 목록 + 시리즈 조인. SeriesLevelPicker 등에서 사용. */
export async function listTextbooks(
  opts?: { activeOnly?: boolean }
): Promise<TextbookWithSeries[]> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return [];
  const supabase = createAdminClient();
  let query = supabase
    .from("homework_books")
    .select(
      "*, series:series_id(name, total_units, cover_image_url)"
    )
    .order("is_active", { ascending: false })
    .order("name", { referencedTable: "series", ascending: true, nullsFirst: false })
    .order("level", { ascending: true, nullsFirst: false })
    .order("title", { ascending: true });
  if (opts?.activeOnly) {
    query = query.eq("is_active", true);
  }
  const { data, error } = await query;
  if (error) {
    logger.error("[listTextbooks]", error.message);
    return [];
  }
  return (data ?? []).map((row) => {
    const { series, ...rest } = row as typeof row & {
      series: { name: string; total_units: number; cover_image_url: string | null } | null;
    };
    return {
      ...rest,
      series_name: series?.name ?? null,
      total_units: series?.total_units ?? 0,
      cover_image_url: series?.cover_image_url ?? null,
    } as TextbookWithSeries;
  });
}

export async function getTextbook(id: string): Promise<TextbookRow | null> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("homework_books")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    logger.error("[getTextbook]", error.message);
    return null;
  }
  return data ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Series-level helpers — homework_books row 는 "시리즈 + 레벨" 인스턴스.
// 표지 / total_units / 시리즈명은 series 에서 owner-managed.
// ─────────────────────────────────────────────────────────────────────────────

/** 시리즈에 새 레벨 추가. */
export async function createSeriesLevel(args: {
  seriesId: string;
  level: string | null;
  sortOrder?: number;
}): Promise<{ error?: string; id?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const seriesId = args.seriesId?.trim();
  if (!seriesId) return { error: "시리즈를 선택해 주세요." };

  const supabase = createAdminClient();
  const { data: seriesRow } = await supabase
    .from("series")
    .select("name")
    .eq("id", seriesId)
    .maybeSingle();
  if (!seriesRow) return { error: "시리즈를 찾을 수 없습니다." };

  const level = args.level?.trim() || null;
  const sort_order =
    typeof args.sortOrder === "number" && Number.isFinite(args.sortOrder)
      ? Math.floor(args.sortOrder)
      : 0;
  // title 컬럼은 NOT NULL — 일단 시리즈명으로 시드 (UI 노출은 series.name 사용)
  const title = seriesRow.name;

  const { data, error } = await supabase
    .from("homework_books")
    .insert({ title, series_id: seriesId, level, sort_order })
    .select("id")
    .single();
  if (error) {
    logger.error("[createSeriesLevel]", error.message);
    return { error: error.message };
  }
  revalidatePath(REVALIDATE_PATH);
  return { id: data.id };
}

/** 시리즈-레벨 수정. level, sort_order, is_active. */
export async function updateSeriesLevel(
  id: string,
  patch: { level?: string | null; sortOrder?: number; isActive?: boolean }
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const updatePayload: Database["public"]["Tables"]["homework_books"]["Update"] = {
    updated_at: new Date().toISOString(),
  };
  if (patch.level !== undefined) {
    updatePayload.level = patch.level?.trim() || null;
  }
  if (patch.sortOrder !== undefined) {
    if (!Number.isFinite(patch.sortOrder)) {
      return { error: "정렬 순서가 올바르지 않습니다." };
    }
    updatePayload.sort_order = Math.floor(patch.sortOrder);
  }
  if (patch.isActive !== undefined) {
    updatePayload.is_active = patch.isActive;
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("homework_books")
    .update(updatePayload)
    .eq("id", id);
  if (error) {
    logger.error("[updateSeriesLevel]", error.message);
    return { error: error.message };
  }
  revalidatePath(REVALIDATE_PATH);
  return {};
}

/** 시리즈-레벨 hard delete. 반에 부여돼 사용 중이면 차단. */
export async function deleteSeriesLevel(
  id: string
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const supabase = createAdminClient();

  const { data: usage, error: usageErr } = await supabase
    .from("class_homework_books")
    .select("id")
    .eq("textbook_id", id)
    .limit(1);
  if (usageErr) {
    logger.error("[deleteSeriesLevel usage]", usageErr.message);
    return { error: usageErr.message };
  }
  if (usage && usage.length > 0) {
    return { error: "반에 부여돼 사용 중인 레벨입니다. 먼저 반 부여를 해제하세요." };
  }

  const { error } = await supabase.from("homework_books").delete().eq("id", id);
  if (error) {
    logger.error("[deleteSeriesLevel]", error.message);
    return { error: error.message };
  }
  revalidatePath(REVALIDATE_PATH);
  return {};
}
