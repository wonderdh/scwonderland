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
│   ├── actions.ts              # barrel re-export (~101개 함수)
│   ├── actions/                # 도메인별 분할 (15개 파일)
│   ├── components/             # 공유 컴포넌트 (AdminLayoutClient, AdminSidebar 등)
│   ├── students/components/    # 학생 전용 컴포넌트 (co-located)
│   ├── teachers/components/    # 교사 전용 컴포넌트 (co-located)
│   ├── notices/components/     # 공지사항 전용 컴포넌트 (co-located)
│   ├── academy-notices/        # Academy 포털 공지 관리
│   ├── timetable/              # 시간표 관리
│   └── bus/                    # 승하차 관리
└── (academy)/academy/          # 학생·교사 포털 (/academy)
    ├── actions.ts              # Academy Server Actions (7개 함수)
    ├── student/                # 학생 포털 (6개 탭)
    └── teacher/                # 교사 포털 (한국인 8탭 / 원어민 6탭)
```

## Layout Composition

```
RootLayout (app/layout.tsx) — Geist 폰트, HTML lang="ko"
├── proxy.ts — Supabase 세션 갱신 (Next.js 16 proxy, 토큰 자동 리프레시)
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

### (admin) — 관리자 대시보드 (9개 섹션)

| 경로 | 페이지 | 기능 |
|------|--------|------|
| `/admin` | 대시보드 | 통계 5종 + 네비 카드 |
| `/admin/students` | 학생 관리 | CRUD, 검색, 7개 탭(정보/학습/리포트/교재/시간표/출결/승하차), 휴지통 |
| `/admin/teachers` | 교사 관리 | CRUD, 검색, 3개 탭(정보/반목록/시간표), 삭제 경고 모달, 휴지통 |
| `/admin/classes` | 반 관리 | 반 CRUD, 담당 교사 배정(최대 2명), 학생 등록/제거, 교재 배정 |
| `/admin/textbooks` | 교재 관리 | 교재 CRUD, 커버 이미지(Storage), 반/학생 배정, 진도 관리, 일괄 업데이트 |
| `/admin/notices` | 공지사항 관리 | 공지 CRUD, 이미지/파일 다중 첨부(Storage), 고정/게시 관리 |
| `/admin/academy-notices` | Academy 공지 | 포털 내부 공지 CRUD, 첨부파일(Storage) |
| `/admin/timetable` | 시간표 관리 | 그룹별 그리드(유치부/오후반/방과후), 교시 CRUD, 학생 개인 시간표 |
| `/admin/bus` | 승하차 관리 | 호차 CRUD, 대시보드(일일 매니페스트), 변경요청 승인/거부 |

**보호:** proxy.ts 세션 갱신 → layout.tsx에서 2단계 검증 (인증 확인 + role="admin" 확인)

### (academy) — 학생·교사 포털

| 경로 | 페이지 | 기능 |
|------|--------|------|
| `/academy/login` | 로그인 | 이메일/비밀번호, 자동 도메인 추가 |
| `/academy/dashboard` | 대시보드 | 역할별 리다이렉트 (admin→/admin, student→/academy/student) |
| `/academy/student` | 학생 정보 | 프로필, 소속 반, 담당 교사 조회 |
| `/academy/student/reports` | 리포트카드 | 년/월별 조회, 학생 답변 작성 |
| `/academy/student/textbooks` | 교재 진도 | 본인 교재 목록 및 진도 조회 |
| `/academy/student/notices` | 공지 | 반별 공지 + Academy 공지 통합 조회 |
| `/academy/student/homework` | 숙제 | 숙제 목록, 텍스트/AudioRecorder 녹음 제출 |
| `/academy/student/bus` | 승하차 | 기본 배정 조회, 변경 요청 생성/취소 |
| `/academy/teacher` | 교사 대시보드 | 담당 반 목록 (teacher_type별 라벨/링크 분기) |
| `/academy/teacher/timetable` | 시간표 | 읽기 전용, 반별 색상 (한국인: 시간표 / 원어민: Timetable) |
| `/academy/teacher/reports` | 리포트카드 작성 | 원어민 전용 (한국인→redirect), 영어 UI |
| `/academy/teacher/textbooks` | 교재 현황 | 반별 배정 교재 목록, 진도 일괄 업데이트 |
| `/academy/teacher/notices` | 공지사항 | 한국인 전용 (원어민→redirect), 반별 공지 CRUD |
| `/academy/teacher/classes` | 반 관리 | 한국인 전용 (원어민→redirect), 읽기 전용 조회 |
| `/academy/teacher/attendance` | 출결 | 반별 출결 기록 (한국인/원어민 모두) |
| `/academy/teacher/homework` | 숙제 | 숙제 출제, 제출 현황, 피드백 작성 |
| `/academy/teacher/bus` | 승하차 | 한국인 전용, 담당 반 승하차 현황 |

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
| `proxy.ts` | Supabase 세션 갱신 (Next.js 16 proxy, 모든 요청에서 토큰 리프레시) |
| `lib/menu-routes.ts` | (site) 라우트 중앙 설정 |
| `lib/auth-utils.ts` | 이메일 정규화 + 인증 에러 메시지 (공유) |
| `lib/types/` | 공유 타입 정의 (database.ts + barrel index.ts) |
| `lib/supabase/storage.ts` | Storage 버킷 정의, 파일 검증/경로 생성 헬퍼 |
| `app/(admin)/admin/actions.ts` | Admin Server Actions barrel re-export (~101개 함수) |
| `app/(admin)/admin/actions/` | 도메인별 분할 (15개 파일) |
| `app/(academy)/academy/actions.ts` | Academy Server Actions (7개 함수) |
| `lib/supabase/admin.ts` | Admin Supabase 클라이언트 (service role) |
| `lib/teacher-labels.ts` | 교사 포털 한국어/영어 라벨 맵 (9개 라벨 세트) |
| `docs/*.sql` | DB 스키마 및 마이그레이션 |
