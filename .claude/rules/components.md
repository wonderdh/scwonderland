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

## Admin Components

**공유 (admin/components/):** `AdminLayoutClient`, `AdminSidebar`, `AdminListSidebar`, `UserRow`, `UserList`, `ScrollToSection`, `TrashView`

**학생 전용 (admin/students/components/):** `AddStudentForm`, `StudentSelectedView`, `StudentTabNav`, `StudentReportTab`, `StudentLearningTab`, `StudentTextbookTab`, `ReportCardReadView` + 시간표/출결/승하차 탭 컴포넌트

**교사 전용 (admin/teachers/components/):** `AddTeacherForm`, `TeacherInfoCard`, `TeacherTabNav`, `TeacherClassesTab`, `TeacherTimetableTab`

**Admin Hooks (admin/hooks/):** `useAsyncData<T>(fetcher, deps)` — 비동기 로딩 공통 훅 / `usePasswordReset(userId, email?)` — 비밀번호 초기화 UI 훅

**반 관리 (admin/classes/components/):** `ClassesManager`

**교재 관리 (admin/textbooks/components/):** `TextbooksManager` (카드 150px 고정폭, 커버 이미지 150x170px, hover 시 수정/삭제 버튼)

**공지사항 관리 (admin/notices/components/):** `NoticesManager` (검색/필터, 목록 뷰, 폼 모달: 이미지 다중 업로드+미리보기, 파일 다중 첨부, 삭제 확인 모달)

**Academy 공지 (admin/academy-notices/):** Academy 포털 공지 관리

**시간표 (admin/timetable/):** `GroupTimetableGrid`, `PeriodDayGrid`, 교시 관리

**승하차 (admin/bus/):** 호차 관리, 대시보드, 변경요청 관리

## Shared Components (components/)

| 컴포넌트 | 역할 |
|---------|------|
| `LogoutButton` | 로그아웃 + 리다이렉트 (admin + academy 공유, labels prop으로 영어 지원) |
| `AudioRecorder` | 오디오 녹음 컴포넌트 (숙제 제출용) |
| `FileUpload` | 파일 업로드 컴포넌트 |
| `FileList` | 파일 목록 표시 컴포넌트 |
| `ui/` | shadcn/ui 컴포넌트 (avatar, badge, button, card, input, label, separator, tabs, textarea, tooltip) |

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
