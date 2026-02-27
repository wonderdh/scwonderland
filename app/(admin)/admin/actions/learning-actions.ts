"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { LearningRecord } from "@/lib/types";

/** 학생의 학습 기록 목록 (최신순) */
export async function listLearningRecords(
  studentProfileId: string
): Promise<LearningRecord[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("learning_records")
    .select("*")
    .eq("student_profile_id", studentProfileId)
    .order("record_date", { ascending: false });
  if (error) {
    console.error("[listLearningRecords]", error.message);
    return [];
  }
  return (data ?? []) as LearningRecord[];
}

/** 학습 기록 생성 */
export async function createLearningRecord(
  studentProfileId: string,
  record: {
    record_date: string;
    category: string;
    title: string;
    content?: string;
    score?: number;
    max_score?: number;
  }
): Promise<{ error?: string; id?: string }> {
  const supabase = createAdminClient();

  if (!record.title?.trim()) return { error: "제목을 입력해 주세요." };
  if (!record.category) return { error: "카테고리를 선택해 주세요." };

  const { data, error } = await supabase
    .from("learning_records")
    .insert({
      student_profile_id: studentProfileId,
      record_date: record.record_date || new Date().toISOString().split("T")[0],
      category: record.category,
      title: record.title.trim(),
      content: record.content?.trim() || null,
      score: record.score ?? null,
      max_score: record.max_score ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[createLearningRecord]", error.message);
    return { error: error.message };
  }
  return { id: data.id };
}

/** 학습 기록 수정 */
export async function updateLearningRecord(
  recordId: string,
  updates: {
    record_date?: string;
    category?: string;
    title?: string;
    content?: string;
    score?: number | null;
    max_score?: number | null;
  }
): Promise<{ error?: string }> {
  const supabase = createAdminClient();

  if (updates.title !== undefined && !updates.title.trim()) {
    return { error: "제목을 입력해 주세요." };
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (updates.record_date !== undefined) updateData.record_date = updates.record_date;
  if (updates.category !== undefined) updateData.category = updates.category;
  if (updates.title !== undefined) updateData.title = updates.title.trim();
  if (updates.content !== undefined) updateData.content = updates.content.trim() || null;
  if (updates.score !== undefined) updateData.score = updates.score;
  if (updates.max_score !== undefined) updateData.max_score = updates.max_score;

  const { error } = await supabase
    .from("learning_records")
    .update(updateData)
    .eq("id", recordId);

  if (error) {
    console.error("[updateLearningRecord]", error.message);
    return { error: error.message };
  }
  return {};
}

/** 학습 기록 삭제 */
export async function deleteLearningRecord(
  recordId: string
): Promise<{ error?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("learning_records")
    .delete()
    .eq("id", recordId);
  if (error) {
    console.error("[deleteLearningRecord]", error.message);
    return { error: error.message };
  }
  return {};
}
