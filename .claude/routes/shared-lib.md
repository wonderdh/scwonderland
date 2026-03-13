# lib/ 유틸리티

## 타입 정의

### `lib/types/index.ts` — 타입 re-export 허브
`lib/types/database.ts`에서 정의된 모든 타입을 re-export.

### `lib/types/database.ts` — 전체 타입 정의

| 타입명 | 설명 |
|--------|------|
| `UserWithProfile` | Admin 사용자 통합 뷰. Auth 정보 + profiles + students/teachers 테이블 병합 |
| `DashboardStats` | 대시보드 통계 (학생수, 교사수, 반수, 리포트카드수, 공지수) |
| `ReportCard` | 리포트카드. student_profile_id + year/month + content/reply |
| `ReportCardListItem` | 리포트카드 목록용 간소 타입 (id, year, month) |
| `ClassTeacherInfo` | 반 담당 교사 정보 (profile_id, name, teacher_type) |
| `ClassWithDetails` | 반 상세 (이름, group_label, teachers[], student_count) |
| `ClassStudentRow` | 반 소속 학생 행 (korean_name, english_name, age, student_number) |
| `ClassTextbookProgressRow` | 반별 교재 진도 행 (학생별 status, completed_units) |
| `AdminStudentClassItem` | Admin 학생 소속 반 아이템 |
| `LearningRecord` | 학습 기록 (category: test/assessment/note/level_change) |
| `AttendanceRecord` | 출결 기록 (status: present/absent/late/excused) |
| `AttendanceStats` | 출결 통계 (total, present, absent, late, excused) |
| `StudentProfile` | 학생 프로필 (Academy 포털용) |
| `StudentClassItem` | 학생 소속 반 정보 (Academy 포털용) |
| `TeacherProfile` | 교사 프로필 (id, email, name, teacher_number, teacher_type) |
| `TeacherClassWithStudents` | 교사 담당 반 + 학생 목록 |
| `ReportCardStatus` | 리포트카드 작성 상태 (학생별 has_report, has_reply) |
| `TeacherClassTextbook` | 교사용 반별 교재 정보 |
| `StudentTextbookItem` | 학생용 교재 아이템 (진도 포함) |
| `ClassNotice` | 반별 공지 (author_id/name, is_pinned, attachment_count) |
| `ClassNoticeAttachment` | 반별 공지 첨부파일 |
| `AcademyNotice` | Academy 공지 (is_published, is_pinned, image/attachment_count) |
| `AcademyNoticeAttachment` | Academy 공지 첨부파일 |
| `HomeworkAssignment` | 숙제 출제 (class_id, teacher_id, due_date, submission_count) |
| `HomeworkSubmission` | 숙제 제출 (status: pending/submitted/reviewed, teacher_feedback) |
| `HomeworkSubmissionFile` | 숙제 제출 파일 (storage_path, signed_url) |
| `Notice` | 사이트 공개 공지사항 |
| `NoticeAttachment` | 사이트 공지 첨부파일 (file_type: image/attachment) |
| `BusNumber` | 호차 (label, is_active) |
| `BusTimeSlot` | 버스 시간대 (direction: pickup/dropoff, label, time) |
| `AcademyPeriod` | 수업 교시 (start_time, end_time, group_label, has_pickup/dropoff) |
| `StudentBusDefault` | 학생 기본 승하차 설정 (요일별, bus_stop 포함) |
| `BusChangeRequest` | 승하차 변경 요청 (change_type: change/no_ride/absent, status: pending/approved/rejected) |
| `BusManifestEntry` | 승하차 명부 항목 (탑승 여부, 변경 여부 포함) |
| `BusManifestGroup` | 승하차 명부 그룹 (시간대+호차별 학생 목록) |
| `NoRideEntry` | 미탑승 항목 |
| `AfterSchoolBusEntry` | 방과후 버스 항목 |
| `BusCheckRecord` | 승하차 체크 기록 |
| `BusStaffProfile` | 버스 담당자 프로필 |
| `BusStop` | 정류장 (name, sort_order, is_active) |
| `BusStopDayAssignment` | 정류장 요일별 호차 배정 |
| `BusStopSchedule` | 정류장 시간표 (estimated_time) |
| `BusDefaultAssignment` | 학생 기본 승하차 배정 (drag-and-drop용) |
| `ClassSchedule` | 수업 시간표 (class_id 또는 student_profile_id) |
| `ClassScheduleWithDetails` | 수업 시간표 + period/teacher 상세 |
| `StudentTimetableCell` | 학생 시간표 셀 (source: class/individual) |
| `StudentTimetableRow` | 학생 시간표 행 (period + cells[1~5]) |
| `AfterschoolEnrollment` | 방과후 등록 (class_id, student_profile_id, day_of_week) |

