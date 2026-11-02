# SC Wonderland

Next.js 16 App Router + React 19 + TypeScript + Tailwind v4 + Supabase 기반 학원 관리 SaaS.

## 작업 규칙
- 코드 수정 전 `ARCHITECTURE.md` 에서 대상 폴더의 위치와 책임을 확인한다.
- 작업 대상 폴더(또는 상위 폴더)에 `AGENTS.md` 가 있으면 **모두** 읽고, 거기 적힌 규칙을 작업에 반영한다.
- Server Action 은 mutation 전에 `verifyAdmin` / `verifyTeacherOrAdmin` / `verifyAuthenticated` 중 하나로 인증 검증. 못 넣을 사정이 있으면 함수 본문 위에 `// @auth-skip: <이유>`.
- Supabase 마이그레이션은 `supabase/migrations/` 에 추가하고 `pnpm db:types` 로 타입 재생성. 정책·트리거·테이블·컬럼 삭제나 anon 권한 부여가 들어가면 파일 맨 위에 `-- reviewed-by: <이름> <날짜>` (CI `check:migration-danger` 가 검사).
- **DB FK 컨벤션**: 학생 컬럼은 `students(id)`, 교사 컬럼은 `teachers(id)` 참조. `profiles(id)` 는 admin·teacher 가 섞이는 actor 컬럼 (`assigned_by`, `recorded_by`, `marked_by` 등) 에만. 상세는 `supabase/AGENTS.md` "FK 컨벤션".
- **요청 범위 준수**: ① 질문/탐색 단계(가능?, 어떻게 돼있어? 등)엔 답만 하고 코드/DB 손 안 댐. ② 명령 단계(바꿔/해/없애 등)엔 DB + 그에 따라 깨지는 코드까지 한 번에 (tsc 통과). ③ **요청 안 한 리팩토·기능 삭제·"이왕 하는 김에" 식 정리 금지**. UI feature 를 stub 으로 만들거나 축소하는 건 사용자 동의 후에만.
- 환경변수는 `.env*` 파일 사용. 민감값 커밋 금지.

## 자주 쓰는 명령
- `pnpm dev` — 개발 서버
- `pnpm build` — 프로덕션 빌드
- `pnpm lint` / `pnpm type-check`
- `pnpm check:admin-imports` / `pnpm check:action-auth` / `pnpm check:migration-danger` — CI 와 같은 정적 검사 3종
- `pnpm db:types` / `pnpm db:types:local`

## 문서
- `ARCHITECTURE.md` — 프로젝트 구조 인덱스
- `docs/` — 캐시/SSR/관찰성 등 패턴 가이드
