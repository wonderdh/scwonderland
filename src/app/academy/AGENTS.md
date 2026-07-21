# app/academy/

학생·교사 포털. `/academy` 자체는 엔트리가 아니라 URL 네임스페이스이고, 실 화면은 `/academy/student/...` / `/academy/teacher/...`.

인증·역할 분기는 **`app/dashboard/`** 가, 로그인 화면은 **`app/login/`** 이 전담한다 (이 폴더 밖).

## 구조

| 경로 | 역할 |
|---|---|
| `layout.tsx` | 인증된 사용자의 `teacher_type`, `username`, primary role 을 layout 단에서 묶어 `AcademyShell` 에 prop 으로. `createAdminClient` 1회 사용 (profile/teacher 조회). |
| `actions.ts` | **학생·교사 공용 server action 단일 파일**. `/admin` 처럼 도메인별로 안 나눔. 작게 유지. |
| `login/page.tsx` | `/login` 으로 이관 후 남긴 redirect stub (기존 링크·북마크 호환용). 새 코드는 `/login` 을 직접 쓸 것. |
| `student/`, `teacher/` | 각 역할 전용 화면. `_components/` private folder 컨벤션. |

## 규칙

- `(admin)/admin/actions/` 의 `verifyAdmin` / `verifyTeacherOrAdmin` 헬퍼 **이쪽에서 import 금지**. 여기 actions 는 학생/교사가 자기 데이터를 읽는 read-only 위주라 `createClient()` + `getUserRoles()` / `hasUserRole()` 패턴 사용.
- mutation 이 필요해지면 `@/lib/auth/user-roles` 의 `hasUserRole` 로 직접 가드 + 함수 위에 인증 정책 주석. admin/actions 헬퍼를 끌어와 wrap 하지 않음.
- 화면 전반은 RSC + Server Action + `revalidatePath`. 클라이언트 캐시 라이브러리 안 씀.
- `createAdminClient` 사용은 layout.tsx + actions.ts 의 read-only 조회로 한정. 새로 추가할 땐 RLS 우회가 진짜 필요한지 먼저 점검.

## 주의

- 역할 불일치 redirect 목적지는 `/dashboard` 로 통일 (`student/layout.tsx`, `teacher/layout.tsx`). 여기에 역할 분기 로직을 다시 넣지 말 것.
- admin 은 `/dashboard` 에서 `/admin` 으로 튕기므로 학생·교사 화면을 그대로 볼 수 없음. 시점 디버깅이 필요하면 별도 임퍼소네이션 경로 필요.
- 학생/교사 화면 컴포넌트가 admin 컴포넌트를 import 하면 안 됨 — 권한·세션 모델이 달라서 RLS 우회 클라이언트가 따라 들어올 위험. `(admin)/admin/_components/**` import 금지.
