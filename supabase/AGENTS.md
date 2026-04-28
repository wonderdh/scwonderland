# supabase/

마이그레이션 + 로컬 CLI 설정.

## 마이그레이션 흐름

1. 새 SQL 파일을 `migrations/` 에 추가. 파일명 timestamp 규칙은 Supabase CLI 에 위임.
2. `npm run db:types:local` (로컬) 또는 `npm run db:types` (원격) 으로 `src/lib/types/database.ts` 갱신.
3. 타입 변경 PR 에 같이 commit.

## 주의

- RLS 정책 변경은 마이그레이션으로만. 수동 SQL 패치 금지.
- `config.toml` 은 로컬 CLI 용. 시크릿 들어가면 안 됨.
- `snippets/`, `.branches/` 는 CLI 가 관리. 직접 편집 X.
