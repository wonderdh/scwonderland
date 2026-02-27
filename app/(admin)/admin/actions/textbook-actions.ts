"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const COVER_BUCKET = "textbook-covers";
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

// ──────────────────────────────────────────────
// 타입 정의
// ──────────────────────────────────────────────

export type Textbook = {
  id: string;
  title: string;
  series: string | null;
  level: string | null;
  category: string;
  total_units: number;
  cover_image: string | null;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ClassTextbook = {
  id: string;
  class_id: string;
  textbook_id: string;
  textbook_title: string;
  textbook_series: string | null;
  textbook_level: string | null;
  textbook_category: string;
  total_units: number;
  assigned_at: string;
};

export type StudentTextbookProgress = {
  id: string;
  student_profile_id: string;
  textbook_id: string;
  textbook_title: string;
  textbook_series: string | null;
  textbook_level: string | null;
  textbook_category: string;
  textbook_cover_image: string | null;
  total_units: number;
  source_type: "class" | "individual";
  source_class_id: string | null;
  source_class_name: string | null;
  status: "not_started" | "in_progress" | "completed";
  completed_units: number;
  assigned_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type ClassTextbookProgressRow = {
  student_profile_id: string;
  korean_name: string | null;
  english_name: string | null;
  student_number: string | null;
  progress_id: string | null;
  status: "not_started" | "in_progress" | "completed";
  completed_units: number;
  note: string | null;
};

// TEXTBOOK_CATEGORIES는 textbook-constants.ts에서 import

// ──────────────────────────────────────────────
// 커버 이미지 헬퍼
// ──────────────────────────────────────────────

async function uploadCoverImage(
  file: File
): Promise<{ url: string } | { error: string }> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { error: "허용되지 않는 이미지 형식입니다. (JPG, PNG, WebP만 가능)" };
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return { error: "이미지 크기가 10MB를 초과합니다." };
  }

  const ext = file.name.includes(".") ? file.name.substring(file.name.lastIndexOf(".")) : ".jpg";
  const storagePath = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;

  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(COVER_BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (error) {
    console.error("[uploadCoverImage]", error.message);
    return { error: `이미지 업로드 실패: ${error.message}` };
  }

  const { data: urlData } = supabase.storage
    .from(COVER_BUCKET)
    .getPublicUrl(storagePath);

  return { url: urlData.publicUrl };
}

async function deleteCoverImage(publicUrl: string): Promise<void> {
  const marker = `/storage/v1/object/public/${COVER_BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return;

  const storagePath = publicUrl.substring(idx + marker.length);
  const supabase = createAdminClient();
  await supabase.storage.from(COVER_BUCKET).remove([storagePath]);
}

// ──────────────────────────────────────────────
// 교재 CRUD
// ──────────────────────────────────────────────

export async function listTextbooks(): Promise<Textbook[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("textbooks")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")
    .order("title");
  if (error) {
    console.error("[listTextbooks]", error.message);
    return [];
  }
  return (data ?? []) as Textbook[];
}

export async function getTextbook(textbookId: string): Promise<Textbook | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("textbooks")
    .select("*")
    .eq("id", textbookId)
    .single();
  if (error) {
    console.error("[getTextbook]", error.message);
    return null;
  }
  return data as Textbook;
}

export async function createTextbook(formData: FormData): Promise<{ error?: string; id?: string }> {
  const title = (formData.get("title") as string)?.trim();
  const series = (formData.get("series") as string)?.trim() || null;
  const level = (formData.get("level") as string)?.trim() || null;
  const category = (formData.get("category") as string) || "general";
  const total_units = Number(formData.get("total_units")) || 1;
  const description = (formData.get("description") as string)?.trim() || null;
  const coverFile = formData.get("cover_image") as File | null;

  if (!title) return { error: "교재명을 입력해 주세요." };
  if (total_units < 1) return { error: "총 단원 수는 1 이상이어야 합니다." };

  // 커버 이미지 업로드
  let cover_image: string | null = null;
  if (coverFile && coverFile.size > 0) {
    const uploadResult = await uploadCoverImage(coverFile);
    if ("error" in uploadResult) return { error: uploadResult.error };
    cover_image = uploadResult.url;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("textbooks")
    .insert({ title, series, level, category, total_units, description, cover_image })
    .select("id")
    .single();

  if (error) {
    // 업로드한 이미지 롤백
    if (cover_image) await deleteCoverImage(cover_image);
    console.error("[createTextbook]", error.message);
    return { error: error.message };
  }
  return { id: data.id };
}

export async function updateTextbook(formData: FormData): Promise<{ error?: string }> {
  const id = (formData.get("id") as string)?.trim();
  const title = (formData.get("title") as string)?.trim();
  const series = (formData.get("series") as string)?.trim() || null;
  const level = (formData.get("level") as string)?.trim() || null;
  const category = (formData.get("category") as string) || "general";
  const total_units = Number(formData.get("total_units")) || 1;
  const description = (formData.get("description") as string)?.trim() || null;
  const coverFile = formData.get("cover_image") as File | null;
  const removeCover = formData.get("remove_cover") === "true";

  if (!id) return { error: "id가 없습니다." };
  if (!title) return { error: "교재명을 입력해 주세요." };

  const supabase = createAdminClient();

  // 기존 커버 이미지 URL 조회 (교체/삭제 시 필요)
  const { data: existing } = await supabase
    .from("textbooks")
    .select("cover_image")
    .eq("id", id)
    .single();
  const oldCoverUrl = existing?.cover_image as string | null;

  // 커버 이미지 처리
  let cover_image: string | null | undefined = undefined; // undefined = 변경 없음
  if (removeCover) {
    cover_image = null;
  } else if (coverFile && coverFile.size > 0) {
    const uploadResult = await uploadCoverImage(coverFile);
    if ("error" in uploadResult) return { error: uploadResult.error };
    cover_image = uploadResult.url;
  }

  const updateData: Record<string, unknown> = {
    title, series, level, category, total_units, description,
    updated_at: new Date().toISOString(),
  };
  if (cover_image !== undefined) {
    updateData.cover_image = cover_image;
  }

  const { error } = await supabase
    .from("textbooks")
    .update(updateData)
    .eq("id", id);

  if (error) {
    // 새로 업로드한 이미지 롤백
    if (cover_image) await deleteCoverImage(cover_image);
    console.error("[updateTextbook]", error.message);
    return { error: error.message };
  }

  // DB 업데이트 성공 후 이전 이미지 삭제
  if (cover_image !== undefined && oldCoverUrl) {
    await deleteCoverImage(oldCoverUrl);
  }

  return {};
}

export async function deleteTextbook(textbookId: string): Promise<{ error?: string }> {
  const supabase = createAdminClient();

  // 커버 이미지 URL 조회 (삭제용)
  const { data: existing } = await supabase
    .from("textbooks")
    .select("cover_image")
    .eq("id", textbookId)
    .single();

  // soft delete: is_active = false
  const { error } = await supabase
    .from("textbooks")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", textbookId);

  if (error) {
    console.error("[deleteTextbook]", error.message);
    return { error: error.message };
  }

  // Storage에서 커버 이미지 삭제
  if (existing?.cover_image) {
    await deleteCoverImage(existing.cover_image as string);
  }

  return {};
}

// ──────────────────────────────────────────────
// 반별 교재 배정
// ──────────────────────────────────────────────

export async function listClassTextbooks(classId: string): Promise<ClassTextbook[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("class_textbooks")
    .select("id, class_id, textbook_id, assigned_at")
    .eq("class_id", classId);

  if (error) {
    console.error("[listClassTextbooks]", error.message);
    return [];
  }
  if (!data?.length) return [];

  // 교재 정보 조인
  const textbookIds = data.map((ct) => ct.textbook_id);
  const { data: textbooks } = await supabase
    .from("textbooks")
    .select("id, title, series, level, category, total_units")
    .in("id", textbookIds);

  const textbookMap = new Map((textbooks ?? []).map((t) => [t.id, t]));

  return data.map((ct) => {
    const t = textbookMap.get(ct.textbook_id);
    return {
      id: ct.id,
      class_id: ct.class_id,
      textbook_id: ct.textbook_id,
      textbook_title: t?.title ?? "삭제된 교재",
      textbook_series: t?.series ?? null,
      textbook_level: t?.level ?? null,
      textbook_category: t?.category ?? "general",
      total_units: t?.total_units ?? 0,
      assigned_at: ct.assigned_at,
    };
  });
}

export async function assignTextbookToClass(
  classId: string,
  textbookId: string
): Promise<{ error?: string }> {
  const supabase = createAdminClient();

  // 1. class_textbooks에 배정
  const { error: assignError } = await supabase
    .from("class_textbooks")
    .insert({ class_id: classId, textbook_id: textbookId });

  if (assignError) {
    if (assignError.message.includes("duplicate") || assignError.message.includes("unique")) {
      return { error: "이미 배정된 교재입니다." };
    }
    console.error("[assignTextbookToClass]", assignError.message);
    return { error: assignError.message };
  }

  // 2. 반 소속 학생들에게 자동으로 progress 레코드 생성
  const { data: classStudents } = await supabase
    .from("class_students")
    .select("student_profile_id")
    .eq("class_id", classId);

  if (classStudents?.length) {
    const progressRows = classStudents.map((cs) => ({
      student_profile_id: cs.student_profile_id,
      textbook_id: textbookId,
      source_type: "class" as const,
      source_class_id: classId,
      status: "not_started" as const,
      completed_units: 0,
    }));

    // upsert로 이미 존재하는 경우 무시
    const { error: progressError } = await supabase
      .from("student_textbook_progress")
      .upsert(progressRows, { onConflict: "student_profile_id,textbook_id,source_class_id", ignoreDuplicates: true });

    if (progressError) {
      console.error("[assignTextbookToClass] progress 생성 오류", progressError.message);
    }
  }

  return {};
}

export async function removeTextbookFromClass(
  classId: string,
  textbookId: string
): Promise<{ error?: string }> {
  const supabase = createAdminClient();

  // class_textbooks에서 제거
  const { error } = await supabase
    .from("class_textbooks")
    .delete()
    .eq("class_id", classId)
    .eq("textbook_id", textbookId);

  if (error) {
    console.error("[removeTextbookFromClass]", error.message);
    return { error: error.message };
  }

  // 연관 progress도 제거 (source_type='class'이고 해당 반에서 배정된 것)
  await supabase
    .from("student_textbook_progress")
    .delete()
    .eq("textbook_id", textbookId)
    .eq("source_class_id", classId)
    .eq("source_type", "class");

  return {};
}

// ──────────────────────────────────────────────
// 개별 학생 교재 배정
// ──────────────────────────────────────────────

export async function assignTextbookToStudent(
  studentProfileId: string,
  textbookId: string
): Promise<{ error?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("student_textbook_progress")
    .insert({
      student_profile_id: studentProfileId,
      textbook_id: textbookId,
      source_type: "individual",
      source_class_id: null,
      status: "not_started",
      completed_units: 0,
    });

  if (error) {
    if (error.message.includes("duplicate") || error.message.includes("unique")) {
      return { error: "이미 배정된 교재입니다." };
    }
    console.error("[assignTextbookToStudent]", error.message);
    return { error: error.message };
  }
  return {};
}

export async function removeTextbookFromStudent(progressId: string): Promise<{ error?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("student_textbook_progress")
    .delete()
    .eq("id", progressId);

  if (error) {
    console.error("[removeTextbookFromStudent]", error.message);
    return { error: error.message };
  }
  return {};
}

// ──────────────────────────────────────────────
// 진도 관리
// ──────────────────────────────────────────────

export async function updateProgress(
  progressId: string,
  completedUnits: number,
  note?: string | null,
  assignedAt?: string | null,
  completedAt?: string | null
): Promise<{ error?: string }> {
  const supabase = createAdminClient();

  // progress 현재 상태 조회
  const { data: current } = await supabase
    .from("student_textbook_progress")
    .select("textbook_id")
    .eq("id", progressId)
    .single();

  if (!current) return { error: "진도 기록을 찾을 수 없습니다." };

  // 교재의 total_units 조회
  const { data: textbook } = await supabase
    .from("textbooks")
    .select("total_units")
    .eq("id", current.textbook_id)
    .single();

  const totalUnits = textbook?.total_units ?? 999;
  const units = Math.max(0, Math.min(completedUnits, totalUnits));

  let status: "not_started" | "in_progress" | "completed" = "not_started";
  let started_at: string | null = null;
  let completed_at: string | null = null;

  if (units >= totalUnits) {
    status = "completed";
    started_at = new Date().toISOString();
    completed_at = new Date().toISOString();
  } else if (units > 0) {
    status = "in_progress";
    started_at = new Date().toISOString();
  }

  const updateData: Record<string, unknown> = {
    completed_units: units,
    status,
    updated_at: new Date().toISOString(),
  };
  if (started_at) updateData.started_at = started_at;
  if (completed_at) updateData.completed_at = completed_at;
  if (note !== undefined) updateData.note = note;

  // 날짜 수동 지정 (admin/교사가 직접 수정 시)
  if (assignedAt !== undefined) updateData.assigned_at = assignedAt;
  if (completedAt !== undefined) {
    updateData.completed_at = completedAt;
    // 완료일이 수동 설정되면 상태도 completed로
    if (completedAt && units >= totalUnits) {
      updateData.status = "completed";
    }
  }

  const { error } = await supabase
    .from("student_textbook_progress")
    .update(updateData)
    .eq("id", progressId);

  if (error) {
    console.error("[updateProgress]", error.message);
    return { error: error.message };
  }
  return {};
}

export async function listStudentProgress(
  studentProfileId: string
): Promise<StudentTextbookProgress[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("student_textbook_progress")
    .select("*")
    .eq("student_profile_id", studentProfileId);

  if (error) {
    console.error("[listStudentProgress]", error.message);
    return [];
  }
  if (!data?.length) return [];

  // 교재 정보 조인 (cover_image 포함)
  const textbookIds = [...new Set(data.map((p) => p.textbook_id))];
  const { data: textbooks } = await supabase
    .from("textbooks")
    .select("id, title, series, level, category, total_units, cover_image")
    .in("id", textbookIds);
  const textbookMap = new Map((textbooks ?? []).map((t) => [t.id, t]));

  // 반 정보 조인
  const classIds = [...new Set(data.map((p) => p.source_class_id).filter(Boolean))] as string[];
  let classMap = new Map<string, string>();
  if (classIds.length) {
    const { data: classes } = await supabase
      .from("classes")
      .select("id, name")
      .in("id", classIds);
    classMap = new Map((classes ?? []).map((c) => [c.id, c.name]));
  }

  return data.map((p) => {
    const t = textbookMap.get(p.textbook_id);
    return {
      id: p.id,
      student_profile_id: p.student_profile_id,
      textbook_id: p.textbook_id,
      textbook_title: t?.title ?? "삭제된 교재",
      textbook_series: t?.series ?? null,
      textbook_level: t?.level ?? null,
      textbook_category: t?.category ?? "general",
      textbook_cover_image: t?.cover_image ?? null,
      total_units: t?.total_units ?? 0,
      source_type: p.source_type as "class" | "individual",
      source_class_id: p.source_class_id,
      source_class_name: p.source_class_id ? classMap.get(p.source_class_id) ?? null : null,
      status: p.status as "not_started" | "in_progress" | "completed",
      completed_units: p.completed_units ?? 0,
      assigned_at: p.assigned_at,
      started_at: p.started_at,
      completed_at: p.completed_at,
      note: p.note,
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
  });
}

// 반 전체 학생의 특정 교재 진도 현황
export async function getClassTextbookProgress(
  classId: string,
  textbookId: string
): Promise<ClassTextbookProgressRow[]> {
  const supabase = createAdminClient();

  // 반 소속 학생 목록
  const { data: members } = await supabase
    .from("class_students")
    .select("student_profile_id")
    .eq("class_id", classId);

  if (!members?.length) return [];

  const profileIds = members.map((m) => m.student_profile_id);

  // 학생 정보
  const { data: students } = await supabase
    .from("students")
    .select("profile_id, korean_name, english_name, student_number")
    .in("profile_id", profileIds);
  const studentMap = new Map((students ?? []).map((s) => [s.profile_id, s]));

  // 진도 정보
  const { data: progress } = await supabase
    .from("student_textbook_progress")
    .select("id, student_profile_id, status, completed_units, note")
    .eq("textbook_id", textbookId)
    .eq("source_class_id", classId)
    .in("student_profile_id", profileIds);
  const progressMap = new Map((progress ?? []).map((p) => [p.student_profile_id, p]));

  return profileIds.map((pid) => {
    const s = studentMap.get(pid);
    const p = progressMap.get(pid);
    return {
      student_profile_id: pid,
      korean_name: s?.korean_name ?? null,
      english_name: s?.english_name ?? null,
      student_number: s?.student_number ?? null,
      progress_id: p?.id ?? null,
      status: (p?.status ?? "not_started") as "not_started" | "in_progress" | "completed",
      completed_units: p?.completed_units ?? 0,
      note: p?.note ?? null,
    };
  });
}

// 교재를 배정할 수 있는 교재 목록 (해당 반에 아직 배정되지 않은 것)
export async function listTextbooksNotInClass(classId: string): Promise<Textbook[]> {
  const supabase = createAdminClient();

  const { data: assigned } = await supabase
    .from("class_textbooks")
    .select("textbook_id")
    .eq("class_id", classId);
  const assignedIds = new Set((assigned ?? []).map((a) => a.textbook_id));

  const allTextbooks = await listTextbooks();
  return allTextbooks.filter((t) => !assignedIds.has(t.id));
}

// 반 전체 학생의 교재 진도를 일괄 업데이트
export async function batchUpdateProgress(
  classId: string,
  textbookId: string,
  completedUnits: number,
  excludeStudentIds: string[]
): Promise<{ error?: string; updatedCount?: number }> {
  const supabase = createAdminClient();

  // 교재의 total_units 조회
  const { data: textbook } = await supabase
    .from("textbooks")
    .select("total_units")
    .eq("id", textbookId)
    .single();

  if (!textbook) return { error: "교재를 찾을 수 없습니다." };

  const totalUnits = textbook.total_units ?? 999;
  const units = Math.max(0, Math.min(completedUnits, totalUnits));

  // 해당 반+교재의 진도 레코드 조회
  const { data: progressRows } = await supabase
    .from("student_textbook_progress")
    .select("id, student_profile_id")
    .eq("textbook_id", textbookId)
    .eq("source_class_id", classId);

  if (!progressRows?.length) return { error: "업데이트할 진도 기록이 없습니다." };

  // 제외 목록에 없는 학생만 필터
  const excludeSet = new Set(excludeStudentIds);
  const targetRows = progressRows.filter(
    (r) => !excludeSet.has(r.student_profile_id)
  );

  if (targetRows.length === 0) return { error: "업데이트할 학생이 없습니다." };

  // 상태 결정
  let status: "not_started" | "in_progress" | "completed" = "not_started";
  let started_at: string | null = null;
  let completed_at: string | null = null;

  if (units >= totalUnits) {
    status = "completed";
    started_at = new Date().toISOString();
    completed_at = new Date().toISOString();
  } else if (units > 0) {
    status = "in_progress";
    started_at = new Date().toISOString();
  }

  const updateData: Record<string, unknown> = {
    completed_units: units,
    status,
    updated_at: new Date().toISOString(),
  };
  if (started_at) updateData.started_at = started_at;
  if (completed_at) updateData.completed_at = completed_at;

  // 대상 진도 ID로 일괄 업데이트
  const targetIds = targetRows.map((r) => r.id);
  const { error } = await supabase
    .from("student_textbook_progress")
    .update(updateData)
    .in("id", targetIds);

  if (error) {
    console.error("[batchUpdateProgress]", error.message);
    return { error: error.message };
  }

  return { updatedCount: targetIds.length };
}

// 학생에게 배정되지 않은 교재 목록
export async function listTextbooksNotAssignedToStudent(
  studentProfileId: string
): Promise<Textbook[]> {
  const supabase = createAdminClient();

  const { data: assigned } = await supabase
    .from("student_textbook_progress")
    .select("textbook_id")
    .eq("student_profile_id", studentProfileId);
  const assignedIds = new Set((assigned ?? []).map((a) => a.textbook_id));

  const allTextbooks = await listTextbooks();
  return allTextbooks.filter((t) => !assignedIds.has(t.id));
}
