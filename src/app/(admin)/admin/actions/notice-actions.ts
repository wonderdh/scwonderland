"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdmin, verifyAuthenticated } from "./auth-helpers";
import { logger } from "@/lib/server/logger";
import type { Notice } from "@/lib/types";

const REVALIDATE_PATH = "/admin/notices";

export async function listNotices(
  includeUnpublished = false
): Promise<Notice[]> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return [];
  if (includeUnpublished) {
    const adminAuth = await verifyAdmin();
    if ("error" in adminAuth) return [];
  }
  const supabase = createAdminClient();
  let query = supabase
    .from("notices")
    .select("*")
    .order("is_pinned", { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: false });
  if (!includeUnpublished) query = query.eq("is_published", true);

  const { data, error } = await query;
  if (error) {
    logger.error("[listNotices]", error.message);
    return [];
  }
  return (data ?? []) as Notice[];
}

export async function getNoticeWithAttachments(
  noticeId: string
): Promise<{ notice: Notice; images: never[]; attachments: never[] } | null> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("notices")
    .select("*")
    .eq("id", noticeId)
    .maybeSingle();
  if (error || !data) {
    if (error) logger.error("[getNoticeWithAttachments]", error.message);
    return null;
  }
  return { notice: data as Notice, images: [], attachments: [] };
}

export async function createNotice(
  formData: FormData
): Promise<{ error?: string; id?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const title = (formData.get("title") as string)?.trim();
  const content = (formData.get("content") as string)?.trim() || null;
  const excerpt =
    (formData.get("excerpt") as string)?.trim() ||
    (content ? content.substring(0, 100) : null);
  const is_published = formData.get("is_published") === "true";
  const is_pinned = formData.get("is_pinned") === "true";

  if (!title) return { error: "제목을 입력해 주세요." };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("notices")
    .insert({
      title,
      content,
      excerpt,
      is_published,
      is_pinned,
      author_id: auth.userId,
      published_at: is_published ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error) {
    logger.error("[createNotice]", error.message);
    return { error: error.message };
  }
  revalidatePath(REVALIDATE_PATH);
  return { id: data.id };
}

export async function updateNotice(
  formData: FormData
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const id = (formData.get("id") as string)?.trim();
  const title = (formData.get("title") as string)?.trim();
  const content = (formData.get("content") as string)?.trim() || null;
  const excerpt =
    (formData.get("excerpt") as string)?.trim() ||
    (content ? content.substring(0, 100) : null);
  const is_published = formData.get("is_published") === "true";
  const is_pinned = formData.get("is_pinned") === "true";

  if (!id) return { error: "id가 없습니다." };
  if (!title) return { error: "제목을 입력해 주세요." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("notices")
    .update({
      title,
      content,
      excerpt,
      is_published,
      is_pinned,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    logger.error("[updateNotice]", error.message);
    return { error: error.message };
  }
  revalidatePath(REVALIDATE_PATH);
  return {};
}

export async function deleteNotice(
  noticeId: string
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const { error } = await supabase.from("notices").delete().eq("id", noticeId);
  if (error) {
    logger.error("[deleteNotice]", error.message);
    return { error: error.message };
  }
  revalidatePath(REVALIDATE_PATH);
  return {};
}
