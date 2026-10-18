#!/usr/bin/env bash
# Full sync: 클라우드 Supabase → 로컬 (dump-based, 신 스키마 호환)
#
# 흐름:
#   1. supabase db reset        (로컬 DB 초기화 + 마이그레이션 재적용)
#   2. sync-auth-from-cloud.mjs (auth.users UUID 보존 + 비번 "1111")
#   3. supabase db dump         (cloud public 데이터 dump)
#   4. docker exec psql         (로컬에 적용)
#
# db pull 은 하지 않음: 클라우드 migration history 에 기록을 추가하고 노이즈 diff 를 만듦.
# 스키마는 git 의 supabase/migrations/ 가 기준.
#
# 비번 "1111" 정책:
#   - 신규 user 만 비번 "1111" 로 생성. 기존 로컬 user 는 비번 보존.
#   - 강제 일괄 변경하려면 별도로 pnpm db:reset-passwords
#
# 필요 env (.env.scripts):
#   SOURCE_URL, SOURCE_SERVICE_KEY  (클라우드)
#   TARGET_URL, TARGET_SERVICE_KEY  (로컬)
#
# 의존성:
#   - supabase CLI
#   - docker (supabase 로컬이 docker 위에서 돌므로 자동 가용)
#   - node
#
# 자세한 내용: docs/db-sync.md

set -euo pipefail

cd "$(dirname "$0")/.."

PROJECT_ID=$(grep '^project_id' supabase/config.toml | cut -d'"' -f2)
DB_CONTAINER="supabase_db_${PROJECT_ID}"
DUMP_FILE="tmp/cloud-public.sql"

if ! docker ps --format "{{.Names}}" | grep -q "^${DB_CONTAINER}$"; then
  echo "ERROR: ${DB_CONTAINER} 컨테이너가 없습니다. supabase start 먼저 실행하세요." >&2
  exit 1
fi

mkdir -p tmp

echo "=== 1/4 로컬 DB 리셋 (스키마 fresh) ==="
supabase db reset

echo ""
echo "=== 2/4 auth.users 동기화 (UUID 보존, 비번 1111) ==="
node scripts/sync-auth-from-cloud.mjs

echo ""
echo "=== 3/4 클라우드 public 데이터 dump ==="
supabase db dump --data-only --schema public --use-copy -f "${DUMP_FILE}"

echo ""
echo "=== 4/4 dump 로컬 적용 (docker exec psql) ==="
MSYS_NO_PATHCONV=1 docker cp "${DUMP_FILE}" "${DB_CONTAINER}:/tmp/cloud-public.sql"
MSYS_NO_PATHCONV=1 docker exec "${DB_CONTAINER}" \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/cloud-public.sql

echo ""
echo "=== Full sync 완료 ==="
echo "다음 단계:"
echo "  pnpm db:types:local  (타입 재생성)"
echo "  Studio: http://127.0.0.1:54323"
