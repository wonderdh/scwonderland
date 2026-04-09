# Server Actions 전체 인덱스

모든 Server Action은 `app/(admin)/admin/actions/`에 위치하며 `{ error?: string }` 패턴 반환.

## 인증 헬퍼 (`auth-helpers.ts`)

| 함수 | 권한 | 설명 |
|------|------|------|
| `verifyAdmin()` | - | 인증 + role=admin 검증. profiles 테이블 조회 |
| `verifyAuthenticated()` | - | 로그인 여부만 검증 (역할 무관). read-only 공유 액션에만 사용 |
| `verifyTeacherOrAdmin()` | - | 인증 + role ∈ { "teacher", "admin" } 검증. 숙제/출결/학습기록 mutating 액션에 사용 |

모든 mutating Server Action은 진입점에서 위 세 헬퍼 중 하나를 호출해야 하며, `verifyAuthenticated()`만 사용하는 mutating 액션은 권한 우회 취약점이므로 금지.

---

## 대시보드 (`dashboard-actions.ts`)

| 함수 | 권한 | 테이블 | 설명 |
|------|------|--------|------|
| `getDashboardStats()` | admin | `profiles`, `classes`, `report_cards`, `notices` | 5개 통계(학생수, 교사수, 반수, 리포트카드수, 공지수) 카운트 |

---

## 사용자 관리 (`user-actions.ts`)

| 함수 | 권한 | 테이블 | 설명 |
|------|------|--------|------|
| `createStudent(formData)` | admin | Auth API, `students` | 학생 생성 (email, password, korean_name, english_name, age) |
| `createTeacher(formData)` | admin | Auth API, `teachers` | 교사 생성 (email, password, name, teacher_type) |
| `listUsersByRole(role)` | admin | `profiles`, Auth API, `students`/`teachers` | 역할별 사용자 목록 (소프트삭제 제외) |
| `listDeletedUsers(role)` | admin | `profiles`, Auth API, `students`/`teachers` | 삭제된 사용자 목록 |
| `getTeacherAssignmentCounts(userId)` | admin | `class_teachers`, `class_schedules` | 교사의 반 담임 + 수업 배정 건수 |
| `deleteUserById(formData)` | admin | `class_teachers`, `class_schedules`, `profiles`, Auth API | 소프트 삭제 (deleted_at + Auth ban). 반 담임/수업 배정 먼저 삭제 |
| `restoreUser(userId)` | admin | `profiles`, Auth API | 복구 (deleted_at=null + Auth unban) |
| `permanentlyDeleteUser(userId)` | admin | Auth API | 영구 삭제 (Auth 유저 삭제, DB CASCADE) |
| `updateStudentProfile(formData)` | admin | `profiles`, `students` | 학생 프로필 수정 (korean_name, english_name, age) |
| `updateTeacherProfile(formData)` | admin | `profiles`, `teachers` | 교사 프로필 수정 (name, teacher_type) |
| `resetUserPassword(userId, newPassword)` | admin | Auth API | 비밀번호 초기화 (최소 6자) |
| `listAllStudents()` | admin | `profiles`, `students` | 전체 활성 학생 목록 (korean_name 정렬) |

---

## 반 관리 (`class-actions.ts`)

| 함수 | 권한 | 테이블 | 설명 |
|------|------|--------|------|
| `listClassesWithDetails()` | admin | `classes`, `class_teachers`, `teachers`, `class_students` | 전체 반 목록 (교사/학생수 포함) |
| `getClassWithStudents(classId)` | authenticated | `classes`, `class_teachers`, `teachers`, `class_students`, `students` | 반 상세 + 학생 목록 |
| `getStudentClasses(studentProfileId)` | authenticated | `class_students`, `classes`, `class_teachers`, `teachers` | 학생 소속 반 목록 |
| `getAllClassStudentsFlat()` | admin | `class_students`, `students` | 전체 반-학생 매핑 (flat 리스트) |
| `createClass(name, teacherProfileIds, groupLabel)` | admin | `classes`, `class_teachers`, `academy_periods`, `class_schedules` | 반 생성. 유치부는 자동 시간표 슬롯 생성 |
| `updateClass(classId, name, teacherProfileIds, groupLabel)` | admin | `classes`, `class_teachers`, `academy_periods`, `class_schedules` | 반 수정. 교사 재배정 (삭제+삽입). 유치부 빈 슬롯 자동 추가 |
| `deleteClass(classId)` | admin | `classes` | 반 삭제 |
| `addStudentToClass(classId, studentProfileId)` | admin | `class_students` | 반에 학생 추가 |
| `removeStudentFromClass(classStudentId)` | admin | `class_students` | 반에서 학생 제거 |
| `listTeachersForSelect()` | admin | `profiles`, `teachers` | 교사 선택 드롭다운용 (활성 교사만) |
| `listStudentsNotInClass(classId)` | admin | `class_students`, `students` | 반에 미소속 학생 목록 |

