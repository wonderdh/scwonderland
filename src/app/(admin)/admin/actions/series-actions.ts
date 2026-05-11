"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdmin, verifyAuthenticated } from "./auth-helpers";
import { logger } from "@/lib/server/logger";
import type { Database } from "@/lib/types/database.generated";

type SeriesRow = Database["public"]["Tables"]["series"]["Row"];

export type SeriesWithPublisher = SeriesRow & {
  publisher: {
    id: string;
    name: string;
    homepage_url: string | null;
  } | null;
};

const REVALIDATE_SERIES = "/admin/series";
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

/** 단일 시리즈 조회. */
export async function getSeries(id: string): Promise<SeriesWithPublisher | null> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("series")
    .select("*, publisher:publisher_id(id, name, homepage_url)")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    logger.error("[getSeries]", error.message);
    return null;
  }
  return (data ?? null) as SeriesWithPublisher | null;
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

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("series")
    .insert({ name, publisher_id, is_active: true })
    .select()
    .single();

  if (error) {
    logger.error("[createSeries]", error.message);
    // PG unique violation (23505) or check constraint
    if (error.code === "23505" || error.message.includes("unique")) {
      return { error: `'${name}' 시리즈가 이미 존재합니다. 다른 이름을 사용해 주세요.` };
    }
    return { error: error.message };
  }

  revalidatePath(REVALIDATE_SERIES);
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

  const isActiveRaw = formData.get("is_active");
  const is_active =
    isActiveRaw === null ? undefined : isActiveRaw !== "false";

  const updatePayload: Database["public"]["Tables"]["series"]["Update"] = {
    name,
    publisher_id,
    updated_at: new Date().toISOString(),
  };
  if (is_active !== undefined) updatePayload.is_active = is_active;

  const supabase = createAdminClient();
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

  revalidatePath(REVALIDATE_SERIES);
  revalidatePath(REVALIDATE_TEXTBOOKS);
  return { data };
}

/** 시리즈 소프트 삭제 (is_active=false). admin 전용. */
export async function deleteSeries(
  id: string
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("series")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    logger.error("[deleteSeries]", error.message);
    return { error: error.message };
  }

  revalidatePath(REVALIDATE_SERIES);
  revalidatePath(REVALIDATE_TEXTBOOKS);
  return {};
}
