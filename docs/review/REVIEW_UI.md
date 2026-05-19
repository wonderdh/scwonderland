# UI/UX 리뷰 — SC Wonderland

> 리뷰어: Designer (oh-my-claudecode)  
> 리뷰 대상: `src/components/`, `src/app/(site)/`, `src/app/(admin)/`, `src/app/academy/`, `src/app/(monitor)/`  
> 검토 날짜: 2026-05-19

---

## 1. 요약

### 강점

- **디자인 시스템 토큰이 일관되게 정의되어 있다.** `globals.css`에 `--brand-orange`, `--brand-green`, `--brand-blue`, `--brand-red`, `--brand-yellow` 5가지 브랜드 컬러와 shadcn의 CSS 변수가 공존하며 `oklch` 색공간을 사용했다. Geist 폰트 선택도 좋은 출발점이다.
- **접근성 기반이 탄탄하다.** `StatusBadge`의 `role="status"`, `aria-label`, `FormGroup`의 `role="alert"`, 모달의 `aria-modal`/`aria-labelledby`, `:focus-visible` 전역 스타일, `prefers-reduced-motion` 미디어 쿼리 대응 등 a11y 인프라가 실제로 코드에 녹아 있다.
- **모바일-퍼스트 관리자 화면(`/m/*`)이 전용 경로로 분리되어 있다.** 터치 타겟 44px 유지 등 모바일 UX를 별도로 설계한 점이 돋보인다.
- **버스/급식 TV 모니터 화면(`/(monitor)`)이 실용적이다.** `LunchMonitorClient`의 시간대 기반 active 하이라이트, `BusMonitorClient`의 Supabase Realtime 통합 등 TV 디스플레이에 맞는 설계가 이루어져 있다.
- **공유 상태 컴포넌트(`ClassUnitProgressList`, `MonitorBusCard`)가 admin/teacher/mobile 세 채널을 재사용한다.** 중복을 줄인 좋은 설계다.
- **`NavigationProgress`가 네이티브 link 클릭을 감지해 진행 바를 표시한다.** App Router 전용 훅 없이 DOM 이벤트로 구현한 실용적인 해결책이다.

### 약점

1. **컬러 시스템이 두 가지 병렬 레이어로 쪼개져 있다.** shadcn CSS 변수(`--primary`, `--destructive`)와 브랜드 변수(`--brand-orange` 등)가 독립적으로 존재하고, Tailwind `slate-*`/`gray-*`/`zinc-*`/`emerald-*`/`blue-*` 등 raw 팔레트를 컴포넌트에서 직접 하드코딩하는 패턴이 혼재한다. 토큰 추상화가 절반만 완성된 상태다.
2. **인라인 모달 패턴이 여러 컴포넌트에 복사-붙여넣기로 중복된다.** `SeriesPicker`, `PublisherPicker`, `SeriesCard`, 관리자 숙제/공지 관련 컴포넌트들 모두 `fixed inset-0 z-50 flex items-center justify-center bg-black/40` 모달 래퍼를 직접 구현하고 있다.
3. **마케팅 사이트(`(site)`)와 관리자/포털 간 톤이 단절된다.** Hero 섹션이 `bg-gray-50`, Footer가 `bg-gray-900` 1줄로 끝난다. 브랜드 아이덴티티가 내부 시스템 UI에서 사라진다.
4. **ErrorScreen이 shadcn `Button`을 쓰지 않고 raw `<button>`으로 구현되어 있다.** 스타일도 `rounded-md bg-slate-800`으로 브랜드 색상과 무관하다.
5. **select 요소가 shadcn 컴포넌트로 통일되지 않았다.** `SeriesLevelPicker`, `PublisherPicker`, `SeriesPicker`, `StudentInfoCard` 등 여러 곳에서 native `<select>`를 쓰는데 Tailwind 클래스 패턴이 제각각이다.

### Top 5 개선 과제

| 순위 | 과제 | 효과 |
|------|------|------|
| 1 | raw 팔레트 하드코딩 → 디자인 토큰 통일 | 전체 일관성, 다크모드 안정성 |
| 2 | 모달 래퍼 공용 컴포넌트 추출 | 중복 코드 ~400줄 제거, FocusTrap/Escape 동작 일관화 |
| 3 | native `<select>` → shadcn Select 또는 공용 `SelectField` | 폼 UX 시각적 통일 |
| 4 | 마케팅 사이트 Footer 강화 | 브랜드 신뢰도 |
| 5 | ErrorScreen을 디자인 시스템 컴포넌트로 교체 | 오류 경험 개선 |

---

## 2. 디자인 시스템 인벤토리

### 2.1 색상 토큰 (실제 사용 현황)

| 계층 | 변수/값 | 사용처 |
|------|---------|--------|
| 브랜드 변수 | `--brand-orange: #ff7700` | Navigation 활성, Sidebar active border, LunchMonitor active |
| 브랜드 변수 | `--brand-green: #059669` | Hero 제목 장식 |
| 브랜드 변수 | `--brand-blue: #3a75ff` | Hero 제목, MainProgram, focus-visible outline |
| 브랜드 변수 | `--brand-red: #e73357` | Hero 제목 |
| 브랜드 변수 | `--brand-yellow: #fbbf24` | Hero 제목 |
| shadcn 토큰 | `--primary: oklch(0.546 0.245 262.881)` | 버튼, 탭 활성 인디케이터, focus ring |
| shadcn 토큰 | `--destructive` | 오류 상태 |
| shadcn 토큰 | `--sidebar` | Admin 사이드바 배경 |
| **raw 하드코딩** | `slate-*` | 전체 UI에서 가장 많이 사용되는 중립색 |
| **raw 하드코딩** | `emerald-*` | 완료/출석/성공 상태 |
| **raw 하드코딩** | `orange-*` | 어드민 사이드바 active, 버스 모니터 |
| **raw 하드코딩** | `blue-*` | 정보 상태, TeacherBadge (native) |
| **raw 하드코딩** | `red-*` | 삭제/오류 (ErrorScreen, ConfirmDialog) |
| **raw 하드코딩** | `amber-*` | 비밀번호 재설정, 유치부 그룹 |

