-- ============================================================
-- class_homework_books.start_unit 컬럼 부활
-- ============================================================
-- 20260515 마이그레이션에서 start_unit 컬럼이 제거됐으나, 부여 시
-- "이미 진행 중인 학생들이 있어 1번이 아닌 unit 부터 시작" 요구가
-- 재발생. 컬럼 재도입 + 기존 행은 default 1 로 backfill.
-- ============================================================

BEGIN;

ALTER TABLE public.class_homework_books
  ADD COLUMN start_unit int NOT NULL DEFAULT 1
  CHECK (start_unit >= 1);

COMMIT;
