# SC Wonderland — 전체 프로젝트 분석 보고서

> 작성일: 2026-03-16
> 기준 커밋: `e2811c8` (P2-11 결과 보고서)
> 빌드 상태: ✅ TypeScript 오류 없음 (55개 페이지 정상 생성)

---

## 1. 프로젝트 개요

### 1-1. 목적

원더랜드 영어학원의 **학원 소개 사이트 + 내부 관리 시스템** 통합 웹 애플리케이션.
단일 Next.js 앱에 공개 사이트, 관리자 대시보드, 학생/교사 포털, 버스 직원 PWA가 공존한다.

### 1-2. 5종 대상 사용자

| 역할 | 접근 경로 | 주요 기능 |
|------|----------|----------|
| **학부모/일반 방문자** | `/` (site) | 학원 소개, 프로그램, 공지사항 열람 |
| **관리자** | `/admin` | 학생·교사·반·시간표·교재·공지·숙제·출결·승하차 전체 관리 |
| **학생** | `/academy/student` | 리포트카드, 교재 진도, 공지, 숙제 제출, 승하차 |
| **한국인 교사** | `/academy/teacher` | 반 관리, 시간표, 공지 작성, 교재, 출결, 숙제 피드백, 승하차 |
| **원어민 교사** | `/academy/teacher` | 리포트카드 작성, 교재, 출결, 숙제 피드백 (영어 UI) |

### 1-3. 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router) |
| UI 라이브러리 | React 19 |
| 언어 | TypeScript |
| 스타일 | Tailwind CSS v4 |
| 백엔드 | Supabase (Auth + PostgreSQL + Storage) |
| 상태 관리 | React 19 `useActionState` + `router.refresh()` |
| UI 컴포넌트 | shadcn/ui (avatar, badge, button, card, input, label, separator, tabs, textarea, tooltip) |
| 알림 | sonner (toast) |

### 1-4. 라우트 그룹 5개 개요

| 그룹 | 경로 | 역할 |
|------|------|------|
| `(site)` | `/` ~ `/experience/links` | 공개 학원 소개 사이트 |
| `(admin)` | `/admin` ~ `/admin/bus` | 관리자 대시보드 |
| `(academy)` | `/academy/login` ~ `/academy/teacher/bus` | 학생·교사 포털 |
| `(bus)` | `/bus` | 버스 직원 PWA (실시간 탑승/하차) |
| `(monitor)` | `/monitor` | 버스 실시간 디스플레이 (TV 모니터) |

---

## 2. 전체 디렉토리 구조

### 2-1. app/ 라우트 트리

```
app/
├── layout.tsx                      # 루트: Geist 폰트, HTML lang="ko", <Toaster>
├── error.tsx                       # 루트 Error Boundary
├── (site)/                         # 공개 학원 소개 사이트
│   ├── layout.tsx                  # Navigation + SideBar + Footer
│   ├── page.tsx                    # 랜딩 (Hero + MainProgram)
│   ├── _components/                # 사이트 전용 컴포넌트
│   ├── error.tsx
│   ├── about-wonderland/           # 인사말, 연혁, 인증, 교육철학
│   ├── program/                    # 프로그램 MAP + 5개 프로그램
│   ├── notice/                     # 공지사항 목록/상세
│   ├── community/                  # 학부모상담, 가맹문의, 캠퍼스
│   └── experience/                 # Special Day, E-School, Library, Links
├── (admin)/admin/                  # 관리자 대시보드
│   ├── layout.tsx                  # 2단계 인증 (로그인 + role=admin)
│   ├── error.tsx
│   ├── page.tsx                    # 대시보드 (통계 5종)
│   ├── actions.ts                  # barrel re-export (~101개 함수)
│   ├── actions/                    # 도메인별 Server Actions (16개 파일)
│   ├── components/                 # 공유 컴포넌트
│   ├── students/                   # 학생 관리 (7개 탭)
│   ├── teachers/                   # 교사 관리 (3개 탭)
│   ├── classes/                    # 반 관리
│   ├── textbooks/                  # 교재 관리
│   ├── notices/                    # 공개 공지사항 관리
│   ├── academy-notices/            # Academy 포털 공지 관리
│   ├── timetable/                  # 시간표 관리
│   └── bus/                        # 승하차 관리 (탭 다수)
├── (academy)/academy/              # 학생·교사 포털
│   ├── layout.tsx
│   ├── error.tsx
│   ├── actions.ts                  # Academy Server Actions (7개)
│   ├── login/                      # 로그인 (LoginForm)
│   ├── dashboard/                  # 역할별 리다이렉트
│   ├── student/                    # 학생 포털 (6개 탭)
│   └── teacher/                    # 교사 포털 (한국인 8탭/원어민 6탭)
├── (bus)/                          # 버스 직원 PWA
│   ├── error.tsx
│   └── bus/                        # 실시간 탑승/하차 체크
└── (monitor)/                      # 버스 실시간 디스플레이
    ├── error.tsx
    └── monitor/                    # TV 모니터 전용 (인증 없음)
```