## Supabase 클라이언트

| 파일 | 역할 | 사용 환경 |
|------|------|-----------|
| `lib/supabase/client.ts` | 브라우저용 Supabase 클라이언트. `createBrowserClient` 사용 | Client Component |
| `lib/supabase/server.ts` | 서버용 Supabase 클라이언트. `createServerClient` + cookies 사용. setAll catch로 Server Component 호환 | Server Component, Server Action |
| `lib/supabase/admin.ts` | Admin 클라이언트. `SUPABASE_SERVICE_ROLE_KEY` 사용, RLS 무시. Auth CRUD 가능. persistSession/autoRefreshToken 비활성 | Server Action 전용 |
| `lib/supabase/storage.ts` | Storage 유틸리티. 버킷 상수(5개), 파일 검증(image/document/audio), 경로 생성, URL 추출, 파일 크기 포맷 |

### Storage 버킷 상수
- `notice-files` — 사이트 공지 파일
- `class-notices` — 반별 공지 파일
- `academy-notices` — Academy 공지 파일
- `homework-submissions` — 숙제 제출 파일
- `textbook-covers` — 교재 커버 이미지

### 파일 제한
- 이미지: JPG/PNG/WebP, 10MB
- 문서: PDF/ZIP/DOCX/XLSX, 20MB
- 오디오: WebM/OGG/MP4/MP3/WAV, 50MB

## 인증 유틸리티

| 파일 | 역할 |
|------|------|
| `lib/auth-utils.ts` | 이메일 정규화(`normalizeEmail`: 한글 입력 자동 변환 + 도메인 자동 추가) + Auth 에러 메시지 한국어 변환(`getAuthErrorMessage`) |

## 일반 유틸리티

| 파일 | 역할 |
|------|------|
| `lib/utils.ts` | Tailwind CSS 클래스 병합 유틸리티. `cn()` = `twMerge(clsx(...))` |
| `lib/korean-to-english.ts` | 한타→영타 변환 (두벌식 키보드 매핑). `containsKorean(str)` 감지 + `koreanToEnglish(str)` 변환. 로그인 시 한글 입력 자동 변환에 사용 |
| `lib/student-age-colors.ts` | 학생 나이별 색상 팔레트. `getAgeColor(age)` -> `{bg, text, border}`. 5세=pink, 6세=sky, 7세=emerald, 기타=slate. `getAgeLabel(age)` -> "N세" |
| `lib/menu-routes.ts` | 사이트 메뉴 경로 매핑. menuId↔URL 변환, 아이템 slug 관리. `getMenuItemHref()`, `getDefaultMenuItemHref()`, `getCategoryItemLabels()`, `getMenuIdFromPathname()` |
| `lib/teacher-labels.ts` | 원어민/한국인 교사 UI 라벨 세트. 9개 라벨 객체(dashboardLabels, reportLabels, textbookLabels, batchUpdateLabels, noticeLabels, homeworkLabels, attendanceLabels, timetableLabels, busLabels). 각각 korean/native 키 |

## Hooks

| 파일 | 역할 |
|------|------|
| `lib/hooks/use-bus-realtime.ts` | 버스 실시간 업데이트 hook. Supabase Realtime으로 `bus_check_records` 테이블 변경 감지. 500ms 디바운스 후 onUpdate 콜백. 날짜 필터링 |
