# SC Wonderland 프로젝트 종합 분석 보고서

> 분석일: 2026-03-10 | Next.js 16.1.6 · React 19 · TypeScript 5 · Tailwind CSS v4 · Supabase

---

## 1. 프로젝트 개요 & 건강도 점수

### 개요
원더랜드 영어학원 통합 웹 플랫폼. 공개 소개 사이트, 관리자 대시보드(9개 섹션), 학생/교사 포털(한국인 8탭/원어민 6탭 영어 UI)로 구성.

### 코드베이스 규모
| 항목 | 수치 |
|------|------|
| TSX/TS 소스 파일 | ~205개 (30,210 LOC) |
| 페이지 라우트 | 47개 |
| Server Actions | 15개 파일, ~101개 함수 (6,048 LOC) |
| 컴포넌트 | ~100+ 개 |
| CSS 파일 | 9개 (globals.css + 6 CSS Modules + PostCSS) |
| 프로덕션 의존성 | 11개 (매우 경량) |
| node_modules | 570 MB |

### 건강도 점수

| 영역 | 점수 | 비고 |
|------|------|------|
| 아키텍처 | **A** | Route Group 분리, 도메인별 Actions, 타입 시스템 |
| 보안 | **B+** | 중앙화된 auth helpers, 2단계 보호, 일부 소유권 검증 누락 |
| 코드 품질 | **B+** | TypeScript strict, 일관된 패턴, 일부 중복 존재 |
| 성능 | **B** | Server Components 활용, 일부 O(n*m) 쿼리 |
| 프론트엔드 | **B** | Tailwind 규율 우수, 접근성/모달 추상화 부족 |
| 인프라/DevOps | **C** | 테스트 0%, 에러 리포팅 없음, 로깅 없음 |
| **종합** | **B+** | 견고한 기반, 테스트/모니터링 인프라 부재가 최대 약점 |

---

## 2. 아키텍처 분석

### 강점

**Route Group 구조 (우수)**
```
app/
├── (site)/          # 공개 웹사이트 (47 pages)
├── (admin)/admin/   # 관리자 대시보드 (16 pages, 15 action files)
├── (academy)/       # 학생·교사 포털 (14 pages)
└── (bus)/           # 승하차 모니터링 (분리된 섹션)
```
- 각 Route Group이 독립적 레이아웃, 인증, 스타일을 가짐
- 관심사 분리가 명확하여 유지보수성 높음

**Server Actions 도메인 분할 (우수)**
- 15개 파일로 기능별 분리 (user, class, schedule, textbook, bus, notice 등)
- barrel re-export (`actions.ts`)로 깔끔한 import
- `auth-helpers.ts`는 의도적으로 barrel에서 제외 (내부 전용)

**Layout Composition**
- `proxy.ts` → 세션 갱신 (모든 요청)
- Route Group별 layout → 인증/권한 검증
- 중복 없는 계층적 구조

**의존성 관리 (우수)**
- 프로덕션 의존성 11개로 극도로 경량
- 불필요한 프레임워크 없음 (상태관리 라이브러리, 폼 라이브러리, HTTP 클라이언트 불필요)
- Supabase 단일 백엔드로 Auth + DB + Storage 통합

### 약점

- 트랜잭션 지원 없음 → 배치 작업(시간표, 숙제) 부분 실패 가능
- `GroupTimetableData` 타입이 `schedule-actions.ts` ("use server")에 정의 → 크로스 라우트 그룹 import 필요
- REST API 레이어 없이 Server Actions만 사용 → 외부 시스템 연동 시 제약

---

## 3. 백엔드 분석

### Server Actions 패턴

**일관된 구조**
- 모든 함수: `{ error?: string }` 또는 `{ error?: string; id?: string }` 반환
- 로깅: `console.error("[functionName]", error.message, context)` 패턴
- 인증: `verifyAdmin()` / `verifyAuthenticated()` 중앙 헬퍼 사용