### 2-2. lib/ 구조

```
lib/
├── types/
│   ├── database.ts                 # DB Row 타입 (테이블 컬럼 1:1 대응)
│   ├── api.ts                      # API 응답 타입 (조인·집계 결과)
│   └── index.ts                    # barrel re-export
├── supabase/
│   ├── client.ts                   # Browser Supabase 클라이언트
│   ├── server.ts                   # Server Supabase 클라이언트 (RLS 적용)
│   ├── admin.ts                    # Admin Supabase 클라이언트 (service role)
│   ├── storage.ts                  # Storage 헬퍼 (버킷 상수, 경로 생성/검증)
│   └── notice-crud-helpers.ts      # 공지사항 3종 공통 CRUD 헬퍼
├── menu-routes.ts                  # (site) 라우트 중앙 관리
├── auth-utils.ts                   # 이메일 정규화 + 에러 메시지 변환
├── teacher-labels.ts               # 교사 포털 한국어/영어 라벨 맵 (9개 세트)
├── student-age-colors.ts           # 나이별 색상 (getAgeColor)
├── class-colors.ts                 # 반 색상 팔레트 + getClassColor
└── utils.ts                        # 기타 유틸
```

### 2-3. components/ 구조

```
components/
├── ui/                             # shadcn/ui 컴포넌트 9종
├── LogoutButton.tsx                # admin + academy 공유 (labels prop)
├── AudioRecorder.tsx               # 오디오 녹음 (숙제 제출용)
├── FileUpload.tsx                  # 파일 업로드
└── FileList.tsx                    # 파일 목록 표시
```

### 2-4. .claude/ 규칙 구조

```
.claude/
├── CLAUDE.md                       # 프로젝트 개요 + 핵심 원칙 + 조건부 로드 설정
└── rules/
    ├── core.md                     # 항상 로드 — 기술 스택, 핵심 원칙
    ├── architecture.md             # 라우트맵, 레이아웃 (app/**/* 작업 시)
    ├── components.md               # 컴포넌트 목록 (*.tsx 작업 시)
    ├── database.md                 # DB 스키마, Storage (lib/, actions/ 작업 시)
    ├── patterns.md                 # 인증·폼·타입 패턴 (app/, lib/ 작업 시)
    ├── server-actions.md           # 101개 함수 목록 (actions/ 작업 시)
    └── styling.md                  # CSS, 색상 팔레트 (*.css, (site)/ 작업 시)
```

---

## 3. 라우트 그룹별 기능 상세

### 3-1. (site) — 공개 학원 소개 사이트

| 경로 | 페이지 | 상태 |
|------|--------|------|
| `/` | 랜딩 (Hero + MainProgram 카드 5개) | ✅ |
| `/about-wonderland/greeting` | 원장 인사말 | ✅ |
| `/about-wonderland/company-history` | 연혁 타임라인 (1993~2022) | ✅ |
| `/about-wonderland/certification` | 대외기관 인증 | 🔲 placeholder |
| `/about-wonderland/wonderland` | 교육 철학 (Whole Language 등) | ✅ |
| `/program/map` | 프로그램 전체 MAP | ✅ |
| `/program/wonderland` | 오전 유치부 (원형 커리큘럼 레이아웃) | ✅ |
| `/program/wonder-k` | 오후 유치부 | ✅ |
| `/program/primo-school` | 초등 저학년 | ✅ |
| `/program/quest-academy` | 초등 고학년·중등 | ✅ |
| `/notice/news` | 공지사항 목록 (DB 조회) | ✅ |
| `/notice/news/[id]` | 공지사항 상세 (이미지, 첨부파일) | ✅ |
| `/community/parent-consultation` | 학부모 상담 | 🔲 placeholder |
| `/community/franchise-inquiry` | 가맹 문의 | 🔲 placeholder |
| `/community/campus` | 캠퍼스 | 🔲 placeholder |
| `/experience/special-day` | Special Day | 🔲 placeholder |
| `/experience/e-school` | E-School | 🔲 placeholder |
| `/experience/library` | Library | 🔲 placeholder |
| `/experience/links` | Links (외부 링크 모음) | ✅ |

**레이아웃:** Navigation(고정 상단 + 메가 메뉴) + SideBar(데스크탑: fixed right / 모바일: FAB) + Footer
**라우팅 중앙 관리:** `lib/menu-routes.ts` — `getMenuItemHref()`, `getDefaultMenuItemHref()` 등