---

## 공지사항 - 사이트 공개 (`notice-actions.ts`)

| 함수 | 권한 | 테이블 | 설명 |
|------|------|--------|------|
| `listNotices(includeUnpublished)` | authenticated | `notices`, `notice_attachments` | 공지 목록 (이미지/첨부파일 개수 포함) |
| `getNoticeWithAttachments(noticeId)` | authenticated | `notices`, `notice_attachments` | 공지 상세 + 이미지/첨부파일 분리 |
| `createNotice(formData)` | admin | `notices`, `notice_attachments`, Storage(`notice-files`) | 공지 생성 + 파일 업로드 |
| `updateNotice(formData)` | admin | `notices`, `notice_attachments`, Storage(`notice-files`) | 공지 수정 + 파일 추가/제거 |
| `deleteNotice(noticeId)` | admin | `notices`, `notice_attachments`, Storage(`notice-files`) | 공지 삭제 + Storage 파일 정리 |

---

## 공지사항 - Academy (`academy-notice-actions.ts`)

| 함수 | 권한 | 테이블 | 설명 |
|------|------|--------|------|
| `listAcademyNotices(includeUnpublished)` | authenticated | `academy_notices`, `academy_notice_attachments` | Academy 공지 목록 |
| `getAcademyNoticeWithAttachments(noticeId)` | authenticated | `academy_notices`, `academy_notice_attachments` | Academy 공지 상세 |
| `createAcademyNotice(formData)` | admin | `academy_notices`, `academy_notice_attachments`, Storage(`academy-notices`) | Academy 공지 생성 |
| `updateAcademyNotice(formData)` | admin | `academy_notices`, `academy_notice_attachments`, Storage(`academy-notices`) | Academy 공지 수정 |
| `deleteAcademyNotice(noticeId)` | admin | `academy_notices`, `academy_notice_attachments`, Storage(`academy-notices`) | Academy 공지 삭제 |

---

## 공지사항 - 반별 (`class-notice-actions.ts`)

| 함수 | 권한 | 테이블 | 설명 |
|------|------|--------|------|
| `listClassNotices(classId)` | authenticated | `class_notices`, `teachers`, `class_notice_attachments` | 반별 공지 목록 (작성자 이름, 첨부 개수) |
| `getClassNoticeWithAttachments(noticeId)` | authenticated | `class_notices`, `teachers`, `class_notice_attachments` | 반별 공지 상세 |
| `createClassNotice(formData)` | 본인 확인 | `class_notices`, `class_notice_attachments`, Storage(`class-notices`) | 반별 공지 생성 (author_id=로그인 사용자) |
| `updateClassNotice(formData)` | 본인 확인 | `class_notices`, `class_notice_attachments`, Storage(`class-notices`) | 반별 공지 수정 |
| `deleteClassNotice(noticeId)` | 본인 확인 | `class_notices`, `class_notice_attachments`, Storage(`class-notices`) | 반별 공지 삭제 |
| `getMyClassNotices(studentProfileId)` | authenticated | `class_students`, `classes`, `class_notices`, `teachers` | 학생 소속 반 공지 목록 (최대 50건) |

---

## 교재 관리 (`textbook-actions.ts`)

