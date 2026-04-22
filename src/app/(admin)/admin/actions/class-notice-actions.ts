"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { STORAGE_BUCKETS } from "@/lib/supabase/storage";
import { logger } from "@/lib/server/logger";
import {
  uploadFilesFromFormData,
  rollbackUploadedFiles,
  insertAttachmentRecords,
  deleteAttachmentsByIds,
  deleteNoticeCommon,
} from "@/lib/supabase/notice-crud-helpers";
import type { ClassNotice, ClassNoticeAttachment } from "@/lib/types";
import { verifyAuthenticated, verifyTeacherOrAdmin } from "./auth-helpers";

const CONFIG = {
  table: "class_notices",
  attachmentTable: "class_notice_attachments",
  fkField: "class_notice_id",
  bucket: STORAGE_BUCKETS.CLASS_NOTICES,
} as const;

const REVALIDATE_PATH = "/admin/class-notices";

// ── 목록 ─────────────────────────────────────────────────────

/** 특정 반의 공지 목록 (작성자 이름 + 첨부파일 수 조인) */
export async function listClassNotices(classId: string): Promise<ClassNotice[]> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return [];

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("class_notices")
    .select("*")
    .eq("class_id", classId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("[listClassNotices]", error.message);
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

// ── 상세 ─────────────────────────────────────────────────────

/** 공지 상세 + 첨부파일 + 작성자 이름 */
export async function getClassNoticeWithAttachments(
  noticeId: string
): Promise<{ notice: ClassNotice; attachments: ClassNoticeAttachment[] } | null> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return null;

  const supabase = createAdminClient();
  const { data: notice, error } = await supabase
    .from("class_notices")
    .select("*")
    .eq("id", noticeId)
    .single();

  if (error || !notice) return null;

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

// ── 생성 ─────────────────────────────────────────────────────

/** 반별 공지 생성 (교사/관리자 전용, author_id === user.id 검증) */
export async function createClassNotice(
  formData: FormData
): Promise<{ error?: string; id?: string }> {
  const auth = await verifyTeacherOrAdmin();
  if ("error" in auth) return { error: auth.error };

  const classId = (formData.get("class_id") as string)?.trim();
  const authorId = (formData.get("author_id") as string)?.trim();
  const title = (formData.get("title") as string)?.trim();
  const content = (formData.get("content") as string)?.trim() || null;
  const is_pinned = formData.get("is_pinned") === "true";

  if (!classId || !authorId) return { error: "필수 정보가 누락되었습니다." };
  if (!title) return { error: "제목을 입력해 주세요." };
  if (authorId !== auth.userId) return { error: "권한이 없습니다." };

  const imageFiles = formData.getAll("images") as File[];
  const attachmentFiles = formData.getAll("attachments") as File[];

  try {
    const uploadResult = await uploadFilesFromFormData(CONFIG.bucket, imageFiles, attachmentFiles);
    if ("error" in uploadResult) {
      await rollbackUploadedFiles(CONFIG.bucket, uploadResult.uploadedFiles);
      return { error: uploadResult.error };
    }
    const { uploadedFiles, records } = uploadResult;

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("class_notices")
      .insert({ class_id: classId, author_id: authorId, title, content, is_pinned })
      .select("id")
      .single();

    if (error) {
      await rollbackUploadedFiles(CONFIG.bucket, uploadedFiles);
      logger.error("[createClassNotice]", error.message);
      return { error: error.message };
    }

    const attResult = await insertAttachmentRecords(supabase, CONFIG, data.id, records);
    if (attResult.error) return { error: attResult.error };

    revalidatePath(REVALIDATE_PATH);
    return { id: data.id };
  } catch (err) {
    logger.error("[createClassNotice]", "예외 발생", { error: err instanceof Error ? err.message : String(err) });
    return { error: "공지 생성 중 오류가 발생했습니다." };
  }
}

// ── 수정 ─────────────────────────────────────────────────────

/** 반별 공지 수정 (교사 본인 글만, 관리자는 전체) */
export async function updateClassNotice(
  formData: FormData
): Promise<{ error?: string }> {
  const auth = await verifyTeacherOrAdmin();
  if ("error" in auth) return { error: auth.error };

  const id = (formData.get("id") as string)?.trim();
  const title = (formData.get("title") as string)?.trim();
  const content = (formData.get("content") as string)?.trim() || null;
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

  const supabase = createAdminClient();

  // 교사는 본인이 작성한 공지만 수정 가능 (관리자는 전체)
  if (auth.role === "teacher") {
    const { data: existing } = await supabase
      .from("class_notices")
      .select("author_id")
      .eq("id", id)
      .single();
    if (!existing) return { error: "공지를 찾을 수 없습니다." };
    if (existing.author_id !== auth.userId) {
      return { error: "본인이 작성한 공지만 수정할 수 있습니다." };
    }
  }

  const newImages = formData.getAll("new_images") as File[];
  const newAttachments = formData.getAll("new_attachments") as File[];

  try {
    const uploadResult = await uploadFilesFromFormData(CONFIG.bucket, newImages, newAttachments);
    if ("error" in uploadResult) {
      await rollbackUploadedFiles(CONFIG.bucket, uploadResult.uploadedFiles);
      return { error: uploadResult.error };
    }
    const { uploadedFiles, records } = uploadResult;

    const { error } = await supabase
      .from("class_notices")
      .update({ title, content, is_pinned, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      await rollbackUploadedFiles(CONFIG.bucket, uploadedFiles);
      return { error: error.message };
    }

    const attResult = await insertAttachmentRecords(supabase, CONFIG, id, records);
    if (attResult.error) return { error: attResult.error };

    await deleteAttachmentsByIds(CONFIG.bucket, supabase, CONFIG, removeIds);

    revalidatePath(REVALIDATE_PATH);
    return {};
  } catch (err) {
    logger.error("[updateClassNotice]", "예외 발생", { error: err instanceof Error ? err.message : String(err) });
    return { error: "공지 수정 중 오류가 발생했습니다." };
  }
}

// ── 삭제 ─────────────────────────────────────────────────────

/** 반별 공지 삭제 (교사 본인 글만, 관리자는 전체) */
export async function deleteClassNotice(
  noticeId: string
): Promise<{ error?: string }> {
  const auth = await verifyTeacherOrAdmin();
  if ("error" in auth) return { error: auth.error };

  const supabase = createAdminClient();

  // 교사는 본인이 작성한 공지만 삭제 가능 (관리자는 전체)
  if (auth.role === "teacher") {
    const { data: existing } = await supabase
      .from("class_notices")
      .select("author_id")
      .eq("id", noticeId)
      .single();
    if (!existing) return { error: "공지를 찾을 수 없습니다." };
    if (existing.author_id !== auth.userId) {
      return { error: "본인이 작성한 공지만 삭제할 수 있습니다." };
    }
  }

  const result = await deleteNoticeCommon(CONFIG, supabase, noticeId);
  if (!result.error) revalidatePath(REVALIDATE_PATH);
  return result;
}

// ── 학생 포털용 ──────────────────────────────────────────────

/** 학생 본인의 소속 반 공지 목록 */
export async function getMyClassNotices(
  studentProfileId: string
): Promise<ClassNotice[]> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return [];

  const supabase = createAdminClient();

  const { data: memberships } = await supabase
    .from("class_students")
    .select("class_id")
    .eq("student_profile_id", studentProfileId);

  if (!memberships?.length) return [];
  const classIds = memberships.map((m) => m.class_id);

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
    logger.error("[getMyClassNotices]", error.message);
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
