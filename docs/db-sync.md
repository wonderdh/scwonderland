# DB Sync — Cloud Supabase → Local

클라우드 Supabase 를 로컬 Supabase 로 옮기는 작업의 전체 흐름. **dump-based** 방식으로, cloud 와 local 이 같은 스키마라는 가정에서 동작.

> 변환 로직 없음 — `supabase db dump` + `psql` 로 1:1 복제.

---

## 1. 사전 준비

### 1-1. `.env.scripts` 작성
`.env.scripts.example` 복사해서 `.env.scripts` 만들고 채움:

```env
SOURCE_URL=https://jxrzhonxnkjpjmzdhyoi.supabase.co        # 클라우드
SOURCE_SERVICE_KEY=eyJ...                                   # 클라우드 service_role
TARGET_URL=http://127.0.0.1:54321                           # 로컬
TARGET_SERVICE_KEY=eyJ...                                   # 로컬 service_role (supabase status)
```

### 1-2. 로컬 Supabase 기동
```bash
supabase start
```
포트는 `supabase/config.toml` 의 `[api] [db] [studio]` 섹션 참고 (54321/54322/54323/54324). `major_version = 17` 로 클라우드 PG 17 과 매칭.

### 1-3. 셸 env 로드
```bash
set -a; source .env.scripts; set +a
```

---

## 2. Full sync — `npm run db:sync`

**언제**: cloud 데이터로 로컬을 동기화. 신규 user 만 비번 `"1111"`, 기존 로컬 user 비번은 자동 보존.

`scripts/sync-full.sh` 5단계:

| # | 명령 | 효과 |
|---|------|------|
| 1 | `supabase db pull` | 클라우드의 새 마이그레이션을 `supabase/migrations/` 로 받아옴 (멱등) |
| 2 | `supabase db reset` | 로컬 DB 초기화 + 마이그레이션 재적용 (스키마 fresh) |
| 3 | `node scripts/sync-auth-from-cloud.mjs` | cloud `auth.users` 를 로컬에 createUser. **UUID 보존** + 비번 `"1111"`. 기존 user 는 skip. |
| 4 | `supabase db dump --data-only --schema public --use-copy -f tmp/cloud-public.sql` | cloud `public` 스키마 데이터를 COPY 형식 SQL 로 dump |
| 5 | `docker cp` + `docker exec psql -f` | dump 를 로컬 PG 컨테이너에 적용 |

### 핵심 포인트
- **UUID 보존** — 3단계가 cloud user 의 `id` 를 그대로 createUser. → 4단계 dump 의 모든 FK (예: `students.id = auth.users.id`) 가 그대로 유효.
- **trigger 자동 우회** — `supabase db dump` 가 SQL 첫 줄에 `SET session_replication_role = replica;` 를 박아 import 시 trigger 비활성화.
- **재실행 안전** — `sync-auth-from-cloud.mjs` 가 기존 user skip 이고, `db reset` 이 매번 깨끗이 만들어줘서 멱등.

### 비밀번호 정책
- 신규 user: `"1111"` 자동 (`scripts/sync-auth-from-cloud.mjs` 의 `PASSWORD` 기본값)
- 기존 user: 비번 보존 (createUser 스킵)
- 일괄 변경하려면 별도: `npm run db:reset-passwords`

---

## 3. 타입 재생성

```bash
npm run db:types:local
# = supabase gen types typescript --local > src/lib/types/database.generated.ts
```

원격 직접 (클라우드 project_id 박힘): `npm run db:types`

---

## 4. 검증

### 4-1. 빠른 row count (권장)
docker 컨테이너 안에서 직접 SELECT:

```bash
MSYS_NO_PATHCONV=1 docker exec supabase_db_scwonderland-local \
  psql -U postgres -d postgres -c "
    SELECT table_name, n_live_tup
    FROM pg_stat_user_tables
    WHERE schemaname='public'
    ORDER BY table_name;
  "
```

### 4-2. Supabase Studio
`http://127.0.0.1:54323` 접속 → Table Editor 에서 핵심 테이블 (students/classes/attendance 등) 행수·내용 눈으로 확인.

### 4-3. 앱으로 검증
```bash
npm run dev
```
임의 cloud user 이메일 + 비번 `"1111"` 로 로그인 가능한지.

---

## 5. 부가 도구

| 명령 / 파일 | 용도 |
|------|------|
| `npm run db:reset-passwords` | 로컬 전체 비번 `"1111"` 통일 (127.0.0.1 외 URL 은 `ALLOW_REMOTE=true` 필요) |
| `scripts/sync-auth-from-cloud.mjs` | sync-full 의 3단계. 단독 실행 가능 (auth 만 sync) |
| Supabase Studio | `http://127.0.0.1:54323` |

