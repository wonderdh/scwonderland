# 홈페이지 (/)

## 라우트 경로
- URL: `/`
- 라우트 그룹: `(site)`

## 핵심 파일
- `src/app/(site)/layout.tsx` — Site 전체 레이아웃 (Navigation + SideBar + Footer)
- `src/app/(site)/page.tsx` — 홈 페이지 (Hero + MainProgram)

## 컴포넌트

| 파일 | 역할 |
|------|------|
| `src/app/(site)/_components/layout/Navigation.tsx` | 상단 고정 네비게이션. 5개 메뉴(About Wonderland, Program, Notice, Community, Experience) + 로고. 호버 시 메가메뉴 드롭다운, 모바일 햄버거 메뉴. `menu-routes.ts` 활용 |
| `src/app/(site)/_components/layout/Footer.tsx` | 하단 푸터. 저작권 표시 |
| `src/app/(site)/_components/sections/Hero.tsx` | 히어로 섹션. "왜 원더랜드일까요?" 타이틀 + 상담 신청 링크(`/community/parent-consultation`) + 3장 이미지 그리드. `ImageWithFallback` 사용 |
| `src/app/(site)/_components/sections/MainProgram.tsx` | 프로그램 섹션. MAP, Wonderland, Wonder K, Primo School, Quest Academy 5개 프로그램 카드. CSS Module(`MainProgram.module.css`) 스타일링 |
| `src/app/(site)/_components/sections/SideBar.tsx` | 우측 고정 퀵링크 사이드바. 6개 링크(학원 전용, 리포트카드, 레벨테스트, Circle Time, Children's Music, Creativity). PC: 우측 고정, 모바일: 플로팅 버튼 |

## Server Actions
- 없음 (정적 페이지)

## 데이터 흐름
1. `layout.tsx`: Navigation + SideBar + children + Footer 렌더링
2. `page.tsx`: Hero와 MainProgram 섹션 순서대로 표시
3. 모든 콘텐츠 정적, DB 조회 없음

## 의존성
- `src/lib/navigation/menu-routes.ts` — Navigation 메뉴 경로 매핑
- `src/app/(site)/_components/common/ImageWithFallback.tsx` — Hero 이미지 에러 핸들링

## 주의사항
- Navigation은 `"use client"` (pathname 기반 활성 메뉴 감지, 호버 상태 관리)
- SideBar도 `"use client"` (모바일 열기/닫기 상태)
- 네비게이션 `fixed top-0 z-50` 으로 고정, 콘텐츠는 `pt-24`로 오프셋
- SideBar 퀵링크 중 "학원 전용"만 내부 Link(`/academy/dashboard`), 나머지는 외부 링크
