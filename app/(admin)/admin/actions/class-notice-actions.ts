"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  STORAGE_BUCKETS,
  generateStoragePath,
  extractStoragePath,
  validateFile,
} from "@/lib/supabase/storage";
import type { ClassNotice, ClassNoticeAttachment } from "@/lib/types";

const BUCKET = STORAGE_BUCKETS.CLASS_NOTICES;

// ── Storage 헬퍼 ──

async function uploadClassNoticeFile(
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
    console.error("[uploadClassNoticeFile]", error.message);
    return { error: `파일 업로드 실패: ${error.message}` };
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return { url: urlData.publicUrl, storagePath };
}

async function deleteClassNoticeFile(publicUrl: string): Promise<void> {
  const storagePath = extractStoragePath(publicUrl, BUCKET);
  if (!storagePath) return;
  const supabase = createAdminClient();
  await supabase.storage.from(BUCKET).remove([storagePath]);
}

// ── CRUD ──

/** 특정 반의 공지 목록 */
export async function listClassNotices(classId: string): Promise<ClassNotice[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("class_notices")
    .select("*")
    .eq("class_id", classId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listClassNotices]", error.message);
    return [];
  }

  const notices = data ?? [];
  if (notices.length === 0) return [];

  // 작성자 이름 조인
  const authorIds = [...new Set(notices.map((n) => n.author_id))];
  const { data: teachers } = await supabase
    .from("teachers")
    .select("profile_id, name")
    .in("profile_id", authorIds);
  const teacherMap = new Map((teachers ?? []).map((t) => [t.profile_id, t.name]));

  // 첨부파일 개수
  const noticeIds = notices.map((n) => n.id);
  const { data: attachments } = await supabase
    .from("class_notice_attachments")
    .select("class_notice_id")
    .in("class_notice_id", noticeIds);
  const countMap = new Map<string, number>();
  for (const a of attachments ?? []) {
    countMap.set(a.class_notice_id, (countMap.get(a.class_notice_id) ?? 0) + 1);
  }

  return notices.map((n) => ({
    ...n,
    author_name: teacherMap.get(n.author_id) ?? "관리자",
    attachment_count: countMap.get(n.id) ?? 0,
  })) as ClassNotice[];
}

/** 공지 상세 + 첨부파일 */
export async function getClassNoticeWithAttachments(
  noticeId: string
): Promise<{ notice: ClassNotice; attachments: ClassNoticeAttachment[] } | null> {
  const supabase = createAdminClient();
  const { data: notice, error } = await supabase
    .from("class_notices")
    .select("*")
    .eq("id", noticeId)
    .single();

  if (error || !notice) return null;

  // 작성자 이름
  const { data: teacher } = await supabase
    .from("teachers")
    .select("name")
    .eq("profile_id", notice.author_id)
    .single();

  const { data: attachments } = await supabase
    .from("class_notice_attachments")
    .select("*")
    .eq("class_notice_id", noticeId)
    .order("sort_order")
    .order("created_at");

  return {
    notice: { ...notice, author_name: teacher?.name ?? "관리자" } as ClassNotice,
    attachments: (attachments ?? []) as ClassNoticeAttachment[],
  };
}

/** 반별 공지 생성 */
export async function createClassNotice(
  formData: FormData
): Promise<{ error?: string; id?: string }> {
  const classId = (formData.get("class_id") as string)?.trim();
  const authorId = (formData.get("author_id") as string)?.trim();
  const title = (formData.get("title") as string)?.trim();
  const content = (formData.get("content") as string)?.trim() || null;
  const is_pinned = formData.get("is_pinned") === "true";

  if (!classId || !authorId) return { error: "필수 정보가 누락되었습니다." };
  if (!title) return { error: "제목을 입력해 주세요." };

  const imageFiles = formData.getAll("images") as File[];
  const attachmentFiles = formData.getAll("attachments") as File[];
  const uploadedFiles: { url: string; storagePath: string }[] = [];
  const records: Omit<ClassNoticeAttachment, "id" | "class_notice_id" | "created_at">[] = [];

  try {
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      if (!file || file.size === 0) continue;
      const result = await uploadClassNoticeFile(file, "image");
      if ("error" in result) {
        for (const u of uploadedFiles) await deleteClassNoticeFile(u.url);
        return { error: result.error };
      }
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
      const result = await uploadClassNoticeFile(file, "attachment");
      if ("error" in result) {
        for (const u of uploadedFiles) await deleteClassNoticeFile(u.url);
        return { error: result.error };
      }
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

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("class_notices")
      .insert({ class_id: classId, author_id: authorId, title, content, is_pinned })
      .select("id")
      .single();

    if (error) {
      for (const u of uploadedFiles) await deleteClassNoticeFile(u.url);
      console.error("[createClassNotice]", error.message);
      return { error: error.message };
    }

    if (records.length > 0) {
      await supabase
        .from("class_notice_attachments")
        .insert(records.map((r) => ({ ...r, class_notice_id: data.id })));
    }

    return { id: data.id };
  } catch (err) {
    for (const u of uploadedFiles) await deleteClassNoticeFile(u.url);
    console.error("[createClassNotice] 예외", err);
    return { error: "공지 생성 중 오류가 발생했습니다." };
  }
}

