# lib/ 유틸리티

## 타입 정의

### 파일 구조
- `lib/types/database.ts` — 순수 DB Row 타입 (테이블 1:1)
- `lib/types/api.ts` — 조인/통합/UI 타입 (Server Action 반환값, Client Component용)
- `lib/types/index.ts` — 두 파일의 모든 타입을 re-export (단일 진입점: `import type { ... } from "@/lib/types"`)

> `"use server"` 파일에서는 `export type` 불가 → 공유 타입은 반드시 `lib/types/`에 정의

### `lib/types/database.ts` — 순수 DB Row 타입 (테이블 1:1)

| 타입명 | 설명 |
|--------|------|
| `ReportCard` | 리포트카드 (student_profile_id, year/month, content, reply) |
| `ReportCardListItem` | 리포트카드 목록용 간소 타입 (id, year, month) |
| `LearningRecord` | 학습 기록 (category: test/assessment/note/level_change) |
| `BusNumber` | 호차 (label, is_active) |
| `BusTimeSlot` | 버스 시간대 (direction: pickup/dropoff, label, time) |
| `AcademyPeriod` | 수업 교시 (start_time, end_time, group_label, has_pickup/dropoff, is_active) |
| `BusCheckRecord` | 승하차 체크 기록 |
| `BusStopDayAssignment` | 정류장 요일별 호차 배정 |
| `BusStop` | 정류장 (name, sort_order, is_active) |
| `BusStopSchedule` | 정류장 시간표 (estimated_time) |
| `AfterschoolEnrollment` | 방과후 등록 (class_id, student_profile_id, day_of_week, second_period) |
| `ClassSchedule` | 수업 시간표 (class_id 또는 student_profile_id) |
| `Textbook` | 교재 DB Row (title, series, level, category, total_units, is_active) |

### `lib/types/api.ts` — 조인/통합/UI 타입

| 타입명 | 설명 |
|--------|------|
| `TeacherOption` | 교사 선택 드롭다운용 (id, name, teacher_type) |
| `UserWithProfile` | Admin 사용자 통합 뷰 (Auth + profiles + students/teachers) |
| `DashboardStats` | 대시보드 통계 5종 (학생수, 교사수, 반수, 리포트카드수, 공지수) |
| `ClassTeacherInfo` | 반 담당 교사 (profile_id, name, teacher_type) |
| `ClassWithDetails` | 반 상세 (이름, group_label, color_index, teachers[], student_count, schedule_count) |
| `ClassStudentRow` | 반 소속 학생 행 (korean_name, english_name, age, student_number) |
| `ClassTextbookProgressRow` | 반별 교재 진도 행 (학생별 status, completed_units) |
| `AdminStudentClassItem` | Admin 학생 소속 반 아이템 |
| `AttendanceRecord` | 출결 기록 (status: present/absent/late/excused, attendance_date) |
| `AttendanceStats` | 출결 통계 (total, present, absent, late, excused) |
| `StudentWithAttendance` | 반별 출결용 학생+상태 통합 타입 (student_profile_id, korean_name, age, status, note) |
| `StudentProfile` | 학생 프로필 (Academy 포털용) |
| `StudentClassItem` | 학생 소속 반 정보 (Academy 포털용) |
| `TeacherProfile` | 교사 프로필 (id, email, name, teacher_number, teacher_type) |
| `TeacherClassWithStudents` | 교사 담당 반 + 학생 목록 |
| `ReportCardStatus` | 리포트카드 작성 상태 (학생별 has_report, has_reply, report_id) |
| `TeacherClassTextbook` | 교사용 반별 교재 정보 |
| `StudentTextbookItem` | 학생용 교재 아이템 (진도, source_type 포함) |
| `ClassTextbook` | 반-교재 매핑 (class_id, textbook_id, assigned_at 포함) |
| `StudentTextbookProgress` | 학생 교재 진도 상세 (source_type, status, completed_units 등) |
| `ClassNotice` | 반별 공지 (author_id/name, is_pinned, attachment_count) |
| `ClassNoticeAttachment` | 반별 공지 첨부파일 |
| `AcademyNotice` | Academy 공지 (is_published, is_pinned, image/attachment_count) |
| `AcademyNoticeAttachment` | Academy 공지 첨부파일 |
| `HomeworkAssignment` | 숙제 출제 (class_id, teacher_id, due_date, submission_count) |
| `HomeworkSubmission` | 숙제 제출 (status: pending/submitted/reviewed, teacher_feedback) |
| `HomeworkSubmissionFile` | 숙제 제출 파일 (storage_path, signed_url) |
| `Notice` | 사이트 공개 공지사항 |
| `NoticeAttachment` | 사이트 공지 첨부파일 (file_type: image/attachment) |
| `StudentBusDefault` | 학생 기본 승하차 설정 (요일별, bus_stop 포함) |
| `BusChangeRequest` | 승하차 변경 요청 (change_type: change/no_ride/absent, status: pending/approved/rejected) |
| `BusManifestEntry` | 승하차 명부 항목 (탑승 여부, 변경 여부, bus_stop 정보 포함) |
| `BusManifestGroup` | 승하차 명부 그룹 (시간대+호차별 학생 목록) |
| `NoRideEntry` | 미탑승 항목 |
| `AfterSchoolBusEntry` | 방과후 버스 항목 |
| `BusStaffProfile` | 버스 담당자 프로필 |
| `BusDefaultAssignment` | 학생 기본 승하차 배정 (drag-and-drop용, age 포함) |
| `DropoffExportRow` / `DropoffExportData` | 하원 내보내기 데이터 타입 |
| `AfterschoolStatus` | 방과후 등록 상태 ("none" \| "first_only" \| "both") |
| `DayEnrollment` | 방과후 요일 등록 (day: number, second_period: boolean) |
| `AfterschoolStudentEnrollment` | 방과후 등록 학생 통합 뷰 (student_profile_id, korean/english_name, age, days[]) |
| `ClassScheduleWithDetails` | 수업 시간표 + period/teacher 상세 |
| `StudentTimetableCell` | 학생 시간표 셀 (source: class/individual) |
| `StudentTimetableRow` | 학생 시간표 행 (period + cells[1~5]) |
| `CellEntry` | 그룹 시간표 그리드 셀 (scheduleId, label, teacherId, teacherType, textbookId) |
| `GroupTimetableData` | 그룹 시간표 그리드 데이터 (periods, classes, cells Record, teachers, textbooks) |
| `BusCheckBatchItem` | 버스 일괄 체크 아이템 (action: board/unboard/check/uncheck) |

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
| `lib/class-groups.ts` | 반 그룹 순서 상수. `GROUP_ORDER = ["유치부", "오후반", ""]`, `GroupKey` 타입. 그룹 필터 UI 전역 공유 |
| `lib/utils/student-sort.ts` | 학생 정렬 공통 유틸. `sortStudentsByAgeAndName<T>(students, ageFirst?)` — 나이순 → 한글 이름순. `age`, `korean_name`, `first_name` 필드를 가진 모든 타입에 적용 가능. 모든 학생 명단 정렬은 이 단일 소스를 통과해야 한다 |
| `lib/utils/date-kst.ts` | KST 날짜/시간 유틸. `todayKst()` → `"YYYY-MM-DD"` (DB `DATE` 컬럼용), `formatDateYmdKst(input)`, `formatDateKst(input)` → `"2026년 4월 9일"`, `formatDateTimeKst(input)` → `"2026. 04. 09. 15:30"`, `formatTimeKst(input)` → `"15:30"`, `nowKstParts()` → `{ year, month, day }`. `new Date().toLocaleDateString(...)` 분산 사용 금지 |
| `lib/utils/escape-html.ts` | HTML 특수문자 이스케이프. `escapeHtml(input)` — React 밖 HTML 생성(`document.write`, `innerHTML = ...`) 시 XSS 방지 필수. 프린트용 새 창 생성에서 사용 |
| `lib/logger.ts` | 서버 구조화 로거. `logger.info(tag, msg, ctx?)` / `logger.warn(...)` / `logger.error(...)`. 서버 코드에서 `console.log/error` 직접 사용 금지. PII(이메일/전화)는 context에서 제외, `user_id`만 기록 |

