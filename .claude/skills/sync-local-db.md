---
name: sync-local-db
description: Use when the user wants to sync cloud Supabase data to their local dev DB, reset local passwords, or troubleshoot the db:sync* npm scripts. Triggers on phrases like "로컬 DB 동기화", "클라우드 데이터 가져오기", "비번 1111 리셋", "supabase 동기화", "db:sync".
---

# 로컬 DB 동기화 가이드

클라우드 Supabase → 로컬 dev 환경 동기화를 위한 3가지 npm 스크립트.

## 어떤 모드를 써야 할까

| 상황 | 명령 | auth.users | 비번 |
|---|---|---|---|
| 처음 세팅 / 로컬 완전 초기화 | `npm run db:sync` | 클라우드 user 새로 생성 | 모두 "1111" |
| 일상 — 클라우드 스키마 변경 반영 | `npm run db:sync:no-auth` | 기존 로컬 계정 보존 | 변경 없음 |
| 비번만 1111로 통일하고 싶을 때 | `npm run db:reset-passwords` | 그대로 | 모두 "1111" |

판단 기준:
- **로컬 auth.users 가 비어있음** → `db:sync`
- **로컬 계정 그대로, 새 마이그레이션만 받고 싶음** → `db:sync:no-auth`
- **계정/스키마 다 그대로, 비번만 1111로** → `db:reset-passwords`

## 사전 준비

1. 로컬 Supabase 실행 중인지 확인
   ```bash
   supabase status
   ```

2. env 변수 세팅 (`.env.scripts.example` 참조)
   - 셸에 직접 export, 또는 dotenv 패턴:
     ```bash
     set -a; source .env.scripts; set +a
     ```
   - 필요한 값:
     - `SOURCE_URL` / `SOURCE_SERVICE_KEY` (클라우드)
     - `TARGET_URL` / `TARGET_SERVICE_KEY` (로컬, `supabase status` 의 service_role)
     - `LOCAL_SUPABASE_SERVICE_KEY` (비번 리셋용, `TARGET_SERVICE_KEY` 와 동일하게 둬도 됨)

## 실행 시나리오

### A. 처음 세팅 (Full sync)
```bash
supabase start                  # 로컬 안 켜져 있으면
set -a; source .env.scripts; set +a
npm run db:sync                 # 스키마 pull → reset → 데이터 이전
npm run db:reset-passwords      # (선택) 모든 계정 1111 강제
npm run db:types:local          # 타입 재생성
```

### B. 일상 (No-auth sync)
```bash
set -a; source .env.scripts; set +a
npm run db:sync:no-auth
npm run db:types:local
```

## 트러블슈팅

### "weak_password" / "Password should be at least 6 characters" 에러
Supabase 기본 정책 (`password_min_length=6`) 이 활성화됨. "1111" 은 4자라 거부됨.

해결:
- `supabase/config.toml` 의 `[auth]` 섹션에서 `minimum_password_length = 4` 로 낮추기
- 또는 비번을 6자 이상 (`TARGET_PASSWORD=111111`) 으로 변경
- 변경 후 `supabase stop && supabase start` 로 재시작

### `supabase migration up` 시 마이그레이션 충돌
`supabase db pull` 이 가져온 새 마이그레이션과 로컬에 이미 적용된 마이그레이션이 충돌.

해결:
- `supabase migration list` 로 상태 확인
- 충돌 마이그레이션 파일을 수동으로 정리하거나, `db:sync` (full sync) 로 전환

### FK 오류 — "source 에 있지만 target 에 없는 user"
`db:sync:no-auth` 사용 시 클라우드 user 가 로컬에 없으면 해당 데이터는 스킵됨.
콘솔 경고로 누락된 email 확인 가능. 필요한 user 만 로컬에 수동 생성 후 재실행.

### `supabase db reset` 이 로컬 user 도 다 지움
Full sync 의 의도된 동작. 보존하려면 `db:sync:no-auth` 사용.

### `node-fetch` / 네트워크 오류
클라우드 `SOURCE_URL` 접근 안 될 때. VPN / 방화벽 / Supabase project 일시정지 여부 확인.

## 안전장치

- `reset-local-passwords.mjs` 는 URL 이 `127.0.0.1` / `localhost` 가 아니면 거부.
  - 운영 DB 에 실수로 실행 방지. 필요 시 `ALLOW_REMOTE=true` 명시.
- 모든 스크립트 `DRY_RUN=true` 로 미리 시뮬레이션 가능.

## 관련 파일

- `scripts/migrate-cloud-to-target.mjs` — 데이터 이전 코어 (모드 3종: legacy / snapshot-out / snapshot-in)
- `scripts/sync-full.sh` — Full sync 오케스트레이터
- `scripts/sync-no-auth.sh` — No-auth sync 오케스트레이터
- `scripts/reset-local-passwords.mjs` — 비번 일괄 리셋
- `.env.scripts.example` — env 변수 템플릿
