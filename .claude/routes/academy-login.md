# Academy 로그인 & 대시보드

## 라우트 경로
- URL: /academy/login, /academy/dashboard
- 라우트 그룹: (academy)

## 핵심 파일
- page.tsx (login): `app/(academy)/academy/login/page.tsx`
- page.tsx (dashboard): `app/(academy)/academy/dashboard/page.tsx`
- layout.tsx: `app/(academy)/academy/layout.tsx`

## 컴포넌트
| 파일 | 역할 |
|------|------|
| `app/(academy)/academy/login/LoginForm.tsx` | 클라이언트 로그인 폼 (Supabase Auth `signInWithPassword`) |
| `components/LogoutButton.tsx` | 로그아웃 버튼 (layout, dashboard에서 사용) |
| `components/Spinner.tsx` | 로딩 스피너 |

## Server Actions
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| (없음 — 로그인은 Supabase Auth 클라이언트 직접 호출) | — | — |

## 타입
- `StudentProfile`, `TeacherProfile` from `lib/types/index.ts` (dashboard 리다이렉트 시 참조)

## 데이터 흐름

### /academy/login
1. `page.tsx`가 `<Suspense>`로 `<LoginForm />` 렌더링 (skeleton fallback 포함)
2. `LoginForm`(클라이언트)이 `createClient()` → `signInWithPassword()` 호출
3. `normalizeEmail()` (`lib/auth-utils.ts`): 한글 입력 자동 영타 변환, `@scwonderland.com` 자동 추가
4. `getAuthErrorMessage()`: Supabase 에러 코드를 한국어 메시지로 변환
5. 성공 시 `router.push(next)` (기본값: `/academy/dashboard`)
6. `searchParams.error === "admin_only"` → "Admin만 접근할 수 있습니다." 에러 표시

### /academy/dashboard
1. `page.tsx`(서버)가 `getUser()` → 미인증 시 `/academy/login` 리다이렉트
2. `profiles` 테이블에서 `role` 조회
3. 역할별 리다이렉트:
   - `admin` → `/admin`
   - `student` → `/academy/student`
   - `teacher` → `/academy/teacher`
   - `bus` → `/bus`
4. 역할 미지정 시 fallback UI + `<LogoutButton />`

### layout.tsx (공통)
1. `getUser()`로 로그인 상태 확인
2. 로그인 시 `teachers` 테이블에서 `teacher_type` 조회 → `isNative` 판별
3. `isNative = true`이면 헤더 텍스트 영어로 표시 (Dashboard, School Website, Logout)
4. 헤더: 로고(→dashboard), 대시보드 링크, 학원 소개 사이트 링크, 로그아웃 버튼

## 의존성
- `lib/supabase/client.ts` — 브라우저 Supabase 클라이언트 (LoginForm)
- `lib/supabase/server.ts` — 서버 Supabase 클라이언트 (dashboard, layout)
- `lib/supabase/admin.ts` — Admin 클라이언트 (layout의 native 교사 감지)
- `lib/auth-utils.ts` — `normalizeEmail()`, `getAuthErrorMessage()`
- `lib/korean-to-english.ts` — 한글→영타 키보드 매핑
- `components/LogoutButton.tsx` — 로그아웃 확인 다이얼로그 포함, `labels` prop으로 영어 UI 지원

## 주의사항
- 로그인 폼은 `email` 타입이 아닌 `text` 타입 (아이디만 입력, 도메인 자동 추가)
- `LoginForm`은 `useSearchParams` 사용 → `<Suspense>` 필수
- layout에서 `createAdminClient()` 사용하여 `teachers` 테이블 조회 (RLS 우회)
- 원어민 교사 감지 로직은 `layout.tsx`에만 존재 (하위 페이지에서는 별도 조회)
