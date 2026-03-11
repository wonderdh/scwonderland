---
paths:
  - "**/*.css"
  - "**/*.module.css"
  - "app/(site)/**/*"
  - "app/globals.css"
---

# Styling

**Tailwind CSS v4** 기본, CSS Modules는 복잡한 레이아웃에만 사용.

## CSS Modules 사용 페이지 (5개)

| 페이지 | CSS Module | 용도 |
|--------|-----------|------|
| `about-wonderland/wonderland` | `Wonderland.module.css` | 교육 철학 섹션 레이아웃 |
| `program/wonderland` | `CurriculumProgram.module.css` | 원형 커리큘럼 노드 배치 |
| `program/wonder-k` | `WonderK.module.css` | 프로그램 소개 레이아웃 |
| `program/primo-school` | `PrimoSchool.module.css` | 레벨별 카드 그리드 |
| `program/quest-academy` | `QuestAcademy.module.css` | 프로그램 레벨 카드 |
| Landing MainProgram | `MainProgram.module.css` | 프로그램 카드 hover 애니메이션 |

## 브랜드 컬러

- **Orange** (`#ff7700`, orange-500): 주요 CTA, Navigation 모바일 버튼, 하이라이트
- **Green** (green-600, `#52b978`): SubNav 활성 탭, 배너 배경
- **Blue** (`#3a75ff`): 타임라인 아이콘, 보조 컬러
- **Slate** 계열: Admin/Academy 전체 UI

## 학생 나이별 색상 팔레트 (lib/student-age-colors.ts)

학생 이름을 표시할 때 나이별 색상으로 구분. **반드시 이 규칙을 따를 것.**

| 나이 | 배경 | 텍스트 | 테두리 |
|------|------|--------|--------|
| 5세 | `bg-pink-100` | `text-pink-700` | `border-pink-200` |
| 6세 | `bg-sky-100` | `text-sky-700` | `border-sky-200` |
| 7세 | `bg-emerald-100` | `text-emerald-700` | `border-emerald-200` |
| 기타/미설정 | `bg-slate-100` | `text-slate-600` | `border-slate-200` |

- `getAgeColor(age)` 헬퍼로 `{ bg, text, border }` 반환
- 태그/배지 스타일: `${ac.bg} ${ac.text} border ${ac.border}`
- 텍스트만: `${getAgeColor(age).text}`
- 적용 범위: 버스 배정/대시보드/모니터, 학생 목록 등 학생 이름 표시되는 모든 곳

## 반응형 브레이크포인트

- **lg** (1024px+): 데스크톱 (사이드바, 다중 컬럼)
- **md** (768px+): 태블릿
- **모바일** (<768px): 단일 컬럼, 햄버거 메뉴, FAB
- CSS Modules 내부: 1280px (태블릿), 768px (모바일)
