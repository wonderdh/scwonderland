# SC Wonderland 폴더 구조 분석 및 리팩토링 플랜

> 작성일: 2026-02-25

---

## 1. 현재 구조 분석

### 1-1. 전체 폴더 구조

```
c:/scwonderland/
├── app/
│   ├── page.tsx                          # 랜딩 페이지 (Hero + MainProgram)
│   ├── layout.tsx                        # RootLayout + LayoutSwitcher
│   ├── globals.css                       # Tailwind v4 + CSS 변수
│   │
│   ├── components/                       # 사이트 전용 컴포넌트 (이름이 모호)
│   │   ├── layout/                       # Navigation, Footer, SubNav, CategoryLayout 등
│   │   ├── sections/                     # Hero, MainProgram, SideBar
│   │   └── common/                       # ImageWithFallback
│   │
│   ├── (content)/                        # 공개 웹사이트 (5개 카테고리)
│   │   ├── about-wonderland/             # layout.tsx + 4개 페이지
│   │   ├── program/                      # layout.tsx + 5개 페이지 (CSS Modules)
│   │   ├── notice/                       # layout.tsx + news/
│   │   ├── community/                    # layout.tsx + 3개 페이지
│   │   └── experience/                   # layout.tsx + 3개 페이지
│   │
│   ├── (admin)/admin/                    # 관리자 대시보드
│   │   ├── layout.tsx, page.tsx
│   │   ├── actions.ts                    # 693줄, 34개 함수 (비대)
│   │   ├── textbook-actions.ts           # 이미 분리된 패턴
│   │   ├── components/                   # 15개 파일 flat (dead code 3개 포함)
│   │   ├── students/                     # page.tsx + components/ (5개)
│   │   ├── teachers/                     # page.tsx + components/ (1개)
│   │   ├── classes/                      # page.tsx + components/
│   │   └── textbooks/                    # page.tsx + components/
│   │
│   └── (academy)/academy/               # 학생·교사 포털
│       ├── layout.tsx, page.tsx
│       ├── actions.ts                    # 383줄
│       ├── components/                   # LogoutButton만
│       ├── login/                        # LoginForm.tsx 포함
│       ├── dashboard/
│       ├── student/                      # layout + components/ (2개) + 기능 페이지
│       └── teacher/                      # layout + components/ (3개) + 기능 페이지
│
├── components/                           # shadcn/ui 컴포넌트 (root 레벨)
│   └── ui/                               # button, card, input 등 10개
│
├── lib/
│   ├── menu-routes.ts                    # content 라우트 중앙 설정
│   ├── utils.ts                          # cn() 유틸리티
│   └── supabase/                         # client.ts, server.ts, admin.ts
│
└── middleware.ts                         # 세션 갱신
```

### 1-2. 발견된 문제점

#### 구조적 문제

| 문제 | 설명 | 심각도 |
|------|------|--------|
| **LayoutSwitcher 런타임 분기** | pathname 기반 조건분기로 사이트/관리 레이아웃 구분 — 구조적 분리가 아닌 클라이언트 코드 분기 | 중 |
| **`app/components/` 이름 모호** | 실제로는 사이트(소개) 전용이지만 app-wide 공유처럼 보임 | 중 |
| **크로스 라우트그룹 의존성** | `AdminSidebar`가 `(academy)` 내부의 `LogoutButton`을 import | 중 |
| **Admin 컴포넌트 flat 구조** | `admin/components/`에 15개 파일이 feature 구분 없이 혼재 | 중 |
| **`admin/actions.ts` 비대** | 693줄, 34개 함수 (user/report/class/dashboard 모두 한 파일) | 높음 |
| **타입 산재** | 6개+ 타입이 actions 파일 내부에 정의, 재사용 어려움 | 낮음 |

#### 코드 품질 문제

| 문제 | 위치 | 설명 |
|------|------|------|
| **이메일 정규화 중복 + 버그** | `admin/actions.ts:8-12` + `LoginForm.tsx:56-60` | 동일 로직이 `normalizeEmail()` / `toFullEmail()`로 중복. LoginForm은 env variable 무시하고 `@scwonderland.com` 하드코딩 |
| **Dead Code 3개** | `admin/components/` | `AddUserForm.tsx`, `StudentDetailCard.tsx`, `TeacherDetailCard.tsx` — 어디서도 import 안 됨 |
| **에러 메시지 비공유** | `LoginForm.tsx:17-41` | `getLoginErrorMessage()` 함수가 컴포넌트 내부에 정의, 재사용 불가 |

