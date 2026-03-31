---
paths:
  - "app/(admin)/admin/actions/**/*"
  - "app/(admin)/admin/actions.ts"
  - "app/(academy)/academy/actions.ts"
---

# Server Actions

## admin/actions/ (16개 파일, barrel re-export via actions.ts)

**user-actions.ts — 사용자 관리 (12개):**
- `createStudent(formData)` — 학생 계정 생성 (AdminClient, email_confirm: true)
- `createTeacher(formData)` — 교사 계정 생성 (teacher_type: korean/native)
- `listUsersByRole(role)` — 역할별 사용자 목록 (profiles + auth + students/teachers 조인)
- `deleteUserById(formData)` — 소프트 삭제: class_teachers·class_schedules 정리 후 profiles.deleted_at 설정 + Auth ban
- `restoreUser(userId)` — 삭제된 사용자 복구 (deleted_at 해제 + Auth unban)
- `permanentlyDeleteUser(userId)` — 영구 삭제 (Auth 사용자 삭제)
- `listDeletedUsers(role)` — 삭제된 사용자 목록 (휴지통용)
- `updateStudentProfile(formData)` — 학생 이름 수정 (profiles + students 테이블)
- `updateTeacherProfile(formData)` — 교사 이름/유형 수정
- `resetUserPassword(userId, newPassword)` — 비밀번호 초기화
- `listAllStudents()` — 전체 학생 목록 (소프트 삭제 제외)
- `getTeacherAssignmentCounts(userId)` — 교사의 담당 반 수 + 수업 배정 수 조회 (삭제 전 경고용)

**report-actions.ts — 리포트카드 (4개):**
- `getReportCard(studentProfileId, year, month)` — 리포트카드 조회 (RLS)
- `listReportCardsByStudent(studentProfileId)` — 학생별 리포트카드 목록
- `upsertReportCard(studentProfileId, year, month, content)` — 리포트카드 작성/수정 (교사/관리자만)
- `updateReportCardReply(reportCardId, reply)` — 학생 답변 작성 (본인만)

**class-actions.ts — 반 관리 (11개):**
- `listClassesWithDetails()` — 전체 반 목록 (교사명, 학생 수 포함)
- `getClassWithStudents(classId)` — 반 상세 + 학생 목록
- `getStudentClasses(studentProfileId)` — 학생 소속 반 목록
- `getAllClassStudentsFlat()` — 전체 반-학생 매핑 (flat)
- `createClass(name, teacherProfileIds[])` — 반 생성 (교사 최대 2명)
- `updateClass(classId, name, teacherProfileIds[])` — 반 수정 (교사 재배정)
- `deleteClass(classId)` — 반 삭제
- `addStudentToClass(classId, studentProfileId)` — 학생 등록
- `removeStudentFromClass(classStudentId)` — 학생 제거
- `listTeachersForSelect()` — 교사 목록 (소프트 삭제 제외, id, name, teacher_type)
- `listStudentsNotInClass(classId)` — 반에 미등록 학생 목록

**dashboard-actions.ts (1개):** `getDashboardStats()` — 대시보드 통계 5종 (삭제된 사용자 제외)

**schedule-actions.ts — 시간표 (9개):**
- `getGroupTimetableGrid(groupLabel)` — 그룹별 시간표 그리드 데이터 (`GroupTimetableData` 반환, `verifyAuthenticated` 사용)
- `addSingleClassSchedule(classId, periodId, dayOfWeek, teacherId, label, textbookId?, studentId?, force?)` — 개별 수업 배정. 반환: `{ error?: string; conflict?: string }` (충돌 시 conflict에 반 이름)
- `setClassScheduleSlot(classId, periodId, dayOfWeek, assignments[], force?)` — 슬롯 전체 교사 덮어쓰기 (복수 교사 배정, GroupTimetableGrid 전용). 반환: `{ error?: string; conflicts?: string[] }`
- `listClassSchedules(classId)` — 반 수업 목록
- `addClassScheduleBatch(schedules[])` — 시간표 일괄 insert
- `deleteClassSchedule(scheduleId)` — 수업 배정 삭제
- `getStudentTimetable(studentProfileId)` — 학생 개인 시간표 조회
- `getStudentTimetableEditable(studentProfileId)` — 학생 시간표 편집 데이터
- `deleteStudentSchedule(scheduleId)` — 학생 개인 수업 삭제