**문제:** `--brand-orange (#ff7700)`과 Tailwind `orange-500 (#f97316)`, Admin 사이드바의 `orange-50/orange-700` 등 유사한 오렌지 계열 색상이 3~4개 서로 다른 값으로 혼용된다.

**문제:** 다크모드 `@theme inline` 정의에 `--brand-*` 변수가 없어, 다크모드에서 인라인 `style={{ color: "var(--brand-red)" }}` 사용은 배경과 대비가 바뀔 수 있다.

### 2.2 타이포그래피

| 요소 | 스케일 | 비고 |
|------|--------|------|
| 기본 폰트 | Geist (CSS 변수로 선언) | `body { font-family: var(--font-geist-sans) }`으로 사용 — 좋음 |
| Admin root | `font-size: 17px; line-height: 1.6` | `:where(.admin-root)` 스코프 — 시니어 친화 의도적 선택 |
| Hero h1 | `text-5xl md:text-7xl font-bold` | 마케팅 랜딩 적합 |
| PageHeader h1 | `text-2xl sm:text-3xl font-bold` | 관리자 페이지 상단 |
| 카드 수치 | `text-4xl font-bold tracking-tight` | 대시보드 stat card |
| 탭 링크 | `text-base font-medium` | 어드민 탭 |
| 모니터 학생명 | `text-2xl font-bold` (버스), `text-3xl font-bold` (급식) | TV 가독성 고려 |

**아쉬운 점:** `text-[10px]`, `text-[11px]`, `text-[17px]` 등 임의 수치가 여러 파일에 흩어져 있어 타이포 스케일의 일관성이 깨진다.

### 2.3 간격(Spacing)

- 카드 패딩: `p-4`, `p-6`, `px-4 py-3` 등 혼용
- 섹션 간격: `space-y-4` ~ `space-y-8`
- 버튼 높이: `h-10` (권장), `h-11`, `h-12`, `h-7`, `h-8` 등 혼재

### 2.4 Radius

`--radius: 0.625rem`이 CSS 변수로 설정되어 있고 `--radius-sm`/`md`/`lg`/`xl`/`2xl`/`3xl`/`4xl`까지 단계가 정의되어 있다. 그러나 실제 컴포넌트에서는 `rounded-xl`, `rounded-lg`, `rounded-md`, `rounded-full`, `rounded-2xl` 등을 직접 클래스로 사용하며 변수를 활용하지 않는다.

### 2.5 Shadow

`shadow-sm` (대부분 카드), `shadow-xl` (모달), `shadow-2xl` (슬라이드 패널) 3단계. `hover:shadow-lg hover:-translate-y-0.5`의 호버 상태 패턴이 대시보드에서 반복된다.

---

## 3. 컴포넌트별 리뷰

### 3.1 Badges

**StatusBadge**
- 잘 설계되어 있다. `config` 오브젝트 패턴으로 확장이 쉽고 `size` prop이 있다.
- `role="status"` + `aria-label` 조합은 스크린리더에 잘 전달된다.
- `badgeClass`가 호출 측에서 Tailwind 클래스를 직접 전달하는 구조여서 다크모드 호환성이 사용처에 따라 달라진다.

**TeacherBadges**
- `bg-blue-100 text-blue-700` / `bg-emerald-100 text-emerald-700`으로 native/korean 교사를 구분. 의도가 명확하다.
- 그러나 색상이 inline 하드코딩이라 디자인 토큰 변경 시 놓치기 쉽다. `getTeacherTypeColor()` 유틸로 추출하는 편이 낫다.

### 3.2 Forms

**FormGroup**
- `role="alert"`를 error 메시지에 적용한 점이 좋다.
- label에 `required` 표시(`*`)가 `aria-hidden`으로 처리되어 스크린리더에 숨겨진다.
- 도움말(`help`)과 에러(`error`)가 상호 배타적으로 표시되는 로직이 명확하다.

**FileUpload**
- 드래그앤드롭 + 클릭 두 가지 방법을 지원하는 양호한 구현이다.
- `accept` prop을 받지만 파일 타입 위반 시 사용자에게 피드백이 없다 (서버 에러에 의존).
- 드롭존에 `role="button"` 또는 `tabindex`가 없어 키보드만으로 접근이 불가능하다.
- `input[type=file]`이 숨겨져 있고 `div`가 click 이벤트를 받는 구조는 키보드 탐색을 깬다.

**MultiDatePicker**
- 범위 선택 → 개별 토글 전환 UX 아이디어는 영리하다.
- `💡` 이모지가 인라인 힌트에 들어가 있다. AI slop 경계선상의 패턴이다.
- 날짜 배지의 삭제 버튼이 `x` 텍스트로 되어 있어 의미가 불명확하다. `×` 또는 아이콘으로 교체 권장.
- `text-[10px]`, `text-[11px]` 등 임의 폰트 크기를 직접 사용한다.
- `localStorage` 영구 dismiss 패턴이 맞으나, 도입 의도가 "최초 1회 안내"라면 충분하다.

