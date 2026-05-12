"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdmin, verifyAuthenticated } from "./auth-helpers";
import { logger } from "@/lib/server/logger";
import {
  STORAGE_BUCKETS,
  generateStoragePath,
  extractStoragePath,
  validateFile,
} from "@/lib/supabase/storage";
import type { Database } from "@/lib/types/database.generated";

type TextbookRow = Database["public"]["Tables"]["homework_books"]["Row"];

/** TextbookRow with joined series_name for display. */
export type TextbookWithSeries = TextbookRow & { series_name: string | null };

const REVALIDATE_PATH = "/admin/homework";

export async function listTextbooks(
  opts?: { activeOnly?: boolean }
): Promise<TextbookWithSeries[]> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return [];
  const supabase = createAdminClient();
  let query = supabase
    .from("homework_books")
    .select("*, series:series_id(name)")
    .order("is_active", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });
  if (opts?.activeOnly) {
    query = query.eq("is_active", true);
  }
  const { data, error } = await query;
  if (error) {
    logger.error("[listTextbooks]", error.message);
    return [];
  }
  // Flatten nested series join into series_name field
  return (data ?? []).map((row) => {
    const { series: seriesJoin, ...rest } = row as typeof row & { series: { name: string } | null };
    return { ...rest, series_name: seriesJoin?.name ?? null } as TextbookWithSeries;
  });
}

export async function getTextbook(
  id: string
): Promise<TextbookRow | null> {
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

/**
 * @deprecated series-actions.ts 의 listSeries() 를 사용하세요.
 * 이 함수는 textbooks.series text 컬럼의 distinct 값만 반환합니다.
 * 하위 호환용으로 보존됩니다.
 */
export async function listSeriesLegacy(): Promise<string[]> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("homework_books")
    .select("series")
    .not("series", "is", null)
    .order("series", { ascending: true });
  if (error) {
    logger.error("[listSeriesLegacy]", error.message);
    return [];
  }
  const unique = [...new Set((data ?? []).map((row) => row.series as string))];
  return unique;
}

export async function createTextbook(
  formData: FormData
): Promise<{ error?: string; id?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const level = (formData.get("level") as string)?.trim() || null;
  const totalUnitsRaw = formData.get("total_units");
  const total_units = totalUnitsRaw ? parseInt(totalUnitsRaw as string, 10) : 0;
  if (!total_units || total_units <= 0) return { error: "총 단원 수를 입력해 주세요." };

  const sortOrderRaw = formData.get("sort_order");
  const sort_order = sortOrderRaw ? parseInt(sortOrderRaw as string, 10) : 0;

  // series_id (new FK) + series text (legacy backward compat). Title falls back to series.name.
  const series_id = (formData.get("series_id") as string)?.trim() || null;
  let series = (formData.get("series") as string)?.trim() || null;
  let title = (formData.get("title") as string)?.trim() || "";

  if (series_id) {
    const supabaseLookup = createAdminClient();
    const { data: seriesRow } = await supabaseLookup
      .from("series")
      .select("name")
      .eq("id", series_id)
      .maybeSingle();
    if (seriesRow) {
      series = seriesRow.name;
      if (!title) title = seriesRow.name;
    }
  }
  if (!title) return { error: "시리즈를 선택해 주세요." };

  let cover_image_url: string | null = null;
  const coverFile = formData.get("cover") as File | null;
  if (coverFile && coverFile.size > 0) {
    const validation = validateFile(coverFile, "image");
    if (!validation.valid) return { error: validation.error };
    const supabase = createAdminClient();
    const storagePath = generateStoragePath(coverFile.name, "covers");
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKETS.TEXTBOOK_COVERS)
      .upload(storagePath, coverFile, { contentType: coverFile.type, upsert: false });
    if (uploadError) {
      logger.error("[createTextbook] cover upload", uploadError.message);
      return { error: "표지 업로드에 실패했습니다." };
    }
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKETS.TEXTBOOK_COVERS)
      .getPublicUrl(storagePath);
    cover_image_url = urlData.publicUrl;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("homework_books")
    .insert({ title, series, series_id, level, total_units, sort_order, cover_image_url })
    .select("id")
    .single();
  if (error) {
    logger.error("[createTextbook]", error.message);
    return { error: error.message };
  }
  revalidatePath(REVALIDATE_PATH);
  return { id: data.id };
}

export async function updateTextbook(
  id: string,
  formData: FormData
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const level = (formData.get("level") as string)?.trim() || null;
  const totalUnitsRaw = formData.get("total_units");
  const total_units = totalUnitsRaw ? parseInt(totalUnitsRaw as string, 10) : 0;
  if (!total_units || total_units <= 0) return { error: "총 단원 수를 입력해 주세요." };
  const sortOrderRaw = formData.get("sort_order");
  const sort_order = sortOrderRaw ? parseInt(sortOrderRaw as string, 10) : 0;
  const is_active = formData.get("is_active") !== "false";

  // series_id (new FK) + series text (legacy backward compat). Title falls back to series.name.
  const series_id = (formData.get("series_id") as string)?.trim() || null;
  let series = (formData.get("series") as string)?.trim() || null;
  let title = (formData.get("title") as string)?.trim() || "";

  const supabase = createAdminClient();

  if (series_id) {
    const { data: seriesRow } = await supabase
      .from("series")
      .select("name")
      .eq("id", series_id)
      .maybeSingle();
    if (seriesRow) {
      series = seriesRow.name;
      if (!title) title = seriesRow.name;
    }
  }
  if (!title) return { error: "시리즈를 선택해 주세요." };

  let cover_image_url: string | undefined;
  const coverFile = formData.get("cover") as File | null;
  if (coverFile && coverFile.size > 0) {
    const validation = validateFile(coverFile, "image");
    if (!validation.valid) return { error: validation.error };

    // Delete old cover (best-effort)
    const { data: existing } = await supabase
      .from("homework_books")
      .select("cover_image_url")
      .eq("id", id)
      .maybeSingle();
    if (existing?.cover_image_url) {
      const oldPath = extractStoragePath(existing.cover_image_url, STORAGE_BUCKETS.TEXTBOOK_COVERS);
      if (oldPath) {
        await supabase.storage.from(STORAGE_BUCKETS.TEXTBOOK_COVERS).remove([oldPath]);
      }
    }

    const storagePath = generateStoragePath(coverFile.name, "covers");
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKETS.TEXTBOOK_COVERS)
      .upload(storagePath, coverFile, { contentType: coverFile.type, upsert: false });
    if (uploadError) {
      logger.error("[updateTextbook] cover upload", uploadError.message);
      return { error: "표지 업로드에 실패했습니다." };
    }
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKETS.TEXTBOOK_COVERS)
      .getPublicUrl(storagePath);
    cover_image_url = urlData.publicUrl;
  }

  const updatePayload: Database["public"]["Tables"]["homework_books"]["Update"] = {
    title,
    series,
    series_id,
    level,
    total_units,
    sort_order,
    is_active,
    updated_at: new Date().toISOString(),
  };
  if (cover_image_url !== undefined) {
    updatePayload.cover_image_url = cover_image_url;
  }

  const { error } = await supabase.from("homework_books").update(updatePayload).eq("id", id);
  if (error) {
    logger.error("[updateTextbook]", error.message);
    return { error: error.message };
  }
  revalidatePath(REVALIDATE_PATH);
  return {};
}

export async function deleteTextbook(id: string): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("homework_books")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    logger.error("[deleteTextbook]", error.message);
    return { error: error.message };
  }
  revalidatePath(REVALIDATE_PATH);
  return {};
}