### 3-2. (admin) — 관리자 대시보드

**보호:** `admin/layout.tsx`에서 2단계 인증 (Supabase 세션 + `profiles.role === "admin"`)

| 경로 | 기능 |
|------|------|
| `/admin` | 대시보드 — 통계 5종 (학생 수, 교사 수, 반 수, 오늘 공지, 버스 현황) + 네비 카드 |
| `/admin/students` | 학생 CRUD, 검색, 7개 탭 (정보/학습기록/리포트카드/교재/시간표/출결/승하차), 휴지통 |
| `/admin/teachers` | 교사 CRUD, 검색, 3개 탭 (정보/담당반목록/시간표), 삭제 경고 모달, 휴지통 |
| `/admin/classes` | 반 CRUD, 담당 교사 배정(최대 2명), 학생 등록/제거, 교재 배정, 색상 선택 |
| `/admin/textbooks` | 교재 CRUD, 커버 이미지 Storage, 반/학생 배정, 진도 관리, 일괄 업데이트, soft delete |
| `/admin/notices` | 공개 공지 CRUD, 이미지/파일 다중 첨부(Storage), 고정/게시 관리 |
| `/admin/academy-notices` | Academy 포털 공지 CRUD, 첨부파일(Storage) |
| `/admin/timetable` | 그룹별 시간표 그리드 (유치부/오후반/방과후), 교시 CRUD, 학생 개인 시간표 |
| `/admin/bus` | 호차 CRUD, 일일 매니페스트, 정류장 관리, 학생 배정, 변경요청 승인/거부 |

### 3-3. (academy) — 학생·교사 포털

**보호:** 각 layout.tsx에서 역할 확인 (student/teacher)

#### 학생 포털 (6개 탭)

| 경로 | 기능 |
|------|------|
| `/academy/student` | 프로필, 소속 반, 담당 교사 조회 |
| `/academy/student/reports` | 리포트카드 년/월별 조회 + 학생 답변 작성 |
| `/academy/student/textbooks` | 본인 교재 목록 및 진도 조회 (진행 중/완료 분리) |
| `/academy/student/notices` | 반별 공지 + Academy 공지 통합 조회 |
| `/academy/student/homework` | 숙제 목록, 텍스트/AudioRecorder 녹음 제출 |
| `/academy/student/bus` | 기본 배정 조회, 변경 요청 생성/취소 |

#### 교사 포털

| 경로 | 한국인 교사 | 원어민 교사 |
|------|------------|------------|
| `/academy/teacher` | 담당 반 목록 | My Classes |
| `/academy/teacher/timetable` | 시간표 (읽기 전용) | Timetable (읽기 전용) |
| `/academy/teacher/reports` | redirect → (미제공) | 리포트카드 작성 (영어 UI) |
| `/academy/teacher/textbooks` | 반별 교재 현황 + 진도 업데이트 | Textbooks |
| `/academy/teacher/notices` | 반별 공지 CRUD | redirect → (미제공) |
| `/academy/teacher/classes` | 반 정보 조회 (읽기 전용) | redirect → (미제공) |
| `/academy/teacher/attendance` | 출결 기록 | Attendance |
| `/academy/teacher/homework` | 숙제 출제, 제출 현황, 피드백 | Homework |
| `/academy/teacher/bus` | 담당 반 승하차 현황 | redirect → (미제공) |

### 3-4. (bus) — 버스 직원 PWA

실시간 탑승/하차 체크. Supabase Realtime 구독으로 다른 기기와 상태 동기화.
참고: `docs/bus-realtime.md`

### 3-5. (monitor) — 버스 실시간 디스플레이

TV 모니터 전용. 인증 없이 접근 가능. Realtime으로 탑승 상태 실시간 반영.

---

## 4. Server Actions 전체 목록

### 4-1. admin/actions/ (16개 파일)

#### user-actions.ts — 사용자 관리 (12개)