#### 잘 된 부분 (변경 불필요)

| 항목 | 이유 |
|------|------|
| `lib/supabase/` 3-client 패턴 | browser/server/admin 용도별 깔끔한 분리 |
| `lib/menu-routes.ts` 중앙 라우팅 | 모든 content 라우트를 한 곳에서 관리 |
| `components/ui/` shadcn 위치 | CLI 설정과 연동, 표준 패턴 |
| CSS Module co-location | 각 페이지에 필요한 스타일만 같은 폴더에 |
| 인증 흐름 (middleware + layout guard) | 2단계 검증 패턴 |
| `academy/actions.ts` 크기 | 383줄으로 관리 가능한 수준 |

---

## 2. 리팩토링 플랜

### 핵심 변경: `(site)` 라우트 그룹으로 소개 사이트 분리

`LayoutSwitcher`를 제거하고, Next.js App Router의 라우트 그룹 layout을 활용하여 소개 사이트와 관리 기능을 구조적으로 분리.

### 리팩토링 후 최종 구조

```
app/
├── layout.tsx                      # 최소: 폰트, 메타데이터, html/body만
├── globals.css
│
├── (site)/                         # ═══ 학원 소개 사이트 ═══
│   ├── layout.tsx                  # Navigation + SideBar + Footer
│   ├── page.tsx                    # 랜딩 페이지
│   ├── _components/                # 사이트 전용 컴포넌트
│   │   ├── layout/                 # Navigation, SubNav, CategoryLayout, Footer 등
│   │   ├── sections/               # Hero, MainProgram, SideBar, PageContent
│   │   └── common/                 # ImageWithFallback
│   ├── about-wonderland/           # 카테고리 페이지들 (직접 배치)
│   ├── program/
│   ├── notice/
│   ├── community/
│   └── experience/
│
├── (admin)/admin/                  # ═══ 관리자 대시보드 ═══
│   ├── layout.tsx
│   ├── page.tsx
│   ├── actions.ts                  # barrel re-export
│   ├── actions/                    # 도메인별 분할
│   │   ├── user-actions.ts
│   │   ├── report-actions.ts
│   │   ├── class-actions.ts
│   │   ├── dashboard-actions.ts
│   │   ├── textbook-actions.ts
│   │   └── textbook-constants.ts
│   ├── components/                 # 공유 컴포넌트만 (6개)
│   ├── students/components/        # 학생 전용 (8개)
│   ├── teachers/components/        # 교사 전용 (4개)
│   ├── classes/components/
│   └── textbooks/components/
│
├── (academy)/academy/              # ═══ 학생·교사 포털 ═══
│   ├── layout.tsx
│   ├── actions.ts
│   ├── login/, dashboard/
│   ├── student/, teacher/
│
components/                         # ═══ 프로젝트 공통 ═══
│   ├── ui/                         # shadcn/ui (10개)
│   └── LogoutButton.tsx            # admin + academy 공유
│
lib/                                # ═══ 공유 유틸리티 ═══
│   ├── menu-routes.ts
│   ├── utils.ts
│   ├── auth-utils.ts               # NEW: normalizeEmail + getAuthErrorMessage
│   ├── supabase/
│   └── types/
│       ├── database.ts             # NEW: 공유 타입
│       └── index.ts
```

---

### Phase 0: Dead Code 삭제

| 파일 | 이유 |
|------|------|
| `admin/components/AddUserForm.tsx` | `AddStudentForm`/`AddTeacherForm`으로 대체됨 |
| `admin/components/StudentDetailCard.tsx` | `StudentSelectedView.tsx`로 대체됨 |
| `admin/components/TeacherDetailCard.tsx` | `TeacherInfoCard.tsx`로 대체됨 |

---

### Phase 1: `(site)` 라우트 그룹 생성

**목적:** 소개 사이트를 구조적으로 분리, `LayoutSwitcher` 제거

1. `app/(site)/` 폴더 생성
2. `app/page.tsx` → `app/(site)/page.tsx` 이동
3. `app/components/` → `app/(site)/_components/` 이동
4. `app/(content)/` 내부 폴더들 → `app/(site)/` 아래로 이동 (content 래퍼 제거)
5. `app/(site)/layout.tsx` 생성 (Navigation + SideBar + Footer)
6. `app/layout.tsx`에서 LayoutSwitcher 제거
7. `LayoutSwitcher.tsx` 삭제
8. Import 경로 업데이트

