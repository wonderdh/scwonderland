# SC Wonderland Architecture

Next.js 16 App Router + React 19 + TypeScript + Tailwind v4 + Supabase.

상세 규칙은 각 폴더의 `AGENTS.md` 에. 작업 전 대상 폴더 + 상위 폴더의 AGENTS.md 를 모두 읽는다.

## 폴더 트리

```
.
├── src/
│   ├── app/
│   │   ├── (site)/         — 공개 마케팅 사이트 (about / program / experience / community / notice)
│   │   ├── academy/        — 학생·교사 포털 (/academy/...). entry page.tsx 가 인증·역할 redirect, actions 는 academy/actions.ts 1개
│   │   ├── (admin)/        — 관리자 대시보드 (/admin) + 모바일 (/m)
│   │   │   └── admin/actions/ — 서버 액션 허브 (~20 파일 + bus/ 하위)  → AGENTS.md
│   │   ├── bus/            — 버스 기사용 화면 (/bus, 현재 비활성)
│   │   └── (monitor)/      — 버스/급식 모니터링 디스플레이 (TV)
│   │  
│   │   ※ 라우트 폴더 안 컴포넌트는 `_components/` (Next.js Private Folder) 컨벤션. 마케팅 사이트(`(site)`) 도 동일.
│   ├── components/         — 공용 UI (badges / forms / overlays / skeletons / ui …)
│   └── lib/
│       ├── supabase/       — admin / server / client 3 클라이언트  → AGENTS.md
│       ├── auth/           — 인증 헬퍼 (verifyAdmin 등)
│       ├── bus/            — 버스 상태/realtime 유틸
│       ├── constants/      — 도메인별 상수 (attendance / bus / class / timetable …)
│       ├── hooks/          — React 훅
│       ├── lunch/          — 급식 로테이션
│       ├── navigation/     — 메뉴/라우트 정의
│       ├── server/         — logger / translate
│       ├── types/          — DB / API / server-action 타입
│       ├── ui/             — UI 전용 유틸 (색상, 라벨, toast)
│       └── utils/          — 범용 유틸 (cn / date-kst / sort …)
├── supabase/               — 마이그레이션 + config + 타입 생성  → AGENTS.md
├── public/                 — 정적 자산
├── docs/                   — 패턴 가이드 (캐시·SSR·관찰성 …) + HARNESS.md
└── .claude/                — SessionStart 훅 + settings.json (HARNESS.md 참고)
```