| 함수 | 인증 | 설명 |
|------|------|------|
| `createStudent(formData)` | verifyAdmin | 학생 계정 생성 (email_confirm: true) |
| `createTeacher(formData)` | verifyAdmin | 교사 계정 생성 (teacher_type: korean/native) |
| `listUsersByRole(role)` | verifyAdmin | 역할별 사용자 목록 (profiles + auth + students/teachers 조인) |
| `deleteUserById(formData)` | verifyAdmin | 소프트 삭제: class_teachers 정리 → profiles.deleted_at + Auth ban |
| `restoreUser(userId)` | verifyAdmin | 삭제된 사용자 복구 (deleted_at 해제 + Auth unban) |
| `permanentlyDeleteUser(userId)` | verifyAdmin | 영구 삭제 (Auth 사용자 삭제) |
| `listDeletedUsers(role)` | verifyAdmin | 삭제된 사용자 목록 (휴지통용) |
| `updateStudentProfile(formData)` | verifyAdmin | 학생 이름 수정 (profiles + students 테이블) |
| `updateTeacherProfile(formData)` | verifyAdmin | 교사 이름/유형 수정 |
| `resetUserPassword(userId, newPassword)` | verifyAdmin | 비밀번호 초기화 |
| `listAllStudents()` | verifyAdmin | 전체 학생 목록 (소프트 삭제 제외) |
| `getTeacherAssignmentCounts(userId)` | verifyAdmin | 교사 담당 반 수 + 수업 배정 수 (삭제 전 경고용) |

#### report-actions.ts — 리포트카드 (4개)

| 함수 | 인증 | 설명 |
|------|------|------|
| `getReportCard(studentProfileId, year, month)` | 커스텀 | 리포트카드 조회 (RLS) |
| `listReportCardsByStudent(studentProfileId)` | 커스텀 | 학생별 리포트카드 목록 |
| `upsertReportCard(studentProfileId, year, month, content)` | 커스텀 | 리포트카드 작성/수정 (교사/관리자만) |
| `updateReportCardReply(reportCardId, reply)` | 커스텀 | 학생 답변 작성 (본인만) |

#### class-actions.ts — 반 관리 (11개)

| 함수 | 인증 | 설명 |
|------|------|------|
| `listClassesWithDetails()` | verifyAdmin | 전체 반 목록 (교사명, 학생 수, color_index 포함) |
| `getClassWithStudents(classId)` | verifyAdmin | 반 상세 + 학생 목록 |
| `getStudentClasses(studentProfileId)` | verifyAdmin | 학생 소속 반 목록 |
| `getAllClassStudentsFlat()` | verifyAdmin | 전체 반-학생 매핑 (flat) |
| `createClass(name, teacherProfileIds[], colorIndex?)` | verifyAdmin | 반 생성 (교사 최대 2명) |
| `updateClass(classId, name, teacherProfileIds[], colorIndex?)` | verifyAdmin | 반 수정 |
| `deleteClass(classId)` | verifyAdmin | 반 삭제 |
| `addStudentToClass(classId, studentProfileId)` | verifyAdmin | 학생 등록 |
| `removeStudentFromClass(classStudentId)` | verifyAdmin | 학생 제거 |
| `listTeachersForSelect()` | verifyAdmin | 교사 목록 (소프트 삭제 제외) |
| `listStudentsNotInClass(classId)` | verifyAdmin | 반에 미등록 학생 목록 |

#### dashboard-actions.ts (1개)

- `getDashboardStats()` — 대시보드 통계 5종 (삭제된 사용자 제외)

#### schedule-actions.ts — 시간표 (8개)

- `getGroupTimetableGrid(groupLabel)` / `addSingleClassSchedule(...)` / `listClassSchedules(classId)` / `addClassScheduleBatch(schedules[])` / `deleteClassSchedule(scheduleId)` / `getStudentTimetable(studentProfileId)` / `getStudentTimetableEditable(studentProfileId)` / `deleteStudentSchedule(scheduleId)`
- `GroupTimetableData` 타입은 이 파일에서 직접 export (크로스 라우트 그룹 경로 우회)

#### timetable-actions.ts — 교시 관리 (4개)

- `listAcademyPeriods()` / `createAcademyPeriod(...)` / `updateAcademyPeriod(...)` / `deleteAcademyPeriod(periodId)`

#### textbook-actions.ts — 교재 관리 (20개)

- 교재 CRUD (soft delete), Storage 커버 이미지 관리
- 반/학생 교재 배정, 진도 관리, 일괄 업데이트

#### notice-actions.ts — 공개 공지사항 (5개)

- `listNotices(includeUnpublished?)` / `getNoticeWithAttachments(id)` / `createNotice(formData)` / `updateNotice(formData)` / `deleteNotice(id)`
- Storage 처리는 `lib/supabase/notice-crud-helpers.ts` 공통 헬퍼 사용

#### class-notice-actions.ts — 반별 공지 (6개)

- `listClassNotices(classId)` / `getClassNoticeWithAttachments(noticeId)` / `createClassNotice(formData)` / `updateClassNotice(formData)` / `deleteClassNotice(noticeId)` / `getMyClassNotices(studentProfileId)`
- 공통 헬퍼 사용

#### academy-notice-actions.ts — Academy 포털 공지 (5개)

