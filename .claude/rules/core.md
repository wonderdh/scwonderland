# Core Rules (항상 로드)

## 기술 스택
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Supabase (Auth + PostgreSQL + Storage)

## 핵심 원칙
- 한국어 UI/에러 메시지. 원어민 교사 포털만 영어 (`src/lib/ui/teacher-labels.ts`)
- Server Actions: `src/app/(admin)/admin/actions/`에 도메인별 분할, barrel re-export via `actions.ts`
- 모든 Server Action은 `{ error?: string }` 반환
- 인증 헬퍼 3종 (`src/app/(admin)/admin/actions/auth-helpers.ts`) — mutating 액션은 반드시 사용:
  - `verifyAdmin()` — admin 전용
  - `verifyAuthenticated()` — read-only 공유 액션만
  - `verifyTeacherOrAdmin()` — 교사·관리자 공용 write 액션 (숙제/출결/학습기록 등)
- 공유 타입은 `src/lib/types/`에 정의 (`"use server"` 파일에서 `export type` 불가)
- Supabase 클라이언트 3종: Browser(`src/lib/supabase/client.ts`), Server(`server.ts`), Admin(`admin.ts`)
- `src/proxy.ts`: 모든 요청에서 Supabase 세션 갱신 (Next.js 16). matcher는 이미지/폰트/CSS/JS 등 정적 리소스 제외
- `router.refresh()`로 Server Component 데이터 갱신 (mutation 후)
- Tailwind 색상: **반드시 완전한 클래스명 리터럴** 사용 (동적 concat 금지)
- 교재 삭제는 soft delete, 사용자 삭제는 soft delete (profiles.deleted_at + Auth ban)
- 학생 나이별 색상: `getAgeColor(age)` from `src/lib/ui/student-age-colors.ts` — 학생 이름 표시 시 필수
- **학생 명단 정렬: 나이순 → 이름순** — `sortStudentsByAgeAndName()` from `src/lib/utils/student-sort.ts` 단일 소스 (`rules/styling.md` 참조)
- 관리자 UI: 교번·학번·이메일 숨김, 아이디(`email.split("@")[0]`)만 표시
- **로깅:** 서버에서는 `console.log/error` 직접 사용 금지. `src/lib/server/logger.ts`의 `logger.info/warn/error(tag, msg, ctx?)` 사용. PII(이메일/전화번호)는 컨텍스트에 넣지 말 것 — `user_id`만
- **날짜/시간:** `new Date().toLocaleDateString(...)` 분산 사용 금지. KST 처리는 `src/lib/utils/date-kst.ts`의 `todayKst()`, `formatDateKst()`, `formatDateTimeKst()`, `nowKstParts()` 사용
- **HTML escape:** React 밖 HTML 문자열 생성(프린트용 새 창, `document.write`) 시 `src/lib/utils/escape-html.ts`의 `escapeHtml()` 필수. `innerHTML` 기반 프린트 금지
- **Redirect:** `?next=` 파라미터는 내부 경로만 허용 (`/`로 시작, `//`·`\\` 차단). LoginForm의 `safeRedirect()` 참고
- **대용량 라이브러리 동적 import:** `html-to-image`, `exceljs`, `xlsx` 등은 사용 시점에 `await import(...)`로 로드
- **lib 폴더 구조 (도메인별):**
  - `src/lib/constants/` — 도메인 상수 (attendance, bus, date, timetable, class, weekly-sentence)
  - `src/lib/utils/` — 범용 함수 (cn, date-kst, escape-html, student-sort, student-name, weekly-sentence-week, group-consecutive-reservations)
  - `src/lib/auth/` — 인증 관련 (auth-utils, korean-to-english)
  - `src/lib/ui/` — 클라이언트 UI 자산 (teacher-labels, student-age-colors, toast)
  - `src/lib/navigation/` — 라우팅·네비 구조 (admin-nav, menu-routes)
  - `src/lib/server/` — **서버 전용** (logger, translate). 경로로 경계 표시 — 클라이언트에서 import 금지
  - `src/lib/supabase/`, `src/lib/types/`, `src/lib/bus/`, `src/lib/hooks/` — 기존 도메인 폴더
- **재사용 원칙:** 같은 기능을 여러 파일에 복붙하지 말고 위 폴더에 단일 소스를 만들어 import. 주요 공유 자산:
  - 출결 상태 → `src/lib/constants/attendance.ts`
  - 시간표 색상 → `src/lib/constants/timetable.ts`
  - 요일 이름 → `src/lib/constants/date.ts`
  - 반 색상·그룹 → `src/lib/constants/class.ts`
  - 학생 이름 포맷 → `src/lib/utils/student-name.ts`
  - 학생 정렬 → `src/lib/utils/student-sort.ts`
  - 날짜/시간 KST → `src/lib/utils/date-kst.ts`
  - HTML escape → `src/lib/utils/escape-html.ts`
  - Tailwind cn → `src/lib/utils/cn.ts`
  - 교사 타입별 라벨 → `src/lib/ui/teacher-labels.ts`
  - 학생 나이 색상 → `src/lib/ui/student-age-colors.ts`
  - 토스트 → `src/lib/ui/toast.ts`
  - 이메일 정규화 → `src/lib/auth/auth-utils.ts`
- **문서 동기화 필수:** 구조 변경 시 관련 MD 파일 즉시 업데이트. 대상: 라우트 추가/삭제/변경, 컴포넌트 추가/삭제, Server Actions 추가/삭제, DB 스키마 변경, 네비게이션 구조 변경, 공유 유틸/타입 변경 등. 업데이트 대상 파일: `rules/` (architecture, components, database, server-actions 등), `routes/*.md`, `CLAUDE.md`