---

## 6. Supabase MCP 의 역할

마이그레이션 흐름에서 MCP 는 보조용:

| MCP 툴 | 용도 |
|--------|------|
| `mcp__supabase__list_tables` / `execute_sql` | 클라우드 스키마/데이터 사전 점검 |
| `mcp__supabase__list_migrations` | 클라우드의 마이그레이션 히스토리 확인 |
| `mcp__supabase__get_advisors` | 마이그레이션 후 RLS/perf 권고 확인 |
| `mcp__supabase__generate_typescript_types` | `npm run db:types` 대안 |

`mcp__supabase__apply_migration` 은 로컬→클라우드 푸시용 — 이 방향에서는 사용 X.

---

## 7. TL;DR

```bash
set -a; source .env.scripts; set +a
supabase start                            # 한 번만
npm run db:sync                           # cloud → local 전체 동기화
npm run db:types:local                    # 타입 갱신
```

Studio (`http://127.0.0.1:54323`) 또는 `npm run dev` 로 검증.

---

## 8. 자주 묻는 시나리오

### Q. cloud 를 원본으로 로컬에 다시 덮어쓰고 싶다. 비번은 `"1111"` 유지.

```bash
set -a; source .env.scripts; set +a
npm run db:sync
npm run db:types:local
```

- 1단계 `db pull` 은 멱등 — 이미 받은 마이그레이션은 다시 안 받음.
- 2단계 `db reset` 이 로컬 비우고 마이그레이션 재적용.
- 3단계 `sync-auth-from-cloud.mjs` 가 cloud 신규 user 만 비번 `"1111"` 로 생성. **기존 로컬 user 의 비번은 그대로**.
- 4·5단계가 cloud `public` 데이터를 1:1 복제.

### Q. `migrations/` 폴더 비우면 안 됨?

비우지 말 것. 이유:

1. `migrations/` 는 **git-tracked 스키마 진화 기록**. 36개 파일이 RLS/FK 컨벤션 패치 (`20260512000000_role_specific_fks.sql` 등) 포함.
2. `supabase/AGENTS.md`: "RLS 정책 변경은 마이그레이션으로만. 수동 SQL 패치 금지."
3. `CLAUDE.md`: "Supabase 마이그레이션은 `supabase/migrations/` 에 추가하고 `npm run db:types` 로 타입 재생성."
4. 비우면 `db pull` 이 단일 baseline 으로만 받아옴 → 히스토리·맥락 손실.

### Q. cloud `schema_migrations` history mismatch 에러가 나면?

`supabase db pull` 이 fail 하면서 41개 정도의 `supabase migration repair ...` 명령을 출력함. CLI 권고대로 실행:

```bash
supabase migration repair --status reverted <ts1> <ts2> ...    # 클라우드만 있고 파일 없는 것
supabase migration repair --status applied  <ts1> <ts2> ...    # 파일만 있고 클라우드 history 없는 것
```

이건 클라우드 `schema_migrations` **메타 테이블만** 정리. 실제 DB 스키마/데이터는 안 건드림. 단, 팀 협업 환경이면 사전 합의 권장.

### Q. 같은 timestamp 의 마이그레이션 파일이 있으면?

`schema_migrations.version` PK 충돌로 `db reset` 실패. 한 파일 timestamp 만 살짝 변경 (예: `_000000_` → `_001000_`) 후 `repair --status applied` 로 cloud 에 그 timestamp 등록.

### Q. 신규 user 가 아닌데 비번을 `"1111"` 로 강제하려면?

```bash
set -a; source .env.scripts; set +a
TARGET_PASSWORD=1111 npm run db:reset-passwords
```

> 주의: `supabase/config.toml` 의 `[auth] minimum_password_length` (현재 `4`) 이하로는 거부됨.

### Q. dump 파일은 어디에 저장되나? PII 가 들어있나?

- 경로: `tmp/cloud-public.sql`
- gitignored (`.gitignore` 에 `/tmp/` 등록됨)
- PII (사용자 이름·이메일·전화 등) 다수 포함 → **commit 절대 금지**
- 사용 후 삭제 권장: `rm tmp/cloud-public.sql`

### Q. docker 없이 dump 적용 가능?

현재 스크립트는 `docker exec psql` 사용 (psql 이 PATH 에 없는 환경 가정).
PATH 에 `psql` 이 있으면 `sync-full.sh` 의 5단계를 다음과 같이 바꿔도 됨:

```bash
psql "postgres://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f tmp/cloud-public.sql
```

단 PowerShell 환경에서는 PATH 통일 필요.
