#!/usr/bin/env bash
# Full sync: 클라우드 Supabase → 로컬 (스키마 + 데이터 + auth)
# 비밀번호는 모두 "1111" 로 통일됨
#
# 필요 env: SOURCE_URL, SOURCE_SERVICE_KEY, TARGET_URL, TARGET_SERVICE_KEY
# 자세한 내용: .env.scripts.example 참고

set -euo pipefail

cd "$(dirname "$0")/.."

echo "=== 1/3 스키마 pull (클라우드 → supabase/migrations) ==="
supabase db pull

echo ""
echo "=== 2/3 로컬 DB 리셋 (모든 데이터 삭제) ==="
supabase db reset

echo ""
echo "=== 3/3 클라우드 데이터 이전 (auth 포함, 비밀번호: 1111) ==="
node scripts/migrate-cloud-to-target.mjs

echo ""
echo "=== Full sync 완료 ==="
echo "다음 단계: npm run db:types:local  (타입 재생성)"
