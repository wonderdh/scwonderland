/**
 * 공지사항 3종(공개·반별·Academy) 공통 CRUD 헬퍼
 * notice-actions.ts / class-notice-actions.ts / academy-notice-actions.ts에서 사용
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateStoragePath,
  extractStoragePath,
  validateFile,
} from "@/lib/supabase/storage";

type AdminClient = ReturnType<typeof createAdminClient>;

// ── 설정 타입 ──────────────────────────────────────────────────

export type NoticeConfig = {
  table: string;          // "notices" | "class_notices" | "academy_notices"
  attachmentTable: string; // "notice_attachments" | "class_notice_attachments" | ...
  fkField: string;         // "notice_id" | "class_notice_id" | "academy_notice_id"
  bucket: string;
};

// ── 내부 타입 ──────────────────────────────────────────────────

export type AttachmentRecord = {
  storage_path: string;
  public_url: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  file_type: string;
  sort_order: number;
};

// ── Storage 헬퍼 ───────────────────────────────────────────────

export async function uploadNoticeFile(
  bucket: string,
  file: File,
  fileType: "image" | "attachment"
): Promise<{ url: string; storagePath: string } | { error: string }> {
  const validation = validateFile(file, fileType === "image" ? "image" : "document");
  if (!validation.valid) return { error: validation.error };

  const storagePath = generateStoragePath(
    file.name,
    fileType === "image" ? "images" : "files"
  );

  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (error) {
    console.error("[uploadNoticeFile]", error.message);
    return { error: `파일 업로드 실패: ${error.message}` };
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  return { url: urlData.publicUrl, storagePath };
}

export async function deleteNoticeFile(
  bucket: string,
  publicUrl: string
): Promise<void> {
  const storagePath = extractStoragePath(publicUrl, bucket);
  if (!storagePath) return;
  const supabase = createAdminClient();
  await supabase.storage.from(bucket).remove([storagePath]);
}

// ── 파일 업로드 루프 ───────────────────────────────────────────

export async function uploadFilesFromFormData(
  bucket: string,
  imageFiles: File[],
  attachmentFiles: File[]
): Promise<
  | { uploadedFiles: { url: string; storagePath: string }[]; records: AttachmentRecord[] }
  | { error: string; uploadedFiles: { url: string; storagePath: string }[] }
> {
  const uploadedFiles: { url: string; storagePath: string }[] = [];
  const records: AttachmentRecord[] = [];

  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    if (!file || file.size === 0) continue;
    const result = await uploadNoticeFile(bucket, file, "image");
    if ("error" in result) return { error: result.error, uploadedFiles };
    uploadedFiles.push(result);
    records.push({
      storage_path: result.storagePath,
      public_url: result.url,
      original_filename: file.name,
      mime_type: file.type,
      file_size: file.size,
      file_type: "image",
      sort_order: i,
    });
  }

  for (let i = 0; i < attachmentFiles.length; i++) {
    const file = attachmentFiles[i];
    if (!file || file.size === 0) continue;
    const result = await uploadNoticeFile(bucket, file, "attachment");
    if ("error" in result) return { error: result.error, uploadedFiles };
    uploadedFiles.push(result);
    records.push({
      storage_path: result.storagePath,
      public_url: result.url,
      original_filename: file.name,
      mime_type: file.type,
      file_size: file.size,
      file_type: "attachment",
      sort_order: i,
    });
  }

  return { uploadedFiles, records };
}

export async function rollbackUploadedFiles(
  bucket: string,
  files: { url: string }[]
): Promise<void> {
  for (const f of files) {
    await deleteNoticeFile(bucket, f.url);
  }
}

// ── 첨부파일 레코드 헬퍼 ──────────────────────────────────────

export async function insertAttachmentRecords(
  supabase: AdminClient,
  config: NoticeConfig,
  noticeId: string,
  records: AttachmentRecord[]
): Promise<{ error?: string }> {
  if (records.length === 0) return {};
  const rows = records.map((r) => ({ ...r, [config.fkField]: noticeId }));
  const { error } = await supabase.from(config.attachmentTable).insert(rows);
  if (error) {
    console.error("[insertAttachmentRecords]", error.message);
    return { error: "첨부파일 저장에 실패했습니다." };
  }
  return {};
}

export async function deleteAttachmentsByIds(
  bucket: string,
  supabase: AdminClient,
  config: NoticeConfig,
  removeIds: string[]
): Promise<void> {
  if (removeIds.length === 0) return;
  const { data: toDelete } = await supabase
    .from(config.attachmentTable)
    .select("id, public_url")
    .in("id", removeIds);
  if (toDelete) {
    for (const att of toDelete as { public_url: string }[]) {
      await deleteNoticeFile(bucket, att.public_url);
    }
    await supabase.from(config.attachmentTable).delete().in("id", removeIds);
  }
}

// ── 공통 CRUD — 공개공지·Academy공지 전용 ─────────────────────
// (class_notices는 인증 방식·필드 구조가 달라 부분적으로만 사용)

/** 목록 + image_count/attachment_count 집계 */
export async function listPublicNoticesCommon(
  config: NoticeConfig,
  supabase: AdminClient,
  includeUnpublished: boolean
) {
  let query = supabase
    .from(config.table)
    .select("*")
    .order("is_pinned", { ascending: false })
    .order("published_at", { ascending: false });

  if (!includeUnpublished) query = query.eq("is_published", true);

  const { data, error } = await query;
  if (error) {
    console.error(`[listPublicNoticesCommon:${config.table}]`, error.message);
    return [];
  }

  const notices = (data ?? []) as { id: string }[];
  if (notices.length === 0) return [];

  const noticeIds = notices.map((n) => n.id);
  const { data: attachments } = await supabase
    .from(config.attachmentTable)
    .select("*")
    .in(config.fkField, noticeIds);

  const countMap = new Map<string, { image: number; attachment: number }>();
  for (const a of (attachments ?? []) as Record<string, string>[]) {
    const id = a[config.fkField];
    const entry = countMap.get(id) ?? { image: 0, attachment: 0 };
    if (a.file_type === "image") entry.image++;
    else entry.attachment++;
    countMap.set(id, entry);
  }

  return notices.map((n) => ({
    ...n,
    image_count: countMap.get(n.id)?.image ?? 0,
    attachment_count: countMap.get(n.id)?.attachment ?? 0,
  }));
}