**파일별 함수 수**
| 파일 | 함수 수 | 비고 |
|------|---------|------|
| bus-actions.ts | ~30 | 최대 규모 (호차, 정류장, 배정, 매니페스트, 스태프) |
| textbook-actions.ts | ~20 | CRUD + 진도 + Storage |
| user-actions.ts | 12 | 계정 CRUD + 소프트 삭제 |
| class-actions.ts | 11 | 반 CRUD + 학생 관리 |
| homework-actions.ts | 9 | 출제 + 제출 + 피드백 |
| schedule-actions.ts | 8 | 시간표 그리드 + 학생 시간표 |
| class-notice-actions.ts | 6 | 반별 공지 CRUD |
| notice-actions.ts | 5 | 공개 공지 CRUD |
| academy-notice-actions.ts | 5 | 포털 공지 CRUD |
| attendance-actions.ts | 5 | 출결 기록 |
| report-actions.ts | 4 | 리포트카드 |
| learning-actions.ts | 4 | 학습 기록 |
| timetable-actions.ts | 4 | 교시 CRUD |
| dashboard-actions.ts | 1 | 통계 (Promise.all) |

### 인증 & 권한

**강점**
- `auth-helpers.ts`: `verifyAdmin()` (role 검증) + `verifyAuthenticated()` (로그인 확인)
- 13/15 action 파일에 적용
- Admin 라우트 2단계 보호: proxy.ts 세션 갱신 → layout.tsx role 검증

**약점**
- `report-actions.ts`: auth-helpers 미사용, 인라인 role 검증 (불일치)
- `schedule-actions.ts`: `getGroupTimetableGrid()` 인증 없음 (서버 전용이지만 불일치)
- 일부 함수에서 소유권(ownership) 검증 누락:
  - `submitHomework()`: 제출물 존재 확인만, 소유권 미검증
  - `recordAttendance()`: 학생 레코드 소유권 미확인

### 에러 처리

**강점**
- Supabase 에러 코드 처리: `error.code === "23505"` (중복 키) 등
- 파일 업로드 실패 시 롤백: `textbook-actions.ts`에서 커버 삭제 처리

**약점**
- 배치 작업 원자성 없음 (`addClassScheduleBatch()` 부분 실패 가능)
- 일부 notice 파일: Storage 성공 → DB 실패 시 파일 미정리
- JSON.parse try-catch 누락 사례 존재 (일부 수정 완료)

### 데이터베이스 쿼리

**최적화 완료**
- `getClassWithStudents()`: N+1 쿼리 수정 완료
- `listUsersByRole()`, `listDeletedUsers()`: `Set.has()` O(1) 필터링
- `getDashboardStats()`: `Promise.all()` 5개 병렬 쿼리

**최적화 필요**
- `academy/actions.ts` → `getCurrentStudentClasses()`, `getTeacherClasses()`: O(n*m) 필터링
- `attendance-actions.ts` → `listAttendanceRecords()`: 전체 classes 로드 후 JS 필터링
- 인덱스 증거 부족: `class_id`, `student_profile_id`, `teacher_profile_id` 컬럼

---

## 4. 프론트엔드 분석

### 컴포넌트 패턴

**강점**
- 도메인별 co-located 컴포넌트 (`admin/students/components/`, `admin/teachers/components/`)
- Server Components 기본 사용, Client Components는 필요한 곳만
- shadcn/ui 기반 UI primitives (10개 타입)
- Skeleton 로딩 21개 파일로 UX 우수

**약점**
- 일부 Client Component 과다 사용 (`AdminLayoutClient`, `Hero` 등 서버 렌더링 가능)
- `StudentSelectedView`: useState 12개+ → useReducer 리팩토링 필요
- `TextbooksManager`, `ClassesManager`: 모달 로직 중복 → 공통 추상화 필요
- `GroupTimetableGrid`: 500+ LOC 대형 컴포넌트 → 분할 필요

### 상태 관리

**패턴별 사용**
| 패턴 | 사용처 | 평가 |
|------|--------|------|
| `useActionState` (React 19) | AddStudentForm, AddTeacherForm | 최적 |
| `useState` 다수 | StudentSelectedView, TextbooksManager | 리팩토링 필요 |
| `useRouter().refresh()` | mutation 후 데이터 갱신 | 적절 |
| refs + polling | BusMonitoringDashboard | 상태 머신 고려 |