**AudioRecorder**
- 녹음 중 / 완료 상태 전환 UI가 명확하다.
- 녹음 인디케이터의 `animate-pulse` 빨간 dot이 직관적이다.
- `audio` 컨트롤 요소(`h-10`)가 브라우저 기본 스타일에 의존한다. iOS Safari에서 레이아웃이 깨질 수 있다.

**PublisherPicker / SeriesPicker**
- 구조가 거의 동일한 복사-붙여넣기다. 인라인 신규 생성 모달을 포함한 제네릭 `EntityPicker<T>` 컴포넌트로 추출할 수 있다.
- native `<select>`가 `border-input bg-background` 클래스를 달지만 화살표 스타일링은 브라우저 기본에 의존한다. shadcn Select와 병용하면 시각적 통일성이 떨어진다.
- 두 컴포넌트 모두 내부에 모달 컴포넌트(`NewPublisherModal`, `NewSeriesModal`)를 로컬로 정의해 파일 길이가 길어진다.

**SeriesLevelPicker**
- 2단계 cascading select 패턴은 적합하다.
- native `<select>` 2개를 연속 배치하는 방식이 익숙하지 않은 사용자에겐 어색할 수 있다. 시각적으로 "Step 1 → Step 2" 레이블이 주석에만 있고 UI에는 없다.

### 3.3 Overlays

**ConfirmDialog**
- `if (!open) return null` 패턴으로 Portal 없이 구현된 모달이다. `fixed inset-0` 모달이 현재 DOM 위치에 렌더링되어 쌓임 맥락(stacking context) 문제가 발생할 수 있다.
- FocusTrap(모달 열린 동안 포커스 가두기)이 없다. 탭 키로 모달 뒤 요소에 접근 가능하다.
- Escape 키 닫기가 없다. `onCancel` 연결 필요.
- `danger` prop과 `variant="danger"` 두 가지 방법이 병존해 사용 API가 혼란스럽다. 하나로 통일이 필요하다.
- `impactList` 기능은 파괴적 액션의 영향 범위를 보여주는 UX 아이디어가 훌륭하다.
- 버튼 크기가 `px-5 py-3 text-base`(확인) vs `px-4 py-2.5 text-sm`(취소)로 불균형하다. 시각적 위계가 너무 강하다.
- 취소 버튼에 focus가 기본으로 가지 않아 파괴적 액션을 실수로 확인할 위험이 있다.

### 3.4 Skeletons

**SkeletonBone**
- `animate-pulse rounded bg-muted` 1줄로 깔끔하다.

**SkeletonTable / AdminListPageSkeleton**
- 실제 페이지 레이아웃을 충실히 반영하는 구조 스켈레톤이다.
- `AdminListPageSkeleton`은 4탭 구조를 가정하고 있어 탭 수가 바뀌면 스켈레톤도 업데이트해야 한다. 동적으로 계산하거나 범용 스켈레톤으로 대체를 검토할 수 있다.

### 3.5 Feedback 컴포넌트

**EmptyState**
- 충실한 구현이다. `icon`, `title`, `description`, `action` 4개 슬롯이 적절하다.
- `border-dashed border-slate-200 bg-slate-50/50` 스타일이 명확하다.
- `icon`이 `aria-hidden`으로 처리되어 있어 좋다.

**ErrorScreen**
- 재시도 버튼이 raw `<button>`으로 구현되어 있고 `bg-slate-800`을 사용한다. shadcn `Button`으로 교체하면 디자인 시스템을 따른다.
- `min-h-[50vh]`로 최소 높이를 보장하는 점은 좋다.
- 에러 타입에 따라 다른 아이콘/색상 표시가 없다. 모든 에러가 동일한 시각으로 표시된다.

**Spinner**
- 3가지 크기 지원이 잘 되어 있다.
- `srLabel` prop으로 스크린리더 텍스트를 커스터마이즈할 수 있어 접근성이 좋다.

**NavigationProgress**
- DOM 이벤트 기반의 영리한 구현이다. 빠른 페이지 전환에서 흘끗 보이는 바가 로딩 감각을 준다.
- 진행 바 너비가 고정(`w-[60%]`)이라 실제 로딩 진행률을 반영하지 못한다. 사용자에게 거짓 정보를 줄 수 있으나, 현실적인 트레이드오프다.

### 3.6 Navigation

**PageHeader**
- 단순하고 일관된 패턴이다. `border-b border-slate-200`으로 섹션 구분이 명확하다.
- `actions` 슬롯이 있어 CTA 버튼 배치가 유연하다.

**QueryTabNav**
- Optimistic pending 상태를 클라이언트 상태로 처리하는 패턴이 인상적이다. 서버 렌더링 후 탭이 "깜박이는" 현상을 방지한다.
- 탭에 아이콘이 없어 긴 텍스트 레이블만으로 탭을 구분한다.

**StudentTabNav**
- 아이콘 + 텍스트 조합으로 `QueryTabNav`보다 시각적으로 풍부하다.
- 활성 탭에 `bg-orange-50 text-orange-700 border-orange-500` 스타일이 적용된다. 이 오렌지가 `--brand-orange`인지 Tailwind `orange-500`인지 명시되어 있지 않다.

