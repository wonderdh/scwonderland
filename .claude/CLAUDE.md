# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SC Wonderland — 원더랜드 영어학원 웹사이트. 5개 Route Group으로 구성:
1. **(site)** — 학원 소개 공개 사이트
2. **(admin)** — 관리자 대시보드 (`/admin`)
3. **(academy)** — 학생·교사 포털 (`/academy`)
4. **(bus)** — 승하차 기사용 인터페이스 (`/bus`)
5. **(monitor)** — 버스 모니터링 화면 (`/bus-monitor`)

**기술 스택:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Supabase (Auth + PostgreSQL + Storage) · shadcn/ui (Radix UI + CVA + tailwind-merge) · react-day-picker v9 + date-fns v4 (캘린더)

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
- `rules/architecture.md` — 라우트맵, 레이아웃 (`src/app/**/*` 작업 시)
- `rules/components.md` — 컴포넌트 목록 (`*.tsx` 작업 시)
- `rules/database.md` — DB 스키마, Storage (`src/lib/types/`, `src/lib/supabase/`, `actions/` 작업 시)
- `rules/patterns.md` — 인증·폼·타입·safe redirect·HTML escape·KST 날짜 패턴 (`src/app/`, `src/lib/` 작업 시)
- `rules/server-actions.md` — Server Action 함수 목록 + 인증 헬퍼 3종 (`actions/` 작업 시)
- `rules/styling.md` — CSS, 색상 팔레트 (`*.css`, `(site)/` 작업 시)

### 라우트별 문서 (`routes/`)
특정 페이지 작업 시 `routes/_index.md`에서 해당 라우트 MD 파일을 찾아 참조. 각 MD에는 핵심 파일, 컴포넌트, Server Actions, 타입, 데이터 흐름, 주의사항이 정리되어 있음.

### 추가 참고사항
- Tailwind 색상 팔레트: `TEACHER_COLOR_PALETTE` (`-200` 계열), `CLASS_COLOR_PALETTE` (`-100` 계열)
- `GroupTimetableData`, `CellEntry` 타입: `@/lib/types`에서 import
- 소프트 삭제: `TrashView` 공유 컴포넌트 (`?section=trash`), 삭제 전 관련 데이터 정리
- 원어민 교사 영어 UI: `teacher-labels.ts` 9개 라벨 세트, `academy/layout.tsx`에서 감지
- DB 초기 데이터: 유치부 6반, 오후반 19개, Native 교사 10명 (`{이름}@scwonderland.com`, Wonder0225!)
- 공유 UI 컴포넌트 (`src/components/` 8개 서브폴더): `ui/` (shadcn/ui) · `forms/` (AudioRecorder, FileUpload, FileList, FormGroup, MultiDatePicker) · `feedback/` (LoadingState, Spinner, NavigationProgress) · `overlays/` (ConfirmDialog) · `navigation/` (Breadcrumb, PageHeader, QueryTabNav, LogoutButton) · `badges/` (StatusBadge, TeacherBadges) · `bus/` · `skeletons/`

### 공통 유틸 (반드시 사용)
- **정렬:** 학생 명단 정렬은 `src/lib/utils/student-sort.ts#sortStudentsByAgeAndName()` 단일 소스
- **날짜/시간:** `src/lib/utils/date-kst.ts`의 `todayKst()`, `formatDateKst()`, `formatDateTimeKst()`, `nowKstParts()`. `new Date().toLocaleDateString(...)` 분산 사용 금지
- **HTML escape:** `src/lib/utils/escape-html.ts#escapeHtml()` — 프린트용 새 창 등 React 밖 HTML 생성 시 XSS 방지 필수
- **로거:** `src/lib/server/logger.ts#logger` — 서버 `console.log/error` 직접 사용 금지, PII 로깅 금지
- **인증:** `src/app/(admin)/admin/actions/auth-helpers.ts` — `verifyAdmin()` / `verifyAuthenticated()` / `verifyTeacherOrAdmin()` 중 상황에 맞게 선택
- **다중 날짜:** `src/components/forms/MultiDatePicker.tsx` — 출결/버스/예약 등 날짜 선택이 필요한 곳에서 공유. 1개=당일, 여러 개=일괄. 토·일 비활성. 범위 자동 채움
- **출결 상태:** `src/lib/constants/attendance.ts` — `ATTENDANCE_STATUSES`, `ATTENDANCE_STATUS_CONFIG`, `getStatusLabel()`, `shouldShowNote()`. 출결 UI에서 로컬 STATUS_CONFIG 정의 금지, 이 상수를 import할 것
- **시간표 색상:** `src/lib/constants/timetable.ts` — `TEACHER_COLOR_PALETTE`(12색), `buildTeacherColorMap()`. 시간표 컴포넌트에서 로컬 복붙 금지
- **요일 이름:** `src/lib/constants/date.ts` — `WEEKDAY_NAMES_5`(월~금), `WEEKDAY_NAMES_7`(일~토). `["월","화","수","목","금"]` 하드코딩 금지
- **학생 이름:** `src/lib/utils/student-name.ts` — `formatStudentName(student, { preferEnglish? })`. `korean_name ?? english_name ?? "이름 없음"` 인라인 패턴 금지