- `listAcademyNotices()` / `getAcademyNoticeWithAttachments(id)` / `createAcademyNotice(formData)` / `updateAcademyNotice(formData)` / `deleteAcademyNotice(id)`
- 공통 헬퍼 사용

#### homework-actions.ts — 숙제 시스템 (9개)

- 숙제 출제 CRUD (4개) + 제출 현황 + 학생 숙제 목록 + 학생 제출 + 교사 피드백 + 파일 signed URL

#### learning-actions.ts — 학습 기록 (4개)

- `listLearningRecords` / `createLearningRecord` / `updateLearningRecord` / `deleteLearningRecord`
- 모든 함수: `verifyAuthenticated` 적용

#### attendance-actions.ts — 출결 (5개)

- `listAttendanceRecords` / `recordAttendance` / `deleteAttendance` / `getAttendanceStats` / `getClassAttendanceByDate`
- `recordAttendance()`: DB 트리거(`after_attendance_bus_sync`)가 버스 연동 자동 처리

#### bus-actions.ts — 승하차 관리 (~47개)

- 호차/시간대/정류장 CRUD
- 학생 기본 배정 (getStudentBusDefaults / upsertStudentBusDefault / deleteStudentBusDefault / getBulkBusDefaults)
- 일일 매니페스트: `getDailyBusManifest(date, direction)` → `{ groups, noRides, afterschoolStudents }`
- 실시간 탑승/하차: boardBusStudent / unboardBusStudent / checkBusStudent / uncheckBusStudent
- 변경요청: listPendingChangeRequests / approveChangeRequest / rejectChangeRequest
- 학생 변경요청: getStudentChangeRequests / submitBusChangeRequest / cancelBusChangeRequest
- 관리자 당일 변경: createAdminBusChange / updateAdminBusChange / deleteAdminBusChange / getExistingBusChange
- 버스 담당자: listBusStaff / upsertBusStaff / deleteBusStaff

#### afterschool-actions.ts — 방과후 관리 (6개)

- `getOrCreateAfterschoolClass(dayOfWeek)` / `getAfterschoolEnrollments(groupLabel?)` / `enrollStudent(...)` / `removeAfterschoolStudent(enrollmentId)` / `listAvailableStudents(classId, dayOfWeek)` / `bulkUpdateEnrollmentDays(...)`

#### auth-helpers.ts (내부 전용, barrel re-export 제외)

- `verifyAdmin()` — 관리자 전용 작업 (사용자 CRUD, 반 CRUD, 공지, 교재, 시간표, 버스 관리)
- `verifyAuthenticated()` — 교사·학생 공용 작업 (출결, 숙제, 교재 진도, 버스 변경요청)

### 4-2. academy/actions.ts (7개)

- `getCurrentStudentProfile()` — 로그인 학생 프로필 조회
- `getCurrentStudentClasses()` — 학생 소속 반 + 담당 교사 조회
- `getCurrentTeacherProfile()` — 로그인 교사 프로필 조회
- `getTeacherClasses()` — 교사 담당 반 + 학생 목록
- `getClassReportStatus(classId, year, month)` — 반별 리포트카드 작성 현황
- `getClassTextbooks(classId)` — 반 교재 목록 (인증 검증 포함)
- `getCurrentStudentTextbooks()` — 학생 교재 진도 조회

---

## 5. DB 스키마 & 테이블 관계

### 5-1. 전체 테이블 구조

