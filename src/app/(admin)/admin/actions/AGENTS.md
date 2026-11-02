# admin/actions/

서버 액션 허브. 도메인별 액션 파일 + `bus/` 하위 폴더. `academy/` 의 read 액션도 여기 것을 import 한다 (가드는 `verifyAuthenticated`).

## 규칙

- 모든 mutation 은 함수 본문 첫 줄에서 `verifyAdmin()` 호출. 못 넣을 사정이면 함수 위에 `// @auth-skip: <이유>`. `pnpm check:action-auth`(CI 포함) 가 `"use server"` 파일의 export 함수마다 둘 중 하나가 있는지 검사한다 — 없으면 CI 실패.
- 파일 1개 = 도메인 1개 (`textbook-actions.ts`, `notice-actions.ts` …). 도메인이 너무 커지면 `bus/` 처럼 폴더로 분리.
- 인증 헬퍼는 `auth-helpers.ts`, 도메인 상수는 `src/lib/constants/`. 컴포넌트나 클라이언트 코드 import 금지.

## 주의

- `academy/actions.ts` / `bus/actions.ts` 는 별도. 거기서 admin 권한이 필요한 동작은 이 허브로 wrap 하지 말고, `verifyTeacherOrAdmin` 같은 적절한 가드 사용.
- realtime 갱신이 걸린 도메인 (bus 위주) 은 `src/lib/bus/realtime-utils.ts` 와 동기 유지.
- `class_students` 는 `.delete()` 금지 → `.update({ is_active: false })`. 명단·소속 조회는 `.eq("is_active", true)` (join 경유면 `"class_students.is_active"`). 이유는 `supabase/AGENTS.md`.
