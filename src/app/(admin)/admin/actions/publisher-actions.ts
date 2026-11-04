"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdmin, verifyAuthenticated } from "./auth-helpers";
import { logger } from "@/lib/server/logger";
import type { Database } from "@/lib/types/database.generated";

type PublisherRow = Database["public"]["Tables"]["publishers"]["Row"];

const REVALIDATE_TEXTBOOKS = "/admin/homework";

function normalizeHomepageUrl(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Auto-prepend https:// if no protocol
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    new URL(withProtocol);
    return withProtocol;
  } catch {
    return null; // caller should surface error
  }
}

/** 활성 출판사 목록 (name 정렬). activeOnly=true 가 기본. */
export const listPublishers = cache(
  async (opts?: { activeOnly?: boolean }): Promise<PublisherRow[]> => {
    const auth = await verifyAuthenticated();
    if ("error" in auth) return [];
    const activeOnly = opts?.activeOnly !== false; // default true
    const supabase = createAdminClient();
    let query = supabase.from("publishers").select("*").order("name", { ascending: true });
    if (activeOnly) {
      query = query.eq("is_active", true);
    }
    const { data, error } = await query;
    if (error) {
      logger.error("[listPublishers]", error.message);
      return [];
    }
    return data ?? [];
  }
);

/** 비활성 포함 전체 출판사 목록 (admin 전용). */
export async function listAllPublishers(): Promise<PublisherRow[]> {
  const auth = await verifyAdmin();
  if ("error" in auth) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("publishers")
    .select("*")
    .order("name", { ascending: true });
  if (error) {
    logger.error("[listAllPublishers]", error.message);
    return [];
  }
  return data ?? [];
}

/** 출판사 생성 (admin 전용). */
export async function createPublisher(
  formData: FormData
): Promise<{ error?: string; data?: PublisherRow }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const rawName = formData.get("name") as string | null;
  const name = rawName?.trim().replace(/\s+/g, " ") ?? "";
  if (!name) return { error: "출판사 이름을 입력해 주세요." };

  const rawUrl = formData.get("homepage_url") as string | null;
  const homepage_url = normalizeHomepageUrl(rawUrl);
  if (rawUrl?.trim() && !homepage_url) {
    return { error: "올바른 URL 형식을 입력해 주세요. (예: https://example.com)" };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("publishers")
    .insert({ name, homepage_url, is_active: true })
    .select()
    .single();

  if (error) {
    logger.error("[createPublisher]", error.message);
    if (error.code === "23505" || error.message.includes("unique")) {
      return { error: `'${name}' 출판사가 이미 존재합니다. 다른 이름을 사용해 주세요.` };
    }
    return { error: error.message };
  }

  revalidatePath(REVALIDATE_TEXTBOOKS);
  return { data };
}

/** 출판사 수정 (admin 전용). */
export async function updatePublisher(
  id: string,
  formData: FormData
): Promise<{ error?: string; data?: PublisherRow }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const rawName = formData.get("name") as string | null;
  const name = rawName?.trim().replace(/\s+/g, " ") ?? "";
  if (!name) return { error: "출판사 이름을 입력해 주세요." };

  const rawUrl = formData.get("homepage_url") as string | null;
  const homepage_url = normalizeHomepageUrl(rawUrl);
  if (rawUrl?.trim() && !homepage_url) {
    return { error: "올바른 URL 형식을 입력해 주세요. (예: https://example.com)" };
  }

  const isActiveRaw = formData.get("is_active");
  const is_active = isActiveRaw === null ? undefined : isActiveRaw !== "false";

  const updatePayload: Database["public"]["Tables"]["publishers"]["Update"] = {
    name,
    homepage_url,
    updated_at: new Date().toISOString(),
  };
  if (is_active !== undefined) updatePayload.is_active = is_active;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("publishers")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logger.error("[updatePublisher]", error.message);
    if (error.code === "23505" || error.message.includes("unique")) {
      return { error: `'${name}' 출판사가 이미 존재합니다. 다른 이름을 사용해 주세요.` };
    }
    return { error: error.message };
  }

  revalidatePath(REVALIDATE_TEXTBOOKS);
  return { data };
}

/** 출판사 소프트 삭제 (is_active=false). admin 전용. */
export async function deletePublisher(id: string): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("publishers")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    logger.error("[deletePublisher]", error.message);
    return { error: error.message };
  }

  revalidatePath(REVALIDATE_TEXTBOOKS);
  return {};
}