```
Supabase Auth Users
    │
    ├── profiles (id=auth.uid, role: "admin"|"student"|"teacher",
    │            first_name, last_name, deleted_at TIMESTAMPTZ)
    │   ├── students (profile_id FK, korean_name, english_name, age INT,
    │   │            student_number [auto], birthday)
    │   └── teachers (profile_id FK, name, teacher_number [auto],
    │                 teacher_type ENUM: "korean"|"native")
    │
    ├── classes (id, name, group_label: "유치부"|"오후반"|"방과후",
    │            color_index: INTEGER NULL)
    │   ├── class_teachers (class_id FK, teacher_profile_id FK) [최대 2명]
    │   ├── class_students (class_id FK, student_profile_id FK)
    │   └── class_schedules (class_id XOR student_profile_id, period_id FK,
    │       day, teacher_profile_id FK, label, textbook_id FK→textbooks ON DELETE SET NULL)
    │       CHECK: class_id IS NOT NULL XOR student_profile_id IS NOT NULL
    │
    ├── academy_periods (name, start_time, end_time, group_label,
    │                    has_pickup, has_dropoff, is_active)
    │
    ├── report_cards (student_profile_id FK, author_id FK, year, month,
    │                 content, reply)
    │   └── UNIQUE (student_profile_id, year, month)
    │
    ├── textbooks (id, title, series, level, category, total_units,
    │              cover_image, is_active)
    │   ├── class_textbooks (class_id FK, textbook_id FK)
    │   └── student_textbook_progress (student_profile_id FK, textbook_id FK,
    │       source_type, source_class_id, status, completed_units)
    │
    ├── notices + notice_attachments (공개 공지)
    ├── class_notices + class_notice_attachments (반별 공지)
    ├── academy_notices + academy_notice_attachments (포털 공지)
    │
    ├── homework_assignments (class_id, teacher_id, title, description, due_date)
    │   └── homework_submissions (assignment_id, student_profile_id,
    │       status, text_content, teacher_feedback)
    │       └── homework_submission_files (submission_id, storage_path,
    │           original_filename, mime_type)
    │
    ├── learning_records (student_profile_id, category, title, content,
    │                     score, max_score, record_date)
    ├── attendance (student_profile_id, class_id, date, status, note)
    │   └── TRIGGER: after_attendance_bus_sync → bus_change_requests 자동 연동
    │
    ├── bus_numbers (label, is_active)
    ├── bus_stops (bus_number_id FK, name, sort_order, is_active)
    ├── bus_time_slots (...)
    ├── student_bus_defaults (student_profile_id, day, direction,
    │                          period_id, bus_number_id, bus_stop_id FK→bus_stops)
    ├── bus_change_requests (student_profile_id, date, direction,
    │                         change_type, status, created_by)
    ├── bus_stop_day_assignments (bus_stop_id FK, day_of_week, direction NOT NULL)
    └── bus_staff (profile_id FK, name, role)
```

### 5-2. 핵심 FK 관계 요약

- `profiles` → `students` / `teachers` (1:1, Auth 트리거로 자동 생성)
- `classes` ← `class_teachers` → `profiles` (M:N, 최대 2명)
- `classes` ← `class_students` → `profiles` (M:N)
- `classes` ← `class_schedules` / `profiles` ← `class_schedules` (XOR)
- `textbooks` ← `class_textbooks` → `classes` (M:N)
- `textbooks` ← `student_textbook_progress` → `profiles` (M:N)
- `homework_assignments` → `classes` / `homework_submissions` → `homework_assignments`
- `bus_stops` → `bus_numbers` / `student_bus_defaults` → `bus_stops`

### 5-3. DB 트리거

| 트리거 | 테이블 | 동작 |
|--------|--------|------|
| `after_attendance_bus_sync` | `attendance` | 출결 상태 변경 시 `bus_change_requests` 자동 생성/삭제 |
| 프로필 자동 생성 트리거 | `auth.users` | 가입 시 `profiles` + `students`/`teachers` 레코드 자동 생성 |
| student_number/teacher_number | `students`/`teachers` | INSERT 시 고유 번호 자동 생성 |

### 5-4. Supabase Storage (5개 버킷)

| 버킷 | 공개여부 | 용도 |
|------|---------|------|
| `textbook-covers` | Public | 교재 커버 이미지 (JPG, PNG, WebP / 10MB 이하) |
| `notice-files` | Public | 공개 공지 이미지(images/) + 첨부파일(files/) |
| `class-notices` | Public | 반별 공지 첨부파일 |
| `academy-notices` | Public | Academy 포털 공지 첨부파일 |
| `homework-submissions` | **Private** | 숙제 제출 파일 (signed URL 1시간) |

---

## 6. 공유 유틸 & 라이브러리

### 6-1. lib/types/ — 타입 분리 구조 (P3-17 이후)

**database.ts — DB Row 타입** (테이블 컬럼과 1:1 대응):
- `BusNumber`, `BusStop`, `BusTimeSlot`, `BusStopDayAssignment` (direction: NOT NULL)
- `Textbook`, `ClassSchedule`, `AcademyPeriod`
- `ClassWithDetails` (color_index: number | null 포함)
- `BusStopDayAssignment` (direction: "pickup" | "dropoff", NOT NULL)

**api.ts — API 응답 타입** (조인·집계 결과):
- `BusManifestEntry`, `DropoffExportData`, `StudentBusInfo`
- `ReportCardWithAuthor`, `HomeworkWithSubmission`
- 서버 액션 반환 타입들

**index.ts** — 두 파일 barrel re-export

### 6-2. lib/supabase/ — Supabase 클라이언트 & 헬퍼

| 파일 | 역할 |
|------|------|
| `client.ts` | Browser Client (로그인 등 클라이언트 사이드) |
| `server.ts` | Server Client (RLS 적용, Server Actions 인증 검증) |
| `admin.ts` | Admin Client (service role, RLS 우회, 사용자 생성/삭제) |
| `storage.ts` | `STORAGE_BUCKETS` 상수, `generateStoragePath()`, `extractStoragePath()`, `validateFile()` |
| `notice-crud-helpers.ts` | 공지사항 3종 공통 CRUD 패턴 (P2-11 통합) |

