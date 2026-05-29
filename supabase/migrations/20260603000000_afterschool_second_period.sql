-- 방과후 1·2차 판정을 academy_periods 의존에서 분리하고,
-- afterschool_enrollments 에 second_period 불리언으로 직접 저장한다.
--
-- 배경: 20260525000000 마이그레이션이 group_type='afterschool' academy_periods 를
-- 전부 삭제하면서, academy_period_id 기반 1/2차 판정이 항상 null(=1교시)로 깨졌다.
-- 1·2차는 이제 하원 시각(15:30=1차 / 16:20=2차)으로 결정한다.

-- 1) 컬럼 추가 (기본 1차)
ALTER TABLE public.afterschool_enrollments
  ADD COLUMN IF NOT EXISTS second_period boolean NOT NULL DEFAULT false;

-- 2) 기존 데이터 백필 — 하원 슬롯(student_bus_defaults dropoff)의 시각이 16:20 이면 2차.
--    하원 시각이 진짜 출처이므로 정확히 복구된다.
UPDATE public.afterschool_enrollments ae
SET second_period = true
FROM public.student_bus_defaults sbd
JOIN public.bus_time_slots bts ON bts.id = sbd.bus_time_slot_id
WHERE sbd.student_id = ae.student_id
  AND sbd.day_of_week = ae.day_of_week
  AND sbd.direction = 'dropoff'
  AND substring(bts.time FROM 1 FOR 5) = '16:20';

-- 3) (class_id, student_id, day_of_week) 중복 행 정리 — 신규 UNIQUE 제약 전에 1행만 남긴다.
--    second_period=true 행을 우선 보존.
DELETE FROM public.afterschool_enrollments a
USING public.afterschool_enrollments b
WHERE a.class_id = b.class_id
  AND a.student_id = b.student_id
  AND a.day_of_week = b.day_of_week
  AND (a.second_period < b.second_period
       OR (a.second_period = b.second_period AND a.id < b.id));

-- 4) UNIQUE 제약 교체: academy_period_id 포함 → (class_id, student_id, day_of_week)
ALTER TABLE public.afterschool_enrollments
  DROP CONSTRAINT IF EXISTS afterschool_enrollments_unique;
ALTER TABLE public.afterschool_enrollments
  ADD CONSTRAINT afterschool_enrollments_unique
  UNIQUE (class_id, student_id, day_of_week);

-- 5) academy_period_id FK + 컬럼 제거 (더 이상 사용 안 함)
ALTER TABLE public.afterschool_enrollments
  DROP CONSTRAINT IF EXISTS afterschool_enrollments_academy_period_id_fkey;
ALTER TABLE public.afterschool_enrollments
  DROP COLUMN IF EXISTS academy_period_id;
