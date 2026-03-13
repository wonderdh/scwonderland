# 학생 포털 (Academy Student)

## 라우트 경로
- URL: /academy/student, /academy/student/*
- 라우트 그룹: (academy)

## 핵심 파일
- layout.tsx: `app/(academy)/academy/student/layout.tsx`
- loading.tsx: `app/(academy)/academy/student/loading.tsx`
- page.tsx (대시보드): `app/(academy)/academy/student/page.tsx`

## 컴포넌트
| 파일 | 역할 |
|------|------|
| `app/(academy)/academy/student/components/StudentNav.tsx` | 학생 포털 네비게이션 바 (7개 탭: 내 정보, 리포트카드, 교재, 공지, 숙제, 시간표, 승하차) |
| `app/(academy)/academy/student/components/ReportCardReplyForm.tsx` | 리포트카드 답글 작성/수정 폼 |
| `app/(academy)/academy/student/bus/StudentBusClient.tsx` | 승하차 스케줄 조회 및 변경 요청 |
| `app/(academy)/academy/student/homework/StudentHomeworkClient.tsx` | 숙제 목록/상세/제출 (음성 녹음 + 텍스트) |
| `app/(academy)/academy/student/notices/StudentNoticesClient.tsx` | 공지사항 조회 (반 공지 + 학원 공지 통합) |
| `app/(academy)/academy/student/textbooks/StudentTextbooksClient.tsx` | 교재 진도 현황 조회 (읽기 전용) |
| `app/(academy)/academy/student/timetable/StudentTimetableClient.tsx` | 개인 시간표 조회 및 출력, 방과후 등록 현황 |
| `app/(admin)/admin/students/components/ReportCardReadView.tsx` | 리포트카드 읽기 전용 뷰 (공유 컴포넌트) |
| `components/AudioRecorder.tsx` | 음성 녹음 컴포넌트 (숙제 제출용) |
| `components/FileList.tsx` | 첨부파일 목록 표시 |
| `components/LoadingState.tsx` | 로딩 상태 표시 |

## Server Actions

### academy/actions.ts (학생용)
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `getCurrentStudentProfile` | () | profiles, students |
| `getCurrentStudentClasses` | () | profiles, class_students, classes, class_teachers, teachers |
| `getCurrentStudentTextbooks` | () | profiles, student_textbook_progress, textbooks, classes |

### admin/actions (barrel export)
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `getReportCard` | (studentProfileId, year, month) | report_cards |
| `listReportCardsByStudent` | (studentProfileId) | report_cards |
| `updateReportCardReply` | (reportCardId, reply) | report_cards |
| `getStudentHomework` | (studentProfileId) | homework_assignments, homework_submissions, class_students |
| `submitHomework` | (submissionId, textContent?, audioFile?) | homework_submissions, homework_submission_files + Storage |
| `getSubmissionFiles` | (submissionId) | homework_submission_files + Storage signed URL |
| `getMyClassNotices` | (studentProfileId) | class_students, class_notices, class_notice_attachments |
| `getClassNoticeWithAttachments` | (noticeId) | class_notices, class_notice_attachments |
| `listAcademyNotices` | (includeDeleted) | academy_notices |
| `getAcademyNoticeWithAttachments` | (noticeId) | academy_notices, academy_notice_images, academy_notice_attachments |
| `getStudentBusDefaults` | (studentProfileId) | student_bus_defaults, bus_time_slots, bus_numbers, bus_stops |
| `getStudentChangeRequests` | (studentProfileId) | bus_change_requests, bus_time_slots, bus_numbers |
| `submitBusChangeRequest` | (studentProfileId, date, direction, changeType, slotId?, busId?, reason?) | bus_change_requests |
| `cancelBusChangeRequest` | (requestId, studentProfileId) | bus_change_requests |
| `listBusNumbers` | () | bus_numbers |
| `listBusTimeSlots` | () | bus_time_slots |
| `getStudentTimetable` | (studentProfileId) | academy_periods, schedule_cells, class_students, classes, teachers |
| `getStudentAfterschoolDays` | (studentProfileId) | afterschool_enrollments |

## 타입
- `StudentProfile` — 학생 기본 정보 (id, email, korean_name, english_name, student_number)
- `StudentClassItem` — 소속 반 정보 (class_name, teachers[])
- `StudentTextbookItem` — 교재 진도 정보
- `ReportCard`, `ReportCardListItem` — 리포트카드
- `HomeworkAssignment`, `HomeworkSubmission`, `HomeworkSubmissionFile` — 숙제 관련
- `ClassNotice`, `ClassNoticeAttachment`, `AcademyNotice`, `AcademyNoticeAttachment` — 공지 관련
- `StudentBusDefault`, `BusChangeRequest`, `BusNumber`, `BusTimeSlot` — 승하차 관련
- `StudentTimetableRow` — 시간표 행 데이터

## 데이터 흐름

### layout.tsx
1. `getUser()` → 미인증 시 `/academy/login` 리다이렉트
2. `profiles.role !== "student"` → `/academy/dashboard` 리다이렉트
3. `<StudentNav />` + `{children}` 렌더링 (max-w-3xl)

### /academy/student (내 정보)
1. `getCurrentStudentProfile()` + `getCurrentStudentClasses()` 병렬 호출
2. 프로필 카드 (이름, 영문명) + 소속 반 목록 (담당 교사 포함)

### /academy/student/reports (리포트카드)
1. `listReportCardsByStudent()` → 연/월 목록 표시
2. `searchParams.year`/`month` → `getReportCard()` → 선택한 리포트 표시
3. `<ReportCardReadView />` + `<ReportCardReplyForm />` (답글 작성)

### /academy/student/textbooks (교재)
1. `getCurrentStudentTextbooks()` → 서버에서 데이터 로드
2. `StudentTextbooksClient`: 진행 중/완료 교재 분리, 진도 바 표시, 커버 이미지

### /academy/student/notices (공지)
1. `getMyClassNotices()` + `listAcademyNotices()` 병렬 호출
2. 탭 필터 (전체/학원/반), 상세 보기 시 첨부파일 로드

### /academy/student/homework (숙제)
1. `getStudentHomework()` → 배정된 숙제 목록 + 제출 상태
2. 상세 → 제출 폼 (음성 녹음 `AudioRecorder` + 텍스트 메모)
3. 교사 피드백 표시 (reviewed 상태)

### /academy/student/timetable (시간표)
1. `getStudentTimetable()` + `getStudentAfterschoolDays()` 병렬 호출
2. 교사별 색상 매핑 (`TEACHER_COLOR_PALETTE`)
3. class 소스 셀만 필터링하여 표시
4. 출력 기능 (새 창에서 print)
5. 방과후 등록 현황 (요일별)

### /academy/student/bus (승하차)
1. `getStudentBusDefaults()` → 주간 스케줄 (요일별 등/하원)
2. 오늘 날짜의 변경 요청 반영하여 표시
3. 변경 요청 폼: 날짜, 방향, 유형(변경/미탑승), 시간대, 호차, 사유
4. `submitBusChangeRequest()` / `cancelBusChangeRequest()` 호출

## 의존성
- `app/(academy)/academy/actions.ts` — 학생/교사 포털 공유 Server Actions
- `app/(admin)/admin/actions.ts` — barrel export (모든 admin action)
- `app/(admin)/admin/actions/schedule-actions.ts` — `getStudentTimetable` 직접 import
- `app/(admin)/admin/actions/afterschool-actions.ts` — `getStudentAfterschoolDays` 직접 import
- `lib/teacher-labels.ts` — (리포트카드 읽기 뷰에서 간접 사용)

## 주의사항
- 학생 포털은 읽기 전용이 대부분 (교재 진도 변경 불가, 공지 작성 불가)
- 숙제 제출은 음성 녹음(webm) + 텍스트 메모 가능, 파일 첨부는 없음
- 리포트카드 답글은 학생이 직접 작성/수정 가능 (`updateReportCardReply`)
- 승하차 변경 요청은 pending 상태에서만 취소 가능
- `StudentTimetableClient`는 `schedule-actions.ts`에서 직접 import (barrel export 미사용, 크로스 라우트 그룹)
- loading.tsx 제공: 루트, reports, textbooks (각각 다른 skeleton)
