# Core Rules (항상 로드)

## 기술 스택
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Supabase (Auth + PostgreSQL + Storage)

## 핵심 원칙
- 한국어 UI/에러 메시지. 원어민 교사 포털만 영어 (`lib/teacher-labels.ts`)
- Server Actions: `app/(admin)/admin/actions/`에 도메인별 분할, barrel re-export via `actions.ts`
- 모든 Server Action은 `{ error?: string }` 반환
- 인증: `createClient()` → `getUser()` 검증 후 `createAdminClient()` 사용
- 인증 헬퍼: `verifyAdmin()` / `verifyAuthenticated()` (`actions/auth-helpers.ts`)
- 공유 타입은 `lib/types/`에 정의 (`"use server"` 파일에서 `export type` 불가)
- Supabase 클라이언트 3종: Browser(`lib/supabase/client.ts`), Server(`server.ts`), Admin(`admin.ts`)
- `proxy.ts`: 모든 요청에서 Supabase 세션 갱신 (Next.js 16)
- `router.refresh()`로 Server Component 데이터 갱신 (mutation 후)
- Tailwind 색상: **반드시 완전한 클래스명 리터럴** 사용 (동적 concat 금지)
- 교재 삭제는 soft delete, 사용자 삭제는 soft delete (profiles.deleted_at + Auth ban)
- 학생 나이별 색상: `getAgeColor(age)` from `lib/student-age-colors.ts` — 학생 이름 표시 시 필수
- 관리자 UI: 교번·학번·이메일 숨김, 아이디(`email.split("@")[0]`)만 표시
