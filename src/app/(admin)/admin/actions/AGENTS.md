# admin/actions/

`(admin)/admin` 의 서버 액션 허브. ~20개 도메인 액션 파일 + `bus/` 하위 6 파일.

## 규칙

- 모든 mutation 은 함수 본문 첫 줄에서 `verifyAdmin()` 호출. 못 넣을 사정이면 함수 위에 `// @auth-skip: <이유>`.
- 파일 1개 = 도메인 1개 (`textbook-actions.ts`, `notice-actions.ts` …). 도메인이 너무 커지면 `bus/` 처럼 폴더로 분리.
- 헬퍼는 `auth-helpers.ts`, 도메인 상수는 `*-constants.ts` 로. 컴포넌트나 클라이언트 코드 import 금지.

## 주의

- `(academy)` / `(bus)` 의 actions 는 별도. 거기서 admin 권한이 필요한 동작은 이 허브로 wrap 하지 말고, `verifyTeacherOrAdmin` 같은 적절한 가드 사용.
- realtime 갱신이 걸린 도메인 (bus 위주) 은 `src/lib/bus/realtime-utils.ts` 와 동기 유지.
