# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SC Wonderland는 **원더랜드 영어학원** 웹사이트로, 학원 소개(공개), 관리자 대시보드, 학생/교사 포털의 3개 섹션으로 구성된다.

**기술 스택:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Supabase (Auth + PostgreSQL)

**대상 사용자:** 학부모/일반 방문자(공개 사이트), 관리자(학생·교사·반 관리), 학생(리포트카드 조회), 교사(리포트카드 작성)

## Development Commands

```bash
npm run dev      # 개발 서버 (http://localhost:3000)
npm run build    # 프로덕션 빌드
npm start        # 프로덕션 서버
npm run lint     # ESLint 실행
```

## Architecture

### Route Groups

```
app/
├── page.tsx                    # 메인 랜딩 페이지 (Hero + MainProgram)
├── (content)/                  # 공개 웹사이트
├── (admin)/admin/              # 관리자 대시보드 (/admin)
└── (academy)/academy/          # 학생·교사 포털 (/academy)
```

### Layout Composition

```
RootLayout (app/layout.tsx) — Geist 폰트, HTML lang="ko"
└── LayoutSwitcher — pathname 기반으로 레이아웃 분기
    ├── [/academy, /admin] → 최소 레이아웃 (Navigation 없음)
    └── [그 외] → 전체 레이아웃
        ├── Navigation (fixed top, mega menu)
        ├── SideBar (desktop: fixed right, mobile: FAB)
        ├── Page Content
        └── Footer
```

Content 섹션 내부:
```
CategoryLayout (menuId로 라우팅)
└── SubNav (카테고리 내 탭 네비게이션, 활성 항목 green-600 하이라이트)
    └── CategoryPageWrapper (pt-24 for fixed nav)
        └── Page Content
```

## Route Map

### (content) — 공개 웹사이트

| 경로 | 페이지 | 상태 |
|------|--------|------|
| `/` | 랜딩 (Hero + MainProgram) | ✅ |
| `/about-wonderland/greeting` | 원장 인사말 | ✅ |
| `/about-wonderland/company-history` | 연혁 타임라인 (1993~2022) | ✅ |
| `/about-wonderland/certification` | 대외기관 인증 | 🔲 placeholder |
| `/about-wonderland/wonderland` | 교육 철학 (Whole Language 등) | ✅ |
| `/program/map` | 프로그램 전체 MAP 이미지 | ✅ |
| `/program/wonderland` | 오전 유치부 (원형 커리큘럼 레이아웃) | ✅ |
| `/program/wonder-k` | 오후 유치부 | ✅ |
| `/program/primo-school` | 초등 저학년 | ✅ |
| `/program/quest-academy` | 초등 고학년·중등 | ✅ |
| `/notice/news` | 공지사항 (샘플 데이터) | ✅ |
| `/community/parent-consultation` | 학부모 상담 | 🔲 placeholder |
| `/community/franchise-inquiry` | 가맹 문의 | 🔲 placeholder |
| `/community/campus` | 캠퍼스 | 🔲 placeholder |
| `/experience/special-day` | Special Day | 🔲 placeholder |
| `/experience/e-school` | E-School | 🔲 placeholder |
| `/experience/library` | Library | 🔲 placeholder |

### (admin) — 관리자 대시보드

| 경로 | 페이지 | 기능 |
|------|--------|------|
| `/admin` | 대시보드 | 메인 진입점, 각 관리 페이지 링크 |
| `/admin/students` | 학생 관리 | 목록 조회, 검색, 생성, 수정, 삭제 |
| `/admin/students?tab=report` | 리포트카드 | 년/월 선택, 내용 작성(upsert), 학생 답변 조회 |
| `/admin/teachers` | 교사 관리 | 목록 조회, 검색, 생성, 수정, 삭제 |
| `/admin/classes` | 반 관리 | 반 CRUD, 담당 교사 배정, 학생 등록/제거 |

**보호:** middleware 세션 갱신 → layout.tsx에서 2단계 검증 (인증 확인 + role="admin" 확인)

### (academy) — 학생·교사 포털

