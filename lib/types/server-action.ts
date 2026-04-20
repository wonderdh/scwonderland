/**
 * Server Action 반환 타입 표준.
 *
 * 기존 혼재 패턴(`{ error?: string }`, `{ error?: string; id?: string }`,
 * `{ data?: T; error?: string }`)을 대체해 discriminated union으로 통일.
 *
 * 신규 Server Action은 `ActionResult<T>`를 반환하고, 호출 사이트는 `result.ok`로 분기:
 *
 * ```ts
 * // 정의
 * export async function createClass(...): Promise<ActionResult<{ id: string }>> {
 *   ...
 *   if (error) return fail("반 생성 실패");
 *   return ok({ id: newId });
 * }
 *
 * // 호출
 * const result = await createClass(...);
 * if (!result.ok) { toastError(result.error); return; }
 * const newId = result.data.id;
 * ```
 *
 * 기존 188개 액션을 한 번에 교체하지 않고, 신규 작성 액션부터 점진 마이그레이션.
 */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });

export const fail = (error: string): ActionResult<never> => ({ ok: false, error });

/** `void` 반환 액션용 편의 alias. `return okVoid()` 패턴으로 사용. */
export const okVoid = (): ActionResult<void> => ({ ok: true, data: undefined });
