#!/usr/bin/env bash
# No-auth sync: 클라우드 → 로컬 스키마 + public 데이터만
# auth.users (기존 로컬 계정 + 비밀번호) 보존됨
#
# 필요 env: SOURCE_URL, SOURCE_SERVICE_KEY, TARGET_URL, TARGET_SERVICE_KEY
# 자세한 내용: .env.scripts.example 참고

set -euo pipefail

cd "$(dirname "$0")/.."

echo "=== 1/3 스키마 pull (클라우드 → supabase/migrations) ==="
supabase db pull

echo ""
echo "=== 2/3 새 마이그레이션만 적용 (기존 데이터 + auth 유지) ==="
supabase migration up

echo ""
echo "=== 3/3 공개 데이터만 이전 (KEEP_AUTH=true, auth 스킵) ==="
KEEP_AUTH=true node scripts/migrate-cloud-to-target.mjs

echo ""
echo "=== No-auth sync 완료 ==="
echo "다음 단계: npm run db:types:local  (타입 재생성)"
echo ""
echo "주의: 클라우드에 있지만 로컬에 없는 user 의 데이터는 이전되지 않습니다."
echo "      (콘솔 경고 메시지 확인)"
