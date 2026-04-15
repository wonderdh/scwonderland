---
paths:
  - "app/**/*.tsx"
  - "components/**/*"
---

# Components

## Site Components (app/(site)/_components/)

| 컴포넌트 | 위치 | 역할 |
|---------|------|------|
| `Navigation` | `_components/layout/` | 고정 상단 네비게이션 + 메가 메뉴 (hover) + 모바일 햄버거 |
| `SubNav` | `_components/layout/` | 카테고리 내 탭 네비게이션, 활성 탭 green-600 하이라이트 |
| `CategoryLayout` | `_components/layout/` | 섹션별 SubNav 래퍼 |
| `CategoryPageWrapper` | `_components/layout/` | 콘텐츠 래퍼 (pt-24 for fixed nav) |
| `Footer` | `_components/layout/` | 하단 저작권 (bg-gray-900) |
| `SideBar` | `_components/sections/` | 빠른 링크 6개 (desktop: fixed right, mobile: FAB + overlay) |
| `Hero` | `_components/sections/` | 랜딩 히어로 (제목 + CTA + 이미지 그리드) |
| `MainProgram` | `_components/sections/` | 랜딩 프로그램 카드 5개 (hover 슬라이드 애니메이션) |
| `ImageWithFallback` | `_components/common/` | 이미지 에러 시 SVG fallback |
| `WeeklySentencePopup` | `_components/sections/` | 주간 문장 팝업 (3레벨 기초·중급·상급 카드, 1.2초 딜레이, 오늘 하루 보지 않기) |

## Admin Components

**공유 (admin/components/):** `AdminLayoutClient`, `AdminSidebar`, `AdminMobileHeader`, `AdminListSidebar`, `UserRow`, `UserList`, `ScrollToSection`, `TrashView`

- `AdminSidebar` — 5 그룹(대시보드/사람/수업/일일운영/공지)으로 그룹화
- `AdminMobileHeader` — lg:hidden 햄버거 + Sheet 조합 (모바일 네비)

**학생 전용 (admin/students/components/):** `AddStudentForm`, `StudentSelectedView`, `StudentTabNav`, `StudentReportTab`, `StudentLearningTab`, `StudentTextbookTab`, `ReportCardReadView` + 시간표/출결/승하차 탭 컴포넌트. 탭 4개 체계(기본정보/학습&리포트/시간표&출결/승하차, URL `?tab=basic|learning|schedule|bus`, legacy tab IDs backwards-compatible) — learning 탭에 학습·리포트·교재 통합, schedule 탭에 시간표·출결 통합

**교사 전용 (admin/teachers/components/):** `AddTeacherForm`, `TeacherInfoCard`, `TeacherTabNav`, `TeacherClassesTab`, `TeacherTimetableTab`

**Admin Hooks (admin/hooks/):** `useAsyncData<T>(fetcher, deps)` — 비동기 로딩 공통 훅 / `usePasswordReset(userId, email?)` — 비밀번호 초기화 UI 훅

**반 관리 (admin/classes/components/):** `ClassesManager`

**교재 관리 (admin/textbooks/components/):** `TextbooksManager` (카드 150px 고정폭, 커버 이미지 150x170px, hover 시 수정/삭제 버튼)

**공지사항 관리 (admin/notices/components/):** `NoticesManager` (검색/필터, 목록 뷰, 폼 모달: 이미지 다중 업로드+미리보기, 파일 다중 첨부, 삭제 확인 모달)

**Academy 공지 (admin/academy-notices/):** Academy 포털 공지 관리

**시간표 (admin/timetable/):** `GroupTimetableGrid`, `PeriodDayGrid`, 교시 관리

**승하차 (admin/bus/):** 4개 탭 구조(오늘운행/변경요청/배정관리/마스터) — today=overview+dashboard 통합, requests=AdminBusChangeDnD+BusChangeRequestsPanel 통합, assignment=학생+정류장 배정, master=호차·시간대·직원 접힘 카드. (AdminBusChangeDnD: MultiDatePicker 적용)

**주간 문장 (admin/weekly-sentences/):** `WeeklySentencesManager` (48주×3레벨 테이블, 셀 클릭 편집, 자동/수동 주차 전환, Excel 업로드, 기초 레벨은 Q&A answer 컬럼)

**예약 현황 (admin/reservations/):** `ReservationDashboard` (통계 카드 3종 + 캘린더 히트맵 + 출결/버스 예약 폼 + 목록 CRUD). 출결 예약 폼·버스 변경 폼에 `MultiDatePicker` 사용

## Shared Components (components/)

| 컴포넌트 | 역할 |
|---------|------|
| `LogoutButton` | 로그아웃 + 리다이렉트 (admin + academy 공유, labels prop으로 영어 지원) |
| `AudioRecorder` | 오디오 녹음 컴포넌트 (숙제 제출용) |
| `FileUpload` | 파일 업로드 컴포넌트 |
| `FileList` | 파일 목록 표시 컴포넌트 |
| `MultiDatePicker` | 다중 날짜 캘린더. 첫 클릭=앵커, 두 번째=범위 채움, 이후=개별 토글. 토·일 비활성. 출결/버스/예약에서 공유 |
| `PageHeader` | 각 admin 섹션 상단 헤더 (제목 + 설명) |
| `Breadcrumb` | admin 경로 표시 (Home > Section > Detail) |
| `FormGroup` | 라벨·도움말·에러를 포함한 폼 필드 wrapper |
| `StatusBadge` | 색·아이콘·라벨이 결합된 상태 뱃지 (StatusConfig 기반) |
| `LoadingState` | 스피너 + 컨텍스트 라벨 (`label` prop 필수) |
| `ConfirmDialog` | 삭제/민감 액션 확인 모달. `danger` 변형 + `impactList` 영향 범위 표시 지원 |
| `ui/` | shadcn/ui 컴포넌트 (avatar, badge, button, calendar, card, input, label, popover, separator, tabs, textarea, tooltip) |

## Academy Components (app/(academy)/academy/)

| 컴포넌트 | 위치 | 역할 |
|---------|------|------|
| `LoginForm` | `login/` | 이메일/비밀번호 로그인 (에러 코드별 한국어 메시지) |
| `StudentNav` | `student/components/` | 학생 포털 6탭 (내 정보/리포트카드/교재/공지/숙제/승하차) |
| `ReportCardReplyForm` | `student/components/` | 학생 리포트카드 답변 작성 폼 |
| `StudentTextbooksClient` | `student/textbooks/` | 학생 교재 카드 UI (진행 중/완료 분리, 커버 이미지, 진도 바) |
| `TeacherNav` | `teacher/components/` | 교사 포털 탭 (한국인 8탭 / 원어민 6탭 영어) |
| `TeacherReportClient` | `teacher/components/` | 교사 리포트카드 작성/관리 (teacherType별 라벨) |
| `TeacherTextbookClient` | `teacher/components/` | 교사 반별 교재 현황 조회 (teacherType별 라벨) |
| `TeacherAcademyTimetable` | `teacher/timetable/` | 교사 시간표 (모바일 친화적, CLASS_COLOR_PALETTE) |

## Admin Info Card 동작 규칙
- `TeacherInfoCard`: 아이디·이름만 표시, 교번·이메일 숨김, 커스텀 삭제 모달 (배정 건수 경고)
- `StudentInfoCard` (`StudentSelectedView`): 아이디·이름만 표시, 학번·이메일 숨김, 단순 확인 모달
- `UserRow` (목록탭): 아이디만 표시 (교번·학번 제거)
- `AdminListSidebar`: 이름 + 아이디만 표시 (학번·교번 제거)
