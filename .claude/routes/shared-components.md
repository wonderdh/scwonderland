# 공용 컴포넌트

## Admin 컴포넌트 (`src/app/(admin)/admin/components/`)

| 파일 | 역할 | 사용처 |
|------|------|--------|
| `AdminLayoutClient.tsx` | 관리자 레이아웃 클라이언트. AdminSidebar + main 영역 flex 구성. adminId를 받아 사이드바에 전달 | `src/app/(admin)/admin/layout.tsx` |
| `AdminSidebar.tsx` | 관리자 좌측 사이드바(w-44). 10개 네비 아이템(대시보드, 학생, 선생, 반, 방과후, 교재, 공지사항, Academy 공지, 시간표, 승하차) + 사이트로 이동/로그아웃. pathname 기반 활성 메뉴 하이라이트 | `AdminLayoutClient.tsx` |
| `AdminListSidebar.tsx` | 학생/선생 목록 사이드바(w-52). 검색, 그룹 필터(전체/유치부/오후반, 학생만), 휴지통 링크, 선택 하이라이트. 학생은 그룹별 컬러 도트(유치부=amber, 오후반=sky), 아이디(email@앞부분)만 표시 | 학생/선생 관리 페이지 |
| `ScrollToSection.tsx` | URL 파라미터 `section=add` 감지 시 해당 요소로 스크롤. useEffect 기반 | 학생/선생 추가 폼 |
| `TrashView.tsx` | 휴지통 뷰. 삭제된 사용자 테이블(이름, 학번/교번, 아이디) + 복구/영구삭제 버튼. `onRestore`/`onPermanentDelete` 콜백. 작업 중 pending 상태 관리, toast 알림 | 학생/선생 관리 `?section=trash` |
| `UserList.tsx` | 사용자 목록 래퍼. UserRow 반복 렌더링 | 학생/선생 관리 |
| `UserRow.tsx` | 사용자 행. 이름/아이디 표시 + 수정(인라인 폼)/삭제 버튼. 학생: korean_name + english_name, 교사: name + teacher_type(한국인/원어민 배지). 수정 시 FormData로 onUpdate 콜백 | `UserList.tsx` |

## Site 레이아웃 컴포넌트 (`src/app/(site)/_components/layout/`)

| 파일 | 역할 | 사용처 |
|------|------|--------|
| `Navigation.tsx` | 상단 고정 네비게이션(z-50). 5개 메뉴 + 메가메뉴 드롭다운 + 모바일 햄버거. `menu-routes.ts` 활용. 데스크톱: 6열 그리드(로고+5메뉴), 모바일: 로고+햄버거 | `src/app/(site)/layout.tsx` |
| `Footer.tsx` | 하단 푸터. 저작권 표시 (`2026 원더랜드 영어학원`) | `src/app/(site)/layout.tsx` |
| `SubNav.tsx` | 카테고리 하위 네비게이션. menuId별 아이템 목록 표시, currentSlug 기반 활성 탭(green-600 밑줄) | 모든 카테고리 layout.tsx |
| `CategoryLayout.tsx` | 카테고리 레이아웃. pathname에서 slug 추출 -> SubNav 렌더링 | 모든 카테고리 layout.tsx |
| `CategoryPageWrapper.tsx` | 카테고리 공통 래퍼. `min-h-screen bg-white pt-24` | 모든 카테고리 layout.tsx |

## Site 섹션 컴포넌트 (`src/app/(site)/_components/sections/`)

| 파일 | 역할 | 사용처 |
|------|------|--------|
| `Hero.tsx` | 홈 히어로. "왜 원더랜드일까요?" + 상담 신청 CTA + 3장 이미지 그리드 | 홈페이지 |
| `MainProgram.tsx` | 프로그램 소개. 5개 프로그램 카드(MAP, Wonderland, Wonder K, Primo School, Quest Academy). CSS Module | 홈페이지 |
| `PageContent.tsx` | 범용 콘텐츠 래퍼. title + prose 스타일 children | 여러 카테고리 하위 페이지 |
| `SideBar.tsx` | 우측 퀵링크 사이드바. 6개 링크(학원 전용, 리포트카드, 레벨테스트, Circle Time, Children's Music, Creativity). PC: 우측 고정, 모바일: 플로팅 버튼+패널 | `src/app/(site)/layout.tsx` |

## Site 공통 컴포넌트 (`src/app/(site)/_components/common/`)

| 파일 | 역할 | 사용처 |
|------|------|--------|
| `ImageWithFallback.tsx` | Next.js Image 래퍼. 로딩 에러 시 SVG 플레이스홀더 표시. `onError`로 에러 감지, `data-original-url` 보존 | Hero 이미지 |