### 6-3. 전용 유틸 파일

| 파일 | 역할 |
|------|------|
| `lib/menu-routes.ts` | (site) 라우트 중앙 설정, `getMenuItemHref()` 등 |
| `lib/auth-utils.ts` | `normalizeEmail()` (도메인 자동 추가), `getAuthErrorMessage()` |
| `lib/teacher-labels.ts` | 교사 포털 한국어/영어 라벨 맵 (9개 세트: dashboard/report/textbook/batchUpdate/notice/homework/attendance/timetable/bus) |
| `lib/student-age-colors.ts` | `getAgeColor(age)` → `{ bg, text, border }` (5세=pink, 6세=sky, 7세=emerald, 기타=slate) |
| `lib/class-colors.ts` | `CLASS_COLOR_PALETTE` (8색), `getClassColor(colorIndex, fallbackIndex)` |

### 6-4. 공유 컴포넌트 (components/)

- `LogoutButton` — admin + academy 공통 (labels prop으로 영어 지원)
- `AudioRecorder` — 오디오 녹음 (숙제 제출용)
- `FileUpload` / `FileList` — 파일 업로드/목록
- `ui/` — shadcn/ui 9종

---

## 7. 핵심 아키텍처 패턴

### 7-1. 인증 흐름

```
1. 로그인: LoginForm → supabase.auth.signInWithPassword()
2. 세션 유지: proxy.ts → 모든 요청에서 auth.getUser() 세션 갱신 (Next.js 16)
3. Admin 보호: admin/layout.tsx → 세션 확인 + profiles.role === "admin"
4. Academy 보호: student(또는 teacher)/layout.tsx → 역할 확인
5. Dashboard: 역할에 따라 자동 리다이렉트
```

**Server Action 내부 패턴:**
```typescript
// 1. Server Client로 인증 사용자 확인
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) return { error: "인증이 필요합니다." };

// 2. (필요 시) 소유권/권한 확인
if (authorId !== user.id) return { error: "권한이 없습니다." };

// 3. Admin Client로 RLS 우회 데이터 조작
const admin = createAdminClient();
```

**인증 헬퍼 (`actions/auth-helpers.ts`):**
- `verifyAdmin()` — 관리자 전용, 80+ 개 함수에 적용
- `verifyAuthenticated()` — 교사·학생 공용, 학습기록 등에 적용

### 7-2. DB 트리거 — 출결↔버스 자동 연동 (P3-16)

```
attendance INSERT/UPDATE
    └─ TRIGGER: after_attendance_bus_sync (AFTER INSERT OR UPDATE)
        ├─ [status = "absent"] → bus_change_requests에 pickup/dropoff 2건 자동 upsert (approved)
        └─ [status ≠ "absent"] → 자동 생성된 bus_change_requests 자동 삭제
```

- `recordAttendance()` 함수는 버스 테이블을 직접 건드리지 않음 — DB 트리거가 담당
- 다른 경로로 attendance 변경 시에도 연동 보장

### 7-3. TeacherTypeContext — 교사 타입 전달 패턴 (P2-15)

```
teacher/layout.tsx
    └─ DB 조회 (teacher_type) 1회
    └─ <TeacherTypeProvider teacherType={...}>
           └─ 하위 클라이언트 컴포넌트에서 useTeacherType() 훅으로 접근
              (prop drilling 없음, DB 중복 조회 없음)
```

### 7-4. notice-crud-helpers — 공지사항 3종 공통 CRUD (P2-11)

```
lib/supabase/notice-crud-helpers.ts
    ├─ 공통 Storage 업로드/삭제 헬퍼
    ├─ 공통 create/update/delete 흐름 (첨부파일 처리 포함)
    └─ 3개 공지 Action 파일이 각자 인라인 구현 → 공통 헬퍼 사용으로 통합
```

### 7-5. 타입 분리 — database.ts vs api.ts (P3-17)

```
lib/types/
    ├── database.ts  — DB Row 타입 (테이블 컬럼 1:1 대응)
    │                  DB 스키마 변경 시 이 파일만 수정
    └── api.ts       — API 응답 타입 (조인·집계 결과)
                       서버 액션 반환 구조 변경 시 이 파일만 수정
```

### 7-6. 반 색상 — colorIndex 패턴 (P3-20)

```
classes.color_index: INTEGER NULL
    ├── NULL → 자동 배정 (배열 인덱스 순서)
    └── 숫자 → 관리자 지정 색상

getClassColor(colorIndex: number | null, fallbackIndex: number)
    └── colorIndex ?? fallbackIndex → CLASS_COLOR_PALETTE[idx % 8]
```