| 경로 | 페이지 | 기능 |
|------|--------|------|
| `/academy/login` | 로그인 | 이메일/비밀번호, 자동 도메인 추가 |
| `/academy/dashboard` | 대시보드 | 역할별 리다이렉트 (admin→/admin, student→/academy/student) |
| `/academy/student` | 학생 정보 | 프로필, 소속 반, 담당 교사 조회 |
| `/academy/student/reports` | 리포트카드 | 년/월별 조회, 학생 답변 작성 |
| `/academy/student/homework` | 숙제 | 🔲 준비 중 |
| `/academy/teacher` | 교사 페이지 | 🔲 준비 중 |

## Database Schema

```
Supabase Auth Users
    │
    ├── profiles (id, role: "admin"|"student"|"teacher", first_name, last_name)
    │   ├── students (profile_id FK, korean_name, english_name, student_number [auto])
    │   └── teachers (profile_id FK, name, teacher_number [auto])
    │
    ├── classes (id, name, teacher_profile_id FK nullable)
    │   └── class_students (class_id FK, student_profile_id FK) [junction]
    │
    └── report_cards (student_profile_id FK, author_id FK, year, month, content, reply)
        └── UNIQUE (student_profile_id, year, month)
```

- 역할은 `user_metadata.role`에 저장 (생성 시 설정)
- student_number, teacher_number는 DB 함수로 자동 생성
- 프로필·학생·교사 레코드는 Auth 트리거로 자동 생성

## Supabase Integration

| 클라이언트 | 파일 | 용도 |
|-----------|------|------|
| **Browser** | `lib/supabase/client.ts` | Client Components (로그인 등) |
| **Server** | `lib/supabase/server.ts` | Server Components, Server Actions (RLS 적용) |
| **Admin** | `lib/supabase/admin.ts` | 사용자 생성/삭제 등 관리 작업 (RLS 우회, service role key) |

**환경 변수:**
```
NEXT_PUBLIC_SUPABASE_URL          # Supabase 프로젝트 URL
NEXT_PUBLIC_SUPABASE_ANON_KEY     # Supabase 공개 키
SUPABASE_SERVICE_ROLE_KEY         # 서버 전용 관리 키 (절대 클라이언트 노출 금지)
NEXT_PUBLIC_EMAIL_DOMAIN          # 이메일 도메인 (기본값: "scwonderland.com")
```

## Server Actions

### admin/actions.ts (582줄)

**사용자 관리:**
- `createStudent(formData)` — 학생 계정 생성 (AdminClient, email_confirm: true)
- `createTeacher(formData)` — 교사 계정 생성
- `listUsersByRole(role)` — 역할별 사용자 목록 (profiles + auth + students/teachers 조인)
- `deleteUserById(formData)` — 사용자 삭제 (cascade)
- `updateStudentProfile(formData)` — 학생 이름 수정 (profiles + students 테이블)
- `updateTeacherProfile(formData)` — 교사 이름 수정

**리포트카드:**
- `getReportCard(studentProfileId, year, month)` — 리포트카드 조회 (RLS)
- `listReportCardsByStudent(studentProfileId)` — 학생별 리포트카드 목록
- `upsertReportCard(studentProfileId, year, month, content)` — 리포트카드 작성/수정 (교사/관리자만)
- `updateReportCardReply(reportCardId, reply)` — 학생 답변 작성 (본인만)

**반 관리:**
- `listClassesWithDetails()` — 전체 반 목록 (교사명, 학생 수 포함)
- `getClassWithStudents(classId)` — 반 상세 + 학생 목록
- `getAllClassStudentsFlat()` — 전체 반-학생 매핑 (flat)
- `createClass(name, teacherProfileId)` — 반 생성
- `updateClass(classId, name, teacherProfileId)` — 반 수정
- `deleteClass(classId)` — 반 삭제
- `addStudentToClass(classId, studentProfileId)` — 학생 등록
- `removeStudentFromClass(classStudentId)` — 학생 제거
- `listTeachersForSelect()` — 교사 드롭다운 목록
- `listStudentsNotInClass(classId)` — 반에 미등록 학생 목록

### academy/actions.ts (101줄)

- `getCurrentStudentProfile()` — 현재 로그인 학생의 프로필 조회
- `getCurrentStudentClasses()` — 현재 학생의 소속 반 + 담당 교사 조회

## Important Patterns

### Routing (lib/menu-routes.ts)

모든 (content) 라우트 매핑이 중앙 관리됨:

```typescript
getMenuItemHref("about", "인사말")    // → "/about-wonderland/greeting"
getDefaultMenuItemHref("programs")    // → "/program/map"
getCategoryItemLabels("about")        // → ["인사말", "회사연혁", ...]
getMenuIdFromPathname("/program/map") // → "programs"
```

**새 페이지 추가 시:** 폴더 생성 → `itemSlugs` 업데이트 → 카테고리 layout 확인

### Email Normalization

`@`가 없으면 자동으로 `@scwonderland.com` 추가:
```typescript
normalizeEmail("student123")      // → "student123@scwonderland.com"
normalizeEmail("user@gmail.com")  // → "user@gmail.com"
```
admin/actions.ts와 LoginForm.tsx 양쪽에서 사용.

### Authentication Flow

```
1. 로그인: LoginForm → supabase.auth.signInWithPassword()
2. 세션 유지: middleware.ts → 모든 요청에서 supabase.auth.getUser()로 세션 갱신
3. Admin 보호: admin/layout.tsx → 인증 확인 + profiles.role === "admin" 확인
4. Academy 보호: student/layout.tsx → 인증 확인 + profiles.role === "student" 확인
5. Dashboard 라우팅: 역할에 따라 자동 리다이렉트
```

### Form Handling Patterns

1. **useActionState (React 19)** — AddStudentForm, AddTeacherForm: `<form action={formAction}>`
2. **클라이언트 수정 폼** — UserRow: editing 토글 → FormData 수동 생성 → Server Action 호출
3. **모달 폼** — ClassesManager: useState + 직접 Server Action 호출 → onSuccess 콜백

### Server Action Return Convention

모든 Server Action은 `{ error?: string }` 또는 `{ error?: string; id?: string }` 반환.

## Components

### Layout Components

| 컴포넌트 | 파일 | 역할 |
|---------|------|------|
| `LayoutSwitcher` | `components/layout/LayoutSwitcher.tsx` | pathname 기반 레이아웃 분기 (academy/admin vs content) |
| `Navigation` | `components/layout/Navigation.tsx` | 고정 상단 네비게이션 + 메가 메뉴 (hover) + 모바일 햄버거 |
| `SubNav` | `components/layout/SubNav.tsx` | 카테고리 내 탭 네비게이션, 활성 탭 green-600 하이라이트 |
| `CategoryLayout` | `components/layout/CategoryLayout.tsx` | 섹션별 SubNav 래퍼 |
| `CategoryPageWrapper` | `components/layout/CategoryPageWrapper.tsx` | 콘텐츠 래퍼 (pt-24 for fixed nav) |
| `Footer` | `components/layout/Footer.tsx` | 하단 저작권 (bg-gray-900) |
| `SideBar` | `components/sections/SideBar.tsx` | 빠른 링크 6개 (desktop: fixed right, mobile: FAB + overlay) |

### Section Components

| 컴포넌트 | 파일 | 역할 |
|---------|------|------|
| `Hero` | `components/sections/Hero.tsx` | 랜딩 히어로 (제목 + CTA + 이미지 그리드) |
| `MainProgram` | `components/sections/MainProgram.tsx` | 랜딩 프로그램 카드 5개 (hover 슬라이드 애니메이션) |
| `PageContent` | `components/sections/PageContent.tsx` | placeholder 페이지 래퍼 |
| `ImageWithFallback` | `components/common/ImageWithFallback.tsx` | 이미지 에러 시 SVG fallback |

### Admin Components (app/(admin)/admin/components/)

| 컴포넌트 | 역할 |
|---------|------|
| `AdminLayoutClient` | 사이드바 + 메인 영역 레이아웃 |
| `AdminSidebar` | 왼쪽 네비게이션 (학생/교사/반 관리 + 로그아웃) |
| `AdminListSidebar` | 사용자 목록 + 검색 + 선택 하이라이트 |
| `AddStudentForm` / `AddTeacherForm` | 인라인 추가 폼 (useActionState) |
| `UserRow` | 수정/삭제 가능한 사용자 행 (editing 토글) |
| `StudentInfoCard` / `TeacherInfoCard` | 선택된 사용자 상세 정보 + 수정 폼 |
| `StudentTabNav` / `TeacherTabNav` | 탭 네비게이션 (정보/학습/리포트/예정) |
| `StudentReportTab` | 리포트카드 UI (년월 선택, 내용 편집, 학생 답변 표시) |
| `ClassesManager` | 반 전체 관리 (카드 + 모달: 생성/수정/삭제/학생추가) |

