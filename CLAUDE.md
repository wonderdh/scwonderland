# SC Wonderland

Next.js 16 App Router + React 19 + TypeScript + Tailwind v4 + Supabase 기반 학원 관리 SaaS.

## 작업 규칙
- 코드 수정 전 `ARCHITECTURE.md` 에서 대상 폴더의 위치와 책임을 확인한다.
- 작업 대상 폴더(또는 상위 폴더)에 `AGENTS.md` 가 있으면 **모두** 읽고, 거기 적힌 규칙을 작업에 반영한다.
- Server Action 은 mutation 전에 `verifyAdmin` / `verifyTeacherOrAdmin` / `verifyAuthenticated` 중 하나로 인증 검증. 못 넣을 사정이 있으면 함수 본문 위에 `// @auth-skip: <이유>`.
- Supabase 마이그레이션은 `supabase/migrations/` 에 추가하고 `npm run db:types` 로 타입 재생성.
- 환경변수는 `.env*` 파일 사용. 민감값 커밋 금지.

## 자주 쓰는 명령
- `npm run dev` — 개발 서버
- `npm run build` — 프로덕션 빌드
- `npm run lint` / `npm run type-check`
- `npm run db:types` / `npm run db:types:local`

## 문서
- `ARCHITECTURE.md` — 프로젝트 구조 인덱스
- `docs/` — 캐시/SSR/관찰성 등 패턴 가이드
