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

**공유 (admin/components/):** `AdminLayoutClient`, `AdminSidebar`, `AdminListSidebar`, `UserRow`, `UserList`, `ScrollToSection`

**학생 전용 (admin/students/components/):** `AddStudentForm`, `StudentSelectedView`, `StudentTabNav`, `StudentReportTab`, `StudentLearningTab`, `StudentTextbookTab`, `StudentComingTab`, `ReportCardReadView`

**교사 전용 (admin/teachers/components/):** `AddTeacherForm`, `TeacherInfoCard`, `TeacherTabNav`, `TeacherClassesTab`

**반 관리 (admin/classes/components/):** `ClassesManager`

**교재 관리 (admin/textbooks/components/):** `TextbooksManager` (카드 150px 고정폭, 커버 이미지 150x170px, hover 시 수정/삭제 버튼)

**공지사항 관리 (admin/notices/components/):** `NoticesManager` (검색/필터, 목록 뷰, 폼 모달: 이미지 다중 업로드+미리보기, 파일 다중 첨부, 삭제 확인 모달)

## Shared Components (components/)

| 컴포넌트 | 역할 |
|---------|------|
| `LogoutButton` | 로그아웃 + 리다이렉트 (admin + academy 공유) |
| `ui/` | shadcn/ui 컴포넌트 (button, card, input 등) |

## Academy Components (app/(academy)/academy/)

| 컴포넌트 | 위치 | 역할 |
|---------|------|------|
| `LoginForm` | `login/` | 이메일/비밀번호 로그인 (에러 코드별 한국어 메시지) |
| `StudentNav` | `student/components/` | 학생 포털 탭 (내 정보/리포트카드/교재/숙제) |
| `ReportCardReplyForm` | `student/components/` | 학생 리포트카드 답변 작성 폼 |
| `TeacherNav` | `teacher/components/` | 교사 포털 탭 (대시보드/리포트카드/교재) |
| `TeacherReportClient` | `teacher/components/` | 교사 리포트카드 작성/관리 |
| `TeacherTextbookClient` | `teacher/components/` | 교사 반별 교재 현황 조회 |
