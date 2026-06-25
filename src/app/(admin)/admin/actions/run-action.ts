import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/server/logger";
import { type ActionResult, fail } from "@/lib/types/server-action";
import {
  verifyAdmin,
  verifyAuthenticated,
  verifyTeacherOrAdmin,
} from "./auth-helpers";

type AuthLevel = "admin" | "teacherOrAdmin" | "authenticated";

export interface ActionContext {
  /** 인증 세션에서 가져온 사용자 ID (클라이언트 입력이 아님 — 신원 위조 방지). */
  userId: string;
  /** `auth: "teacherOrAdmin"` 일 때만 채워진다. */
  role?: "teacher" | "admin";
  /** RLS 우회 admin 클라이언트. */
  supabase: ReturnType<typeof createAdminClient>;
  /** 함수 태그(`tag`)가 자동으로 붙는 logger. */
  log: {
    info: (msg: string, meta?: Record<string, unknown>) => void;
    error: (msg: string, meta?: Record<string, unknown>) => void;
  };
}

export interface RunActionOptions {
  /** 필요한 인증 수준. */
  auth: AuthLevel;
  /** 성공(`ok`) 시 revalidate 할 경로 목록. */
  revalidate?: string[];
  /** logger 태그 (예: "createClass"). 미지정 시 "action". */
  tag?: string;
}

function resolveAuth(level: AuthLevel) {
  if (level === "admin") return verifyAdmin();
  if (level === "teacherOrAdmin") return verifyTeacherOrAdmin();
  return verifyAuthenticated();
}

/**
 * Server Action 공통 실행기.
 *
 * 인증 → admin 클라이언트 준비 → try/catch → 성공 시 revalidate 를 한 곳에 모은다.
 * 액션 파일마다 반복되던 4줄 prologue(인증·에러체크·클라이언트 생성)와 누락되기 쉬운
 * try/catch·revalidate 를 표준화하고, 반환 타입을 {@link ActionResult} 로 통일한다.
 *
 * ⚠️ **"use server" 파일의 액션 본문에서 호출**할 것. HOF 로 export 를 감싸지 말 것
 * (Next.js 가 래핑된 함수를 액션 엔드포인트로 인식하지 못한다).
 *
 * 기존 188개 액션을 한 번에 바꾸지 않는다 — 신규 작성 액션부터 점진 적용한다.
 *
 * @example
 * // src/app/(admin)/admin/actions/class-actions.ts
 * "use server";
 * import { runAction } from "./run-action";
 * import { ok, fail, type ActionResult } from "@/lib/types/server-action";
 *
 * export async function createClass(name: string): Promise<ActionResult<{ id: string }>> {
 *   return runAction(
 *     { auth: "admin", tag: "createClass", revalidate: ["/admin/classes"] },
 *     async ({ supabase, userId, log }) => {
 *       const trimmed = name.trim();
 *       if (!trimmed) return fail("반 이름을 입력해 주세요.");
 *       const { data, error } = await supabase
 *         .from("classes")
 *         .insert({ name: trimmed, created_by: userId })
 *         .select("id")
 *         .single();
 *       if (error) {
 *         log.error(error.message);
 *         return fail("반 생성에 실패했습니다.");
 *       }
 *       return ok({ id: data.id });
 *     },
 *   );
 * }
 *
 * // 호출부
 * const result = await createClass(name);
 * if (!result.ok) { toastError(result.error); return; }
 * router.push(`/admin/classes/${result.data.id}`);
 */
export async function runAction<T>(
  options: RunActionOptions,
  handler: (ctx: ActionContext) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const tag = `[${options.tag ?? "action"}]`;
  const auth = await resolveAuth(options.auth);
  if ("error" in auth) return fail(auth.error);

  // role 없는 멤버와의 유니온 탓에 `auth.role` 직접 접근은 unknown 으로 넓어지므로,
  // 값을 리터럴로 매핑해 타입을 확정한다.
  const role: ActionContext["role"] =
    "role" in auth ? (auth.role === "admin" ? "admin" : "teacher") : undefined;

  const ctx: ActionContext = {
    userId: auth.userId,
    role,
    supabase: createAdminClient(),
    log: {
      info: (msg, meta) => logger.info(tag, msg, meta),
      error: (msg, meta) => logger.error(tag, msg, meta),
    },
  };

  try {
    const result = await handler(ctx);
    if (result.ok && options.revalidate) {
      for (const path of options.revalidate) revalidatePath(path);
    }
    return result;
  } catch (err) {
    logger.error(tag, "예기치 못한 오류", {
      error: err instanceof Error ? err.message : String(err),
    });
    return fail("처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
  }
}
