# 원더랜드 프로젝트 구조 문서

> 작성일: 2026-02-10  
> 프로젝트명: SC Wonderland (원더랜드 영어학원 웹사이트)

---

## 📋 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [기술 스택](#기술-스택)
3. [디렉토리 구조](#디렉토리-구조)
4. [스타일링 시스템](#스타일링-시스템)
5. [라우팅 시스템](#라우팅-시스템)
6. [컴포넌트 아키텍처](#컴포넌트-아키텍처)
7. [페이지 구성 및 렌더링 흐름](#페이지-구성-및-렌더링-흐름)
8. [주요 기능](#주요-기능)

---

## 🎯 프로젝트 개요

**원더랜드 영어학원** 공식 웹사이트로, 1992년 설립 이후 30년 전통의 유아·초등 영어 전문 교육기관을 소개하는 웹사이트입니다.

- **프레임워크**: Next.js 16.1.6 (App Router)
- **언어**: TypeScript 5
- **UI**: React 19.2.3
- **스타일링**: Tailwind CSS v4

---

## 🛠 기술 스택

### Core
- **Next.js 16.1.6** - App Router 기반 풀스택 프레임워크
- **React 19.2.3** - UI 라이브러리
- **TypeScript 5** - 타입 안전성

### Styling
- **Tailwind CSS v4** - 유틸리티 우선 CSS 프레임워크
- **PostCSS** - CSS 후처리
- **CSS Modules** - 컴포넌트 전용 스타일 (일부 페이지)

### Fonts
- **Geist Sans** - 기본 산세리프 폰트
- **Geist Mono** - 모노스페이스 폰트

### Build & Dev Tools
- **ESLint** - 코드 린팅 (Next.js + TypeScript)
- **next/image** - 이미지 최적화
- **Vercel** - 배포 플랫폼 (예상)

---

## 📁 디렉토리 구조

```
C:\scwonderland\
├── app/                                    # Next.js App Router 메인 디렉토리
│   ├── (content)/                          # Route Group (URL에 포함되지 않음)
│   │   ├── about-wonderland/               # About Wonderland 섹션
│   │   │   ├── greeting/                   # 인사말 페이지
│   │   │   │   └── page.tsx
│   │   │   ├── company-history/            # 회사연혁 페이지
│   │   │   │   └── page.tsx
│   │   │   ├── certification/              # 대외기관 인증 페이지
│   │   │   │   └── page.tsx
│   │   │   ├── wonderland/                 # Wonderland 소개 페이지
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx                  # About 섹션 공통 레이아웃
│   │   │
│   │   ├── program/                        # Program 섹션
│   │   │   ├── map/                        # 프로그램 MAP 페이지
│   │   │   │   └── page.tsx
│   │   │   ├── wonderland/                 # Wonderland 프로그램
│   │   │   │   ├── page.tsx
│   │   │   │   └── CurriculumProgram.module.css  # CSS Module
│   │   │   ├── wonder-k/                   # Wonder K 페이지
│   │   │   │   └── page.tsx
│   │   │   ├── primo-school/               # Primo School 페이지
│   │   │   │   └── page.tsx
│   │   │   ├── quest-academy/              # Quest Academy 페이지
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx                  # Program 섹션 공통 레이아웃
│   │   │
│   │   ├── experience/                     # Experience 섹션
│   │   │   ├── e-school/                   # Wonderland E-School
│   │   │   │   └── page.tsx
│   │   │   ├── library/                    # Library
│   │   │   │   └── page.tsx
│   │   │   ├── special-day/                # Special Day
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx                  # Experience 섹션 공통 레이아웃
│   │   │
│   │   ├── community/                      # Community 섹션
│   │   │   ├── campus/                     # 캠퍼스 페이지
│   │   │   │   └── page.tsx
│   │   │   ├── parent-consultation/        # 학부모상담 페이지
│   │   │   │   └── page.tsx
│   │   │   ├── franchise-inquiry/          # 가맹문의 페이지
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx                  # Community 섹션 공통 레이아웃
│   │   │
│   │   └── notice/                         # Notice 섹션
│   │       ├── news/                       # News 페이지
│   │       │   └── page.tsx
│   │       └── layout.tsx                  # Notice 섹션 공통 레이아웃
│   │
│   ├── components/                         # 재사용 가능한 컴포넌트
│   │   ├── layout/                         # 레이아웃 컴포넌트
│   │   │   ├── Navigation.tsx              # 상단 메인 네비게이션
│   │   │   ├── SubNav.tsx                  # 서브 네비게이션
│   │   │   ├── CategoryLayout.tsx          # 카테고리 레이아웃 래퍼
│   │   │   └── CategoryPageWrapper.tsx     # 페이지 래퍼 (SideBar + Footer)
│   │   │
│   │   ├── sections/                       # 섹션 컴포넌트
│   │   │   ├── Hero.tsx                    # 홈페이지 히어로 섹션
│   │   │   ├── SideBar.tsx                 # 사이드바 (퀵 링크)
│   │   │   └── PageContent.tsx             # 페이지 콘텐츠 래퍼
│   │   │
│   │   └── common/                         # 공통 유틸리티 컴포넌트
│   │       └── ImageWithFallback.tsx       # 이미지 에러 처리 컴포넌트
│   │
│   ├── favicon.ico                         # 파비콘
│   ├── globals.css                         # 전역 CSS 스타일
│   ├── layout.tsx                          # 루트 레이아웃
│   └── page.tsx                            # 홈페이지
│
├── lib/                                    # 유틸리티 및 헬퍼 함수
│   └── menu-routes.ts                      # 메뉴 라우팅 로직
│
├── public/                                 # 정적 파일
│   ├── images/                             # 이미지 리소스
│   │   ├── about-wonderland/               # About 섹션 이미지
│   │   ├── common/                         # 공통 이미지
│   │   └── program/                        # Program 섹션 이미지
│   └── sc-wonderland-logo.png              # 메인 로고
│
├── tmp/                                    # 임시 파일 (현재 미사용)
│   ├── commonui.css
│   └── reset.css
│
├── eslint.config.mjs                       # ESLint 설정
├── next.config.ts                          # Next.js 설정
├── package.json                            # 의존성 관리
├── postcss.config.mjs                      # PostCSS 설정
├── tsconfig.json                           # TypeScript 설정
└── README.md                               # 프로젝트 README
```

---

## 🎨 스타일링 시스템

### 1. Tailwind CSS (주 스타일링 방식)

프로젝트의 **거의 모든 스타일**은 Tailwind CSS 유틸리티 클래스로 작성되어 있습니다.

#### 설정 파일

**`app/globals.css`**
```css
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #171717;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}
```

#### 특징
- **CSS 변수 기반 테마**: `:root`에서 `--background`, `--foreground` 정의
- **다크모드 지원**: `prefers-color-scheme: dark` 미디어 쿼리
- **반응형 디자인**: `sm:`, `md:`, `lg:`, `xl:` 브레이크포인트 사용

#### 주요 색상 팔레트
| 색상 | Tailwind 클래스 | 용도 |
|------|----------------|------|
| 오렌지 | `orange-500` (#ff7700) | 메인 액센트 (CTA, 호버 효과) |
| 그린 | `green-600` (#52b978) | 서브 네비게이션, 인사말 |
| 블루 | `blue-500` (#3a75ff) | 사이드바 퀵링크 |
| 레드 | `red-500` (#e73357) | 사이드바 퀵링크, 강조 |
| 그레이 | `gray-50~900` | 배경, 텍스트, 테두리 |

#### 사용 예시
```tsx
// Navigation.tsx
<nav className="fixed left-0 right-0 top-0 z-50 border-b border-black/5 bg-white">
  <button className="hover:text-orange-600 transition">
    About Wonderland
  </button>
</nav>

// Hero.tsx
<section className="scroll-mt-24 bg-gray-50 pt-20">
  <h1 className="mb-6 text-5xl font-bold md:text-7xl">
    왜 원더랜드 일까요?
  </h1>
</section>
```

---

### 2. CSS Modules (특수 레이아웃)

**단 하나의 페이지**에서만 CSS Module을 사용합니다: **Wonderland 프로그램 페이지**.

#### 파일 위치
```
app/(content)/program/wonderland/CurriculumProgram.module.css
```

#### 사용 이유
원형 레이아웃의 복잡한 절대 위치 지정 때문에 CSS Module을 사용합니다.

#### 주요 스타일
```css
/* 원형 카드 레이아웃 */
.node {
  position: absolute;
  border-radius: 50%;
  width: 200px;
  height: 200px;
  transform: translate(-50%, -50%);
}

.pr1 { left: 50%; top: 12%; border: solid 4px #e73357; }
.pr2 { left: 78%; top: 28%; border: solid 4px #6cbfe0; }
.pr3 { left: 22%; top: 28%; border: solid 4px #44ba96; }
.pr4 { left: 78%; top: 72%; border: solid 4px #ffa400; }
.pr5 { left: 22%; top: 72%; border: solid 4px #8c40b4; }

/* 반응형 */
@media (max-width: 768px) {
  .node {
    position: relative;
    width: 100%;
    border-radius: 16px;
  }
}
```

#### 사용 예시
```tsx
import styles from "./CurriculumProgram.module.css";

<div className={styles.wrapper}>
  <div className={`${styles.node} ${styles.pr1}`}>
    <span className={styles.nodeTitle}>표현생활</span>
    <p className={styles.nodeContent}>예술적 감성 개발</p>
  </div>
</div>
```

---

### 3. 미사용 스타일 파일

`tmp/` 폴더에 있는 파일들은 **현재 사용되지 않습니다**:
- `tmp/reset.css` - CSS 리셋 (기존 프로젝트에서 사용)
- `tmp/commonui.css` - 공통 UI 스타일 (Tailwind로 대체됨)

---

### 4. 스타일 사용 분포

| 파일/컴포넌트 | 스타일링 방식 | 비고 |
|--------------|--------------|------|
| `app/layout.tsx` | Tailwind CSS | 루트 레이아웃 |
| `app/page.tsx` | Tailwind CSS | 홈페이지 |
| `app/globals.css` | CSS 변수 + Tailwind | 전역 스타일 |
| `components/layout/Navigation.tsx` | Tailwind CSS | 메인 네비게이션 |
| `components/layout/SubNav.tsx` | Tailwind CSS | 서브 네비게이션 |
| `components/sections/Hero.tsx` | Tailwind CSS | 히어로 섹션 |
| `components/sections/SideBar.tsx` | Tailwind CSS | 사이드바 |
| `(content)/**/page.tsx` | Tailwind CSS | 모든 콘텐츠 페이지 |
| `program/wonderland/page.tsx` | **CSS Module** | 원형 레이아웃 전용 |

---

## 🔀 라우팅 시스템

### 1. Next.js App Router

프로젝트는 **Next.js 14+ App Router**를 사용합니다.

#### Route Group: `(content)`
URL 경로에 포함되지 않는 폴더 그룹화 방식입니다.

```
app/(content)/about-wonderland/greeting/page.tsx
→ URL: /about-wonderland/greeting  (❌ /content/about-wonderland/greeting)
```

---

### 2. 라우팅 로직 (`lib/menu-routes.ts`)

모든 라우팅 로직은 **중앙 집중식**으로 관리됩니다.

#### 주요 데이터 구조

```typescript
// 메뉴 ID → URL 경로 prefix
export const menuIdToPath: Record<string, string> = {
  about: "about-wonderland",
  programs: "program",
  features: "notice",
  gallery: "community",
  contact: "experience",
};

// 메뉴별 아이템 라벨 → 영어 slug
export const itemSlugs: Record<string, Record<string, string>> = {
  about: {
    인사말: "greeting",
    회사연혁: "company-history",
    "대외기관 인증": "certification",
    Wonderland: "wonderland",
  },
  programs: {
    MAP: "map",
    Wonderland: "wonderland",
    "Wonder K": "wonder-k",
    "Primo School": "primo-school",
    "Quest Academy": "quest-academy",
  },
  // ...
};
```

#### 헬퍼 함수

```typescript
// 메뉴 아이템 전체 경로 반환
getMenuItemHref("about", "인사말")  // → "/about-wonderland/greeting"

// 메뉴의 첫 번째 아이템 경로
getDefaultMenuItemHref("programs")  // → "/program/map"

// 카테고리의 모든 아이템 라벨
getCategoryItemLabels("about")      // → ["인사말", "회사연혁", ...]
```

---

### 3. 라우팅 맵 (전체 URL)

| 메뉴 ID | 카테고리 | 아이템 | URL 경로 |
|---------|---------|--------|----------|
| `about` | About Wonderland | 인사말 | `/about-wonderland/greeting` |
| | | 회사연혁 | `/about-wonderland/company-history` |
| | | 대외기관 인증 | `/about-wonderland/certification` |
| | | Wonderland | `/about-wonderland/wonderland` |
| `programs` | Program | MAP | `/program/map` |
| | | Wonderland | `/program/wonderland` |
| | | Wonder K | `/program/wonder-k` |
| | | Primo School | `/program/primo-school` |
| | | Quest Academy | `/program/quest-academy` |
| `features` | Notice | News | `/notice/news` |
| `gallery` | Community | 학부모상담 | `/community/parent-consultation` |
| | | 가맹문의 | `/community/franchise-inquiry` |
| | | 캠퍼스 | `/community/campus` |
| `contact` | Experience | Special Day | `/experience/special-day` |
| | | Wonderland E-School | `/experience/e-school` |
| | | Library | `/experience/library` |

---

## 🧩 컴포넌트 아키텍처

### 컴포넌트 계층 구조

```
RootLayout (app/layout.tsx)
├── Navigation                           # 고정 상단 네비게이션
└── children
    ├── [홈페이지] (app/page.tsx)
    │   ├── SideBar                      # 사이드바 퀵링크
    │   ├── Hero                         # 히어로 섹션
    │   └── Footer                       # 푸터
    │
    └── [카테고리 페이지] ((content)/*/layout.tsx)
        └── CategoryPageWrapper
            ├── SideBar                  # 사이드바 퀵링크
            ├── CategoryLayout
            │   ├── SubNav               # 서브 네비게이션
            │   └── children             # 실제 페이지 콘텐츠
            └── Footer                   # 푸터
```

---

### 1. Layout 컴포넌트

#### `app/layout.tsx` (루트 레이아웃)
```tsx
export default function RootLayout({ children }) {
  return (
    <html lang="ko" className="scroll-smooth">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Navigation />    {/* 전역 네비게이션 */}
        {children}
      </body>
    </html>
  );
}
```

**역할:**
- 전역 폰트 설정 (Geist Sans, Geist Mono)
- SEO 메타데이터 (`title`, `description`)
- `<Navigation>` 컴포넌트를 모든 페이지에 표시

---

#### `components/layout/CategoryLayout.tsx`
```tsx
export function CategoryLayout({ menuId, categoryTitle, children }) {
  const pathname = usePathname();
  const currentSlug = pathname.split("/")[1] ?? "";

  return (
    <>
      <SubNav categoryTitle={categoryTitle} menuId={menuId} currentSlug={currentSlug} />
      {children}
    </>
  );
}
```

**역할:**
- 카테고리별 서브 네비게이션 표시
- 현재 활성 페이지 감지 (`usePathname`)

**사용 위치:**
- `app/(content)/about-wonderland/layout.tsx`
- `app/(content)/program/layout.tsx`
- 모든 카테고리 레이아웃

---

#### `components/layout/CategoryPageWrapper.tsx`
```tsx
export function CategoryPageWrapper({ children }) {
  return (
    <main className="min-h-screen bg-white">
      <SideBar />      {/* 사이드바 퀵링크 */}
      {children}
      <footer>...</footer>  {/* 푸터 */}
    </main>
  );
}
```

**역할:**
- 사이드바 + 메인 콘텐츠 + 푸터 래핑
- 모든 카테고리 페이지의 공통 구조

---

### 2. Navigation 컴포넌트

#### `components/layout/Navigation.tsx`

**구조:**
```tsx
<nav className="fixed left-0 right-0 top-0 z-50 bg-white">
  {/* 로고 */}
  <Link href="/">
    <Image src="/sc-wonderland-logo.png" />
  </Link>

  {/* 메뉴 아이템 */}
  {menuItems.map(item => (
    <Link href={getDefaultMenuItemHref(item.id)}>
      {item.label}
    </Link>
  ))}

  {/* 메가 메뉴 패널 (호버 시 표시) */}
  <div className="mega-menu">
    {menuItems.map(menu => (
      <div key={menu.id}>
        {megaMenuItems[menu.id].map(subItem => (
          <Link href={getMenuItemHref(menu.id, subItem)}>
            {subItem}
          </Link>
        ))}
      </div>
    ))}
  </div>
</nav>
```

**주요 기능:**
1. **메인 메뉴**: About Wonderland, Program, Notice, Community, Experience
2. **메가 메뉴**: 마우스 호버 시 하위 메뉴 드롭다운
3. **활성 상태**: 현재 페이지에 따라 메뉴 하이라이트
4. **반응형**: 모바일에서는 햄버거 메뉴

**상태 관리:**
```tsx
const [isOpen, setIsOpen] = useState(false);           // 모바일 메뉴 열림/닫힘
const [activeId, setActiveId] = useState("about");     // 현재 활성 메뉴
const [hoveredId, setHoveredId] = useState<string | null>(null);  // 호버된 메뉴
```

---

#### `components/layout/SubNav.tsx`

**구조:**
```tsx
<header className="border-b border-gray-200 bg-gray-50/80">
  <h1>{categoryTitle}</h1>  {/* 카테고리 제목 */}
  
  <nav>
    {items.map(label => {
      const isActive = slug === currentSlug;
      return (
        <Link href={getMenuItemHref(menuId, label)} className={isActive ? "text-green-600" : ""}>
          {label}
          {isActive && <span className="bg-green-600 h-0.5" />}  {/* 활성 표시 */}
        </Link>
      );
    })}
  </nav>
</header>
```

**역할:**
- 카테고리 제목 표시 (예: "About Wonderland")
- 하위 페이지 네비게이션 (예: 인사말, 회사연혁, ...)
- 현재 활성 페이지 하이라이트

---

### 3. Section 컴포넌트

#### `components/sections/Hero.tsx`

**구조:**
```tsx
<section id="about" className="bg-gray-50 pt-20">
  {/* 헤드라인 */}
  <h1 className="text-5xl font-bold md:text-7xl">
    "왜 <span className="text-red-500">원</span>
        <span className="text-yellow-500">더</span>
        <span className="text-green-500">랜</span>
        <span className="text-blue-500">드</span> 일까요?"
  </h1>
  
  {/* CTA 버튼 */}
  <Link href="/community/parent-consultation">
    상담 신청하기
  </Link>
  
  {/* 이미지 갤러리 */}
  <div className="grid grid-cols-3">
    <ImageWithFallback src="https://unsplash.com/..." />
    <ImageWithFallback src="https://unsplash.com/..." />
    <ImageWithFallback src="https://unsplash.com/..." />
  </div>
</section>
```

**역할:**
- 홈페이지 메인 비주얼
- 브랜드 메시지 전달
- CTA (Call-to-Action) 버튼 제공

---

#### `components/sections/SideBar.tsx`

**구조:**
```tsx
<aside className="fixed right-8 top-1/2 z-40 hidden lg:block">
  {/* 리포트 카드 */}
  <a href="https://wonderland-reportcard.web.app" className="bg-red-500 text-white">
    <h3>리포트 카드</h3>
    <p>학습 성과 확인</p>
  </a>
  
  {/* 레벨테스트 */}
  <a href="http://qawonderland.com/leveltest/" className="bg-blue-500 text-white">
    <h3>레벨테스트</h3>
    <p>실력 평가</p>
  </a>
</aside>
```

**역할:**
- 외부 서비스 퀵 링크 제공
- 화면 우측에 고정 위치
- 데스크톱에서만 표시 (`lg:block`)

---

### 4. Common 컴포넌트

#### `components/common/ImageWithFallback.tsx`

**구조:**
```tsx
export function ImageWithFallback({ src, alt, ...rest }) {
  const [didError, setDidError] = useState(false);

  if (didError) {
    return <img src={ERROR_IMG_SRC} />;  // 에러 시 플레이스홀더
  }

  return (
    <img src={src} alt={alt} onError={() => setDidError(true)} {...rest} />
  );
}
```

**역할:**
- 이미지 로드 실패 시 폴백 이미지 표시
- 사용자 경험 개선

**사용 위치:**
- `Hero.tsx` (Unsplash 이미지)
- 기타 외부 이미지 사용 컴포넌트

---

## 📄 페이지 구성 및 렌더링 흐름

### 1. 홈페이지 (`app/page.tsx`)

#### 컴포넌트 트리
```
RootLayout
├── Navigation (고정 상단)
└── Home (page.tsx)
    ├── SideBar (우측 고정)
    ├── Hero (메인 섹션)
    └── Footer
```

#### 렌더링 순서
1. **`app/layout.tsx`** 렌더링
   - 폰트 설정 (`Geist Sans`, `Geist Mono`)
   - `<Navigation>` 마운트
   - `globals.css` 적용

2. **`app/page.tsx`** 렌더링
   - `<SideBar>` 마운트 (우측 고정)
   - `<Hero>` 마운트
     - 헤드라인 + CTA 버튼
     - 3개의 `<ImageWithFallback>` 렌더링
   - `<footer>` 렌더링

#### CSS 사용
- **Tailwind CSS**: 모든 스타일
- **클래스 예시**:
  - `min-h-screen bg-white` (전체 페이지)
  - `text-5xl font-bold md:text-7xl` (헤드라인)
  - `bg-gray-900 px-10 py-4 text-white` (CTA 버튼)

---

### 2. 카테고리 페이지 (예: `/about-wonderland/greeting`)

#### 컴포넌트 트리
```
RootLayout
├── Navigation (고정 상단)
└── AboutWonderlandLayout ((content)/about-wonderland/layout.tsx)
    └── CategoryPageWrapper
        ├── SideBar (우측 고정)
        └── CategoryLayout
            ├── SubNav (서브 네비게이션)
            └── GreetingPage (greeting/page.tsx)
                ├── 텍스트 콘텐츠
                └── 이미지
```

#### 렌더링 순서
1. **`app/layout.tsx`** 렌더링
   - `<Navigation>` 마운트

2. **`(content)/about-wonderland/layout.tsx`** 렌더링
   - `<CategoryPageWrapper>` 마운트
     - `<SideBar>` 마운트 (우측 고정)
   - `<CategoryLayout>` 마운트
     - `menuId="about"`, `categoryTitle="About Wonderland"` props 전달

3. **`<CategoryLayout>`** 렌더링
   - `usePathname()` 호출 → 현재 경로 확인
   - `currentSlug = "greeting"` 계산
   - `<SubNav>` 마운트
     - `getCategoryItemLabels("about")` 호출 → `["인사말", "회사연혁", ...]`
     - 각 아이템을 `<Link>`로 렌더링
     - `currentSlug === "greeting"` → 인사말 메뉴 활성화

4. **`greeting/page.tsx`** 렌더링
   - 페이지 콘텐츠 표시
   - `<Image>` 컴포넌트로 이미지 렌더링

5. **`<footer>`** 렌더링 (CategoryPageWrapper 내부)

#### CSS 사용
- **Tailwind CSS**: 모든 스타일
- **클래스 예시**:
  - `border-b border-gray-200 bg-gray-50/80` (SubNav 배경)
  - `text-green-600` (활성 메뉴)
  - `grid gap-12 lg:grid-cols-[1fr_1fr]` (2단 레이아웃)

---

### 3. Wonderland 프로그램 페이지 (`/program/wonderland`)

#### 컴포넌트 트리
```
RootLayout
├── Navigation
└── ProgramLayout ((content)/program/layout.tsx)
    └── CategoryPageWrapper
        ├── SideBar
        └── CategoryLayout
            ├── SubNav
            └── WonderlandPage (program/wonderland/page.tsx)
                ├── CurriculumProgram 컴포넌트
                │   ├── .wrapper (CSS Module)
                │   ├── .node.pr1 (표현생활)
                │   ├── .node.pr2 (자연탐구생활)
                │   ├── .node.pr3 (사회생활)
                │   ├── .node.pr4 (신체, 건강생활)
                │   ├── .node.pr5 (언어생활)
                │   └── .center (중앙 로고)
                └── 기타 콘텐츠
```

#### 렌더링 순서
1. **공통 레이아웃** 렌더링 (위와 동일)

2. **`program/wonderland/page.tsx`** 렌더링
   - CurriculumProgram 섹션 렌더링
   - **CSS Module** 클래스 적용
     - `styles.wrapper` → 원형 레이아웃 컨테이너
     - `styles.node` + `styles.pr1~5` → 5개 원형 카드
     - 각 카드는 `position: absolute`로 배치

3. **반응형 동작**
   - **Desktop**: 원형 레이아웃
   - **Mobile**: 세로 카드 레이아웃 (`position: relative`)

#### CSS 사용
- **CSS Module** (`CurriculumProgram.module.css`)
  - `.wrapper`, `.node`, `.pr1~5`, `.center`
- **Tailwind CSS** (나머지 콘텐츠)

---

## ✨ 주요 기능

### 1. 메가 메뉴 네비게이션

**위치**: `components/layout/Navigation.tsx`

**동작 방식:**
1. 사용자가 상단 메뉴에 **마우스 호버**
2. `onMouseEnter` 이벤트 → `setHoveredId(menuId)`
3. `hoveredId !== null` → 메가 메뉴 패널 표시
4. 패널 내부에서 하위 메뉴 표시 (5개 컬럼)
5. 사용자가 네비게이션 영역을 벗어나면 → `onMouseLeave` → `setHoveredId(null)`

**CSS 애니메이션:**
```tsx
<div className={[
  "transition-all duration-200",
  panelVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
].join(" ")}>
```

---

### 2. 서브 네비게이션

**위치**: `components/layout/SubNav.tsx`

**동작 방식:**
1. `usePathname()` 훅으로 현재 URL 확인
2. URL에서 `slug` 추출 (예: `/about-wonderland/greeting` → `greeting`)
3. `itemSlugs[menuId]`에서 현재 카테고리의 모든 아이템 가져오기
4. 현재 `slug`와 일치하는 아이템에 **활성 스타일** 적용
   - 텍스트 색상: `text-green-600`
   - 하단 바: `<span className="bg-green-600 h-0.5" />`

---

### 3. 사이드바 퀵 링크

**위치**: `components/sections/SideBar.tsx`

**기능:**
- 외부 서비스로의 빠른 이동
- **리포트 카드**: `https://wonderland-reportcard.web.app`
- **레벨테스트**: `http://qawonderland.com/leveltest/`

**CSS:**
- `fixed right-8 top-1/2 -translate-y-1/2` → 화면 우측 중앙 고정
- `hidden lg:block` → 데스크톱에서만 표시

---

### 4. 이미지 폴백 처리

**위치**: `components/common/ImageWithFallback.tsx`

**동작 방식:**
1. `<img>` 렌더링 시도
2. 이미지 로드 실패 → `onError` 이벤트 발생
3. `setDidError(true)` → 상태 변경
4. 플레이스홀더 이미지 표시 (Base64 SVG)

---

### 5. 반응형 디자인

**브레이크포인트:**
| 디바이스 | Tailwind 클래스 | 화면 너비 |
|---------|----------------|----------|
| Mobile | (기본) | < 640px |
| Tablet | `sm:`, `md:` | 640px ~ 1024px |
| Desktop | `lg:`, `xl:` | > 1024px |

**적용 예시:**
```tsx
// 네비게이션
<div className="hidden md:flex">  {/* 데스크톱: flex */}
<button className="md:hidden">   {/* 모바일: 햄버거 메뉴 */}

// 헤드라인
<h1 className="text-5xl md:text-7xl">  {/* 모바일: 5xl, 데스크톱: 7xl */}

// 그리드 레이아웃
<div className="grid gap-12 lg:grid-cols-[1fr_1fr]">  {/* 데스크톱: 2열 */}
```

---

### 6. SEO 최적화

**메타데이터 설정:**
```tsx
// app/layout.tsx
export const metadata: Metadata = {
  title: "원더랜드 영어학원",
  description: "아이들의 영어 자신감을 키우는 원더랜드 영어학원",
};

// app/(content)/about-wonderland/greeting/page.tsx
export const metadata: Metadata = {
  title: "인사말 | 원더랜드 영어학원",
  description: "원더랜드 영어학원 인사말 - Everyone Smiles in Wonderland",
};
```

---

### 7. 스무스 스크롤

**설정:**
```tsx
// app/layout.tsx
<html lang="ko" className="scroll-smooth">
```

**사용 예시:**
```tsx
// Navigation.tsx (홈페이지에서만)
<button onClick={() => {
  const element = document.getElementById("about");
  element.scrollIntoView({ behavior: "smooth" });
}}>
  About Wonderland
</button>
```

---

## 📊 페이지별 컴포넌트 매핑

| 페이지 경로 | 사용 컴포넌트 | CSS 방식 |
|------------|--------------|----------|
| `/` (홈) | `Navigation`, `SideBar`, `Hero`, `ImageWithFallback` | Tailwind CSS |
| `/about-wonderland/greeting` | `Navigation`, `SubNav`, `SideBar`, `CategoryLayout`, `CategoryPageWrapper` | Tailwind CSS |
| `/about-wonderland/company-history` | 위와 동일 | Tailwind CSS |
| `/program/map` | 위와 동일 | Tailwind CSS |
| `/program/wonderland` | 위와 동일 + CurriculumProgram | **CSS Module** |
| `/program/wonder-k` | `Navigation`, `SubNav`, `SideBar`, `CategoryLayout`, `PageContent` | Tailwind CSS |
| `/community/parent-consultation` | 위와 동일 | Tailwind CSS |
| `/notice/news` | 위와 동일 | Tailwind CSS |

---

## 🔗 컴포넌트 간 데이터 흐름

### 예시: 사용자가 "About Wonderland > 인사말" 클릭 시

1. **Navigation.tsx**
   - 사용자가 메가 메뉴에서 "인사말" 클릭
   - `getMenuItemHref("about", "인사말")` 호출
   - 반환값: `/about-wonderland/greeting`
   - Next.js Link로 라우팅

2. **menu-routes.ts**
   - `menuIdToPath["about"]` → `"about-wonderland"`
   - `itemSlugs["about"]["인사말"]` → `"greeting"`
   - 최종 경로: `/about-wonderland/greeting`

3. **layout.tsx (about-wonderland)**
   - `CategoryPageWrapper` 렌더링
   - `CategoryLayout` 렌더링
     - `menuId="about"` props 전달
     - `categoryTitle="About Wonderland"` props 전달

4. **SubNav.tsx**
   - `usePathname()` → `/about-wonderland/greeting`
   - `currentSlug = "greeting"`
   - `getCategoryItemLabels("about")` → `["인사말", "회사연혁", ...]`
   - "인사말" 메뉴에 `text-green-600` 클래스 적용

5. **page.tsx (greeting)**
   - 인사말 페이지 콘텐츠 렌더링

---

## 📝 참고 사항

### 개발 시 주의사항

1. **CSS Module은 `program/wonderland`만 사용**
   - 다른 페이지는 모두 Tailwind CSS 사용
   - 일관성 유지 권장

2. **라우팅 변경 시 `menu-routes.ts` 수정 필수**
   - 새로운 페이지 추가 시 `itemSlugs`에 등록
   - `menuIdToPath` 변경 시 폴더명도 동일하게 수정

3. **이미지 최적화**
   - Next.js `<Image>` 컴포넌트 사용 권장
   - 외부 이미지는 `next.config.ts`에 도메인 등록 필요

4. **반응형 테스트**
   - Mobile (< 640px), Tablet (640~1024px), Desktop (> 1024px) 모두 확인

---

## 🚀 향후 개선 가능한 부분

1. **CSS 통일성**
   - CSS Module을 Tailwind CSS로 마이그레이션 고려
   - 또는 모든 복잡한 레이아웃을 CSS Module로 통일

2. **상태 관리**
   - Navigation 컴포넌트의 상태를 Context API로 분리
   - 전역 상태 관리 (Zustand, Jotai 등)

3. **페이지 콘텐츠**
   - 현재 플레이스홀더인 페이지들 콘텐츠 작성
   - CMS 연동 고려 (Contentful, Sanity 등)

4. **성능 최적화**
   - 이미지 lazy loading
   - 코드 스플리팅 (동적 import)
   - Lighthouse 점수 개선

---

## 📞 문의

프로젝트에 대한 문의사항은 원더랜드 영어학원으로 연락 주세요.

- 웹사이트: www.wonderland-english.com
- 설립: 1992년
- 전화: (문서에 명시되지 않음)

---

**문서 끝**