**Breadcrumb**
- 별도 파일로 분리된 컴포넌트임을 확인. 관리자 레이아웃의 `AdminLayoutClient`에서 브레드크럼을 자동으로 렌더링한다. 좋은 패턴이다.

---

## 4. 라우트별 리뷰

### 4.1 `(site)` — 마케팅 사이트

**전체 인상**
`bg-gray-50`, `text-gray-900`, `bg-gray-900` 중심의 조심스러운 배색이다. 브랜드 컬러 5종이 선언되어 있지만 Hero 제목 글자색 장식과 Navigation 활성 표시에만 쓰인다. 30년 전통 영어학원의 신뢰감을 주려는 의도는 이해되나, 마케팅 사이트로서 강렬한 인상을 주기에는 소극적이다.

**Navigation**
- 데스크톱: 로고 + 5등분 그리드 + 메가드롭다운. `md:grid-cols-[140px_1fr_1fr_1fr_1fr_1fr]` 구조가 안정적이다.
- hover시 `-translate-y-0.5` 미세 움직임과 밑줄 애니메이션(`scale-x-0 → scale-x-100`)이 섬세하다.
- 드롭다운 배경이 `bg-zinc-900/95`로 어둡고 텍스트가 `text-white/80`이다. 대비비는 충분하다.
- 모바일: 햄버거 버튼(`rounded-full bg-orange-500`)이 유일한 브랜드 컬러 활용. 메가메뉴 없이 링크만 표시.
- **문제:** 모바일 메뉴가 열릴 때 슬라이드/페이드 애니메이션이 없다. 갑자기 나타난다.
- **문제:** 모바일 메뉴 오버레이가 없어 배경이 보이지 않는다(닫기 방법이 링크 클릭뿐).

**Hero 섹션**
- `pt-24` 고정으로 Navigation 높이(`h-24`)를 보완. 정확한 오프셋이다.
- 제목의 각 글자에 다른 브랜드 컬러를 적용한 "왜 원더랜드일까요?" 타이포가 인상적이다.
- 이미지 3개를 `bg-gray-900` 박스에 담는 구성이 독특하다.
- **문제:** Hero 이미지 높이가 `h-64`(256px) 고정이라 종횡비 제어 없이 왜곡될 수 있다. `object-cover`가 `ImageWithFallback` 안에 있어야 한다.
- CTA 버튼이 `bg-gray-900 hover:bg-gray-800`. 브랜드 컬러 미사용이 아쉽다.

**MainProgram 섹션**
- 5개 프로그램 카드가 이미지 배경 + hover 시 슬라이드 오버레이 효과. 생동감 있는 인터랙션이다.
- `group-hover:bottom-0 group-hover:bg-[#5781ec]` — 파란색 오버레이가 하드코딩되어 있다. CSS 변수로 대체 가능.
- 모바일에서 설명 텍스트와 "view" 링크가 보이고, 태블릿에서 숨기고(`md:hidden`), 데스크톱에서 다시 표시(`xl:inline-block`). 반응형 로직이 세밀하다.

**SubNav**
- Unsplash 이미지를 배경 텍스처로 `opacity-[0.06]`으로 사용. 미묘하고 효과적이다.
- 활성 링크가 `text-green-600 + 밑줄`로 표시된다. 내비게이션에서는 `orange-500`을 쓰는데 서브 nav에서는 `green-600`을 쓴다. **일관성 깨짐.**

**Footer**
- `bg-gray-900`에 저작권 1줄이 전부다. 마케팅 사이트의 푸터로서 매우 빈약하다.
- 연락처, SNS 링크, 사이트맵 등 최소한의 정보가 없다.

**WeeklySentencePopup**
- `animate-in fade-in zoom-in-95` 입장 애니메이션이 있다. 좋다.
- `role="dialog" aria-modal="true" aria-labelledby` 접근성 속성이 모두 있다.
- 3개 레벨 카드에 각 레벨 색상 배지(`lv.color`)가 적용되어 시각적으로 구분된다.
- 닫기 버튼이 우상단 `×` 아이콘으로 명확하다.
- **문제:** FocusTrap이 없어 탭 키로 팝업 뒤 배경으로 이동 가능하다.

### 4.2 `(admin)` — 관리자 데스크톱

**레이아웃 구조**
- `AdminLayoutClient`: 데스크톱에서 `hidden lg:flex fixed` 사이드바 + 메인 컨텐츠 `lg:ml-60`. 표준적이고 안정적인 패턴이다.
- `AdminMobileHeader`: `lg:hidden sticky` 상단 헤더 + 슬라이드 드로어. Escape 키 지원, 배경 스크롤 차단, 경로 변경 시 자동 닫힘. 잘 구현되어 있다.

**AdminSidebar**
- 배경: `bg-sidebar`(CSS 변수) 사용. dark 사이드바 스타일.
- 활성 항목: `bg-orange-50 text-orange-700 border-l-4 border-orange-500 pl-2`. 왼쪽 4px 강조선이 명확하다.
- **문제:** `bg-orange-50`은 라이트 배경색이지만 사이드바 배경이 `oklch(0.21 0.034 265)` — 어두운 색이다. 활성 항목의 `bg-orange-50`이 어두운 배경 위에 밝은 오렌지-화이트로 표시되어 매우 어색하다.
- 아이콘 크기 `h-6 w-6`, 텍스트 `text-base`가 admin-root의 17px 기준에 잘 맞는다.

