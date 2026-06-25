/**
 * 필수 환경변수 접근 헬퍼.
 *
 * 미설정 시 `process.env.X!`(non-null 단언)는 런타임에서 모호하게 실패하지만,
 * 이 헬퍼는 변수명을 담은 명확한 에러를 던진다.
 *
 * ⚠️ 호출부에서 반드시 `process.env.X` **리터럴**을 인자로 넘길 것.
 * Next.js 는 빌드타임에 `process.env.NEXT_PUBLIC_*` 리터럴 접근만 인라인 치환하므로,
 * 동적 키 접근(`process.env[name]`)을 쓰면 클라이언트 번들에서 값이 사라진다.
 *
 * @example
 * const url = requireEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
 */
export function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `환경변수 ${name} 가 설정되지 않았습니다. .env(.local) 파일을 확인하세요.`,
    );
  }
  return value;
}
