"use server";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * 관리자 권한 검증: 인증 + role=admin 확인
 * Admin-only Server Actions에서 사용
 */
export async function verifyAdmin(): Promise<
  { userId: string } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    logger.warn("[verifyAdmin]", "인증 없이 접근 시도");
    return { error: "인증이 필요합니다." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    logger.warn("[verifyAdmin]", "관리자 권한 없음", { userId: user.id, role: profile?.role ?? "없음" });
    return { error: "관리자만 접근 가능합니다." };
  }
  return { userId: user.id };
}

/**
 * 인증 검증: 로그인 여부만 확인 (역할 무관)
 * 교사/학생도 호출 가능한 공유 Server Actions에서 사용
 */
export async function verifyAuthenticated(): Promise<
  { userId: string } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    logger.warn("[verifyAuthenticated]", "인증 없이 접근 시도");
    return { error: "인증이 필요합니다." };
  }
  return { userId: user.id };
}

/**
 * 교사/관리자 권한 검증: 인증 + role ∈ { "teacher", "admin" } 확인
 * 숙제 출제/수정, 출결 기록, 학습기록 등 교사·관리자만 가능한 mutating action에 사용
 */
export async function verifyTeacherOrAdmin(): Promise<
  { userId: string; role: "teacher" | "admin" } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    logger.warn("[verifyTeacherOrAdmin]", "인증 없이 접근 시도");
    return { error: "인증이 필요합니다." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "teacher" && profile?.role !== "admin") {
    logger.warn("[verifyTeacherOrAdmin]", "권한 없음", {
      userId: user.id,
      role: profile?.role ?? "없음",
    });
    return { error: "교사 또는 관리자만 접근 가능합니다." };
  }
  return { userId: user.id, role: profile.role };
}