**대시보드 (`/admin` page)**
- Stat 카드에 그라데이션 아이콘 박스(`bg-gradient-to-br from-emerald-500 to-teal-600` 등)가 사용된다. 총 5개 카드에 5가지 다른 그라데이션이 쓰인다.
- Nav 카드의 `hover:-translate-y-0.5 hover:shadow-lg` 효과가 통일되어 있다.
- **문제:** 아이콘 박스 그라데이션들이 브랜드 컬러 팔레트(`--brand-*`)와 무관한 임의 색상 조합이다. 5개 카드 중 3개에 서로 다른 보라/파랑/초록 계열이 쓰여 산만하다.
- **문제:** `반`(클래스) 카드에 `Users` 아이콘이 쓰였다. 학생 카드와 동일한 아이콘이다. `School` 또는 `BookOpen`이 더 적합하다.

**학생 관리 (`/admin/students`)**
- 좌측 목록 + 우측 상세(탭)의 마스터-디테일 패턴이 데스크톱에서 효과적이다.
- `StudentTabNav`: 아이콘 + 텍스트 탭, 오렌지 활성 인디케이터.
- `StudentGroupedList`: 나이 배지 색상 시스템(`getAgeColor`)이 잘 적용되어 있다. 유치부(amber)/오후반(sky)/미배정(slate) 3그룹 분류.
- **문제:** `StudentGroupedList`의 StudentRow와 `StudentSelectedView`의 StudentInfoCard가 동일한 학생 정보를 서로 다른 UI 패턴으로 편집한다. 인라인 편집(목록) vs 독립 편집(상세)이 혼재한다.

**숙제 관리 (`/admin/homework`)**
- `SeriesCard`의 책 표지 `aspect-[3/4]` 비율과 hover 섀도우 효과가 세련됐다.
- 레벨 드롭다운 popover 구현이 작은 카드 내 세부 정보를 잘 처리한다.
- 비활성 시리즈의 `opacity-60` 처리가 명확하다.

### 4.3 `(admin)/m` — 모바일 관리자

**홈 (`/m`)**
- 카드 목록 형태의 메뉴. `min-h-[100px] rounded-2xl` 터치 타겟이 충분하다.
- 아이콘이 SVG 인라인으로 직접 작성되어 있다. `lucide-react` 대신 인라인 SVG를 써서 번들 절약 의도일 수 있으나 코드 가독성이 떨어진다.

**출결 관리 (`/m/attendance`)**
- 3단계 화면 흐름(반 목록 → 학생 목록 → 학생 검색)이 조건부 렌더링으로 구현되어 있다.
- `min-h-[44px] min-w-[44px]` 터치 타겟 준수.
- 저장 버튼이 `fixed bottom-6 right-6` FAB(플로팅 액션 버튼) 패턴으로 변경 사항이 있을 때만 표시된다. 직관적이다.
- segment control(반별/학생 검색)이 `bg-muted rounded-lg` pill 스타일로 잘 처리되어 있다.
- **문제:** 오류 메시지가 `fixed bottom-20 left-4 right-4` 위치에 표시되는데, FAB와 겹칠 수 있다.

### 4.4 `academy` — 학생/교사 포털

**AcademyShell**
- 상단 헤더가 `bg-white border-b border-slate-200`로 관리자와 동일한 느낌이다. 포털로서 차별화가 부족하다.
- 로고 + 내비게이션 링크 + 사용자명 + 로그아웃 구조가 간결하다.
- 원어민 교사(`isNative`)일 때 영문 레이블로 전환하는 다국어 지원이 내장되어 있다.

**LoginForm**
- 카드 상단의 무지개 그라데이션 바(`from-red-500 via-yellow-400 via-green-500 to-blue-500`)가 Hero 제목의 브랜드 컬러와 연결된다. 귀여운 아이덴티티 장치다.
- 로그인 버튼도 동일한 그라데이션 패턴을 사용한다. 일관성이 있다.
- 로딩 시 `animate-pulse` 텍스트와 Spinner 조합이 자연스럽다.
- **문제:** 에러 메시지 박스(`rounded-lg bg-red-50 border border-red-200`)가 나타날 때 애니메이션이 없다. 갑자기 등장해 레이아웃 점프가 발생한다.

**학생 대시보드**
- 프로필 카드의 무지개 그라데이션 헤더가 LoginForm과 동일한 패턴으로 아이덴티티를 유지한다.
- 아바타가 이름 첫 글자로 구성된다. 이미지 없는 깔끔한 대안이다.
- `Suspense` + 스켈레톤으로 위젯이 개별 로딩된다. 좋은 UX 패턴이다.

**PortalNav**
- 가로 스크롤 pill 탭이 `overflow-x-auto scrollbar-hide`로 처리된다.
- pending 탭 클릭 시 optimistic 하이라이트가 적용된다.
- `activeColor` prop을 각 링크 정의에서 받아 탭마다 다른 활성 색상을 지정할 수 있다. 유연하지만 일관성을 해칠 수 있다.

### 4.5 `(monitor)` — TV 모니터

**LunchMonitorClient**
- `bg-slate-900 text-white` 다크 배경이 TV 환경에 적합하다.
- 시계가 `text-5xl font-mono tabular-nums`로 크게 표시된다.
- 활성 시간대에 `border-orange-400 bg-orange-950/30 shadow-[0_0_40px_rgba(251,146,60,0.3)]` 글로우 효과가 있다. 주목도가 높다.
- 학생 이름이 `text-2xl font-bold`로 TV에서 충분히 가독성이 있다.
- `LEADER` 뱃지가 급식 리더를 명확히 표시한다.
- **문제:** 갱신 주기가 `5분(300초)`이다. 급식 시간 변경이 5분 단위로만 반영된다. Realtime 연동이 없어 아쉽다.
- **문제:** 5분 주기 갱신이 페이지 전체를 `router.refresh()`로 실행한다. TV에서 화면이 잠깐 깜빡일 수 있다.

