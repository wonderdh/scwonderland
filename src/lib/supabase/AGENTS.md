# lib/supabase/

Supabase 클라이언트 3개. 어떤 환경에서 어떤 클라이언트를 쓰는지가 핵심.

| 파일 | 사용처 | 권한 |
|---|---|---|
| `client.ts` | 클라이언트 컴포넌트 (use client) | anon, RLS 적용 |
| `server.ts` | RSC / Server Action / Route Handler | 사용자 세션, RLS 적용 |
| `admin.ts` | 서버 전용 + service-role 필요 | RLS 우회. **절대 client 코드에서 import 금지** |

## 규칙

- `admin.ts` import 는 server action / route handler 안에서만. 정적 분석으로 못 막으니 PR 리뷰 때 grep.
- `storage.ts` / `notice-crud-helpers.ts` 는 위 3 클라이언트 위에서 동작. 새 클라이언트 만들지 말고 헬퍼만 추가.
- 타입은 `lib/types/database.ts` (자동 생성). 직접 수정 금지 → `pnpm db:types`.
