# SC Wonderland

원더랜드 영어학원 웹사이트. 학원 소개(공개), 관리자 대시보드, 학생/교사 포털의 3개 섹션으로 구성.

**기술 스택:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Supabase (Auth + PostgreSQL + Storage)

**대상 사용자:** 학부모/일반 방문자(공개 사이트), 관리자(학생·교사·반 관리), 학생(리포트카드·교재 조회), 교사(한국인: 반 관리·공지·교재 / 원어민: 리포트카드·교재, 영어 UI)

## Development Commands

```bash
npm run dev      # 개발 서버 (http://localhost:3000)
npm run build    # 프로덕션 빌드
npm start        # 프로덕션 서버
npm run lint     # ESLint 실행
```

## Key Principles

- 한국어 사용자 대상 (UI 텍스트, 에러 메시지 모두 한국어). 단, 원어민 교사 포털은 영어 UI (`lib/teacher-labels.ts`)
- Server Actions는 `app/(admin)/admin/actions/`에 도메인별 분할, barrel re-export via `actions.ts`
- 모든 Server Action은 `{ error?: string }` 반환
- 공유 타입은 `lib/types/`에 정의 (`"use server"` 파일에서 `export type` 불가)
- Supabase 클라이언트 3종: Browser(`lib/supabase/client.ts`), Server(`server.ts`), Admin(`admin.ts`)
- 교재 삭제는 soft delete, 사용자(학생/교사) 삭제는 soft delete (profiles.deleted_at + Auth ban)
- `router.refresh()`로 Server Component 데이터 갱신 (mutation 후)
- Tailwind 색상 팔레트: 12색 `{ bg, text }` 배열로 정의, **반드시 완전한 클래스명 리터럴** 사용 (동적 문자열 concat 금지 — purge 대응)
  - `TEACHER_COLOR_PALETTE` (GroupTimetableGrid, `-200` 계열), `CLASS_COLOR_PALETTE` (TeacherTimetableTab·TeacherAcademyTimetable, `-100` 계열)
- `GroupTimetableData` 타입은 `schedule-actions.ts` ("use server")에서 직접 import — 크로스 라우트 그룹 경로 예: `../../../../(admin)/admin/actions/schedule-actions`

## 최근 구현 완료 사항

### 시간표 시스템 (admin/timetable)
- `GroupTimetableGrid` — 그룹별(유치부/오후반/방과후) 시간표 편집 그리드
- **툴바+체크박스+지연저장 패턴:** 상단 툴바에서 교사·과목·교재 선택 → 셀 클릭으로 토글(UI 즉시 반영) → 저장 버튼 클릭 시 DB batch upsert
- 배정된 셀 클릭 → amber ring 표시(수정 예정), 빈 셀 클릭 → emerald 표시(추가 예정)
- `pendingChanges: Map<string, PendingCell>` — key: `${classId}|${periodId}|${day}` (pipe separator)
- 교사 드롭다운: 원어민/한국인 optgroup 분리, 소프트 삭제된 교사 제외
- `class_schedules`에 `textbook_id UUID FK → textbooks(id) ON DELETE SET NULL` 추가
- `schedule-actions.ts`의 `GroupTimetableData`: cells에 `textbookId`, 전체에 `textbooks[]` 포함
- 교시 관리: `timetable-actions.ts` (academy_periods CRUD)

### 관리자 시간표 교사 색상 (GroupTimetableGrid)
- `TEACHER_COLOR_PALETTE` 12색 → `buildTeacherColorMap(sortedTeachers)` — 이름순 정렬 후 팔레트 할당
- 셀이 교사별 고유색으로 표시, 상단 색상 범례(legend) 렌더링
- `PeriodDayGrid`에 `teacherColorMap` prop 추가

### 교사 시간표 탭 (admin/teachers → timetable 탭)
- `TeacherTimetableTab` — 읽기 전용 시간표, 월화수목금 컬럼, 반별 색상 (CLASS_COLOR_PALETTE 12색)
- 3개 그룹(유치부/오후반/방과후) 전환 탭
- `teachers/page.tsx`에서 timetable 탭 선택 시 3개 그룹 데이터 병렬 로드

### Academy 교사 포털 시간표 (/academy/teacher/timetable)
- `TeacherAcademyTimetable` client component — 월화수목금 컬럼, 반별 CLASS_COLOR_PALETTE 색상, 모바일 친화적(`overflow-x-auto`, `minWidth: 360px`)
- 서버 page: `getCurrentTeacherProfile()` + `getGroupTimetableGrid()` 3개 병렬 fetch
- 원어민 교사는 영어 탭/컬럼 레이블 (Kindergarten/Afternoon/After School, Mon/Tue/Wed/Thu/Fri)

### 원어민 교사 영어 UI 확장
- `LogoutButton`: `labels` prop 추가 (button/title/message/cancel/confirm/confirming)
- **감지 패턴:** `academy/layout.tsx`에서 `teachers.teacher_type` 조회 (admin client, `maybeSingle()`) → 학생은 null 반환되어 자동으로 한국어 유지
- `TeacherNav`: 시간표 탭 추가 (Korean: "시간표" / Native: "Timetable", sky→blue gradient)
- `teacher-labels.ts`: `timetableLabels` 추가 (Korean/English group names + day labels)

### 소프트 삭제 + 휴지통 시스템
- `profiles.deleted_at` + Auth ban 기반 soft delete / 복구 / 영구삭제
- `TrashView` 공유 컴포넌트 (`?section=trash`), 삭제 전 `class_teachers`·`class_schedules` 정리
- 교사 삭제 시 배정 건수 경고 모달, 학생은 단순 확인 모달

### 관리자 UI 정보 표시 정책
- 교번·학번·이메일 숨김, 아이디(`email.split("@")[0]`)만 표시 (InfoCard, ListSidebar, UserRow, 포털)

### DB 초기 데이터 현황
- **유치부 반 (6개):** Tweety, Snoopy, Neptune, Jupiter, Beethoven, Einstein (group_label='유치부')
- **오후반 (19개):** 3A, 3B, 베토벤, 아인슈타인, 2~3, [이름], 2A, 2B, 신규, 노벨, 하림, 추시준, 정수하, 6세(화목), 7세(화목), 임시반1~4
- **오후반 시간표 배정 (131건):** 19개 반 × 교사 배정 완료 (class_schedules, ON CONFLICT DO NOTHING으로 삽입됨)
- **Native 교사 (10명):** Stacey, Joy, Joyce, Julie, Shanon, Vicky, Lauren, Zanele, Elin, William
  - 이메일: `{소문자이름}@scwonderland.com`, 초기 비밀번호: Wonder0225!