### Academy Components (app/(academy)/academy/components/)

| 컴포넌트 | 역할 |
|---------|------|
| `LoginForm` | 이메일/비밀번호 로그인 (에러 코드별 한국어 메시지) |
| `LogoutButton` | 로그아웃 + 리다이렉트 |
| `StudentNav` | 학생 포털 탭 (내 정보/리포트카드/숙제) |
| `ReportCardReplyForm` | 학생 리포트카드 답변 작성 폼 |

## Styling

**Tailwind CSS v4** 기본, CSS Modules는 복잡한 레이아웃에만 사용.

### CSS Modules 사용 페이지 (5개)

| 페이지 | CSS Module | 용도 |
|--------|-----------|------|
| `about-wonderland/wonderland` | `Wonderland.module.css` | 교육 철학 섹션 레이아웃 |
| `program/wonderland` | `CurriculumProgram.module.css` | 원형 커리큘럼 노드 배치 |
| `program/wonder-k` | `WonderK.module.css` | 프로그램 소개 레이아웃 |
| `program/primo-school` | `PrimoSchool.module.css` | 레벨별 카드 그리드 |
| `program/quest-academy` | `QuestAcademy.module.css` | 프로그램 레벨 카드 |
| Landing MainProgram | `MainProgram.module.css` | 프로그램 카드 hover 애니메이션 |

### 브랜드 컬러

- **Orange** (`#ff7700`, orange-500): 주요 CTA, Navigation 모바일 버튼, 하이라이트
- **Green** (green-600, `#52b978`): SubNav 활성 탭, 배너 배경
- **Blue** (`#3a75ff`): 타임라인 아이콘, 보조 컬러
- **Slate** 계열: Admin/Academy 전체 UI

### 반응형 브레이크포인트

- **lg** (1024px+): 데스크톱 (사이드바, 다중 컬럼)
- **md** (768px+): 태블릿
- **모바일** (<768px): 단일 컬럼, 햄버거 메뉴, FAB
- CSS Modules 내부: 1280px (태블릿), 768px (모바일)

## Public Directory

```
public/
├── images/
│   ├── about-wonderland/    # 인사말, 교육 철학 이미지
│   ├── common/logo-b.svg    # 로고
│   ├── landing/             # 히어로 섹션 학생 사진 3장
│   ├── main/program01~05.png # 메인 프로그램 카드 배경
│   └── program/             # 각 프로그램 소개 이미지/아이콘
├── circle-time-data.json    # Circle Time 커리큘럼 데이터 (노래, 활동, 연령별)
├── circle-time-curriculum.html  # Circle Time 인터랙티브 HTML
└── sc-wonderland-logo.png
```

## Important Files

| 파일 | 역할 |
|------|------|
| `lib/menu-routes.ts` | (content) 라우트 중앙 설정 |
| `middleware.ts` | 모든 요청에서 Supabase 세션 갱신 |
| `app/(admin)/admin/actions.ts` | Admin 전체 Server Actions (582줄) |
| `app/(academy)/academy/actions.ts` | Academy Server Actions (101줄) |
| `lib/supabase/admin.ts` | Admin Supabase 클라이언트 (service role) |
| `docs/*.sql` | DB 스키마 및 마이그레이션 |
| `docs/domain-setup-guide.md` | 도메인 구매·연결 가이드 (Cloudflare + Vercel) |
| `docs/web-infra-concepts.md` | 웹 인프라 핵심 개념 정리 |
| `docs/VERCEL_SUPABASE.md` | Vercel + Supabase 연동 방법 |

## Notes

- 한국어 사용자 대상 (UI 텍스트, 에러 메시지 모두 한국어)
- 외부 이미지: Unsplash만 허용 (`next.config.ts` remotePatterns)
- SideBar 외부 링크: Firebase 리포트카드, 레벨테스트, YouTube, Facebook
- Admin 삭제 시 cascade (DB 제약조건으로 관련 데이터 자동 삭제)
- 리포트카드: 교사가 content 작성 → 학생이 reply 작성 (본인만)
- `router.refresh()`로 Server Component 데이터 갱신 (mutation 후)
