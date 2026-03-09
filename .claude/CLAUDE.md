# SC Wonderland

원더랜드 영어학원 웹사이트. 학원 소개(공개), 관리자 대시보드, 학생/교사 포털의 3개 섹션으로 구성.

**기술 스택:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Supabase (Auth + PostgreSQL + Storage)

**대상 사용자:** 학부모/일반 방문자(공개 사이트), 관리자(학생·교사·반·시간표·교재·공지·숙제·출결·승하차 관리), 학생(리포트카드·교재·공지·숙제·승하차), 교사(한국인: 반 관리·공지·교재·출결·숙제·승하차 / 원어민: 리포트카드·교재·출결·숙제, 영어 UI)

## Development Commands

```bash
npm run dev      # 개발 서버 (http://localhost:3000)
npm run build    # 프로덕션 빌드
npm start        # 프로덕션 서버
npm run lint     # ESLint 실행
```

## Key Principles

- 한국어 사용자 대상 (UI 텍스트, 에러 메시지 모두 한국어). 단, 원어민 교사 포털은 영어 UI (`lib/teacher-labels.ts`)
- Server Actions는 `app/(admin)/admin/actions/`에 도메인별 분할 (15개 파일, ~101개 함수), barrel re-export via `actions.ts`
- 모든 Server Action은 `{ error?: string }` 반환, 인증 필요 시 `createClient()` → `getUser()` 검증 후 `createAdminClient()` 사용
- 공유 타입은 `lib/types/`에 정의 (`"use server"` 파일에서 `export type` 불가)
- Supabase 클라이언트 3종: Browser(`lib/supabase/client.ts`), Server(`server.ts`), Admin(`admin.ts`)
- `proxy.ts` (Next.js 16): 모든 요청에서 Supabase 세션 갱신 (토큰 자동 리프레시)
- 교재 삭제는 soft delete, 사용자(학생/교사) 삭제는 soft delete (profiles.deleted_at + Auth ban)
- `router.refresh()`로 Server Component 데이터 갱신 (mutation 후)
- Tailwind 색상 팔레트: 12색 `{ bg, text }` 배열로 정의, **반드시 완전한 클래스명 리터럴** 사용 (동적 문자열 concat 금지 — purge 대응)
  - `TEACHER_COLOR_PALETTE` (GroupTimetableGrid, `-200` 계열), `CLASS_COLOR_PALETTE` (TeacherTimetableTab·TeacherAcademyTimetable, `-100` 계열)
- `GroupTimetableData` 타입은 `schedule-actions.ts` ("use server")에서 직접 import — 크로스 라우트 그룹 경로 예: `../../../../(admin)/admin/actions/schedule-actions`

## 구현 완료 시스템 요약

### 관리자 대시보드 (9개 섹션, 모두 완전 구현)
- **대시보드** (`/admin`) — 통계 5종 + 네비 카드
- **학생 관리** (`/admin/students`) — CRUD, 검색, 7개 탭(정보/학습/리포트/교재/시간표/출결/승하차), 휴지통
- **교사 관리** (`/admin/teachers`) — CRUD, 검색, 3개 탭(정보/반목록/시간표), 삭제 경고 모달, 휴지통
- **반 관리** (`/admin/classes`) — CRUD, 교사 2명 배정, 학생 등록/제거, 교재 배정
- **교재 관리** (`/admin/textbooks`) — CRUD, 커버 이미지(Storage), 반/학생 배정, 진도 관리, 일괄 업데이트
- **공지사항** (`/admin/notices`) — CRUD, 이미지/파일 다중 첨부(Storage), 고정/게시 관리
- **Academy 공지** (`/admin/academy-notices`) — 포털 내부 공지 관리
- **시간표** (`/admin/timetable`) — 그룹별 그리드(유치부/오후반/방과후), 교시 CRUD, 학생 개인 시간표
- **승하차** (`/admin/bus`) — 호차 관리, 대시보드, 변경요청 승인

### 학생 포털 (6개 탭)
- 내 정보 · 리포트카드 · 교재 · 공지(반별+Academy 통합) · 숙제(AudioRecorder 녹음 제출) · 승하차(변경 요청)

### 교사 포털
- **한국인 교사 (8탭):** 담당 반 · 시간표 · 공지사항 · 반 관리(읽기 전용) · 교재 · 출결 · 숙제 · 승하차
- **원어민 교사 (6탭, 영어 UI):** My Classes · Timetable · Report Cards · Textbooks · Attendance · Homework

### 시간표 시스템 (admin/timetable)
- `GroupTimetableGrid` — 그룹별 시간표 편집, **툴바+체크박스+지연저장 패턴**
- `TEACHER_COLOR_PALETTE` 12색 → `buildTeacherColorMap(sortedTeachers)` 교사별 고유색
- `TeacherTimetableTab` — 관리자 교사 시간표 읽기 전용 (CLASS_COLOR_PALETTE 12색)
- `TeacherAcademyTimetable` — 교사 포털 시간표 (모바일 친화적)

### 소프트 삭제 + 휴지통 시스템
- `profiles.deleted_at` + Auth ban 기반 soft delete / 복구 / 영구삭제
- `TrashView` 공유 컴포넌트 (`?section=trash`), 삭제 전 `class_teachers`·`class_schedules` 정리

### 원어민 교사 영어 UI
- `teacher-labels.ts`: 9개 라벨 세트 (dashboard/report/textbook/batchUpdate/notice/homework/attendance/timetable/bus)
- **감지 패턴:** `academy/layout.tsx`에서 `teachers.teacher_type` 조회 → 학생은 null 반환되어 한국어 유지
- `LogoutButton`: `labels` prop으로 영어 지원

### 관리자 UI 정보 표시 정책
- 교번·학번·이메일 숨김, 아이디(`email.split("@")[0]`)만 표시

### DB 초기 데이터 현황
- **유치부 반 (6개):** Tweety, Snoopy, Neptune, Jupiter, Beethoven, Einstein
- **오후반 (19개):** 3A, 3B, 베토벤, 아인슈타인 등
- **Native 교사 (10명):** Stacey, Joy, Joyce, Julie, Shanon, Vicky, Lauren, Zanele, Elin, William
  - 이메일: `{소문자이름}@scwonderland.com`, 초기 비밀번호: Wonder0225!