**timetable-actions.ts — 교시 관리 (4개):**
- `listAcademyPeriods()` / `createAcademyPeriod(...)` / `updateAcademyPeriod(...)` / `deleteAcademyPeriod(periodId)`

**textbook-actions.ts — 교재 관리 (20개):**
- `listTextbooks()` / `getTextbook(id)` — 교재 목록/상세 조회
- `createTextbook(formData)` / `updateTextbook(formData)` / `deleteTextbook(id)` — 교재 CRUD (삭제는 soft delete)
- `uploadCoverImage(file)` / `deleteCoverImage(url)` — Storage 커버 이미지 헬퍼
- `assignTextbookToClass()` / `removeTextbookFromClass()` — 반 교재 배정/해제
- `assignTextbookToStudent()` / `removeTextbookFromStudent()` — 개별 학생 교재 배정
- `updateProgress()` — 학생 교재 진도 업데이트
- `batchUpdateProgress(...)` — 반 전체 학생 진도 일괄 업데이트
- `listStudentProgress()` — 학생별 교재 진도 조회
- `getClassTextbookProgress()` — 반 교재 전체 학생 진도 조회

**notice-actions.ts — 공개 공지사항 (5개):**
- `listNotices(includeUnpublished?)` / `getNoticeWithAttachments(id)` / `createNotice(formData)` / `updateNotice(formData)` / `deleteNotice(id)`

**class-notice-actions.ts — 반별 공지 (6개):**
- `listClassNotices(classId)` / `getClassNoticeWithAttachments(noticeId)` / `createClassNotice(formData)` / `updateClassNotice(formData)` / `deleteClassNotice(noticeId)` / `getMyClassNotices(studentProfileId)`
- CUD 함수에 인증 검증: `createClient()` → `getUser()` 확인

**academy-notice-actions.ts — Academy 포털 공지 (5개):**
- `listAcademyNotices()` / `getAcademyNoticeWithAttachments(id)` / `createAcademyNotice(formData)` / `updateAcademyNotice(formData)` / `deleteAcademyNotice(id)`

**homework-actions.ts — 숙제 시스템 (9개):**
- `listHomeworkAssignments(classId)` / `createHomeworkAssignment(...)` / `updateHomeworkAssignment(...)` / `deleteHomeworkAssignment(assignmentId)` — 숙제 출제 CRUD
- `listSubmissions(assignmentId)` — 제출 현황 (교사용, signed URL 포함)
- `getStudentHomework(studentProfileId)` — 학생 본인 숙제 목록
- `submitHomework(submissionId, textContent?, audioFile?)` — 학생 제출 (소유권 검증 포함)
- `reviewSubmission(submissionId, feedback, reviewerId)` — 교사 피드백 (reviewer 인증 검증 포함)
- `getSubmissionFiles(submissionId)` — 제출물 signed URL 조회

**learning-actions.ts — 학습 기록 (4개):**
- `listLearningRecords(studentProfileId)` / `createLearningRecord(...)` / `updateLearningRecord(...)` / `deleteLearningRecord(recordId)`
- 모든 함수에 인증 검증 (`verifyAuthenticatedUser` 헬퍼)

