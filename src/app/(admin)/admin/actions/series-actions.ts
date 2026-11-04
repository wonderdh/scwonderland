"use server";

import { cache } from "react";
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

type SeriesRow = Database["public"]["Tables"]["series"]["Row"];

export type SeriesWithPublisher = SeriesRow & {
  publisher: {
    id: string;
    name: string;
    homepage_url: string | null;
  } | null;
};

export type SeriesLevelRow = {
  id: string;
  level: string | null;
  sort_order: number;
  is_active: boolean;
};

const REVALIDATE_TEXTBOOKS = "/admin/homework";

/** 활성 시리즈 목록 (name 정렬). activeOnly=true 가 기본. */
export const listSeries = cache(
  async (opts?: { activeOnly?: boolean }): Promise<SeriesWithPublisher[]> => {
    const auth = await verifyAuthenticated();
    if ("error" in auth) return [];
    const activeOnly = opts?.activeOnly !== false; // default true
    const supabase = createAdminClient();
    let query = supabase
      .from("series")
      .select("*, publisher:publisher_id(id, name, homepage_url)")
      .order("name", { ascending: true });
    if (activeOnly) {
      query = query.eq("is_active", true);
    }
    const { data, error } = await query;
    if (error) {
      logger.error("[listSeries]", error.message);
      return [];
    }
    return (data ?? []) as SeriesWithPublisher[];
  }
);

/** 비활성 포함 전체 시리즈 목록 (admin 전용). */
export async function listAllSeries(): Promise<SeriesWithPublisher[]> {
  const auth = await verifyAdmin();
  if ("error" in auth) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("series")
    .select("*, publisher:publisher_id(id, name, homepage_url)")
    .order("name", { ascending: true });
  if (error) {
    logger.error("[listAllSeries]", error.message);
    return [];
  }
  return (data ?? []) as SeriesWithPublisher[];
}

/** 시리즈별 레벨 (homework_books) 목록. 활성 우선 + sort_order. */
export async function listSeriesLevels(
  seriesId: string
): Promise<SeriesLevelRow[]> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("homework_books")
    .select("id, level, sort_order, is_active")
    .eq("series_id", seriesId)
    .order("is_active", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("level", { ascending: true, nullsFirst: false });
  if (error) {
    logger.error("[listSeriesLevels]", error.message);
    return [];
  }
  return (data ?? []) as SeriesLevelRow[];
}

/** 시리즈 별 레벨 맵 (페이지 prefetch 용). 활성 시리즈만 다룬다. */
export async function listLevelsBySeries(): Promise<Record<string, SeriesLevelRow[]>> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return {};
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("homework_books")
    .select("id, level, sort_order, is_active, series_id")
    .not("series_id", "is", null)
    .order("is_active", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("level", { ascending: true, nullsFirst: false });
  if (error) {
    logger.error("[listLevelsBySeries]", error.message);
    return {};
  }
  const map: Record<string, SeriesLevelRow[]> = {};
  for (const row of data ?? []) {
    const sid = row.series_id as string | null;
    if (!sid) continue;
    const arr = map[sid] ?? (map[sid] = []);
    arr.push({
      id: row.id as string,
      level: (row.level as string | null) ?? null,
      sort_order: (row.sort_order as number) ?? 0,
      is_active: (row.is_active as boolean) ?? true,
    });
  }
  return map;
}

async function uploadCover(
  file: File
): Promise<{ url?: string; error?: string }> {
  const validation = validateFile(file, "image");
  if (!validation.valid) return { error: validation.error };
  const supabase = createAdminClient();
  const storagePath = generateStoragePath(file.name, "covers");
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKETS.TEXTBOOK_COVERS)
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadError) {
    logger.error("[series uploadCover]", uploadError.message);
    return { error: "표지 업로드에 실패했습니다." };
  }
  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKETS.TEXTBOOK_COVERS)
    .getPublicUrl(storagePath);
  return { url: urlData.publicUrl };
}