| 함수 | 권한 | 테이블 | 설명 |
|------|------|--------|------|
| `listTextbooks()` | authenticated | `textbooks` | 활성 교재 목록 (is_active=true) |
| `getTextbook(textbookId)` | authenticated | `textbooks` | 교재 상세 |
| `createTextbook(formData)` | admin | `textbooks`, Storage(`textbook-covers`) | 교재 생성 + 커버 이미지 업로드 |
| `updateTextbook(formData)` | admin | `textbooks`, Storage(`textbook-covers`) | 교재 수정 + 커버 교체/삭제 |
| `deleteTextbook(textbookId)` | admin | `textbooks`, Storage(`textbook-covers`) | 교재 soft delete (is_active=false) + 커버 삭제 |
| `listClassTextbooks(classId)` | authenticated | `class_textbooks`, `textbooks` | 반별 교재 목록 |
| `assignTextbookToClass(classId, textbookId)` | admin | `class_textbooks`, `class_students`, `student_textbook_progress` | 반에 교재 배정 + 학생별 progress 자동 생성 |
| `removeTextbookFromClass(classId, textbookId)` | admin | `class_textbooks`, `student_textbook_progress` | 반 교재 해제 + 관련 progress 삭제 |
| `assignTextbookToStudent(studentProfileId, textbookId)` | admin | `student_textbook_progress` | 학생 개별 교재 배정 |
| `removeTextbookFromStudent(progressId)` | admin | `student_textbook_progress` | 학생 교재 해제 |
| `updateProgress(progressId, completedUnits, note, assignedAt, completedAt)` | authenticated | `student_textbook_progress`, `textbooks` | 진도 업데이트 (자동 상태 결정) |
| `listStudentProgress(studentProfileId)` | authenticated | `student_textbook_progress`, `textbooks`, `classes` | 학생 전체 교재 진도 |
| `getClassTextbookProgress(classId, textbookId)` | authenticated | `class_students`, `students`, `student_textbook_progress` | 반 전체 학생의 교재별 진도 현황 |
| `listTextbooksNotInClass(classId)` | admin | `class_textbooks`, `textbooks` | 반 미배정 교재 목록 |
| `batchUpdateProgress(classId, textbookId, completedUnits, excludeStudentIds)` | authenticated | `textbooks`, `student_textbook_progress` | 반 전체 진도 일괄 업데이트 |
| `listTextbooksNotAssignedToStudent(studentProfileId)` | - | `student_textbook_progress`, `textbooks` | 학생 미배정 교재 목록 |

### 교재 상수 (`textbook-constants.ts`)
- `TEXTBOOK_CATEGORIES`: 7개 카테고리 (general, phonics, reading, grammar, speaking, writing, vocabulary)

---

## 리포트카드 (`report-actions.ts`)

| 함수 | 권한 | 테이블 | 설명 |
|------|------|--------|------|
| `getReportCard(studentProfileId, year, month)` | RLS | `report_cards` | 특정 학생/년/월 리포트카드 조회 |
| `listReportCardsByStudent(studentProfileId)` | RLS | `report_cards` | 학생의 리포트카드 목록 (년월 내림차순) |
| `upsertReportCard(studentProfileId, year, month, content)` | admin/teacher | `profiles`, `report_cards` | 리포트카드 본문 작성/수정 (author_id=현재 사용자) |
| `updateReportCardReply(reportCardId, reply)` | 본인 확인 | `report_cards` | 학생 답글 작성 (본문 있을 때만) |

> report-actions는 `createClient()`(RLS 적용 서버 클라이언트) 사용. 다른 액션들과 달리 createAdminClient 미사용.

---

## 학습 관리 (`learning-actions.ts`)

| 함수 | 권한 | 테이블 | 설명 |
|------|------|--------|------|
| `listLearningRecords(studentProfileId)` | authenticated | `learning_records` | 학습 기록 목록 (최신순) |
| `createLearningRecord(studentProfileId, record)` | teacher/admin | `learning_records` | 학습 기록 생성 (category: test/assessment/note/level_change). 날짜 기본값은 `todayKst()` |
| `updateLearningRecord(recordId, updates)` | teacher/admin | `learning_records` | 학습 기록 수정 |
| `deleteLearningRecord(recordId)` | teacher/admin | `learning_records` | 학습 기록 삭제 |

---

## 출결 관리 (`attendance-actions.ts`)

| 함수 | 권한 | 테이블 | 설명 |
|------|------|--------|------|
| `listAttendanceRecords(studentProfileId, year?, month?)` | authenticated | `attendance` | 출결 기록 목록 (최신순, 월 필터 선택) |
| `recordAttendance(studentProfileId, attendanceDate, status, note?)` | teacher/admin | `attendance` | 출결 생성/수정 (upsert, conflict: student_profile_id+attendance_date) |
| `deleteAttendance(recordId)` | teacher/admin | `attendance` | 출결 기록 삭제 |
| `getStudentAttendanceByDate(studentProfileId, date)` | authenticated | `attendance` | 특정 학생·날짜 출결 조회 → `{ status, note }` |
| `getClassAttendanceByDate(classId, date)` | authenticated | `class_students`, `attendance` | 반 학생들의 특정 날짜 출결 목록 (교사용) |
| `getClassStudentsWithAttendance(classId, date)` | admin | `class_students`, `students`, `attendance` | 반 학생 목록 + 출결 통합 → `StudentWithAttendance[]` (나이순 정렬, 관리자 반별 출결용) |
| `bulkRecordAttendance(records[{student_profile_id, date, status, note?}])` | admin | `attendance` | 반 출결 일괄 upsert (관리자 반별 출결 저장, revalidate: /admin/attendance + /m/attendance) |
| `getAttendanceStats(studentProfileId, year, month)` | authenticated | `attendance` | 월별 출결 통계 (total, present, absent, late, excused) |