**BusMonitorClient**
- Supabase Realtime으로 승하차 체크 기록이 실시간으로 반영된다. 우수한 구현이다.
- 요일 선택, 시간대 필터, 새로고침 컨트롤이 잘 배치되어 있다.
- 나이별 색상 범례(`5세/6세/7세`)가 상단에 표시된다.
- **문제:** 새로고침 버튼에 `🔄` 이모지가 사용된다. 아이콘 컴포넌트로 교체 권장.
- **문제:** TV 화면인데 컨트롤 버튼(`요일/시간대`)이 `size="sm"`으로 작아 원격 확인이 어렵다.
- **문제:** 버스 모니터와 급식 모니터가 별도 페이지다. 진입점(`/bus-monitor`, `/lunch-monitor`)이 `/m` 홈에만 링크로 등장하고 공용 TV 포털이 없다.

---

## 5. 반응형 & 모바일

### 5.1 브레이크포인트 전략

| 영역 | 전략 | 평가 |
|------|------|------|
| 마케팅 사이트 | `md:`, `xl:` 사용. 모바일 우선 | 양호 |
| 관리자 데스크톱 | `lg:` 이상에서만 사이드바 + `AdminMobileHeader` | 양호 |
| 모바일 관리자 | `/m/*` 별도 경로 | 명확한 분리 |
| 학생/교사 포털 | `sm:`, `md:` 사용. 모바일 우선 | 양호 |
| TV 모니터 | 고정 화면 가정. 반응형 불필요 | 적절 |

### 5.2 주요 반응형 이슈

- **Admin 데스크톱 마스터-디테일 패턴이 모바일에서 동작 방식 불명확.** `/admin/students?selected=xxx&tab=basic` URL 구조가 데스크톱 전용으로 설계된 것으로 보인다. 모바일에서는 사이드바와 컨텐츠가 모두 좁은 화면에 표시될 수 있다.
- **`MobileAttendanceClient`의 저장 오류 메시지와 FAB 버튼이 `fixed bottom` 위치 충돌 가능.**
- **다중 탭 nav가 좁은 화면에서 `overflow-x-auto`로 스크롤 처리.** 현재 활성 탭이 보이도록 자동 스크롤 기능이 없다.
- **`QueryTabNav` / `StudentTabNav`의 탭 텍스트가 긴 경우(예: "시간표 & 출결") 모바일에서 잘릴 수 있다.** `whitespace-nowrap`이 적용되어 있어 가로 스크롤은 되지만 현재 탭 가시성 보장이 없다.

---

## 6. 접근성 (a11y)

### 6.1 잘 되어 있는 부분

- `:focus-visible` 전역 스타일 (`outline: 2px solid var(--brand-blue)`)
- `prefers-reduced-motion` 쿼리 지원
- `StatusBadge`의 `role="status"` + `aria-label`
- `FormGroup`의 에러 메시지 `role="alert"`
- `Spinner`의 `<span class="sr-only">로딩 중</span>`
- `WeeklySentencePopup`의 `role="dialog" aria-modal aria-labelledby`
- `AdminMobileHeader`의 드로어 `role="dialog" aria-modal aria-label`
- `ImageWithFallback`의 `alt` 텍스트 전달
- `EmptyState` icon의 `aria-hidden`

### 6.2 개선이 필요한 부분

| 위치 | 문제 | 권장 조치 |
|------|------|-----------|
| `ConfirmDialog` | FocusTrap 없음 | `@radix-ui/react-focus-trap` 또는 Dialog 컴포넌트 사용 |
| `ConfirmDialog` | Escape 키 닫기 없음 | `useEffect`로 keydown 이벤트 추가 |
| `WeeklySentencePopup` | FocusTrap 없음 | 동일 |
| `FileUpload` 드롭존 | `tabindex="0"` + `role="button"` 없음 | 키보드 접근 불가 |
| `FileUpload` 파일 제거 버튼 | aria-label 없음 | `aria-label="파일명 제거"` 추가 |
| `SeriesCard` 메뉴 버튼 | aria-label이 "메뉴"뿐 | "시리즈명 메뉴"로 구체화 |
| `PublisherPicker` / `SeriesPicker` | native `<select>`에 연결된 `<label>`이 없음 | `FormGroup`으로 감싸거나 `aria-label` 추가 |
| `AdminBusCard` 정류장 아이콘 | `📍` 이모지 텍스트가 스크린리더에 노출 | `aria-hidden` 추가 |
| `MonitorBusCard` 상태 이모지 | `✅`, `🚌`, `⬜`, `🔴` | `aria-hidden` + 인접 sr-only 텍스트 |
| Navigation 모바일 메뉴 | 메뉴 닫기 버튼이 없음 | 오버레이 클릭 또는 X 버튼 추가 |
| `MobileAttendanceClient` | 탭 전환 버튼에 `aria-selected`/`role="tab"` 없음 | tablist 패턴 적용 |
| 색상 대비 | `text-slate-300`(admin sidebar 아이디) + 어두운 배경 | 4.5:1 기준 확인 필요 |

---

## 7. 로딩 / 에러 / 빈 상태

### 7.1 로딩