/** 상세 + 이미지/첨부파일 분리 */
export async function getNoticeWithAttachmentsCommon(
  config: NoticeConfig,
  supabase: AdminClient,
  noticeId: string
) {
  const { data: notice, error } = await supabase
    .from(config.table)
    .select("*")
    .eq("id", noticeId)
    .single();

  if (error || !notice) {
    console.error(`[getNoticeWithAttachmentsCommon:${config.table}]`, error?.message);
    return null;
  }

  const { data: allAttachments } = await supabase
    .from(config.attachmentTable)
    .select("*")
    .eq(config.fkField, noticeId)
    .order("sort_order")
    .order("created_at");

  const images: Record<string, unknown>[] = [];
  const attachments: Record<string, unknown>[] = [];
  for (const a of (allAttachments ?? []) as { file_type: string }[]) {
    if (a.file_type === "image") images.push(a as Record<string, unknown>);
    else attachments.push(a as Record<string, unknown>);
  }

  return { notice, images, attachments };
}

/** 생성 (excerpt + is_published 포함 공개공지·Academy공지용) */
export async function createPublicNoticeCommon(
  config: NoticeConfig,
  supabase: AdminClient,
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

  try {
    const uploadResult = await uploadFilesFromFormData(config.bucket, imageFiles, attachmentFiles);
    if ("error" in uploadResult) {
      await rollbackUploadedFiles(config.bucket, uploadResult.uploadedFiles);
      return { error: uploadResult.error };
    }
    const { uploadedFiles, records } = uploadResult;

    const { data, error } = await supabase
      .from(config.table)
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
      await rollbackUploadedFiles(config.bucket, uploadedFiles);
      console.error(`[createPublicNoticeCommon:${config.table}]`, error.message);
      return { error: error.message };
    }

    const attResult = await insertAttachmentRecords(supabase, config, data.id, records);
    if (attResult.error) return { error: attResult.error };

    return { id: data.id };
  } catch (err) {
    console.error(`[createPublicNoticeCommon:${config.table}] 예외`, err);
    return { error: "공지사항 생성 중 오류가 발생했습니다." };
  }
}

/** 수정 (excerpt + is_published 포함 공개공지·Academy공지용) */
export async function updatePublicNoticeCommon(
  config: NoticeConfig,
  supabase: AdminClient,
  formData: FormData
): Promise<{ error?: string }> {
  const id = (formData.get("id") as string)?.trim();
  const title = (formData.get("title") as string)?.trim();
  const content = (formData.get("content") as string)?.trim() || null;
  const excerpt = (formData.get("excerpt") as string)?.trim() || null;
  const is_published = formData.get("is_published") === "true";
  const is_pinned = formData.get("is_pinned") === "true";
  let removeIds: string[] = [];
  try {
    removeIds = JSON.parse(
      (formData.get("remove_attachment_ids") as string) || "[]"
    ) as string[];
  } catch {
    return { error: "잘못된 요청 형식입니다." };
  }

  if (!id) return { error: "id가 없습니다." };
  if (!title) return { error: "제목을 입력해 주세요." };

  const newImageFiles = formData.getAll("new_images") as File[];
  const newAttachmentFiles = formData.getAll("new_attachments") as File[];

  try {
    const uploadResult = await uploadFilesFromFormData(
      config.bucket,
      newImageFiles,
      newAttachmentFiles
    );
    if ("error" in uploadResult) {
      await rollbackUploadedFiles(config.bucket, uploadResult.uploadedFiles);
      return { error: uploadResult.error };
    }
    const { uploadedFiles, records } = uploadResult;

    const { error } = await supabase
      .from(config.table)
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
      await rollbackUploadedFiles(config.bucket, uploadedFiles);
      console.error(`[updatePublicNoticeCommon:${config.table}]`, error.message);
      return { error: error.message };
    }

    const attResult = await insertAttachmentRecords(supabase, config, id, records);
    if (attResult.error) return { error: attResult.error };

    await deleteAttachmentsByIds(config.bucket, supabase, config, removeIds);
    return {};
  } catch (err) {
    console.error(`[updatePublicNoticeCommon:${config.table}] 예외`, err);
    return { error: "공지사항 수정 중 오류가 발생했습니다." };
  }
}

/** 삭제 (3종 모두 동일한 패턴) */
export async function deleteNoticeCommon(
  config: NoticeConfig,
  supabase: AdminClient,
  noticeId: string
): Promise<{ error?: string }> {
  const { data: attachments } = await supabase
    .from(config.attachmentTable)
    .select("public_url")
    .eq(config.fkField, noticeId);

  if (attachments) {
    for (const att of attachments as { public_url: string }[]) {
      await deleteNoticeFile(config.bucket, att.public_url);
    }
  }

  const { error } = await supabase.from(config.table).delete().eq("id", noticeId);
  if (error) {
    console.error(`[deleteNoticeCommon:${config.table}]`, error.message);
    return { error: error.message };
  }
  return {};
}