### 폼 처리 (3가지 패턴)

1. **useActionState**: 가장 깔끔 (서버 액션 콜백 + 리셋 + 토스트)
2. **수동 FormData**: 인라인 편집용 (UserRow)
3. **직접 서버 액션 호출**: 복잡한 모달 폼 (ClassesManager, TextbooksManager)

### UI 일관성

**Tailwind 규율 (우수)**
- 동적 클래스 문자열 concat 금지 규칙 준수
- `TEACHER_COLOR_PALETTE`, `CLASS_COLOR_PALETTE`: 완전한 클래스명 리터럴
- 학생 나이별 색상: `lib/student-age-colors.ts` 중앙화
- 브랜드 컬러: CSS 변수로 정의 (`--brand-orange`, `--brand-green`, `--brand-blue`)

**CSS Modules (6개, 정당화됨)**
- 복잡한 hover 애니메이션, 원형 레이아웃, 그리드 배치에만 사용
- Tailwind로 표현 어려운 pseudo-element, keyframe 애니메이션

### 접근성

**구현됨**
- `:focus-visible` 스타일 (파란 outline)
- `prefers-reduced-motion` 미디어 쿼리
- ARIA 속성: `role="alert"`, `role="status"`, `aria-hidden`
- 시맨틱 HTML: `<button>`, `<nav>`, `<main>`, `<header>`

**미흡**
- 모달에 `role="dialog"` + focus trap 없음
- 일부 폼 입력에 visible label 누락
- 인라인 SVG에 `aria-hidden="true"` 누락
- WCAG AA 대비율 미검증 (text-slate-400 등)

---

## 5. 보안 분석

### 현재 상태 (양호)

| 항목 | 상태 | 비고 |
|------|------|------|
| 인증 | **양호** | Supabase Auth + proxy.ts 세션 갱신 |
| 권한 검증 | **양호** | verifyAdmin/verifyAuthenticated 중앙화 |
| Admin 보호 | **우수** | 2단계 (세션 + role 검증) |
| 파일 업로드 | **양호** | MIME 타입 + 크기 검증 |
| 환경 변수 | **양호** | .env* gitignore, NEXT_PUBLIC_ 구분 |
| 소프트 삭제 | **양호** | deleted_at + Auth ban |
| Private Storage | **양호** | homework-submissions signed URL (1시간) |

### 취약점/개선 필요

| 위험도 | 항목 | 설명 |
|--------|------|------|
| **중** | 소유권 검증 누락 | submitHomework, recordAttendance에서 소유권 미확인 |
| **중** | report-actions 인증 불일치 | auth-helpers 미사용, 인라인 검증 |
| **낮** | Admin Client + 약한 인증 | verifyAuthenticated만으로 Admin Client 사용하는 곳 존재 |
| **낮** | RLS 2차 방어 없음 | Admin Client(service role)는 RLS 우회 → app 레벨 검증만 의존 |
| **낮** | `.env.example` 없음 | 새 개발자가 필요한 환경 변수 모름 |
| **낮** | signed URL 갱신 없음 | 1시간 만료 후 재요청 메커니즘 없음 |

---

## 6. 성능 분석

### 쿼리 최적화

| 상태 | 항목 | 파일 |
|------|------|------|
| **수정 완료** | N+1 쿼리 | `getClassWithStudents()` |
| **수정 완료** | O(n*m) → Set.has() | `listUsersByRole()`, `listDeletedUsers()` |
| **수정 완료** | 병렬 쿼리 | `getDashboardStats()` Promise.all |
| **미수정** | O(n*m) 필터링 | `getCurrentStudentClasses()`, `getTeacherClasses()` |
| **미수정** | 전체 로드 후 필터 | `listAttendanceRecords()` |
| **미확인** | DB 인덱스 | FK 컬럼 인덱스 존재 여부 확인 필요 |

### 이미지 최적화

| 항목 | 상태 |
|------|------|
| next/image 사용 | 적용됨 (remotePatterns 설정) |
| Supabase Storage CDN | 설정됨 |
| ImageWithFallback | SVG placeholder 제공 |
| priority 속성 | LCP 이미지에 적용 (로고, 히어로) |
| 크기 일관성 | 일부 inline style 혼용 (개선 필요) |