**`(site)/layout.tsx` 코드:**
```tsx
import { Navigation } from "./_components/layout/Navigation";
import { Footer } from "./_components/layout/Footer";
import { SideBar } from "./_components/sections/SideBar";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navigation />
      <SideBar />
      {children}
      <Footer />
    </>
  );
}
```

---

### Phase 2: 공유 유틸리티 추출

**2-1. `lib/auth-utils.ts` 생성**

- `normalizeEmail()` — `admin/actions.ts`에서 추출
- `getAuthErrorMessage()` — `LoginForm.tsx`에서 추출
- `LoginForm.tsx` 버그 수정: `@scwonderland.com` 하드코딩 → env variable 사용

**2-2. `LogoutButton` 이동**

- `app/(academy)/academy/components/LogoutButton.tsx` → `components/LogoutButton.tsx`
- 크로스 라우트그룹 의존성 해소

---

### Phase 3: Admin Actions 분할

`admin/actions.ts` (693줄) → 도메인별 파일 분할

| 파일 | 포함 함수 | ~줄 |
|------|-----------|-----|
| `actions/user-actions.ts` | createStudent, createTeacher, listUsersByRole, deleteUserById, updateStudentProfile, updateTeacherProfile, resetUserPassword, listAllStudents | 220 |
| `actions/report-actions.ts` | getReportCard, listReportCardsByStudent, upsertReportCard, updateReportCardReply | 130 |
| `actions/class-actions.ts` | listClassesWithDetails, getClassWithStudents, createClass, updateClass, deleteClass, addStudentToClass, removeStudentFromClass 등 | 260 |
| `actions/dashboard-actions.ts` | getDashboardStats | 30 |
| `actions/textbook-actions.ts` | 기존 textbook-actions.ts 이동 | 기존 |

**호환성:** `actions.ts`를 barrel re-export 파일로 유지 → 기존 import 변경 불필요

---

### Phase 4: Admin 컴포넌트 co-location

Feature-specific 컴포넌트를 해당 라우트 폴더로 이동

| 이동 파일 | From → To |
|-----------|-----------|
| `AddStudentForm.tsx` | `admin/components/` → `admin/students/components/` |
| `StudentSelectedView.tsx` | `admin/components/` → `admin/students/components/` |
| `StudentTabNav.tsx` | `admin/components/` → `admin/students/components/` |
| `AddTeacherForm.tsx` | `admin/components/` → `admin/teachers/components/` |
| `TeacherInfoCard.tsx` | `admin/components/` → `admin/teachers/components/` |
| `TeacherTabNav.tsx` | `admin/components/` → `admin/teachers/components/` |

---

### Phase 5: 타입 중앙화

`lib/types/database.ts` 생성 — 공유 타입 정의

추출 대상:
- `UserWithProfile`, `DashboardStats`, `ReportCard`, `ReportCardListItem`, `ClassWithDetails`, `ClassStudentRow`
- `StudentProfile`, `StudentClassItem`, `TeacherProfile`, `TeacherClassWithStudents`
- `Textbook`, `ClassTextbook` 등

---

## 3. 미래 기능 호환성

| 예정 기능 | 구조적 대응 |
|-----------|-------------|
| **관리자 게시글 작성** | Admin server action → DB 저장 → `(site)/notice/news/` 페이지에서 DB 읽기. 컴포넌트 독립 |
| **홈페이지 상담 예약** | `(site)/community/parent-consultation/`에 폼 추가 → server action → DB → Admin에서 목록 확인 |
| **공유 데이터 타입** | `lib/types/`에서 양쪽 모두 import 가능 |

라우트 그룹은 URL에 영향을 주지 않으며, 데이터는 Supabase DB를 통해 공유되므로 크로스 기능에 구조적 제약 없음.

---

## 4. 검증 방법

각 Phase 완료 후:
1. `npm run build` — 빌드 에러 확인
2. `npm run lint` — lint 통과
3. `npm run dev` → 주요 페이지 확인:
   - `/` — 랜딩 (Navigation + Footer)
   - `/about-wonderland/greeting` — 카테고리 레이아웃
   - `/program/map` — SubNav 탭
   - `/admin` — 대시보드, 로그아웃
   - `/admin/students` — 학생 목록 + 상세
   - `/academy/login` — 이메일 정규화 동작
   - `/academy/student` — 학생 포털
4. URL 변경 없음 확인