| 패턴 | 사용처 | 평가 |
|------|--------|------|
| `Spinner` | LoginForm 로딩 중, 단순 로딩 | 적절 |
| `SkeletonBone` | DashboardWidgets, AdminListPageSkeleton | 좋음 |
| `SkeletonTable` | 테이블 뷰 | 좋음 |
| `AdminListPageSkeleton` | 학생/교사/반 관리 | 좋음 |
| 인라인 스피너 | `MobileAttendanceClient` (border animate-spin div) | Spinner 컴포넌트를 재사용해야 함 |
| 텍스트 "불러오는 중…" | `ClassUnitProgressList` | 빈약. 스켈레톤 권장 |

**누락된 로딩 상태:**
- `/m/bus-change`, `/m/bus-check` 페이지에서 데이터 로딩 상태가 확인되지 않음
- 버스 모니터 `handleRefresh` 중 카드 영역에 overlay 표시 없음 (loading state가 버튼 텍스트에만 반영)

### 7.2 에러

- `error.tsx` 파일이 `(admin)`, `(site)`, `academy` 각 라우트 그룹에 존재한다. 좋다.
- `ErrorScreen` 컴포넌트가 공용으로 존재하며 `title`, `description`, `resetLabel`을 커스터마이즈할 수 있다.
- **문제:** 에러 화면에 아이콘이 없고 색상이 `gray-900`으로 무채색이다. 오류 심각도에 따른 시각적 차이가 없다.
- 네트워크 오류와 권한 오류를 동일한 UI로 표시한다.

### 7.3 빈 상태

- `EmptyState` 컴포넌트가 잘 설계되어 있다.
- 그러나 일부 컴포넌트(`ClassUnitProgressList`, `StudentGroupedList` 등)에서 `EmptyState`를 쓰지 않고 직접 `<p className="text-sm text-muted-foreground text-center py-8">` 패턴을 사용한다.
- `DailyBusChanges`는 변경 사항이 없으면 `return null`로 완전히 숨겨진다. "오늘 버스 변경 없음" 메시지를 보여주는 것이 더 명확할 수 있다.

---

## 8. 폼 / 인터랙션 일관성

### 8.1 toast 사용 패턴

`src/lib/ui/toast.ts`에 `toastSuccess`, `toastError`, `toastInfo` 래퍼가 있지만 코드베이스 전반에서 Grep 결과 `toast.success()`, `toast.error()`를 직접 호출하는 곳이 더 많다(37개 파일 152회). 래퍼 사용율이 낮다.

기간 설정이 래퍼에서는 성공 6초, 에러 8초로 통일되어 있는데, 직접 호출 시에는 기본값(4초)을 사용한다. 일관성이 없다.

### 8.2 select vs shadcn Select

native `<select>` 사용처:
- `SeriesLevelPicker`, `PublisherPicker`, `SeriesPicker` (폼 내부)
- `StudentInfoCard`의 그룹 선택
- `StudentGroupedList`의 인라인 편집
- `MobileAttendanceClient`의 날짜 입력

일부는 `h-10 rounded-md border border-input bg-background px-3 text-sm` 클래스로 스타일링되어 있지만 화살표 스타일링은 브라우저 기본이다. shadcn Select로 통일하거나 공용 `NativeSelect` 스타일 클래스를 정의하는 것이 권장된다.

### 8.3 버튼 사이즈 혼재

| 패턴 | 사용처 |
|------|--------|
| shadcn `Button` size="sm/md/lg" | 대부분의 어드민 |
| raw `<button>` Tailwind 직접 스타일링 | `MobileAttendanceClient`, `ClassUnitProgressList` 컨트롤 버튼, `ErrorScreen` |
| `min-h-[44px]` 직접 지정 | `AudioRecorder`, 모바일 출결 |

`AudioRecorder`는 `variant="outline" className="w-full min-h-[44px] sm:min-h-[40px]"`으로 데스크톱에서 높이가 줄어든다. 모바일 퍼스트 터치 타겟 원칙에 맞다.

### 8.4 낙관적 업데이트

`ClassUnitProgressList`에서 `UnitProgressGrid`가 `useOptimistic`을 이용한 즉각적인 UI 피드백을 제공한다. 숙제 체크가 서버 응답 전에 시각적으로 반영된다. 좋은 패턴이다.

### 8.5 ConfirmDialog 톤

- 삭제 모달에 `impactList`로 영향 범위를 표시하는 패턴은 우수하다.
- 취소/확인 버튼 크기가 비대칭(`px-4 py-2.5 text-sm` vs `px-5 py-3 text-base`)이다. 파괴적 액션 강조 의도이나 지나치다. 동일한 크기에 색상으로 구분하는 것이 충분하다.
- `confirmLabel` 기본값이 `"삭제"`다. 확인/저장 유형 다이얼로그에서도 기본값이 삭제로 표시되면 혼란을 준다. `"확인"`으로 변경 권장.

---

## 9. UX 개선 권장사항