### 번들 크기 (추정)

| 카테고리 | 라이브러리 | 추정 크기 (gzip) |
|----------|-----------|----------------|
| Framework | Next.js 16 + React 19 | ~100-150 KB |
| UI | shadcn/ui + Radix UI | ~50-80 KB |
| 스타일 | Tailwind CSS | ~30-50 KB |
| 아이콘 | Lucide React | ~20-30 KB |
| Supabase | Auth + DB + Storage | ~100-150 KB |
| 유틸 | clsx, tailwind-merge, sonner | ~15-20 KB |
| **합계** | | **~315-480 KB** |

- 무거운 프레임워크 없음 (jQuery, Lodash, moment.js 없음)
- Tree-shaking 지원 (ESM)
- Admin 전용 라우트 lazy-load 미적용 (최적화 기회)

---

## 7. 코드 품질

### 타입 시스템

**강점**
- TypeScript strict 모드 전체 적용
- `lib/types/database.ts`에 공유 타입 정의 (47개 export)
- barrel export (`lib/types/index.ts`)
- loose `any` 타입 없음

**약점**
- Server Action 반환 타입 미통일 (`{ error?: string }` vs `{ error?: string; id?: string }`)
- `GroupTimetableData`가 "use server" 파일에 정의 → `lib/types/`로 이동 필요
- 일부 bus 관련 타입 (`BusStaffProfile`, `BusStop`) 커버리지 불명확

### 중복 코드

| 중복 패턴 | 위치 | 해결 상태 |
|-----------|------|-----------|
| Storage 경로 추출 | notice/textbook/class-notice actions | 일부 `extractStoragePath()` 사용, 일부 인라인 |
| 파일 업로드 검증 | notice/textbook/class-notice actions | 일부 `validateFile()` 사용, 일부 인라인 |
| 교사/학생 데이터 매핑 | academy/actions.ts 여러 함수 | 유틸 함수 추출 가능 |
| 소프트 삭제 정리 | deleteUserById 등 | 중앙화 안됨 |
| 인라인 SVG 아이콘 | AdminSidebar (9개 함수) | 아이콘 컴포넌트 라이브러리 필요 |
| 모달 상태 관리 | TextbooksManager, ClassesManager | 공통 hook/context 필요 |

### 디자인 패턴 (잘 적용됨)

- **Barrel Export**: actions.ts, lib/types/index.ts
- **Helper 중앙화**: auth-helpers.ts, storage.ts, auth-utils.ts
- **Color Palette 상수**: TEACHER_COLOR_PALETTE, CLASS_COLOR_PALETTE, student-age-colors
- **라벨 맵**: teacher-labels.ts (한국어/영어 분기)
- **Co-location**: 도메인별 컴포넌트 배치

---

## 8. 누락된 기능/인프라

### 테스트 (가장 중요한 부재)

| 항목 | 상태 |
|------|------|
| 유닛 테스트 | 없음 |
| 컴포넌트 테스트 | 없음 |
| E2E 테스트 | 없음 |
| 테스트 프레임워크 | 미설치 (Jest/Vitest) |
| 테스트 커버리지 | 0% |
| CI/CD 테스트 | 없음 |

→ 101개 Server Action + 100+ 컴포넌트가 수동 테스트에만 의존

### 모니터링 & 로깅

| 항목 | 상태 |
|------|------|
| 에러 리포팅 | 없음 (Sentry 등 미설치) |
| 구조화된 로깅 | 없음 (console.error만 사용) |
| 성능 모니터링 | 없음 |
| 요청 추적 | 없음 |
| 분석/통계 | 없음 |

### 개발자 경험

| 항목 | 상태 |
|------|------|
| Prettier | 미설정 |
| Pre-commit hooks | 없음 (husky/lint-staged) |
| `.env.example` | 없음 |
| API 문서 | 없음 |
| Storybook | 없음 |
| 번들 분석 | 미설정 (@next/bundle-analyzer) |

### 접근성

