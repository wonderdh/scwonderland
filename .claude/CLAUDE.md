# SC Wonderland 프로젝트 가이드

Next.js 16 App Router + React 19 + TypeScript + Tailwind v4 + Supabase 기반 학원 관리 SaaS.

## 스택 핵심
- App Router는 route group(`(site)`, `(academy)`, `(admin)`, `(bus)`, `(monitor)`)으로 구분.
- Server Action은 `src/app/(admin)/admin/actions/`, `src/app/(academy)/academy/.../actions/` 등에 위치.
- 공용 유틸은 `src/lib/`, UI 컴포넌트는 `src/components/`.

## 작업 시 주의
- Server Action은 mutation 전에 `verifyAdmin` / `verifyTeacherOrAdmin` / `verifyAuthenticated` 중 하나로 인증 검증 필수. 못 넣을 사정이 있으면 `// @auth-skip: <이유>` 주석.
- Supabase 마이그레이션은 `supabase/migrations/` 에 추가하고 `npm run db:types` 로 타입 재생성.
- 환경변수는 `.env*` 사용. 민감값 커밋 금지.

## 자주 쓰는 명령
- `npm run dev` — 개발 서버
- `npm run build` — 프로덕션 빌드
- `npm run lint` / `npm run type-check`
- `npm run db:types` / `npm run db:types:local`

## 문서
- `docs/` 에 캐시, SSR, 관찰성 등 패턴 가이드.
