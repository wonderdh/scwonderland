# SC Wonderland

Next.js 16 App Router + React 19 + TypeScript + Tailwind v4 + Supabase 기반 학원 관리 SaaS.

## 구조 메모 (코드만 보고는 알 수 없는 의도)
- `src/app/page.tsx` 는 `/dashboard` 로 redirect 만 한다. 추후 랜딩 페이지 교체 지점.
- `src/app/dashboard/` 는 로그인 게이트 + 역할 디스패처. 미인증 → `/login`, admin → `/admin`, teacher·student → `/academy/...`.
- `src/app/academy/` 는 학생·교사 포털. 엔트리 없는 네임스페이스이고 actions 는 `academy/actions.ts` 1개.
- `src/app/(admin)/` 은 관리자 `/admin` + 모바일 `/m`. 서버 액션 허브는 `(admin)/admin/actions/` (→ AGENTS.md). `verifyAdmin` 류는 그 안의 `auth-helpers.ts`.
- `src/app/bus/` 는 버스 기사용 화면. 현재 비활성. `src/app/(monitor)/` 는 버스·급식 TV 모니터.
- 라우트 폴더 안 컴포넌트는 `_components/` (Next.js Private Folder) 컨벤션.
- `archive/` 는 비활성 라우트 보관소 (`(site)/` 구 마케팅 사이트). tsconfig·eslint 제외 대상.
- 폴더별 규칙 문서(AGENTS.md): `(admin)/admin/actions/`, `app/academy/`, `lib/bus/`, `lib/supabase/`, `supabase/`.
- 호출 관계·구조 탐색은 CodeGraphContext MCP (`find_code`, `analyze_code_relationships`) 를 쓴다.

## 작업 규칙
- 작업 대상 폴더(또는 상위 폴더)에 `AGENTS.md` 가 있으면 **모두** 읽고, 거기 적힌 규칙을 작업에 반영한다.
- Server Action 은 mutation 전에 `verifyAdmin` / `verifyTeacherOrAdmin` / `verifyAuthenticated` 중 하나로 인증 검증. 못 넣을 사정이 있으면 함수 본문 위에 `// @auth-skip: <이유>`.
- Supabase 마이그레이션은 `supabase/migrations/` 에 추가하고 `pnpm db:types` 로 타입 재생성. 정책·트리거·테이블·컬럼 삭제나 anon 권한 부여가 들어가면 파일 맨 위에 `-- reviewed-by: <이름> <날짜>` (CI `check:migration-danger` 가 검사).
- **DB FK 컨벤션**: 학생 컬럼은 `students(id)`, 교사 컬럼은 `teachers(id)` 참조. `profiles(id)` 는 admin·teacher 가 섞이는 actor 컬럼 (`assigned_by`, `recorded_by`, `marked_by` 등) 에만. 상세는 `supabase/AGENTS.md` "FK 컨벤션".
- **요청 범위 준수**: ① 질문/탐색 단계(가능?, 어떻게 돼있어? 등)엔 답만 하고 코드/DB 손 안 댐. ② 명령 단계(바꿔/해/없애 등)엔 DB + 그에 따라 깨지는 코드까지 한 번에 (tsc 통과). ③ **요청 안 한 리팩토·기능 삭제·"이왕 하는 김에" 식 정리 금지**. UI feature 를 stub 으로 만들거나 축소하는 건 사용자 동의 후에만.
- **UI 중복 금지**: 같은 className 묶음이나 같은 JSX 구조가 한 파일에서 2번 이상 반복되면 그 파일 안에 작은 컴포넌트로 뽑는다 (예: `SectionTitle`). 3개 이상 파일에서 쓰이면 `src/components/` 로 올린다. 새 코드를 쓸 때 적용하고, 기존 코드는 요청 없이 건드리지 않는다.
- 환경변수는 `.env*` 파일 사용. 민감값 커밋 금지.

## 자주 쓰는 명령
- `pnpm dev` — 개발 서버
- `pnpm build` — 프로덕션 빌드
- `pnpm lint` / `pnpm type-check`
- `pnpm check:admin-imports` / `pnpm check:action-auth` / `pnpm check:migration-danger` — CI 와 같은 정적 검사 3종
- `pnpm db:types` / `pnpm db:types:local`

## 문서
- `docs/db-sync.md` — 운영 DB → 로컬 동기화 절차
- `docs/<날짜>/` — 리뷰·감사 보고서와 보류 항목 추적 (최신 폴더가 현행)
- DB 스키마는 `src/lib/types/database.generated.ts` 와 supabase MCP 가 진실. 별도 스키마 문서 없음.