/** 시리즈 생성 (admin 전용). */
export async function createSeries(
  formData: FormData
): Promise<{ error?: string; data?: SeriesRow }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const rawName = formData.get("name") as string | null;
  const name = rawName?.trim().replace(/\s+/g, " ") ?? "";
  if (!name) return { error: "시리즈 이름을 입력해 주세요." };

  const publisherIdRaw = formData.get("publisher_id") as string | null;
  const publisher_id = publisherIdRaw?.trim() || null;

  const totalUnitsRaw = formData.get("total_units");
  const total_units = totalUnitsRaw ? parseInt(totalUnitsRaw as string, 10) : 0;
  if (!total_units || total_units <= 0) {
    return { error: "총 단원 수를 입력해 주세요." };
  }

  let cover_image_url: string | null = null;
  const coverFile = formData.get("cover") as File | null;
  if (coverFile && coverFile.size > 0) {
    const up = await uploadCover(coverFile);
    if (up.error) return { error: up.error };
    cover_image_url = up.url ?? null;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("series")
    .insert({ name, publisher_id, total_units, cover_image_url, is_active: true })
    .select()
    .single();

  if (error) {
    logger.error("[createSeries]", error.message);
    if (error.code === "23505" || error.message.includes("unique")) {
      return { error: `'${name}' 시리즈가 이미 존재합니다. 다른 이름을 사용해 주세요.` };
    }
    return { error: error.message };
  }

  revalidatePath(REVALIDATE_TEXTBOOKS);
  return { data };
}

/** 시리즈 수정 (admin 전용). */
export async function updateSeries(
  id: string,
  formData: FormData
): Promise<{ error?: string; data?: SeriesRow }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const rawName = formData.get("name") as string | null;
  const name = rawName?.trim().replace(/\s+/g, " ") ?? "";
  if (!name) return { error: "시리즈 이름을 입력해 주세요." };

  const publisherIdRaw = formData.get("publisher_id") as string | null;
  const publisher_id = publisherIdRaw?.trim() || null;

  const totalUnitsRaw = formData.get("total_units");
  const total_units = totalUnitsRaw ? parseInt(totalUnitsRaw as string, 10) : 0;
  if (!total_units || total_units <= 0) {
    return { error: "총 단원 수를 입력해 주세요." };
  }

  const isActiveRaw = formData.get("is_active");
  const is_active =
    isActiveRaw === null ? undefined : isActiveRaw !== "false";

  const supabase = createAdminClient();

  let cover_image_url: string | undefined;
  const coverFile = formData.get("cover") as File | null;
  if (coverFile && coverFile.size > 0) {
    // best-effort delete of old cover
    const { data: existing } = await supabase
      .from("series")
      .select("cover_image_url")
      .eq("id", id)
      .maybeSingle();
    if (existing?.cover_image_url) {
      const oldPath = extractStoragePath(
        existing.cover_image_url,
        STORAGE_BUCKETS.TEXTBOOK_COVERS
      );
      if (oldPath) {
        await supabase.storage
          .from(STORAGE_BUCKETS.TEXTBOOK_COVERS)
          .remove([oldPath]);
      }
    }
    const up = await uploadCover(coverFile);
    if (up.error) return { error: up.error };
    cover_image_url = up.url;
  }

  const updatePayload: Database["public"]["Tables"]["series"]["Update"] = {
    name,
    publisher_id,
    total_units,
    updated_at: new Date().toISOString(),
  };
  if (is_active !== undefined) updatePayload.is_active = is_active;
  if (cover_image_url !== undefined) updatePayload.cover_image_url = cover_image_url;

  const { data, error } = await supabase
    .from("series")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logger.error("[updateSeries]", error.message);
    if (error.code === "23505" || error.message.includes("unique")) {
      return { error: `'${name}' 시리즈가 이미 존재합니다. 다른 이름을 사용해 주세요.` };
    }
    return { error: error.message };
  }

  revalidatePath(REVALIDATE_TEXTBOOKS);
  return { data };
}

/** 시리즈 하드 삭제 (admin 전용). 반에 부여돼 사용 중이면 차단. */
export async function deleteSeries(
  id: string
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const supabase = createAdminClient();

  // 사용 중 검사: 이 시리즈의 어떤 레벨이라도 반에 부여돼 있으면 차단
  const { data: usage, error: usageErr } = await supabase
    .from("class_homework_books")
    .select("id, homework_books!inner(series_id)")
    .eq("homework_books.series_id", id)
    .limit(1);
  if (usageErr) {
    logger.error("[deleteSeries usage check]", usageErr.message);
    return { error: usageErr.message };
  }
  if (usage && usage.length > 0) {
    return { error: "반에 부여돼 사용 중인 시리즈입니다. 먼저 반 부여를 해제하세요." };
  }

  // 자식 (homework_books) 부터 정리 후 시리즈 삭제
  const { error: childErr } = await supabase
    .from("homework_books")
    .delete()
    .eq("series_id", id);
  if (childErr) {
    logger.error("[deleteSeries children]", childErr.message);
    return { error: childErr.message };
  }

  const { error } = await supabase.from("series").delete().eq("id", id);
  if (error) {
    logger.error("[deleteSeries]", error.message);
    return { error: error.message };
  }

  revalidatePath(REVALIDATE_TEXTBOOKS);
  return {};
}