**attendance-actions.ts — 출결 (8개):**
- `listAttendanceRecords(studentProfileId, year?, month?)` — 출결 기록 목록 (최신순)
- `recordAttendance(studentProfileId, attendanceDate, status, note?)` — 출결 upsert
- `deleteAttendance(recordId)` — 출결 삭제
- `getStudentAttendanceByDate(studentProfileId, date)` — 특정 날짜 출결 조회 → `{ status, note }`
- `getClassAttendanceByDate(classId, date)` — 반 학생들 특정 날짜 출결 조회 (교사용)
- `getClassStudentsWithAttendance(classId, date)` — 반 학생 목록 + 출결 통합 → `StudentWithAttendance[]` (관리자용, 나이순 정렬)
- `bulkRecordAttendance(records[])` — 반 출결 일괄 저장 (관리자용 upsert)
- `getAttendanceStats(studentProfileId, year, month)` — 월별 출결 통계

**bus-actions.ts — 승하차 관리 (~47개):**
- `listBusNumbers()` / `createBusNumber(...)` / `updateBusNumber(...)` / `deleteBusNumber(...)` — 호차 CRUD
- `listBusTimeSlots()` / `createBusTimeSlot(...)` / `updateBusTimeSlot(...)` / `deleteBusTimeSlot(...)` — 시간대 CRUD
- `listAllActiveStudentNames()` — 전체 활성 학생 목록 (배정용)
- `getStudentBusDefaults(studentProfileId)` / `upsertStudentBusDefault(...)` / `deleteStudentBusDefault(...)` / `deleteStudentBusDefaults(ids[])` / `getBulkBusDefaults(...)` — 기본 배정
- `getDailyBusManifest(date, direction)` — 일일 매니페스트 (groups + noRides + afterschoolStudents 반환)
- `boardBusStudent(...)` / `unboardBusStudent(...)` / `checkBusStudent(...)` / `uncheckBusStudent(...)` — 탑승/하차 체크
- `listBusStops(busNumberId)` / `createBusStop(...)` / `updateBusStop(...)` / `deleteBusStop(...)` — 정류장 CRUD
- `listPendingChangeRequests()` / `approveChangeRequest(...)` / `rejectChangeRequest(...)` — 변경요청 관리
- `getStudentChangeRequests(studentProfileId)` / `submitBusChangeRequest(...)` / `cancelBusChangeRequest(...)` — 학생 변경요청
- `createAdminBusChange(...)` / `updateAdminBusChange(...)` / `deleteAdminBusChange(...)` / `getExistingBusChange(...)` — 관리자 당일 변경
- `listBusStaff()` / `upsertBusStaff(...)` / `deleteBusStaff(...)` — 버스 담당자 관리

**afterschool-actions.ts — 방과후 관리 (8개):**
- `getOrCreateAfterschoolClass()` — 방과후 반 조회/생성 (group_label="방과후" 단일 반)
- `getAfterschoolEnrollments(classId)` — 방과후 등록 학생 + 요일 정보 → `AfterschoolStudentEnrollment[]`
- `enrollStudent(classId, studentProfileId, days[])` — 학생 등록 (요일 배열 + class_students upsert)
- `removeAfterschoolStudent(classId, studentProfileId)` — 학생 제거 (enrollments + class_students)
- `listAvailableStudents(classId)` — 미등록 학생 목록
- `listAfterschoolStudentIdsByDay(day)` — 특정 요일 등록 학생 ID 목록
- `getStudentAfterschoolDays(studentProfileId)` — 학생의 방과후 등록 요일 목록
- `bulkUpdateEnrollmentDays(classId, updates[{studentProfileId, days[]}])` — 요일 일괄 수정 (기존 삭제→재삽입)

## academy/actions.ts (7개)

- `getCurrentStudentProfile()` — 현재 로그인 학생의 프로필 조회
- `getCurrentStudentClasses()` — 현재 학생의 소속 반 + 담당 교사 조회
- `getCurrentTeacherProfile()` — 현재 로그인 교사의 프로필 조회
- `getTeacherClasses()` — 교사 담당 반 + 학생 목록
- `getClassReportStatus(classId, year, month)` — 반별 리포트카드 작성 현황
- `getClassTextbooks(classId)` — 반 교재 목록 (인증 검증 포함)
- `getCurrentStudentTextbooks()` — 학생 교재 진도 조회
