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

## 반응형 브레이크포인트

- **lg** (1024px+): 데스크톱 (사이드바, 다중 컬럼)
- **md** (768px+): 태블릿
- **모바일** (<768px): 단일 컬럼, 햄버거 메뉴, FAB
- CSS Modules 내부: 1280px (태블릿), 768px (모바일)
