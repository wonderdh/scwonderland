---
paths:
  - "app/**/*"
  - "lib/**/*"
---

# Important Patterns

## Routing (lib/menu-routes.ts)

모든 (site) 라우트 매핑이 중앙 관리됨:

```typescript
getMenuItemHref("about", "인사말")    // → "/about-wonderland/greeting"
getDefaultMenuItemHref("programs")    // → "/program/map"
getCategoryItemLabels("about")        // → ["인사말", "회사연혁", ...]
getMenuIdFromPathname("/program/map") // → "programs"
```

**새 페이지 추가 시:** 폴더 생성 → `itemSlugs` 업데이트 → 카테고리 layout 확인

## Email Normalization (lib/auth-utils.ts)

`@`가 없으면 자동으로 `@{NEXT_PUBLIC_EMAIL_DOMAIN}` 추가:
```typescript
normalizeEmail("student123")      // → "student123@scwonderland.com"
normalizeEmail("user@gmail.com")  // → "user@gmail.com"
```
`lib/auth-utils.ts`에 중앙화됨. `getAuthErrorMessage()`도 동일 파일에 위치.

## Authentication Flow

```
1. 로그인: LoginForm → supabase.auth.signInWithPassword()
2. 세션 유지: proxy.ts → 모든 요청에서 supabase.auth.getUser()로 세션 갱신
3. Admin 보호: admin/layout.tsx → 인증 확인 + profiles.role === "admin" 확인
4. Academy 보호: student/layout.tsx → 인증 확인 + profiles.role === "student" 확인
5. Dashboard 라우팅: 역할에 따라 자동 리다이렉트
```

## Server Action Auth Pattern

모든 mutating Server Action은 진입점에서 `auth-helpers.ts`의 헬퍼 중 하나로 권한을 검증해야 한다:

```typescript
// 역할별 헬퍼 (app/(admin)/admin/actions/auth-helpers.ts)
verifyAdmin()           // admin 전용
verifyAuthenticated()   // 로그인 여부만 확인 (read-only 공유 액션)
verifyTeacherOrAdmin()  // 교사·관리자 공용 (숙제/출결/학습기록 write 액션)

// 예시: 숙제 수정
const auth = await verifyTeacherOrAdmin();
if ("error" in auth) return { error: auth.error };
const admin = createAdminClient(); // 이후 RLS 우회 작업
```

소유권 기반 검증(본인 제출물만 수정 등)은 `verifyAuthenticated()` 후 별도 ownership 쿼리로 검증 (예: `homework-actions.ts#submitHomework`, `#reviewSubmission`).

**금지:** mutating 액션에 `verifyAuthenticated()`만 사용하면 학생 계정으로도 통과되어 권한 우회 가능.

## Safe Redirect (Open Redirect 방지)

`router.push(searchParams.get("next"))` 형태는 외부 도메인 리다이렉트 취약점. `?next=` 류 파라미터는 반드시 내부 경로로만 허용:

```typescript
// academy/login/LoginForm.tsx 참고
function safeRedirect(next: string | null): string {
  const trimmed = next?.trim();
  if (!trimmed) return "/academy/dashboard";
  if (!trimmed.startsWith("/")) return "/academy/dashboard";
  if (trimmed.startsWith("//") || trimmed.includes("\\")) return "/academy/dashboard";
  return trimmed;
}
```

## HTML Escaping (XSS 방지)

React 밖으로 나가는 HTML 문자열(`document.write`, `innerHTML = ...` 등)에 사용자 입력을 삽입할 때는 **반드시** `lib/utils/escape-html.ts`의 `escapeHtml()`을 거친다. 프린트용 새 창 생성이 대표 사례.

```typescript
import { escapeHtml } from "@/lib/utils/escape-html";
win.document.write(`<h2>${escapeHtml(studentName)}</h2>`);
```

`printRef.current.innerHTML`을 통째로 `document.write`에 꽂는 구(舊) 패턴은 금지. 데이터에서 HTML을 escape-build한다 (StudentTimetableClient.tsx 참고).

## Date / Timezone (KST 고정)