| 항목 | 상태 |
|------|------|
| eslint-plugin-jsx-a11y | 미설치 |
| focus trap (모달) | 미구현 |
| WCAG 대비율 검증 | 미수행 |
| 자동화된 접근성 테스트 | 없음 |

---

## 9. 우선순위별 개선 권고사항

### 높음 (즉시)

| # | 항목 | 이유 | 예상 작업량 |
|---|------|------|-----------|
| 1 | **테스트 프레임워크 도입** | 101개 Action + 100+ 컴포넌트 무테스트 → 리팩토링 위험 | Vitest + RTL 설정, 핵심 Action 테스트 작성 |
| 2 | **에러 리포팅** | 프로덕션 에러 감지 불가 | Sentry 설치 + Next.js 연동 |
| 3 | **소유권 검증 추가** | submitHomework, recordAttendance 등 보안 약점 | 해당 함수에 소유권 체크 추가 |
| 4 | **report-actions 인증 통일** | auth-helpers 패턴 불일치 | verifyAdmin() 적용 |

### 중간 (1-2주)

| # | 항목 | 이유 |
|---|------|------|
| 5 | **O(n*m) 쿼리 최적화** | academy/actions.ts 성능 병목 |
| 6 | **Git hooks 설정** | lint/typecheck 자동화 (husky + lint-staged) |
| 7 | **`.env.example` 생성** | 새 개발자 온보딩 |
| 8 | **모달 접근성** | role="dialog" + focus trap |
| 9 | **중복 코드 제거** | Storage 헬퍼 통일, 모달 hook 추출 |
| 10 | **Server Action 반환 타입 통일** | 제네릭 `ServerActionResult<T>` 정의 |

### 낮음 (개선 기회)

| # | 항목 | 이유 |
|---|------|------|
| 11 | **번들 분석** | @next/bundle-analyzer로 최적화 기회 발견 |
| 12 | **Prettier 설정** | 코드 포맷 일관성 |
| 13 | **ESLint 규칙 확장** | jsx-a11y, import order, hooks deps |
| 14 | **Admin 라우트 lazy-load** | 코드 스플리팅으로 초기 로드 감소 |
| 15 | **GroupTimetableGrid 분할** | 500+ LOC → Grid, Cell, MergeLogic 분리 |
| 16 | **Storybook** | 컴포넌트 문서화 + 시각적 테스트 |
| 17 | **DB 인덱스 검증** | FK 컬럼 인덱스 확인 및 추가 |
| 18 | **구조화된 로깅** | pino/winston 도입 |

---

## 부록: 프로젝트 파일 구조 요약

```
app/
├── layout.tsx, globals.css, error.tsx, proxy.ts
├── (site)/                    # 공개 웹사이트 (47 pages, 18 components)
│   ├── _components/layout/    # Navigation, SubNav, Footer
│   ├── _components/sections/  # Hero, MainProgram, SideBar
│   └── about-wonderland/, program/, notice/, community/, experience/
├── (admin)/admin/             # 관리자 대시보드
│   ├── actions/ (15 files)    # 도메인별 Server Actions
│   ├── components/            # AdminLayoutClient, AdminSidebar, TrashView
│   └── students/, teachers/, classes/, textbooks/, notices/, timetable/, bus/
├── (academy)/academy/         # 학생·교사 포털
│   ├── student/ (6 tabs)
│   └── teacher/ (8 korean / 6 native tabs)
└── (bus)/bus/                 # 승하차 모니터링

lib/
├── supabase/ (client, server, admin, storage)
├── types/ (database.ts, index.ts)
├── auth-utils.ts, menu-routes.ts, teacher-labels.ts
└── student-age-colors.ts, korean-to-english.ts, utils.ts

components/
├── ui/ (shadcn/ui: 10 types)
├── AudioRecorder, FileUpload, FileList, LogoutButton
└── Skeletons (4 variants)
```

---

*이 보고서는 백엔드(Server Actions, 인증, DB), 프론트엔드(컴포넌트, 상태관리, UI), 인프라(설정, 의존성, 보안) 3개 영역의 병렬 분석 결과를 종합하여 작성되었습니다.*
