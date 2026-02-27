"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  STORAGE_BUCKETS,
  generateStoragePath,
  extractStoragePath,
  validateFile,
} from "@/lib/supabase/storage";
import type { AcademyNotice, AcademyNoticeAttachment } from "@/lib/types";

const BUCKET = STORAGE_BUCKETS.ACADEMY_NOTICES;

// ── Storage 헬퍼 ──

async function uploadFile(
  file: File,
  fileType: "image" | "attachment"
): Promise<{ url: string; storagePath: string } | { error: string }> {
  const category = fileType === "image" ? "image" : "document";
  const validation = validateFile(file, category);
  if (!validation.valid) return { error: validation.error };

  const folder = fileType === "image" ? "images" : "files";
  const storagePath = generateStoragePath(file.name, folder);

  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (error) {
    console.error("[uploadAcademyNoticeFile]", error.message);
    return { error: `파일 업로드 실패: ${error.message}` };
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return { url: urlData.publicUrl, storagePath };
}

async function deleteFile(publicUrl: string): Promise<void> {
  const storagePath = extractStoragePath(publicUrl, BUCKET);
  if (!storagePath) return;
  const supabase = createAdminClient();
  await supabase.storage.from(BUCKET).remove([storagePath]);
}

// ── CRUD ──

/** Academy 공지 목록 (admin: 전체, academy: 게시된 것만) */
export async function listAcademyNotices(
  includeUnpublished = false
): Promise<AcademyNotice[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("academy_notices")
    .select("*")
    .order("is_pinned", { ascending: false })
    .order("published_at", { ascending: false });

  if (!includeUnpublished) {
    query = query.eq("is_published", true);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[listAcademyNotices]", error.message);
    return [];
  }

  const notices = data ?? [];
  if (notices.length === 0) return [];

  // 첨부파일 개수
  const noticeIds = notices.map((n) => n.id);
  const { data: attachments } = await supabase
    .from("academy_notice_attachments")
    .select("academy_notice_id, file_type")
    .in("academy_notice_id", noticeIds);

  const countMap = new Map<string, { image: number; attachment: number }>();
  for (const a of attachments ?? []) {
    const entry = countMap.get(a.academy_notice_id) ?? { image: 0, attachment: 0 };
    if (a.file_type === "image") entry.image++;
    else entry.attachment++;
    countMap.set(a.academy_notice_id, entry);
  }

  return notices.map((n) => ({
    ...n,
    image_count: countMap.get(n.id)?.image ?? 0,
    attachment_count: countMap.get(n.id)?.attachment ?? 0,
  })) as AcademyNotice[];
}

/** Academy 공지 상세 + 첨부파일 */
export async function getAcademyNoticeWithAttachments(
  noticeId: string
): Promise<{
  notice: AcademyNotice;
  images: AcademyNoticeAttachment[];
  attachments: AcademyNoticeAttachment[];
} | null> {
  const supabase = createAdminClient();
  const { data: notice, error } = await supabase
    .from("academy_notices")
    .select("*")
    .eq("id", noticeId)
    .single();

  if (error || !notice) return null;

  const { data: allAttachments } = await supabase
    .from("academy_notice_attachments")
    .select("*")
    .eq("academy_notice_id", noticeId)
    .order("sort_order")
    .order("created_at");

  const images: AcademyNoticeAttachment[] = [];
  const attachmentList: AcademyNoticeAttachment[] = [];
  for (const a of (allAttachments ?? []) as AcademyNoticeAttachment[]) {
    if (a.file_type === "image") images.push(a);
    else attachmentList.push(a);
  }

  return { notice: notice as AcademyNotice, images, attachments: attachmentList };
}

/** Academy 공지 생성 */
export async function createAcademyNotice(
  formData: FormData
): Promise<{ error?: string; id?: string }> {
  const title = (formData.get("title") as string)?.trim();
  const content = (formData.get("content") as string)?.trim() || null;
  const excerpt = (formData.get("excerpt") as string)?.trim() || null;
  const is_published = formData.get("is_published") === "true";
  const is_pinned = formData.get("is_pinned") === "true";

  if (!title) return { error: "제목을 입력해 주세요." };

  const imageFiles = formData.getAll("images") as File[];
  const attachmentFiles = formData.getAll("attachments") as File[];
  const uploadedFiles: { url: string; storagePath: string }[] = [];
  const records: Omit<AcademyNoticeAttachment, "id" | "academy_notice_id" | "created_at">[] = [];

  try {
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      if (!file || file.size === 0) continue;
      const result = await uploadFile(file, "image");
      if ("error" in result) {
        for (const u of uploadedFiles) await deleteFile(u.url);
        return { error: result.error };
      }
      uploadedFiles.push(result);
      records.push({
        storage_path: result.storagePath, public_url: result.url,
        original_filename: file.name, mime_type: file.type,
        file_size: file.size, file_type: "image", sort_order: i,
      });
    }

    for (let i = 0; i < attachmentFiles.length; i++) {
      const file = attachmentFiles[i];
      if (!file || file.size === 0) continue;
      const result = await uploadFile(file, "attachment");
      if ("error" in result) {
        for (const u of uploadedFiles) await deleteFile(u.url);
        return { error: result.error };
      }
      uploadedFiles.push(result);
      records.push({
        storage_path: result.storagePath, public_url: result.url,
        original_filename: file.name, mime_type: file.type,
        file_size: file.size, file_type: "attachment", sort_order: i,
      });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("academy_notices")
      .insert({
        title,
        content,
        excerpt: excerpt || (content ? content.substring(0, 100) : null),
        is_published,
        is_pinned,
      })
      .select("id")
      .single();

    if (error) {
      for (const u of uploadedFiles) await deleteFile(u.url);
      console.error("[createAcademyNotice]", error.message);
      return { error: error.message };
    }

    if (records.length > 0) {
      await supabase
        .from("academy_notice_attachments")
        .insert(records.map((r) => ({ ...r, academy_notice_id: data.id })));
    }

    return { id: data.id };
  } catch (err) {
    for (const u of uploadedFiles) await deleteFile(u.url);
    console.error("[createAcademyNotice] 예외", err);
    return { error: "공지사항 생성 중 오류가 발생했습니다." };
  }
}

/** Academy 공지 수정 */
export async function updateAcademyNotice(
  formData: FormData
): Promise<{ error?: string }> {
  const id = (formData.get("id") as string)?.trim();
  const title = (formData.get("title") as string)?.trim();
  const content = (formData.get("content") as string)?.trim() || null;
  const excerpt = (formData.get("excerpt") as string)?.trim() || null;
  const is_published = formData.get("is_published") === "true";
  const is_pinned = formData.get("is_pinned") === "true";
  const removeIds = JSON.parse(
    (formData.get("remove_attachment_ids") as string) || "[]"
  ) as string[];

  if (!id) return { error: "id가 없습니다." };
  if (!title) return { error: "제목을 입력해 주세요." };

  const supabase = createAdminClient();
  const uploadedFiles: { url: string; storagePath: string }[] = [];
  const newRecords: Omit<AcademyNoticeAttachment, "id" | "academy_notice_id" | "created_at">[] = [];

  try {
    const newImages = formData.getAll("new_images") as File[];
    const newAttachments = formData.getAll("new_attachments") as File[];

    for (let i = 0; i < newImages.length; i++) {
      const file = newImages[i];
      if (!file || file.size === 0) continue;
      const result = await uploadFile(file, "image");
      if ("error" in result) {
        for (const u of uploadedFiles) await deleteFile(u.url);
        return { error: result.error };
      }
      uploadedFiles.push(result);
      newRecords.push({
        storage_path: result.storagePath, public_url: result.url,
        original_filename: file.name, mime_type: file.type,
        file_size: file.size, file_type: "image", sort_order: i,
      });
    }

    for (let i = 0; i < newAttachments.length; i++) {
      const file = newAttachments[i];
      if (!file || file.size === 0) continue;
      const result = await uploadFile(file, "attachment");
      if ("error" in result) {
        for (const u of uploadedFiles) await deleteFile(u.url);
        return { error: result.error };
      }
      uploadedFiles.push(result);
      newRecords.push({
        storage_path: result.storagePath, public_url: result.url,
        original_filename: file.name, mime_type: file.type,
        file_size: file.size, file_type: "attachment", sort_order: i,
      });
    }

    const { error } = await supabase
      .from("academy_notices")
      .update({
        title,
        content,
        excerpt: excerpt || (content ? content.substring(0, 100) : null),
        is_published,
        is_pinned,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      for (const u of uploadedFiles) await deleteFile(u.url);
      return { error: error.message };
    }

    if (newRecords.length > 0) {
      await supabase
        .from("academy_notice_attachments")
        .insert(newRecords.map((r) => ({ ...r, academy_notice_id: id })));
    }

    if (removeIds.length > 0) {
      const { data: toDelete } = await supabase
        .from("academy_notice_attachments")
        .select("id, public_url")
        .in("id", removeIds);
      if (toDelete) {
        for (const att of toDelete) await deleteFile(att.public_url);
        await supabase.from("academy_notice_attachments").delete().in("id", removeIds);
      }
    }

    return {};
  } catch (err) {
    for (const u of uploadedFiles) await deleteFile(u.url);
    return { error: "공지사항 수정 중 오류가 발생했습니다." };
  }
}

/** Academy 공지 삭제 */
export async function deleteAcademyNotice(
  noticeId: string
): Promise<{ error?: string }> {
  const supabase = createAdminClient();

  const { data: attachments } = await supabase
    .from("academy_notice_attachments")
    .select("public_url")
    .eq("academy_notice_id", noticeId);

  if (attachments) {
    for (const att of attachments) await deleteFile(att.public_url);
  }

  const { error } = await supabase
    .from("academy_notices")
    .delete()
    .eq("id", noticeId);

  if (error) {
    console.error("[deleteAcademyNotice]", error.message);
    return { error: error.message };
  }
  return {};
}
