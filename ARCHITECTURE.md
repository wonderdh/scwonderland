# SC Wonderland Architecture

Next.js 16 App Router + React 19 + TypeScript + Tailwind v4 + Supabase.

상세 규칙은 각 폴더의 `AGENTS.md` 에. 작업 전 대상 폴더 + 상위 폴더의 AGENTS.md 를 모두 읽는다.

## 폴더 트리

```
.
├── src/
│   ├── app/
│   │   ├── page.tsx        — 루트(/). /dashboard 로 redirect 만. (추후 랜딩 교체 지점)
│   │   ├── login/          — 로그인 화면 (/login). next / error 쿼리 처리, 폼은 _components/LoginForm.tsx
│   │   ├── dashboard/      — 로그인 게이트 + 역할 디스패처 (/dashboard). 미인증 → /login, admin → /admin, teacher·student → /academy/...
│   │   ├── academy/        — 학생·교사 포털 (/academy/...). 엔트리 없는 순수 네임스페이스, actions 는 academy/actions.ts 1개
│   │   ├── (admin)/        — 관리자 대시보드 (/admin) + 모바일 (/m)
│   │   │   └── admin/actions/ — 서버 액션 허브 (~20 파일 + bus/ 하위)  → AGENTS.md
│   │   ├── bus/            — 버스 기사용 화면 (/bus, 현재 비활성)
│   │   └── (monitor)/      — 버스/급식 모니터링 디스플레이 (TV)
│   │  
│   │   ※ 라우트 폴더 안 컴포넌트는 `_components/` (Next.js Private Folder) 컨벤션.
│   ├── components/         — 공용 UI (badges / forms / overlays / skeletons / ui …)
│   └── lib/
│       ├── supabase/       — admin / server / client 3 클라이언트  → AGENTS.md
│       ├── auth/           — 역할 조회(user-roles) · 이메일 정규화 · 한영 변환. (`verifyAdmin` 류는 `(admin)/admin/actions/auth-helpers.ts`)
│       ├── bus/            — 버스 상태/realtime 유틸
│       ├── constants/      — 도메인별 상수 (attendance / bus / class / timetable …)
│       ├── hooks/          — React 훅
│       ├── lunch/          — 급식 로테이션
│       ├── navigation/     — 메뉴/라우트 정의
│       ├── server/         — logger / translate
│       ├── types/          — DB / API / server-action 타입
│       ├── ui/             — UI 전용 유틸 (색상, 라벨, toast)
│       └── utils/          — 범용 유틸 (cn / date-kst / sort …)
├── archive/                — 비활성화된 라우트 보관소. `(site)/` 구 마케팅 사이트 전체 (tsconfig·eslint 제외 대상)
├── supabase/               — 마이그레이션 + config + 타입 생성  → AGENTS.md
├── public/                 — 정적 자산
└── docs/                   — data-model.md(스키마) · db-sync.md(운영→로컬 동기화) · page-flow.html(라우트 흐름) · 리뷰 기록(review/, 날짜 폴더)
```
