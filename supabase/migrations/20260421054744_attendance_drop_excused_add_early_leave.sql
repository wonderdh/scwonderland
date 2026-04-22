-- =============================================================================
-- Migration: 20260421000000_attendance_drop_excused_add_early_leave.sql
-- Purpose  : attendance.status CHECK 제약에서 'excused' 제거, 'early_leave' 추가
--            앱 코드(attendance-actions.ts 등)는 이미 early_leave를 upsert하고
--            있으나 DB의 attendance_status_check가 이를 막아 insert/upsert가
--            실패했다(new row ... violates check constraint "attendance_status_check").
-- Data     : 기존 'excused' 행은 'absent'로 일괄 변환 (사유결석도 결석으로 통합).
--            변환 이력은 보존되지 않으므로 롤백해도 excused는 복구되지 않음.
-- =============================================================================
--
-- ROLLBACK (run this block to undo the constraint change — 데이터는 복구 불가):
-- ----------------------------------------------------------------------------
-- BEGIN;
-- ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
-- ALTER TABLE public.attendance
--   ADD CONSTRAINT attendance_status_check
--   CHECK (status IN ('present','absent','late','excused'));
-- COMMIT;
-- =============================================================================

BEGIN;

-- 1) 기존 'excused' 행을 'absent'로 변환 (새 CHECK 적용 전 필수)
UPDATE public.attendance
SET status = 'absent'
WHERE status = 'excused';

-- 2) 기존 CHECK 제약 제거
ALTER TABLE public.attendance
  DROP CONSTRAINT IF EXISTS attendance_status_check;

-- 3) 새 CHECK 제약 추가 (present / absent / late / early_leave)
ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_status_check
  CHECK (status IN ('present', 'absent', 'late', 'early_leave'));

COMMIT;