## 버스 유틸리티 (`lib/bus/`)

| 파일 | 역할 |
|------|------|
| `lib/bus/afterschool-sync.ts` | 방과후 슬롯 감지 유틸. `AFTERSCHOOL_SLOT_LABEL_1 = "방과후1차"`, `AFTERSCHOOL_SLOT_LABEL_2 = "오후반 1차/방과후2차"` 상수 + `detectAfterschoolSlot(slot)` → `{ isAfterschoolSlot, secondPeriod }`. StudentBusTab·AdminBusChangeDnD 공유 |
| `lib/bus/utils.ts` | 버스 표시 유틸. `StopGroup` 타입, `groupStudentsByStop(students)` (정류장 sort_order → 나이순 그룹핑), `formatTime(t)` (HH:MM:SS→HH:MM), `formatCheckedTime(iso)` (ISO→H:MM) |
| `lib/bus/realtime-utils.ts` | Realtime 이벤트 패치 유틸. `CheckRecordRow`, `ChangeRequestRow` 타입. `applyCheckRecord(groups, event, row)` — 탑승/하차 체크 즉시 반영. `applyChangeRequest(groups, noRides, event, row)` — 변경 요청 이벤트 반영. 낙관적 UI 업데이트용 |

## Hooks

| 파일 | 역할 |
|------|------|
| `lib/hooks/use-bus-realtime.ts` | 버스 실시간 업데이트 hook. Supabase Realtime으로 `bus_check_records` 테이블 변경 감지. 500ms 디바운스 후 onUpdate 콜백. 날짜 필터링 |

## Admin Client Hooks (`app/(admin)/admin/hooks/`)

| 파일 | 역할 |
|------|------|
| `admin/hooks/useAsyncData.ts` | 비동기 데이터 로딩 공통 훅. `useAsyncData<T>(fetcher, deps)` → `{ data, loading, error, reload, setData }`. StudentTimetableTab·StudentTextbookTab·StudentAttendanceTab 등에서 공유 |
| `admin/hooks/usePasswordReset.ts` | 비밀번호 초기화 UI 훅. `usePasswordReset(userId, email?)` → `{ show, setShow, newPassword, setNewPassword, pending, message, open, generatePassword, handleReset, reset }`. 이메일 prefix + 4자리 난수로 비밀번호 자동 생성. StudentSelectedView·TeacherInfoCard 공유 |
