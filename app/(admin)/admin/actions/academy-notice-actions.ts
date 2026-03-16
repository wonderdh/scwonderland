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
import type { AcademyNotice, AcademyNoticeAttachment } from "@/lib/types";

const CONFIG = {
  table: "academy_notices",
  attachmentTable: "academy_notice_attachments",
  fkField: "academy_notice_id",
  bucket: STORAGE_BUCKETS.ACADEMY_NOTICES,
} as const;

const REVALIDATE_PATH = "/admin/academy-notices";

export async function listAcademyNotices(
  includeUnpublished = false
): Promise<AcademyNotice[]> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return [];
  return listPublicNoticesCommon(CONFIG, createAdminClient(), includeUnpublished) as Promise<
    AcademyNotice[]
  >;
}

export async function getAcademyNoticeWithAttachments(
  noticeId: string
): Promise<{
  notice: AcademyNotice;
  images: AcademyNoticeAttachment[];
  attachments: AcademyNoticeAttachment[];
} | null> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return null;
  return getNoticeWithAttachmentsCommon(CONFIG, createAdminClient(), noticeId) as Promise<{
    notice: AcademyNotice;
    images: AcademyNoticeAttachment[];
    attachments: AcademyNoticeAttachment[];
  } | null>;
}

export async function createAcademyNotice(
  formData: FormData
): Promise<{ error?: string; id?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const result = await createPublicNoticeCommon(CONFIG, createAdminClient(), formData);
  if (!result.error) revalidatePath(REVALIDATE_PATH);
  return result;
}

export async function updateAcademyNotice(
  formData: FormData
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const result = await updatePublicNoticeCommon(CONFIG, createAdminClient(), formData);
  if (!result.error) revalidatePath(REVALIDATE_PATH);
  return result;
}

export async function deleteAcademyNotice(
  noticeId: string
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const result = await deleteNoticeCommon(CONFIG, createAdminClient(), noticeId);
  if (!result.error) revalidatePath(REVALIDATE_PATH);
  return result;
}
