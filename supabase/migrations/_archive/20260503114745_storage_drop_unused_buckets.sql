-- ============================================================
-- Storage 버킷 정리: academy-notices / class-notices 폐기 — 정책만 마이그레이션 처리
--
-- 배경:
--   대응 테이블 (academy_notices, class_notices) 은 cutover 시 드롭되었으나
--   Storage 버킷이 그대로 남아 advisor 0025 가 broad SELECT 정책 경고.
--
-- 처리:
--   - 버킷 자체는 Supabase Storage API 로 사전 삭제 (DELETE /storage/v1/bucket/<id>)
--     SQL 직접 delete 는 storage.protect_delete() 트리거로 차단됨
--   - 본 마이그레이션은 storage.objects 의 broad SELECT 정책만 정리 (idempotent)
-- ============================================================

drop policy if exists "academy_notices_public_read" on storage.objects;
drop policy if exists "class_notices_public_read"   on storage.objects;
