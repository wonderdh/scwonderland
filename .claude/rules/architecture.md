# Architecture

## Route Groups

```
app/
├── layout.tsx                  # 최소: 폰트, 메타데이터, html/body
├── (site)/                     # 학원 소개 사이트 (공개)
│   ├── layout.tsx              # Navigation + SideBar + Footer
│   ├── page.tsx                # 랜딩 페이지
│   ├── _components/            # 사이트 전용 컴포넌트
│   └── about-wonderland/, program/, notice/, community/, experience/
├── (admin)/admin/              # 관리자 대시보드 (/admin)
│   ├── actions.ts              # barrel re-export
│   ├── actions/                # 도메인별 분할 (user, report, class, dashboard, textbook, notice)
│   ├── components/             # 공유 컴포넌트 (AdminLayoutClient, AdminSidebar 등)
│   ├── students/components/    # 학생 전용 컴포넌트 (co-located)
│   ├── teachers/components/    # 교사 전용 컴포넌트 (co-located)
│   └── notices/components/     # 공지사항 전용 컴포넌트 (co-located)
└── (academy)/academy/          # 학생·교사 포털 (/academy)
```

## Layout Composition

```
RootLayout (app/layout.tsx) — Geist 폰트, HTML lang="ko"
├── (site)/layout.tsx — 소개 사이트 전용 레이아웃
│   ├── Navigation (fixed top, mega menu)
│   ├── SideBar (desktop: fixed right, mobile: FAB)
│   ├── Page Content
│   └── Footer
├── (admin)/admin/layout.tsx — 관리자 전용 레이아웃
└── (academy)/academy/layout.tsx — 포털 전용 레이아웃
```

Content 섹션 내부:
```
CategoryLayout (menuId로 라우팅)
└── SubNav (카테고리 내 탭 네비게이션, 활성 항목 green-600 하이라이트)
    └── CategoryPageWrapper (pt-24 for fixed nav)
        └── Page Content
```

## Route Map

### (site) — 공개 웹사이트

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
| `/notice/news` | 공지사항 목록 (DB 조회) | ✅ |
| `/notice/news/[id]` | 공지사항 상세 (이미지, 첨부파일) | ✅ |
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
| `/admin/students?tab=textbook` | 교재 진도 | 학생별 교재 배정 및 진도 관리 |
| `/admin/students/classes` | 학생 반 조회 | 학생 소속 반 정보 |
| `/admin/teachers` | 교사 관리 | 목록 조회, 검색, 생성, 수정, 삭제 |
| `/admin/classes` | 반 관리 | 반 CRUD, 담당 교사 배정, 학생 등록/제거 |
| `/admin/textbooks` | 교재 관리 | 교재 CRUD, 반/학생 배정, 진도 관리 |
| `/admin/notices` | 공지사항 관리 | 공지 CRUD, 이미지/파일 첨부, 고정/게시 관리 |

**보호:** middleware 세션 갱신 → layout.tsx에서 2단계 검증 (인증 확인 + role="admin" 확인)

### (academy) — 학생·교사 포털

| 경로 | 페이지 | 기능 |
|------|--------|------|
| `/academy/login` | 로그인 | 이메일/비밀번호, 자동 도메인 추가 |
| `/academy/dashboard` | 대시보드 | 역할별 리다이렉트 (admin→/admin, student→/academy/student) |
| `/academy/student` | 학생 정보 | 프로필, 소속 반, 담당 교사 조회 |
| `/academy/student/reports` | 리포트카드 | 년/월별 조회, 학생 답변 작성 |
| `/academy/student/textbooks` | 교재 진도 | 본인 교재 목록 및 진도 조회 |
| `/academy/student/homework` | 숙제 | 🔲 준비 중 |
| `/academy/teacher` | 교사 대시보드 | 담당 반 목록 조회 (teacher_type별 라벨/링크 분기) |
| `/academy/teacher/reports` | 리포트카드 작성 | 원어민 전용 (한국인→redirect), 영어 UI |
| `/academy/teacher/textbooks` | 교재 현황 | 반별 배정 교재 목록 (teacher_type별 라벨) |
| `/academy/teacher/notices` | 공지사항 | 한국인 전용 (원어민→redirect), 🔲 placeholder |
| `/academy/teacher/classes` | 반 관리 | 한국인 전용 (원어민→redirect), 읽기 전용 조회 |

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
| `lib/menu-routes.ts` | (site) 라우트 중앙 설정 |
| `lib/auth-utils.ts` | 이메일 정규화 + 인증 에러 메시지 (공유) |
| `lib/types/` | 공유 타입 정의 (database.ts + barrel index.ts) |
| `middleware.ts` | 모든 요청에서 Supabase 세션 갱신 |
| `app/(admin)/admin/actions.ts` | Admin Server Actions barrel re-export |
| `app/(admin)/admin/actions/` | 도메인별 분할 (user, report, class, dashboard, textbook) |
| `app/(academy)/academy/actions.ts` | Academy Server Actions |
| `lib/supabase/admin.ts` | Admin Supabase 클라이언트 (service role) |
| `docs/*.sql` | DB 스키마 및 마이그레이션 |
| `docs/storage-implementation-plan.md` | Supabase Storage 전체 구현 계획 (반별 공지, 숙제 등) |
| `docs/textbook-cover-image.md` | 교재 커버 이미지 기능 상세 문서 |
| `lib/teacher-labels.ts` | 교사 포털 한국어/영어 라벨 맵 (teacher_type별) |
