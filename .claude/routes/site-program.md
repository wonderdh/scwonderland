# Program (/program/*)

## 라우트 경로
- URL: `/program/map`, `/program/wonderland`, `/program/wonder-k`, `/program/primo-school`, `/program/quest-academy`
- 라우트 그룹: `(site)`
- 메뉴 ID: `programs`

## 핵심 파일
- `src/app/(site)/program/layout.tsx` — CategoryPageWrapper + CategoryLayout(menuId="programs") 래핑

## 컴포넌트

| 파일 | 역할 |
|------|------|
| `src/app/(site)/program/map/page.tsx` | 프로그램 MAP 페이지. 커리큘럼 전체 구조 이미지 표시. 모바일 스크롤 안내 포함 |
| `src/app/(site)/program/wonderland/page.tsx` | 오전 유치부 프로그램(5~7세). 연차별 학습 목표(1st~3rd Year) + 교육 과정 연계 프로그램(5개 영역 원형 레이아웃). CSS Module 사용 |
| `src/app/(site)/program/wonder-k/page.tsx` | 오후 유치부 프로그램(5~7세). 학습목표 + 학습과목(Phonics/Course Book 75%, Sing&Chant/Science 25%). CSS Module + PageContent 래퍼 |
| `src/app/(site)/program/primo-school/page.tsx` | 초등 저학년 집중 프로그램. 4단계 레벨 시스템(Galaxy~Hubble~Orbit~Prodigy~Global Leader), Lexile 지수 표시. CSS Module + PageContent 래퍼 |
| `src/app/(site)/program/quest-academy/page.tsx` | 초등 고학년/중등 전문 프로그램. 4단계 레벨 시스템(Twilight~Vesper~Nova~Prodigy Advanced~Global Leader). CSS Module + PageContent 래퍼 |

## Server Actions
- 없음 (정적 페이지)

## 데이터 흐름
1. `layout.tsx` -> `CategoryPageWrapper` -> `CategoryLayout(menuId="programs")`
2. SubNav에 MAP, Wonderland, Wonder K, Primo School, Quest Academy 탭 표시
3. 각 page.tsx가 정적 콘텐츠 렌더링

## 의존성
- `PageContent` — wonder-k, primo-school, quest-academy에서 사용
- 각 프로그램별 CSS Module 파일 (`CurriculumProgram.module.css`, `WonderK.module.css`, `PrimoSchool.module.css`, `QuestAcademy.module.css`)

## 주의사항
- map 페이지는 독자적 레이아웃 (PageContent 미사용)
- wonderland 페이지도 독자적 레이아웃 (3개 섹션 구성)
- 모든 프로그램 데이터 하드코딩 (DB 미사용)
- 각 프로그램별 Metadata 설정 완료
