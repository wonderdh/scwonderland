"use server";

// 신 스키마에서 learning_records 테이블이 제거되어 학습 기록 도메인은 비활성화 상태.
// 도메인 재도입 결정 시 마이그레이션 + 코드 복원 필요.
import { verifyAuthenticated as verifyAuthenticatedUser, verifyTeacherOrAdmin } from "./auth-helpers";
import type { LearningRecord } from "@/lib/types";

export async function listLearningRecords(
  _studentProfileId: string
): Promise<LearningRecord[]> {
  const auth = await verifyAuthenticatedUser();
  if ("error" in auth) return [];
  return [];
}

export async function createLearningRecord(
  _studentProfileId: string,
  _record: {
    record_date: string;
    category: string;
    title: string;
    content?: string;
    score?: number;
    max_score?: number;
  }
): Promise<{ error?: string; id?: string }> {
  const auth = await verifyTeacherOrAdmin();
  if ("error" in auth) return { error: auth.error };
  return { error: "학습 기록 도메인은 현재 비활성화되어 있습니다." };
}

export async function updateLearningRecord(
  _recordId: string,
  _updates: {
    record_date?: string;
    category?: string;
    title?: string;
    content?: string;
    score?: number | null;
    max_score?: number | null;
  }
): Promise<{ error?: string }> {
  const auth = await verifyTeacherOrAdmin();
  if ("error" in auth) return { error: auth.error };
  return { error: "학습 기록 도메인은 현재 비활성화되어 있습니다." };
}

export async function deleteLearningRecord(
  _recordId: string
): Promise<{ error?: string }> {
  const auth = await verifyTeacherOrAdmin();
  if ("error" in auth) return { error: auth.error };
  return { error: "학습 기록 도메인은 현재 비활성화되어 있습니다." };
}
