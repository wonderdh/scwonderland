"use server";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getUserRoles } from "@/lib/auth/user-roles";
import { logger } from "@/lib/server/logger";

/**
 * 관리자 권한 검증: 인증 + role=admin 확인
 * Admin-only Server Actions에서 사용
 *
 * React `cache()`로 요청당 1회만 DB 조회 (같은 요청에서 여러 번 호출해도 auth.getUser + profiles 쿼리 1회).
 */
const cachedVerifyAdmin = cache(
  async (): Promise<{ userId: string } | { error: string }> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      logger.warn("[verifyAdmin]", "인증 없이 접근 시도");
      return { error: "인증이 필요합니다." };
    }

    const { roles } = await getUserRoles(supabase, user.id);

    if (!roles.includes("admin")) {
      logger.warn("[verifyAdmin]", "관리자 권한 없음", {
        userId: user.id,
        roles,
      });
      return { error: "관리자만 접근 가능합니다." };
    }
    return { userId: user.id };
  }
);

export async function verifyAdmin() {
  return cachedVerifyAdmin();
}

/**
 * 인증 검증: 로그인 여부만 확인 (역할 무관)
 * 교사/학생도 호출 가능한 공유 Server Actions에서 사용
 */
const cachedVerifyAuthenticated = cache(
  async (): Promise<{ userId: string } | { error: string }> => {
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
);

export async function verifyAuthenticated() {
  return cachedVerifyAuthenticated();
}

/**
 * 교사/관리자 권한 검증: 인증 + role ∈ { "teacher", "admin" } 확인
 * 숙제 출제/수정, 출결 기록, 학습기록 등 교사·관리자만 가능한 mutating action에 사용
 */
const cachedVerifyTeacherOrAdmin = cache(
  async (): Promise<
    { userId: string; role: "teacher" | "admin" } | { error: string }
  > => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      logger.warn("[verifyTeacherOrAdmin]", "인증 없이 접근 시도");
      return { error: "인증이 필요합니다." };
    }

    const { roles } = await getUserRoles(supabase, user.id);

    const role = roles.includes("admin")
      ? "admin"
      : roles.includes("teacher")
        ? "teacher"
        : null;

    if (!role) {
      logger.warn("[verifyTeacherOrAdmin]", "권한 없음", {
        userId: user.id,
        roles,
      });
      return { error: "교사 또는 관리자만 접근 가능합니다." };
    }
    return { userId: user.id, role };
  }
);

export async function verifyTeacherOrAdmin() {
  return cachedVerifyTeacherOrAdmin();
}
