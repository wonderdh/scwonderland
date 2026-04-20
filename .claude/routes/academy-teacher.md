# 교사 포털 (Academy Teacher)

## 라우트 경로
- URL: /academy/teacher, /academy/teacher/*
- 라우트 그룹: (academy)

## 핵심 파일
- layout.tsx: `src/app/(academy)/academy/teacher/layout.tsx`
- loading.tsx: `src/app/(academy)/academy/teacher/loading.tsx`
- page.tsx (대시보드): `src/app/(academy)/academy/teacher/page.tsx`

## 컴포넌트
| 파일 | 역할 |
|------|------|
| `teacher/components/TeacherNav.tsx` | 교사 포털 네비게이션 (한국인: 8탭, 원어민: 6탭) |
| `teacher/components/TeacherReportClient.tsx` | 리포트카드 작성/조회 (반별, 년/월 선택, 학생별 작성) |
| `teacher/components/TeacherTextbookClient.tsx` | 교재 관리 + 일괄 진도 업데이트 (배치 모달) |
| `teacher/attendance/components/TeacherAttendanceClient.tsx` | 출결 기록 (반별, 당일, 학생별 상태 선택) |
| `teacher/bus/components/TeacherBusClient.tsx` | 승하차 현황 조회 (날짜/방향별, 읽기 전용) |
| `teacher/homework/components/TeacherHomeworkClient.tsx` | 숙제 출제/수정/삭제, 제출 확인/피드백 |
| `teacher/notices/components/TeacherNoticesClient.tsx` | 반별 공지 CRUD (첨부파일 포함) |
| `teacher/timetable/TeacherAcademyTimetable.tsx` | 그룹별 시간표 (유치부/오후반/방과후), 본인 배정만 하이라이트 |

## 서브 페이지
| URL | page.tsx | 역할 | 접근 제한 |
|-----|---------|------|----------|
| `/academy/teacher` | `teacher/page.tsx` | 대시보드: 프로필 + 담당 반 + 학생 목록 | 모두 |
| `/academy/teacher/timetable` | `teacher/timetable/page.tsx` | 전체 시간표 (그룹 탭) | 모두 |
| `/academy/teacher/reports` | `teacher/reports/page.tsx` | 리포트카드 작성(원어민)/조회(한국인) | 모두 (역할별 UI 분기) |
| `/academy/teacher/textbooks` | `teacher/textbooks/page.tsx` | 교재 진도 관리 | 모두 |
| `/academy/teacher/attendance` | `teacher/attendance/page.tsx` | 출결 기록 | 모두 |
| `/academy/teacher/homework` | `teacher/homework/page.tsx` | 숙제 관리 | 모두 |
| `/academy/teacher/notices` | `teacher/notices/page.tsx` | 반별 공지 관리 | 한국인만 (원어민 → 리다이렉트) |
| `/academy/teacher/classes` | `teacher/classes/page.tsx` | 반 관리 (학생 목록 조회) | 한국인만 (원어민 → 리다이렉트) |
| `/academy/teacher/bus` | `teacher/bus/page.tsx` | 승하차 현황 조회 | 한국인만 (원어민 → 리다이렉트) |

## Server Actions

### academy/actions.ts (교사용)
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `getCurrentTeacherProfile` | () | profiles, teachers |
| `getTeacherClasses` | () | profiles, class_teachers, classes, class_students, students |
| `getClassReportStatus` | (classId, year, month) | class_students, students, report_cards |
| `getClassTextbooks` | (classId) | class_textbooks, textbooks |

### admin/actions (barrel export)
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `getReportCard` | (studentProfileId, year, month) | report_cards |
| `upsertReportCard` | (studentProfileId, year, month, content) | report_cards |
| `getClassTextbookProgress` | (classId, textbookId) | student_textbook_progress, class_students, students |
| `batchUpdateProgress` | (classId, textbookId, units, excludeIds) | student_textbook_progress |
| `getClassAttendanceByDate` | (classId, date) | attendance_records |
| `recordAttendance` | (studentId, classId, date, status, note?) | attendance_records |
| `listHomeworkAssignments` | (classId) | homework_assignments, homework_submissions |
| `createHomeworkAssignment` | (classId, teacherId, title, desc, dueDate) | homework_assignments, homework_submissions |
| `updateHomeworkAssignment` | (id, title, desc, dueDate) | homework_assignments |
| `deleteHomeworkAssignment` | (id) | homework_assignments, homework_submissions |
| `listSubmissions` | (assignmentId) | homework_submissions, homework_submission_files + Storage |
| `reviewSubmission` | (submissionId, feedback, teacherId) | homework_submissions |
| `listClassNotices` | (classId) | class_notices |
| `getClassNoticeWithAttachments` | (noticeId) | class_notices, class_notice_attachments |
| `createClassNotice` | (FormData) | class_notices, class_notice_attachments + Storage |
| `updateClassNotice` | (FormData) | class_notices, class_notice_attachments + Storage |
| `deleteClassNotice` | (noticeId) | class_notices, class_notice_attachments + Storage |
| `getDailyBusManifest` | (date) | bus_time_slots, student_bus_defaults, bus_change_requests, bus_check_records 등 |
| `getGroupTimetableGrid` | (groupName) | academy_period_groups, academy_periods, classes, schedule_cells, teachers |

## 타입
- `TeacherProfile` — id, email, name, teacher_number, teacher_type
- `TeacherClassWithStudents` — id, name, students[]
- `ReportCardStatus` — 학생별 리포트카드 작성 현황
- `ReportCard` — 리포트카드 (content, reply)
- `TeacherClassTextbook` — 반 교재 정보
- `ClassTextbookProgressRow` — 학생별 교재 진도
- `HomeworkAssignment`, `HomeworkSubmission` — 숙제
- `ClassNotice`, `ClassNoticeAttachment` — 반 공지
- `BusManifestGroup`, `NoRideEntry` — 승하차 매니페스트
- `GroupTimetableData` — 그룹 시간표 데이터 (schedule-actions.ts에서 직접 import)

## 데이터 흐름

### layout.tsx
1. `getUser()` → 미인증 시 `/academy/login` 리다이렉트
2. `profiles.role !== "teacher"` → `/academy/dashboard` 리다이렉트
3. `teachers` 테이블에서 `teacher_type` 조회 → `TeacherNav`에 전달
4. `<TeacherNav teacherType={...} />` + `{children}` (max-w-4xl)

### TeacherNav
- 한국인 교사 (`koreanLinks`): 담당 반, 시간표, 공지사항, 반 관리, 교재, 출결, 숙제, 승하차 (8탭)
- 원어민 교사 (`nativeLinks`): My Classes, Timetable, Report Cards, Textbooks, Attendance, Homework (6탭)
- 원어민은 공지사항, 반 관리, 승하차 탭 없음

### /academy/teacher (대시보드)
1. `getCurrentTeacherProfile()` + `getTeacherClasses()` 병렬 호출
2. 프로필 카드 + 담당 반 카드 (학생 목록, 바로가기)
3. `dashboardLabels[teacher_type]`으로 한/영 라벨 적용

### /academy/teacher/timetable
1. `getGroupTimetableGrid()` 3회 병렬 호출 (유치부, 오후반, 방과후)
2. `TeacherAcademyTimetable`: 그룹 탭 전환, 본인 교시만 색상 하이라이트
3. `CLASS_COLOR_PALETTE` 사용 (`-100` 계열)

### /academy/teacher/reports
1. `TeacherReportClient`: 반/년/월 선택 → 학생 목록 + 작성 현황
2. **원어민 교사 (native):** 편집 가능, `upsertReportCard()` 저장 (DeepL 번역 자동 생성)
   - 신규 작성(`!report?.id`) 시 **"이전 달 내용 불러오기"** 버튼 노출 → `handleCopyPrev()`가 `getReportCard(student, prevYear, prevMonth)` 호출 후 textarea에 로드 (저장 전 상태)
3. **한국인 교사 (korean):** 읽기 전용 뷰. 한국어 번역본 우선 표시, 영어 원문은 `<details>`로 접힘
4. 학생 답글 표시 (영어 번역본 우선, 원문 접힘)

### /academy/teacher/textbooks
1. `getTeacherClasses()` + `getClassTextbooks()` 호출
2. `TeacherTextbookClient`: 반 교재 목록 → 배치 업데이트 모달
3. `batchUpdateProgress()`: 선택한 학생들의 진도를 일괄 변경

### /academy/teacher/attendance
1. `TeacherAttendanceClient`: 반/오늘 출결 기록
2. 학생별 present/absent/late/excused 선택 → `recordAttendance()` 호출
3. "전원 출석" 일괄 저장 기능

### /academy/teacher/homework
1. `TeacherHomeworkClient`: CRUD + 제출 확인/피드백
2. 뷰: list → form (생성/수정) / submissions (제출 확인)
3. 오디오 파일 재생, 피드백 입력 및 `reviewSubmission()` 호출

### /academy/teacher/notices (한국인 전용)
1. `TeacherNoticesClient`: 반별 공지 CRUD
2. 이미지/첨부파일 업로드 (`FileUpload`, `FileList`)
3. FormData로 서버 전달, Storage에 파일 저장

### /academy/teacher/classes (한국인 전용)
1. `getTeacherClasses()` → 담당 반 + 학생 목록 표시 (읽기 전용)

### /academy/teacher/bus (한국인 전용)
1. `TeacherBusClient`: 날짜/방향 선택 → `getDailyBusManifest()` 호출
2. 호차별 학생 목록, 변경 표시 (is_changed), 미탑승 학생

## 의존성
- `src/app/(academy)/academy/actions.ts` — 교사 포털 Server Actions
- `src/app/(admin)/admin/actions.ts` — barrel export
- `src/app/(admin)/admin/actions/schedule-actions.ts` — `getGroupTimetableGrid`, `GroupTimetableData` 직접 import
- `src/lib/ui/teacher-labels.ts` — 9개 라벨 세트 (dashboard, report, textbook, attendance, homework, notice, bus, batchUpdate + ENGLISH_MONTHS)

## 주의사항
- **원어민 교사 영어 UI**: `src/lib/ui/teacher-labels.ts`에 정의된 라벨 세트 사용. 각 Client 컴포넌트가 `teacherType` prop으로 라벨 결정
- **접근 제한**: notices/classes/bus(한국인만) — 각 page.tsx에서 `redirect()` 처리. reports는 역할 무관 접근하지만 UI는 `isReadOnly` prop으로 분기 (한국인은 읽기 전용)
- `TeacherAcademyTimetable`은 `GroupTimetableData` 타입을 `schedule-actions.ts`에서 직접 import (크로스 라우트 그룹 경로 사용)
- loading.tsx 제공: 루트, reports, textbooks, timetable (timetable은 `SkeletonTable` 사용)
- 공지사항의 `createClassNotice`/`updateClassNotice`는 FormData로 전달 (파일 업로드)