---

## 시간표 - 수업 배정 (`schedule-actions.ts`)

| 함수 | 권한 | 테이블 | 설명 |
|------|------|--------|------|
| `getGroupTimetableGrid(groupLabel)` | admin | `academy_periods`, `classes`, `class_schedules`, `teachers`, `profiles`, `textbooks` | 그룹별 시간표 그리드 데이터 (cells 맵 포함) |
| `addSingleClassSchedule(classId, periodId, day, teacherId, label, textbookId, studentProfileId)` | admin | `class_schedules`, `classes` | 수업 배정 추가/수정 (교사 충돌 검사 포함) |
| `listClassSchedules(classId)` | authenticated | `class_schedules`, `academy_periods`, `teachers` | 반별 수업 시간표 조회 |
| `addClassScheduleBatch(classId, periodId, days[], teacherId, label)` | admin | `class_schedules` | 여러 요일 일괄 수업 배정 |
| `deleteClassSchedule(scheduleId)` | admin | `class_schedules` | 수업 배정 삭제 |
| `getStudentTimetable(studentProfileId)` | authenticated | `class_students`, `classes`, `afterschool_enrollments`, `class_schedules`, `academy_periods`, `teachers` | 학생 시간표 (반+개인+방과후 통합) |
| `getStudentTimetableEditable(studentProfileId)` | authenticated | `academy_periods`, `class_schedules`, `teachers`, `profiles`, `textbooks` | 학생 개인 시간표 편집용 데이터 |
| `deleteStudentSchedule(scheduleId)` | admin | `class_schedules` | 학생 개인 배정 삭제 |

### 내보내기 타입
- `GroupTimetableData` — 그룹별 시간표 그리드 타입 (크로스 라우트 그룹에서 직접 import)
- `StudentTimetableEditData` — 학생 시간표 편집 데이터 타입

---

## 시간표 - 수업 시간대 (`timetable-actions.ts`)

| 함수 | 권한 | 테이블 | 설명 |
|------|------|--------|------|
| `listAcademyPeriods()` | - | `academy_periods` | 활성 교시 목록 (start_time 정렬) |
| `createAcademyPeriod(name, startTime, endTime, groupLabel?)` | admin | `academy_periods` | 교시 생성 |
| `updateAcademyPeriod(id, name, startTime, endTime, groupLabel?)` | admin | `academy_periods` | 교시 수정 |
| `deleteAcademyPeriod(id)` | admin | `academy_periods` | 교시 soft delete (is_active=false) |

---

## 숙제 관리 (`homework-actions.ts`)

| 함수 | 권한 | 테이블 | 설명 |
|------|------|--------|------|
| `listHomeworkAssignments(classId)` | authenticated | `homework_assignments`, `homework_submissions`, `class_students` | 반별 숙제 목록 (제출 현황 포함) |
| `createHomeworkAssignment(classId, teacherId, title, description?, dueDate?)` | teacher/admin | `homework_assignments`, `class_students`, `homework_submissions` | 숙제 생성 + 학생별 pending 제출 자동 생성 |
| `updateHomeworkAssignment(assignmentId, title, description?, dueDate?)` | teacher/admin | `homework_assignments` | 숙제 수정 |
| `deleteHomeworkAssignment(assignmentId)` | teacher/admin | `homework_assignments`, `homework_submissions`, `homework_submission_files`, Storage(`homework-submissions`) | 숙제 삭제 + 제출 파일 정리 |
| `listSubmissions(assignmentId)` | authenticated | `homework_submissions`, `students`, `homework_submission_files`, Storage (signed URL) | 제출 현황 (학생 이름, 파일 signed URL 포함) |
| `getStudentHomework(studentProfileId)` | authenticated | `class_students`, `classes`, `homework_assignments`, `homework_submissions` | 학생 본인 숙제 목록 |
| `submitHomework(submissionId, textContent?, audioFile?)` | 본인 확인 | `homework_submissions`, `homework_submission_files`, Storage(`homework-submissions`) | 숙제 제출 (텍스트 + 오디오) |
| `reviewSubmission(submissionId, feedback, reviewerId)` | 본인 확인 | `homework_submissions` | 교사 피드백 작성 |
| `getSubmissionFiles(submissionId)` | authenticated | `homework_submission_files`, Storage (signed URL) | 제출 파일 signed URL 조회 |