/** 반별 공지 수정 */
export async function updateClassNotice(
  formData: FormData
): Promise<{ error?: string }> {
  const id = (formData.get("id") as string)?.trim();
  const title = (formData.get("title") as string)?.trim();
  const content = (formData.get("content") as string)?.trim() || null;
  const is_pinned = formData.get("is_pinned") === "true";
  const removeIds = JSON.parse(
    (formData.get("remove_attachment_ids") as string) || "[]"
  ) as string[];

  if (!id) return { error: "id가 없습니다." };
  if (!title) return { error: "제목을 입력해 주세요." };

  const supabase = createAdminClient();
  const uploadedFiles: { url: string; storagePath: string }[] = [];
  const newRecords: Omit<ClassNoticeAttachment, "id" | "class_notice_id" | "created_at">[] = [];

  try {
    const newImages = formData.getAll("new_images") as File[];
    const newAttachments = formData.getAll("new_attachments") as File[];

    for (let i = 0; i < newImages.length; i++) {
      const file = newImages[i];
      if (!file || file.size === 0) continue;
      const result = await uploadClassNoticeFile(file, "image");
      if ("error" in result) {
        for (const u of uploadedFiles) await deleteClassNoticeFile(u.url);
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
      const result = await uploadClassNoticeFile(file, "attachment");
      if ("error" in result) {
        for (const u of uploadedFiles) await deleteClassNoticeFile(u.url);
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
      .from("class_notices")
      .update({ title, content, is_pinned, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      for (const u of uploadedFiles) await deleteClassNoticeFile(u.url);
      return { error: error.message };
    }

    if (newRecords.length > 0) {
      await supabase
        .from("class_notice_attachments")
        .insert(newRecords.map((r) => ({ ...r, class_notice_id: id })));
    }

    if (removeIds.length > 0) {
      const { data: toDelete } = await supabase
        .from("class_notice_attachments")
        .select("id, public_url")
        .in("id", removeIds);
      if (toDelete) {
        for (const att of toDelete) await deleteClassNoticeFile(att.public_url);
        await supabase.from("class_notice_attachments").delete().in("id", removeIds);
      }
    }

    return {};
  } catch (err) {
    for (const u of uploadedFiles) await deleteClassNoticeFile(u.url);
    return { error: "공지 수정 중 오류가 발생했습니다." };
  }
}

/** 반별 공지 삭제 */
export async function deleteClassNotice(
  noticeId: string
): Promise<{ error?: string }> {
  const supabase = createAdminClient();

  const { data: attachments } = await supabase
    .from("class_notice_attachments")
    .select("public_url")
    .eq("class_notice_id", noticeId);

  if (attachments) {
    for (const att of attachments) await deleteClassNoticeFile(att.public_url);
  }

  const { error } = await supabase
    .from("class_notices")
    .delete()
    .eq("id", noticeId);

  if (error) {
    console.error("[deleteClassNotice]", error.message);
    return { error: error.message };
  }
  return {};
}

// ── Academy 조회용 (학생/교사 포털) ──

/** 학생 본인의 소속 반 공지 목록 */
export async function getMyClassNotices(
  studentProfileId: string
): Promise<ClassNotice[]> {
  const supabase = createAdminClient();

  const { data: memberships } = await supabase
    .from("class_students")
    .select("class_id")
    .eq("student_profile_id", studentProfileId);

  if (!memberships?.length) return [];
  const classIds = memberships.map((m) => m.class_id);

  // 반 이름
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name")
    .in("id", classIds);
  const classMap = new Map((classes ?? []).map((c) => [c.id, c.name]));

  const { data, error } = await supabase
    .from("class_notices")
    .select("*")
    .in("class_id", classIds)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[getMyClassNotices]", error.message);
    return [];
  }

  const notices = data ?? [];
  const authorIds = [...new Set(notices.map((n) => n.author_id))];
  const { data: teachers } = await supabase
    .from("teachers")
    .select("profile_id, name")
    .in("profile_id", authorIds);
  const teacherMap = new Map((teachers ?? []).map((t) => [t.profile_id, t.name]));

  return notices.map((n) => ({
    ...n,
    class_name: classMap.get(n.class_id) ?? "",
    author_name: teacherMap.get(n.author_id) ?? "관리자",
  })) as ClassNotice[];
}