한국 학원 서비스이므로 모든 날짜는 KST 기준. **직접 `new Date()` 연산 금지** (서버 타임존에 따라 자정 경계 버그 발생).

`lib/utils/date-kst.ts` 헬퍼 사용:

```typescript
import { todayKst, formatDateKst, formatDateTimeKst, nowKstParts } from "@/lib/utils/date-kst";

todayKst()                 // "2026-04-09"   — DB DATE 컬럼(attendance_date 등)에 저장
formatDateKst(iso)         // "2026년 4월 9일"
formatDateTimeKst(ts)      // "2026. 04. 09. 15:30"
nowKstParts()              // { year: 2026, month: 4, day: 9 }
```

`new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" })` 분산 패턴 금지 → `todayKst()`로 통일.

## Form Handling Patterns

1. **useActionState (React 19)** — AddStudentForm, AddTeacherForm: `<form action={formAction}>`
2. **클라이언트 수정 폼** — UserRow: editing 토글 → FormData 수동 생성 → Server Action 호출
3. **모달 폼** — ClassesManager: useState + 직접 Server Action 호출 → onSuccess 콜백

## Server Action Return Convention

모든 Server Action은 `{ error?: string }` 또는 `{ error?: string; id?: string }` 반환.

## Type Import Convention

`"use server"` 파일에서는 `export type`이 불가능 (런타임에 제거됨). 공유 타입은 `lib/types/`에 정의하고, 컴포넌트에서 직접 `import type { ... } from "@/lib/types"` 사용.

## Teacher Type Differentiation (lib/teacher-labels.ts)

교사 포털은 `teacher_type`에 따라 UI/라벨/탭이 다름:

```
teacher/layout.tsx → teachers 테이블에서 teacher_type 조회 (Admin Client)
                   → TeacherNav에 teacherType prop 전달
각 page.tsx → getCurrentTeacherProfile()로 teacher_type 조회
            → 라우트 보호 (redirect) + Client Component에 teacherType 전달
```

- **한국인 교사 (korean):** 한국어 UI, 8탭 (담당 반/시간표/공지사항/반 관리/교재/출결/숙제/승하차)
- **원어민 교사 (native):** 영어 UI, 6탭 (My Classes/Timetable/Report Cards/Textbooks/Attendance/Homework)
- 9개 라벨 세트: dashboard/report/textbook/batchUpdate/notice/homework/attendance/timetable/bus — 각각 `[teacherType]`로 접근
- i18n 라이브러리 없이 단순 객체 맵으로 구현 (교사 포털만 영어 필요)

## Notes

- 한국어 사용자 대상 (UI 텍스트, 에러 메시지 모두 한국어). 단, 원어민 교사 포털은 영어 UI
- 외부 이미지: Unsplash + Supabase Storage 허용 (`next.config.ts` remotePatterns)
- SideBar 외부 링크: Firebase 리포트카드, 레벨테스트, YouTube, Facebook
- Admin 삭제 시 cascade (DB 제약조건으로 관련 데이터 자동 삭제)
- 리포트카드: 원어민(native) 교사가 content 작성 → 학생이 reply 작성 (본인만)
- 교사 유형: `korean`(한국인) / `native`(원어민), teachers.teacher_type ENUM으로 구분
- 반당 담당 교사 최대 2명 (class_teachers 중간 테이블), 생성/수정 시 체크박스로 선택
- `router.refresh()`로 Server Component 데이터 갱신 (mutation 후)
- 교재 삭제는 soft delete (`is_active = false`) — 진도 데이터 보존, Storage 커버 이미지는 삭제
- 교재 반 배정 시 해당 반 학생들에게 자동으로 `student_textbook_progress` 생성
- 학생 교재 페이지: 진행 중/완료 분리, 카드 UI (커버 이미지 170x190, 진도 바, 카테고리 배지)
- 공지사항(3종) 삭제는 hard delete — Storage 파일 먼저 삭제 → DB CASCADE 삭제
- 공지사항 이미지는 원본 크기로 표시 (`max-w-full`, 컨테이너보다 클 때만 축소)
- 숙제 제출 파일은 private 버킷 (homework-submissions) → signed URL 1시간으로 접근
