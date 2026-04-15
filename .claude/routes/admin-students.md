# Admin Students (학생 관리)

## 라우트 경로
- URL: `/admin/students`
- 서브라우트: `/admin/students/classes` (반 이동 - 미구현, 준비 중)
- 라우트 그룹: `(admin)`

## 핵심 파일
- page.tsx: `app/(admin)/admin/students/page.tsx`
- 서브라우트: `app/(admin)/admin/students/classes/page.tsx`

## 컴포넌트
| 파일 | 역할 |
|------|------|
| `students/components/AddStudentForm.tsx` | 학생 추가 폼 (아이디, 비밀번호, 한글/영문 이름, 나이) |
| `students/components/StudentSelectedView.tsx` | 선택된 학생 정보 카드 (`StudentInfoCard`) |
| `students/components/StudentTabNav.tsx` | 학생 상세 탭 네비게이션 (4탭: basic / learning / schedule / bus, URL `?tab=basic\|learning\|schedule\|bus`, legacy tab IDs backwards-compatible) |
| `students/components/StudentClassesView.tsx` | 학생 소속 반 목록 표시 |
| `students/components/StudentLearningTab.tsx` | 학습 기록 탭 |
| `students/components/StudentReportTab.tsx` | 리포트카드 탭 |
| `students/components/StudentTextbookTab.tsx` | 교재 진도 탭 |
| `students/components/StudentTimetableTab.tsx` | 시간표 탭 |
| `students/components/StudentAttendanceTab.tsx` | 출결 기록 탭 |
| `students/components/StudentBusTab.tsx` | 승하차 배정 탭 |
| `students/components/StudentComingTab.tsx` | (미사용 또는 예비) |
| `students/components/ReportCardReadView.tsx` | 리포트카드 읽기 뷰 |
| `components/AdminListSidebar.tsx` | 학생/교사 목록 좌측 사이드바 (검색, 추가, 휴지통 링크) |
| `components/UserList.tsx` | 사용자 목록 테이블 |
| `components/UserRow.tsx` | 사용자 행 컴포넌트 |
| `components/TrashView.tsx` | 소프트 삭제된 사용자 복구/영구삭제 뷰 |
| `components/ScrollToSection.tsx` | 섹션 스크롤 유틸리티 |

## Server Actions

### user-actions.ts
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `createStudent` | FormData(email, password, korean_name, english_name, age) | `auth.users`, `students` |
| `listUsersByRole` | role: "student" | "teacher" | `profiles`, `auth.users`, `students` 또는 `teachers` |
| `listDeletedUsers` | role: "student" | "teacher" | `profiles`, `auth.users`, `students` 또는 `teachers` |
| `updateStudentProfile` | FormData(id, korean_name, english_name, age) | `profiles`, `students` |
| `deleteUserById` | FormData(id) | `class_teachers`, `class_schedules`, `profiles`, `auth.users` |
| `restoreUser` | userId: string | `profiles`, `auth.users` |
| `permanentlyDeleteUser` | userId: string | `auth.users` (CASCADE) |
| `resetUserPassword` | userId, newPassword | `auth.users` |
| `listAllStudents` | (없음) | `profiles`, `students` |

### report-actions.ts
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `getReportCard` | studentProfileId, year, month | `report_cards` |
| `listReportCardsByStudent` | studentProfileId | `report_cards` |
| `upsertReportCard` | studentProfileId, year, month, content | `report_cards`, `profiles` |

### learning-actions.ts
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `listLearningRecords` | studentProfileId | `learning_records` |
| `createLearningRecord` | studentProfileId, record | `learning_records` |
| `updateLearningRecord` | recordId, updates | `learning_records` |
| `deleteLearningRecord` | recordId | `learning_records` |

### attendance-actions.ts
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `listAttendanceRecords` | studentProfileId, year?, month? | `attendance`, `classes` |
| `recordAttendance` | studentProfileId, classId, date, status, note? | `attendance` |
| `deleteAttendance` | recordId | `attendance` |
| `getAttendanceStats` | studentProfileId, year, month | `attendance` |

### schedule-actions.ts (학생 시간표용)
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `getStudentTimetable` | studentProfileId | `class_students`, `classes`, `afterschool_enrollments`, `class_schedules`, `academy_periods`, `teachers` |
| `getStudentTimetableEditable` | studentProfileId | `academy_periods`, `class_schedules`, `teachers`, `textbooks` |
| `addSingleClassSchedule` | classId, periodId, day, teacherId, label, textbookId, studentProfileId | `class_schedules`, `classes` |
| `deleteStudentSchedule` | scheduleId | `class_schedules` |

### class-actions.ts (학생 소속 반 조회용)
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `getStudentClasses` | studentProfileId | `class_students`, `classes`, `class_teachers`, `teachers` |

## 타입
- `UserWithProfile` from `lib/types`
- `LearningRecord` from `lib/types`
- `ReportCard`, `ReportCardListItem` from `lib/types`
- `AttendanceRecord`, `AttendanceStats` from `lib/types`
- `StudentTimetableRow`, `StudentTimetableCell` from `lib/types`
- `StudentTabId` = "basic" | "learning" | "schedule" | "bus" (legacy "info"/"report"/"textbook"/"timetable"/"attendance" IDs backwards-compatible → basic/learning/schedule)

## 데이터 흐름
1. `page.tsx`: `listUsersByRole("student")` → 학생 목록 로드
2. searchParams로 `section`(add/trash), `selected`(학생 ID), `tab`(현재 탭) 결정
3. `section=trash` → `listDeletedUsers("student")` → `TrashView` 렌더링
4. `section=add` → `AddStudentForm` + `UserList` 렌더링
5. `selected` 있으면 → `StudentTabNav` + 해당 탭 컴포넌트 렌더링
6. 기본: "왼쪽 목록에서 학생을 선택하세요" 안내 표시

## 의존성
- Shared: `AdminListSidebar`, `UserList`, `TrashView`, `ScrollToSection`
- Actions: `listUsersByRole`, `deleteUserById`, `listDeletedUsers`, `restoreUser`, `permanentlyDeleteUser`, `updateStudentProfile` from `actions.ts`

## 주의사항
- 학생 삭제는 소프트 삭제 (`profiles.deleted_at` + Auth ban)
- 삭제 시 `class_teachers`, `class_schedules` 관련 데이터도 정리
- 학생 이름 표시 시 `getAgeColor(age)` 나이별 색상 적용 필수
- 서브라우트 `/admin/students/classes`는 "준비 중" 상태
- 4개 탭으로 학생 상세 정보 관리 (basic / learning / schedule / bus) — 내부에 학습·리포트·교재는 learning 탭에 통합, 시간표·출결은 schedule 탭에 통합. Legacy tab IDs(info/report/textbook/timetable/attendance) backwards-compatible