---

## 8. 코딩 컨벤션

### 8-1. 데이터 표시 규칙

| 규칙 | 적용 범위 |
|------|----------|
| **학생 명단 정렬: 나이순 → 이름순** | 배지, 행 목록, 드래그 리스트 등 모든 학생 명단 |
| **학생 이름: `getAgeColor(age)` 적용 필수** | 모든 학생 이름 표시 위치 |
| **관리자 UI: 아이디만 표시** | 교번·학번·이메일 숨김, `email.split("@")[0]` |

### 8-2. Tailwind 사용 규칙

- **완전한 클래스명 리터럴** 사용 필수 (동적 concat 금지)
  ```typescript
  // ❌ 금지
  `bg-${color}-100`
  // ✅ 올바름
  "bg-blue-100"
  ```
- `TEACHER_COLOR_PALETTE` — `-200` 계열 (교사별 색상)
- `CLASS_COLOR_PALETTE` — `-100` 계열 (`lib/class-colors.ts`)

### 8-3. Server Actions 컨벤션

```typescript
// 모든 Server Action 반환 형식
return { error?: string }
// 또는
return { error?: string; id?: string }
```

### 8-4. 원어민 교사 영어 UI

```typescript
// lib/teacher-labels.ts의 9개 라벨 세트 사용
const labels = TEACHER_LABELS[teacherType];   // "korean" | "native"
// dashboard, report, textbook, batchUpdate, notice, homework, attendance, timetable, bus
```

### 8-5. 소프트 삭제 패턴

| 대상 | 방식 |
|------|------|
| 사용자 (학생/교사) | `profiles.deleted_at` 설정 + Supabase Auth ban |
| 교재 | `textbooks.is_active = false` |
| 공지사항 | hard delete (Storage 파일 먼저 삭제 → DB CASCADE) |

### 8-6. 데이터 갱신 패턴

```typescript
// mutation 후 Server Component 데이터 갱신
router.refresh();
```

---

## 9. 최근 작업 이력 (2026-03-16)

세션 1, 2 합산 총 7건의 리팩토링·기능·버그 예방 작업 완료.

### P0-3 — direction NOT NULL 제약 추가

`bus_stop_day_assignments.direction` 컬럼 NOT NULL 제약 추가.
DB 레벨에서 null 삽입 차단, TypeScript 타입 동기화.

### P1-9 — 공지사항 Storage 헬퍼 공통화

`notice-actions.ts`의 인라인 Storage 헬퍼를 `lib/supabase/storage.ts` 공통 유틸로 교체.
3개 공지 액션 파일 모두 동일한 패턴 사용.

### P2-11 — 공지사항 3개 Action 파일 공통 헬퍼 통합

`notice-crud-helpers.ts` 신규 생성.
공지사항 create/update/delete 공통 흐름 추출 — 3개 파일 중복 제거.

### P2-15 — 원어민 교사 UI Context Provider 도입

`TeacherTypeContext.tsx` 신규 생성 (`useTeacherType()` 훅).
teacher_type DB 조회 경로 단일화, prop drilling 제거.

### P3-16 — 출결↔버스 연동 로직 DB 트리거 이전

`after_attendance_bus_sync` DB 트리거 생성.
`recordAttendance()` 함수에서 버스 테이블 직접 조작 코드 제거.

### P3-17 — lib/types 분리 (database.ts + api.ts)

`lib/types/database.ts` 680줄 → `database.ts` (DB Row) + `api.ts` (API 응답) 분리.
타입별 수정 영향 범위 명확화.

### P3-20 — 반 색상 직접 지정 UI

`classes.color_index` 컬럼 추가 + `lib/class-colors.ts` 공통 팔레트.
관리자가 색상 스와치로 반 색상 직접 지정 가능.

---

## 10. 초기 데이터 참고

| 항목 | 내용 |
|------|------|
| 유치부 반 | 6개 |
| 오후반 | 19개 |
| Native 교사 | 10명 (`{이름}@scwonderland.com` / Wonder0225!) |

---

## 11. 환경 변수

```
NEXT_PUBLIC_SUPABASE_URL          # Supabase 프로젝트 URL
NEXT_PUBLIC_SUPABASE_ANON_KEY     # Supabase 공개 키
SUPABASE_SERVICE_ROLE_KEY         # 서버 전용 관리 키 (절대 클라이언트 노출 금지)
NEXT_PUBLIC_EMAIL_DOMAIN          # 이메일 도메인 (기본값: "scwonderland.com")
```

---

*이 문서는 2026-03-16 기준 프로젝트 전체 상태를 반영합니다.*
