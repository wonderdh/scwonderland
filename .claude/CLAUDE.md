# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SC Wonderland — 원더랜드 영어학원 웹사이트. 5개 Route Group으로 구성:
1. **(site)** — 학원 소개 공개 사이트
2. **(admin)** — 관리자 대시보드 (`/admin`)
3. **(academy)** — 학생·교사 포털 (`/academy`)
4. **(bus)** — 승하차 기사용 인터페이스 (`/bus`)
5. **(monitor)** — 버스 모니터링 화면 (`/bus-monitor`)

**기술 스택:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Supabase (Auth + PostgreSQL + Storage) · shadcn/ui (Radix UI + CVA + tailwind-merge)

**대상 사용자:** 학부모/일반 방문자(공개 사이트), 관리자(학생·교사·반·시간표·교재·공지·숙제·출결·승하차 관리), 학생(리포트카드·교재·공지·숙제·승하차), 교사(한국인: 반 관리·공지·교재·출결·숙제·승하차·리포트카드(읽기전용) / 원어민: 리포트카드(작성)·교재·출결·숙제, 영어 UI)

## Development Commands

```bash
npm run dev      # 개발 서버 (http://localhost:3000)
npm run build    # 프로덕션 빌드
npm start        # 프로덕션 서버
npm run lint     # ESLint 실행
```

## Key Principles

핵심 원칙은 `rules/core.md`에 정의 (항상 로드). 도메인별 상세 규칙은 `paths` 프론트매터로 조건부 로드:
- `rules/architecture.md` — 라우트맵, 레이아웃 (`app/**/*` 작업 시)
- `rules/components.md` — 컴포넌트 목록 (`*.tsx` 작업 시)
- `rules/database.md` — DB 스키마, Storage (`lib/types/`, `lib/supabase/`, `actions/` 작업 시)
- `rules/patterns.md` — 인증, 폼, 타입 패턴 (`app/`, `lib/` 작업 시)
- `rules/server-actions.md` — 101개 함수 목록 (`actions/` 작업 시)
- `rules/styling.md` — CSS, 색상 팔레트 (`*.css`, `(site)/` 작업 시)

### 라우트별 문서 (`routes/`)
특정 페이지 작업 시 `routes/_index.md`에서 해당 라우트 MD 파일을 찾아 참조. 각 MD에는 핵심 파일, 컴포넌트, Server Actions, 타입, 데이터 흐름, 주의사항이 정리되어 있음.

### 추가 참고사항
- Tailwind 색상 팔레트: `TEACHER_COLOR_PALETTE` (`-200` 계열), `CLASS_COLOR_PALETTE` (`-100` 계열)
- `GroupTimetableData`, `CellEntry` 타입: `@/lib/types`에서 import
- 소프트 삭제: `TrashView` 공유 컴포넌트 (`?section=trash`), 삭제 전 관련 데이터 정리
- 원어민 교사 영어 UI: `teacher-labels.ts` 9개 라벨 세트, `academy/layout.tsx`에서 감지
- DB 초기 데이터: 유치부 6반, 오후반 19개, Native 교사 10명 (`{이름}@scwonderland.com`, Wonder0225!)
- 공유 UI 컴포넌트: `components/ui/` (shadcn/ui), `components/` (AudioRecorder, ConfirmDialog, FileUpload, QueryTabNav 등)