---

## 방과후 관리 (`afterschool-actions.ts`)

| 함수 | 권한 | 테이블 | 설명 |
|------|------|--------|------|
| `getOrCreateAfterschoolClass()` | - | `classes` | 방과후 반 조회/자동 생성 (group_label="방과후") |
| `getAfterschoolEnrollments(classId)` | - | `afterschool_enrollments`, `students` | 등록 학생 + 요일 정보 |
| `enrollStudent(classId, studentProfileId, days)` | admin | `afterschool_enrollments`, `class_students` | 학생 등록 (요일 + class_students 자동 추가) |
| `removeAfterschoolStudent(classId, studentProfileId)` | admin | `afterschool_enrollments`, `class_students` | 학생 제거 |
| `listAvailableStudents(classId)` | - | `afterschool_enrollments`, `profiles`, `students` | 미등록 학생 목록 |
| `listAfterschoolStudentIdsByDay(day)` | - | `afterschool_enrollments` | 특정 요일 등록 학생 ID 목록 |
| `getStudentAfterschoolDays(studentProfileId)` | - | `afterschool_enrollments` | 학생의 방과후 등록 요일 |
| `bulkUpdateEnrollmentDays(classId, updates)` | admin | `afterschool_enrollments`, `class_students` | 요일 일괄 수정 (요일 0개면 class_students에서도 제거) |

---

## 승하차(버스) 관리 (`bus-actions.ts`)

### 호차 CRUD

| 함수 | 권한 | 테이블 | 설명 |
|------|------|--------|------|
| `listBusNumbers()` | - | `bus_numbers` | 활성 호차 목록 |
| `createBusNumber(label)` | admin | `bus_numbers` | 호차 생성 (중복 검사) |
| `updateBusNumber(id, label)` | admin | `bus_numbers` | 호차 수정 |
| `deleteBusNumber(id)` | admin | `bus_numbers` | 호차 soft delete (is_active=false) |

### 시간대 CRUD

| 함수 | 권한 | 테이블 | 설명 |
|------|------|--------|------|
| `listBusTimeSlots()` | - | `bus_time_slots` | 활성 시간대 목록 |
| `createBusTimeSlot(direction, label, time)` | admin | `bus_time_slots` | 시간대 생성 |
| `updateBusTimeSlot(id, direction, label, time)` | admin | `bus_time_slots` | 시간대 수정 |
| `deleteBusTimeSlot(id)` | admin | `bus_time_slots` | 시간대 soft delete |

### 학생 목록

| 함수 | 권한 | 테이블 | 설명 |
|------|------|--------|------|
| `listAllActiveStudentNames()` | - | `profiles`, `students` | 전체 활성 학생 이름 목록 (age 포함) |

### 기본 배정

| 함수 | 권한 | 테이블 | 설명 |
|------|------|--------|------|
| `getStudentBusDefaults(studentProfileId)` | authenticated | `student_bus_defaults`, `bus_time_slots`, `bus_numbers`, `bus_stops` | 학생 기본 승하차 설정 |
| `upsertStudentBusDefault(...)` | authenticated | `student_bus_defaults` | 학생 기본 승하차 설정 생성/수정 |
| `deleteStudentBusDefault(id)` | authenticated | `student_bus_defaults` | 학생 기본 승하차 삭제 |
| `deleteStudentBusDefaults(ids)` | authenticated | `student_bus_defaults` | 복수 삭제 |
| `saveBulkBusDefaults(entries)` | admin | `student_bus_defaults` | 대량 기본 배정 저장 (기존 삭제 후 삽입) |
| `getBulkBusDefaults(direction, dayOfWeek, busTimeSlotId)` | admin | `student_bus_defaults`, `students`, `bus_stops` | 대량 기본 배정 조회 |

### 일일 명부

| 함수 | 권한 | 테이블 | 설명 |
|------|------|--------|------|
| `getDailyBusManifest(date, direction)` | authenticated | `student_bus_defaults`, `bus_change_requests`, `bus_time_slots`, `bus_numbers`, `students`, `bus_check_records`, `bus_stops`, `afterschool_enrollments` | 일일 승하차 명부 (변경 요청 반영, 방과후 포함) |

