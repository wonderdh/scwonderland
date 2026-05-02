"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdmin, verifyAuthenticated } from "./auth-helpers";
import { STORAGE_BUCKETS } from "@/lib/supabase/storage";
import {
  listPublicNoticesCommon,
  getNoticeWithAttachmentsCommon,
  createPublicNoticeCommon,
  updatePublicNoticeCommon,
  deleteNoticeCommon,
} from "@/lib/supabase/notice-crud-helpers";
import type { Notice, NoticeAttachment } from "@/lib/types";

const CONFIG = {
  table: "notices",
  attachmentTable: "notice_attachments",
  fkField: "notice_id",
  bucket: STORAGE_BUCKETS.NOTICE_FILES,
} as const;

const REVALIDATE_PATH = "/admin/notices";

export async function listNotices(
  includeUnpublished = false
): Promise<(Notice & { image_count: number; attachment_count: number })[]> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return [];
  if (includeUnpublished) {
    const adminAuth = await verifyAdmin();
    if ("error" in adminAuth) return [];
  }
  return listPublicNoticesCommon(CONFIG, createAdminClient(), includeUnpublished) as Promise<
    (Notice & { image_count: number; attachment_count: number })[]
  >;
}

export async function getNoticeWithAttachments(
  noticeId: string
): Promise<{
  notice: Notice;
  images: NoticeAttachment[];
  attachments: NoticeAttachment[];
} | null> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return null;
  return getNoticeWithAttachmentsCommon(CONFIG, createAdminClient(), noticeId) as Promise<{
    notice: Notice;
    images: NoticeAttachment[];
    attachments: NoticeAttachment[];
  } | null>;
}

export async function createNotice(
  formData: FormData
): Promise<{ error?: string; id?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const result = await createPublicNoticeCommon(CONFIG, createAdminClient(), formData);
  if (!result.error) revalidatePath(REVALIDATE_PATH);
  return result;
}

export async function updateNotice(
  formData: FormData
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const result = await updatePublicNoticeCommon(CONFIG, createAdminClient(), formData);
  if (!result.error) revalidatePath(REVALIDATE_PATH);
  return result;
}

export async function deleteNotice(
  noticeId: string
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const result = await deleteNoticeCommon(CONFIG, createAdminClient(), noticeId);
  if (!result.error) revalidatePath(REVALIDATE_PATH);
  return result;
}