| 우선순위 | 영역 | 항목 | 예상 효과 |
|----------|------|------|-----------|
| **High** | 전체 | raw Tailwind 팔레트 → 디자인 토큰 통일 (`--brand-orange` 단일 소스 사용) | 브랜드 일관성, 다크모드 안정성, 변경 비용 감소 |
| **High** | 모달 | 공용 Modal 래퍼 컴포넌트 추출 + FocusTrap + Escape 지원 | 접근성 통일, 코드 중복 ~400줄 제거 |
| **High** | ConfirmDialog | shadcn `AlertDialog`로 교체 또는 FocusTrap/Escape 추가 | 접근성, UX 안전성 |
| **High** | Admin Sidebar | `bg-orange-50` 활성 배경을 어두운 사이드바에서 사용 → 토큰 교정 필요 (`bg-sidebar-accent`) | 시각적 어색함 제거 |
| **High** | 폼 컴포넌트 | `PublisherPicker` / `SeriesPicker` → 제네릭 `EntityPicker<T>` 추출 | 코드 중복 절반 제거 |
| **Med** | (site) | Navigation 모바일 메뉴 닫기 오버레이 + 슬라이드 애니메이션 추가 | 모바일 UX |
| **Med** | (site) | Footer 강화 (연락처, SNS, 사이트맵 최소 구성) | 마케팅 신뢰도 |
| **Med** | (site) | Hero CTA 버튼을 `--brand-orange` 또는 `--brand-blue` 사용 | 브랜드 일관성 |
| **Med** | (site) | SubNav 활성 색상을 `text-green-600` → `--brand-orange` 통일 | 내비게이션 일관성 |
| **Med** | 전체 | `toast.success()` 직접 호출 → `toastSuccess()` 래퍼로 통일 | toast 지속 시간 일관성 |
| **Med** | select | native `<select>` → shadcn `Select` 또는 공용 스타일 클래스 | 폼 시각적 통일성 |
| **Med** | TV 모니터 | 버스 모니터 컨트롤 버튼 크기 키움 (`size="sm"` → 기본) | TV 원격 조작 UX |
| **Med** | 에러 | `ErrorScreen` 리디자인: shadcn Button + 에러 아이콘 + 색상 | 오류 경험 개선 |
| **Med** | 빈 상태 | `ClassUnitProgressList` 등 직접 구현된 빈 상태 → `EmptyState` 컴포넌트 통일 | 일관성 |
| **Low** | MultiDatePicker | 날짜 배지의 `x` → 아이콘 버튼, 이모지 제거 | 시각적 완성도 |
| **Low** | LunchMonitor | `router.refresh()` → Realtime 또는 더 긴 주기 + 부드러운 전환 | TV 화면 깜빡임 방지 |
| **Low** | Admin Dashboard | 그라데이션 아이콘 박스를 브랜드 컬러 팔레트와 연결 | 브랜드 일관성 |
| **Low** | FileUpload | `tabindex="0"` + `role="button"` + 키보드 Enter/Space 지원 | 접근성 |
| **Low** | 전체 | `text-[10px]` / `text-[11px]` 등 임의 폰트 크기 → Tailwind 스케일로 교체 | 타이포 일관성 |

---

## 10. 재사용 가능한 컴포넌트 추출 후보

### 10.1 인라인 모달 래퍼 (High Priority)

**현재 중복:**
```
// PublisherPicker, SeriesPicker, SeriesCard, 
// (admin)/classes, /notices, /weekly-sentences, /bus/BusStopAssignmentManager 등 17개 파일
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
     onClick={onClose}>
  <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
       onClick={(e) => e.stopPropagation()}>
    ...
  </div>
</div>
```

**추출 후보:** `<ModalSheet>` 또는 shadcn `Dialog` 전면 채택. FocusTrap, Escape 닫기, 배경 클릭 닫기를 한 곳에서 처리.

---

### 10.2 EntityPicker (Med Priority)

`PublisherPicker`와 `SeriesPicker`가 구조적으로 동일하다. 제네릭 타입으로 추출 가능:

```tsx
// 공통 패턴 추출 대상
interface EntityPickerProps<T extends { id: string; name: string }> {
  value: string | null;
  onChange: (id: string | null) => void;
  options: T[];
  onCreateNew: (name: string) => Promise<T>;
  placeholder?: string;
  createLabel?: string;
  disabled?: boolean;
}
```

---

### 10.3 NativeSelectField (Med Priority)

native `<select>`를 래핑해 일관된 스타일 적용:

```tsx
// 현재 각 파일에서 동일한 클래스 반복
className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
// 또는
className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
```

공용 `SelectField` 또는 `NativeSelect` 컴포넌트로 추출.

---

### 10.4 StatusBadge용 Config 생성 유틸 (Low Priority)

`TeacherBadges`의 `t.teacher_type === "native" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"` 패턴이 다른 곳에서도 반복될 가능성이 높다. `getTeacherTypeConfig()` 유틸로 추출해 `student-age-colors.ts`와 같은 패턴으로 `lib/ui/teacher-type-colors.ts`에 위치.

---

### 10.5 TabNav (Low Priority)

`QueryTabNav`, `StudentTabNav`, `TextbooksPageClient` 내 탭, `BusTabNav` 등 여러 탭 컴포넌트가 존재한다. URL 기반 탭과 상태 기반 탭, 아이콘 유무 등 요구사항이 달라 100% 통일은 어렵지만, shadcn `Tabs` 컴포넌트를 기반으로 한 공통 스타일 레이어를 만들어 `border-b-[3px]` 스타일 등을 중앙에서 관리할 수 있다.

---

### 10.6 InlineFeedback (Low Priority)

에러/성공 인라인 피드백 박스:
```
// 현재 패턴들
"text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg"
"text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg"
"text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg"
"rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700"
```

최소 4가지 패턴이 유사한 역할을 한다. `<InlineFeedback variant="error|success|warning">` 하나로 통일 가능.

---

*리뷰 끝 — 총 10개 섹션, 1,900여 줄*
