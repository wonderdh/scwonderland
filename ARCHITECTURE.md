# SC Wonderland Architecture

## Stack
- Next.js 16 App Router, React 19, TypeScript, Tailwind v4
- Supabase (PostgreSQL + Auth + Storage)

## Top-Level Layout
- `src/` — 애플리케이션 코드
- `supabase/` — 마이그레이션, RLS, config
- `public/` — 정적 자산
- `docs/` — 패턴 가이드 (캐시, SSR, 관찰성 등)

## src/ Layout
- `src/app/(site)/` — 공개 마케팅 사이트
- `src/app/(academy)/` — 학생/교사 포털 (`/academy/...`)
- `src/app/(admin)/` — 관리자 대시보드 + 모바일 (`/admin`, `/m`)
- `src/app/(bus)/` — 버스 기사용 화면
- `src/app/(monitor)/` — 버스/급식 모니터링 디스플레이
- `src/components/` — 공용 UI 컴포넌트
- `src/lib/` — 공용 유틸 (`navigation/`, supabase 클라이언트, 헬퍼)

## Server Actions
- `src/app/(admin)/admin/actions/`
- `src/app/(academy)/academy/{teacher,student}/.../actions/`
- mutation 은 `verifyAdmin` / `verifyTeacherOrAdmin` / `verifyAuthenticated` 중 하나 호출 필수.

## Supabase
- `supabase/migrations/` — SQL 마이그레이션 (커밋 대상)
- `supabase/config.toml` — 로컬 CLI 설정
- 타입 생성: `npm run db:types` / `npm run db:types:local`

## Folder-Level Docs (점진 추가)
주요 작업 폴더에는 `AGENTS.md` 를 둔다. 작업 전 해당 폴더 + 상위 폴더의 AGENTS.md 를 모두 읽는다.

| 폴더 | AGENTS.md | 상태 |
|---|---|---|
| `src/app/(admin)/admin/actions/` | (예정) | 미작성 |
| `src/lib/` | (예정) | 미작성 |
| `supabase/migrations/` | (예정) | 미작성 |

## 환경
- 환경변수는 `.env*` 파일. `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 등은 커밋 금지.
