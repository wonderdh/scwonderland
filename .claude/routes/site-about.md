# About Wonderland (/about-wonderland/*)

## 라우트 경로
- URL: `/about-wonderland/greeting`, `/about-wonderland/company-history`, `/about-wonderland/certification`, `/about-wonderland/wonderland`
- 라우트 그룹: `(site)`
- 메뉴 ID: `about`

## 핵심 파일
- `app/(site)/about-wonderland/layout.tsx` — CategoryPageWrapper + CategoryLayout(menuId="about") 래핑

## 컴포넌트

| 파일 | 역할 |
|------|------|
| `app/(site)/about-wonderland/greeting/page.tsx` | 인사말 페이지. 대표이사 인사말 텍스트 + 서명 이미지 + 학원 이미지. `next/image` 사용 |
| `app/(site)/about-wonderland/company-history/page.tsx` | 회사연혁 타임라인. 1993~2022년 연혁 데이터를 교차 배치 타임라인으로 표시. 색상(blue/orange/green) 코딩 |
| `app/(site)/about-wonderland/certification/page.tsx` | 대외기관 인증 페이지. `PageContent` 래퍼 사용, 콘텐츠 미완성 (플레이스홀더) |
| `app/(site)/about-wonderland/wonderland/page.tsx` | "Wonderland는 왜 다른가요?" 페이지. 3가지 교육 방법론(Whole Language, CLT, CBI) 소개. CSS Module 스타일링 |
| `app/(site)/_components/layout/SubNav.tsx` | 카테고리 하위 네비게이션. 현재 slug 기반 활성 탭 표시. `menu-routes.ts`에서 아이템 목록 조회 |
| `app/(site)/_components/layout/CategoryLayout.tsx` | 카테고리 레이아웃. pathname에서 currentSlug 추출 후 SubNav에 전달 |
| `app/(site)/_components/layout/CategoryPageWrapper.tsx` | 카테고리 공통 래퍼. `pt-24` (네비게이션 오프셋) + `min-h-screen` |
| `app/(site)/_components/sections/PageContent.tsx` | 범용 콘텐츠 래퍼. title + prose 스타일 children |

## Server Actions
- 없음 (정적 페이지)

## 데이터 흐름
1. `layout.tsx` -> `CategoryPageWrapper` -> `CategoryLayout(menuId="about")`
2. `CategoryLayout`이 pathname에서 slug 추출 -> `SubNav`에 전달
3. `SubNav`가 `getCategoryItemLabels("about")`로 메뉴 아이템 렌더링
4. 하위 page.tsx가 children으로 렌더링

## 의존성
- `lib/menu-routes.ts` — SubNav 메뉴 아이템/경로 매핑
- `PageContent` — certification 등 간단한 페이지에서 사용

## 주의사항
- `SubNav`, `CategoryLayout`은 `"use client"` (pathname 감지)
- `CategoryPageWrapper`는 Server Component
- greeting과 wonderland은 독자적 레이아웃, certification은 `PageContent` 래퍼 사용
- company-history는 타임라인 데이터가 하드코딩된 정적 콘텐츠