### 탑승 체크

| 함수 | 권한 | 테이블 | 설명 |
|------|------|--------|------|
| `boardBusStudent(studentProfileId, date, direction, slotId, busNumberId)` | authenticated | `bus_check_records` | 탑승 체크 (boarded_at 기록) |
| `unboardBusStudent(checkRecordId)` | authenticated | `bus_check_records` | 탑승 체크 취소 |
| `checkBusStudent(studentProfileId, date, direction, slotId, busNumberId)` | authenticated | `bus_check_records` | 하차 체크 (checked_at 기록) |
| `uncheckBusStudent(checkRecordId)` | authenticated | `bus_check_records` | 하차 체크 취소 |

### 변경 요청

| 함수 | 권한 | 테이블 | 설명 |
|------|------|--------|------|
| `listAllChangeRequests()` | admin | `bus_change_requests`, `students`, `bus_time_slots`, `bus_numbers`, `bus_stops` | 전체 변경 요청 목록 (학생 정보 포함) |
| `listPendingChangeRequests()` | admin | (listAllChangeRequests 호출) | 대기중 변경 요청만 필터 |
| `approveChangeRequest(requestId)` | admin | `bus_change_requests` | 변경 요청 승인 |
| `rejectChangeRequest(requestId, reviewNote?)` | admin | `bus_change_requests` | 변경 요청 거절 |
| `getStudentChangeRequests(studentProfileId)` | authenticated | `bus_change_requests`, `bus_time_slots`, `bus_numbers`, `bus_stops` | 학생 본인 변경 요청 목록 |
| `submitBusChangeRequest(...)` | authenticated | `bus_change_requests` | 변경 요청 제출 (change/no_ride/absent) |
| `cancelBusChangeRequest(requestId)` | authenticated | `bus_change_requests` | 변경 요청 취소 (pending만) |
| `createAdminBusChange(...)` | admin | `bus_change_requests` | 관리자 직접 변경 생성 (auto-approved) |
| `updateAdminBusChange(requestId, ...)` | admin | `bus_change_requests` | 관리자 직접 변경 수정 |
| `getExistingBusChange(studentProfileId, date, direction)` | admin | `bus_change_requests` | 기존 변경 요청 조회 |
| `deleteAdminBusChange(requestId)` | admin | `bus_change_requests` | 관리자 변경 삭제 |

### 정류장 관리

| 함수 | 권한 | 테이블 | 설명 |
|------|------|--------|------|
| `listBusStops()` | - | `bus_stops` | 활성 정류장 목록 |
| `createBusStop(name, sortOrder?)` | admin | `bus_stops` | 정류장 생성 |
| `updateBusStop(id, name, sortOrder?)` | admin | `bus_stops` | 정류장 수정 |
| `deleteBusStop(id)` | admin | `bus_stops`, `student_bus_defaults` | 정류장 삭제 (연관 배정의 bus_stop_id null 처리) |
| `listBusStopDayAssignments(busStopId)` | - | `bus_stop_day_assignments` | 정류장 요일별 호차 배정 |
| `saveBusStopDayAssignments(busStopId, assignments)` | admin | `bus_stop_day_assignments` | 정류장 요일별 배정 저장 |
| `listBusStopSchedulesBulk(busStopIds)` | - | `bus_stop_schedules` | 복수 정류장 시간표 조회 |
| `listBusStopSchedules(busStopId)` | - | `bus_stop_schedules` | 정류장 시간표 조회 |
| `upsertBusStopSchedule(busStopId, dayOfWeek, direction, slotId, time)` | admin | `bus_stop_schedules` | 정류장 시간표 생성/수정 |
| `deleteBusStopSchedule(scheduleId)` | admin | `bus_stop_schedules` | 정류장 시간표 삭제 |

### 버스 담당자

| 함수 | 권한 | 테이블 | 설명 |
|------|------|--------|------|
| `createBusStaff(email, name, busNumberId?)` | admin | Auth API, `profiles`, `bus_staff` | 버스 담당자 생성 (Auth + profile + bus_staff) |
| `listBusStaff()` | - | `bus_staff`, `profiles`, Auth API, `bus_numbers` | 버스 담당자 목록 |
| `updateBusStaff(staffId, busNumberId?)` | admin | `bus_staff` | 버스 담당자 호차 배정 수정 |
