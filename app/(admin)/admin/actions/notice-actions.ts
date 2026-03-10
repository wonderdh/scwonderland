"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdmin } from "./auth-helpers";
import type { Notice, NoticeAttachment } from "@/lib/types";

const NOTICE_BUCKET = "notice-files";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

// ──────────────────────────────────────────────
// Storage 헬퍼
// ──────────────────────────────────────────────

async function uploadNoticeFile(
  file: File,
  fileType: "image" | "attachment"
): Promise<{ url: string; storagePath: string } | { error: string }> {
  const allowed = fileType === "image" ? ALLOWED_IMAGE_TYPES : ALLOWED_FILE_TYPES;
  const maxSize = fileType === "image" ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;
  const folder = fileType === "image" ? "images" : "files";

  if (!allowed.includes(file.type)) {
    return {
      error:
        fileType === "image"
          ? "허용되지 않는 이미지 형식입니다. (JPG, PNG, WebP만 가능)"
          : "허용되지 않는 파일 형식입니다. (PDF, ZIP, DOCX, XLSX만 가능)",
    };
  }
  if (file.size > maxSize) {
    return {
      error: `파일 크기가 ${maxSize / 1024 / 1024}MB를 초과합니다.`,
    };
  }

  const ext = file.name.includes(".")
    ? file.name.substring(file.name.lastIndexOf("."))
    : "";
  const storagePath = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;

  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(NOTICE_BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (error) {
    console.error("[uploadNoticeFile]", error.message);
    return { error: `파일 업로드 실패: ${error.message}` };
  }

  const { data: urlData } = supabase.storage
    .from(NOTICE_BUCKET)
    .getPublicUrl(storagePath);

  return { url: urlData.publicUrl, storagePath };
}

async function deleteNoticeFile(publicUrl: string): Promise<void> {
  const marker = `/storage/v1/object/public/${NOTICE_BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return;

  const storagePath = publicUrl.substring(idx + marker.length);
  const supabase = createAdminClient();
  await supabase.storage.from(NOTICE_BUCKET).remove([storagePath]);
}

// ──────────────────────────────────────────────
// 공지사항 CRUD
// ──────────────────────────────────────────────

export async function listNotices(
  includeUnpublished = false
): Promise<(Notice & { image_count: number; attachment_count: number })[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("notices")
    .select("*")
    .order("is_pinned", { ascending: false })
    .order("published_at", { ascending: false });

  if (!includeUnpublished) {
    query = query.eq("is_published", true);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[listNotices]", error.message);
    return [];
  }

  const notices = (data ?? []) as Notice[];
  if (notices.length === 0) return [];

  // 첨부파일 개수 집계
  const noticeIds = notices.map((n) => n.id);
  const { data: attachments } = await supabase
    .from("notice_attachments")
    .select("notice_id, file_type")
    .in("notice_id", noticeIds);

  const countMap = new Map<string, { image: number; attachment: number }>();
  for (const a of attachments ?? []) {
    const entry = countMap.get(a.notice_id) ?? { image: 0, attachment: 0 };
    if (a.file_type === "image") entry.image++;
    else entry.attachment++;
    countMap.set(a.notice_id, entry);
  }

  return notices.map((n) => ({
    ...n,
    image_count: countMap.get(n.id)?.image ?? 0,
    attachment_count: countMap.get(n.id)?.attachment ?? 0,
  }));
}

export async function getNoticeWithAttachments(
  noticeId: string
): Promise<{
  notice: Notice;
  images: NoticeAttachment[];
  attachments: NoticeAttachment[];
} | null> {
  const supabase = createAdminClient();

  const { data: notice, error } = await supabase
    .from("notices")
    .select("*")
    .eq("id", noticeId)
    .single();

  if (error || !notice) {
    console.error("[getNoticeWithAttachments]", error?.message);
    return null;
  }

  const { data: allAttachments } = await supabase
    .from("notice_attachments")
    .select("*")
    .eq("notice_id", noticeId)
    .order("sort_order")
    .order("created_at");

  const images: NoticeAttachment[] = [];
  const attachments: NoticeAttachment[] = [];
  for (const a of (allAttachments ?? []) as NoticeAttachment[]) {
    if (a.file_type === "image") images.push(a);
    else attachments.push(a);
  }

  return { notice: notice as Notice, images, attachments };
}

export async function createNotice(
  formData: FormData
): Promise<{ error?: string; id?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const title = (formData.get("title") as string)?.trim();
  const content = (formData.get("content") as string)?.trim() || null;
  const excerpt = (formData.get("excerpt") as string)?.trim() || null;
  const is_published = formData.get("is_published") === "true";
  const is_pinned = formData.get("is_pinned") === "true";

  if (!title) return { error: "제목을 입력해 주세요." };

  // 파일 업로드
  const imageFiles = formData.getAll("images") as File[];
  const attachmentFiles = formData.getAll("attachments") as File[];

  const uploadedFiles: { url: string; storagePath: string }[] = [];
  const attachmentRecords: Omit<NoticeAttachment, "id" | "notice_id" | "created_at">[] = [];

  try {
    // 이미지 업로드
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      if (!file || file.size === 0) continue;
      const result = await uploadNoticeFile(file, "image");
      if ("error" in result) {
        // 이미 업로드된 파일 롤백
        for (const uploaded of uploadedFiles) {
          await deleteNoticeFile(uploaded.url);
        }
        return { error: result.error };
      }
      uploadedFiles.push(result);
      attachmentRecords.push({
        storage_path: result.storagePath,
        public_url: result.url,
        original_filename: file.name,
        mime_type: file.type,
        file_size: file.size,
        file_type: "image",
        sort_order: i,
      });
    }

    // 첨부파일 업로드
    for (let i = 0; i < attachmentFiles.length; i++) {
      const file = attachmentFiles[i];
      if (!file || file.size === 0) continue;
      const result = await uploadNoticeFile(file, "attachment");
      if ("error" in result) {
        for (const uploaded of uploadedFiles) {
          await deleteNoticeFile(uploaded.url);
        }
        return { error: result.error };
      }
      uploadedFiles.push(result);
      attachmentRecords.push({
        storage_path: result.storagePath,
        public_url: result.url,
        original_filename: file.name,
        mime_type: file.type,
        file_size: file.size,
        file_type: "attachment",
        sort_order: i,
      });
    }

    // DB 삽입
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("notices")
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
      // DB 실패 시 업로드 파일 롤백
      for (const uploaded of uploadedFiles) {
        await deleteNoticeFile(uploaded.url);
      }
      console.error("[createNotice]", error.message);
      return { error: error.message };
    }

    // 첨부파일 레코드 삽입
    if (attachmentRecords.length > 0) {
      const rows = attachmentRecords.map((r) => ({
        ...r,
        notice_id: data.id,
      }));
      const { error: attError } = await supabase
        .from("notice_attachments")
        .insert(rows);
      if (attError) {
        console.error("[createNotice] 첨부파일 레코드 삽입 실패", attError.message);
      }
    }

    return { id: data.id };
  } catch (err) {
    // 예외 발생 시 업로드 파일 롤백
    for (const uploaded of uploadedFiles) {
      await deleteNoticeFile(uploaded.url);
    }
    console.error("[createNotice] 예외", err);
    return { error: "공지사항 생성 중 오류가 발생했습니다." };
  }
}

export async function updateNotice(
  formData: FormData
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const id = (formData.get("id") as string)?.trim();
  const title = (formData.get("title") as string)?.trim();
  const content = (formData.get("content") as string)?.trim() || null;
  const excerpt = (formData.get("excerpt") as string)?.trim() || null;
  const is_published = formData.get("is_published") === "true";
  const is_pinned = formData.get("is_pinned") === "true";
  let removeAttachmentIds: string[] = [];
  try {
    removeAttachmentIds = JSON.parse(
      (formData.get("remove_attachment_ids") as string) || "[]"
    ) as string[];
  } catch {
    return { error: "잘못된 요청 형식입니다." };
  }

  if (!id) return { error: "id가 없습니다." };
  if (!title) return { error: "제목을 입력해 주세요." };

  const supabase = createAdminClient();

  // 새 파일 업로드
  const newImageFiles = formData.getAll("new_images") as File[];
  const newAttachmentFiles = formData.getAll("new_attachments") as File[];

  const uploadedFiles: { url: string; storagePath: string }[] = [];
  const newRecords: Omit<NoticeAttachment, "id" | "notice_id" | "created_at">[] = [];

  try {
    for (let i = 0; i < newImageFiles.length; i++) {
      const file = newImageFiles[i];
      if (!file || file.size === 0) continue;
      const result = await uploadNoticeFile(file, "image");
      if ("error" in result) {
        for (const uploaded of uploadedFiles) await deleteNoticeFile(uploaded.url);
        return { error: result.error };
      }
      uploadedFiles.push(result);
      newRecords.push({
        storage_path: result.storagePath,
        public_url: result.url,
        original_filename: file.name,
        mime_type: file.type,
        file_size: file.size,
        file_type: "image",
        sort_order: i,
      });
    }

    for (let i = 0; i < newAttachmentFiles.length; i++) {
      const file = newAttachmentFiles[i];
      if (!file || file.size === 0) continue;
      const result = await uploadNoticeFile(file, "attachment");
      if ("error" in result) {
        for (const uploaded of uploadedFiles) await deleteNoticeFile(uploaded.url);
        return { error: result.error };
      }
      uploadedFiles.push(result);
      newRecords.push({
        storage_path: result.storagePath,
        public_url: result.url,
        original_filename: file.name,
        mime_type: file.type,
        file_size: file.size,
        file_type: "attachment",
        sort_order: i,
      });
    }

    // DB 업데이트
    const { error } = await supabase
      .from("notices")
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
      for (const uploaded of uploadedFiles) await deleteNoticeFile(uploaded.url);
      console.error("[updateNotice]", error.message);
      return { error: error.message };
    }

    // 새 첨부파일 레코드 삽입
    if (newRecords.length > 0) {
      const rows = newRecords.map((r) => ({ ...r, notice_id: id }));
      await supabase.from("notice_attachments").insert(rows);
    }

    // 제거할 첨부파일 삭제
    if (removeAttachmentIds.length > 0) {
      const { data: toDelete } = await supabase
        .from("notice_attachments")
        .select("id, public_url")
        .in("id", removeAttachmentIds);

      if (toDelete) {
        for (const att of toDelete) {
          await deleteNoticeFile(att.public_url);
        }
        await supabase
          .from("notice_attachments")
          .delete()
          .in("id", removeAttachmentIds);
      }
    }

    return {};
  } catch (err) {
    for (const uploaded of uploadedFiles) await deleteNoticeFile(uploaded.url);
    console.error("[updateNotice] 예외", err);
    return { error: "공지사항 수정 중 오류가 발생했습니다." };
  }
}

export async function deleteNotice(
  noticeId: string
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const supabase = createAdminClient();

  // 첨부파일 URL 조회 (Storage 삭제용)
  const { data: attachments } = await supabase
    .from("notice_attachments")
    .select("public_url")
    .eq("notice_id", noticeId);

  // Storage 파일 삭제
  if (attachments) {
    for (const att of attachments) {
      await deleteNoticeFile(att.public_url);
    }
  }

  // DB 삭제 (CASCADE로 notice_attachments도 삭제)
  const { error } = await supabase
    .from("notices")
    .delete()
    .eq("id", noticeId);

  if (error) {
    console.error("[deleteNotice]", error.message);
    return { error: error.message };
  }

  return {};
}
