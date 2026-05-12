-- /admin/homework 구조 변경:
-- 숙제 요일을 class_schedules(수업 시간표) 기반 자동 결정에서
-- 관리자가 반 단위로 지정하는 방식으로 전환.
--
-- 변경 사항:
--   1. classes.homework_days int[] 컬럼 추가 (default '{}', 0=일~6=토)
--   2. 기존 반의 homework_days 를 class_schedules.day_of_week distinct 로 backfill
--      → 도입 직후에도 진도 화면이 끊기지 않게 (사용자가 명시 변경 전까지 동일 결과)
--   3. CHECK 제약: 모든 원소가 0..6 사이

set search_path = public;

-- =================================================================
-- 1. 컬럼 추가
-- =================================================================
alter table public.classes
  add column if not exists homework_days int[] not null default '{}';

-- 0=일 ~ 6=토 (KST, src/lib/utils/date-kst.ts:13 컨벤션과 동일)
alter table public.classes
  drop constraint if exists classes_homework_days_range_check;
alter table public.classes
  add constraint classes_homework_days_range_check
  check (
    homework_days <@ array[0,1,2,3,4,5,6]::int[]
  );

comment on column public.classes.homework_days is
  '반의 숙제 요일 (0=일~6=토, KST). 비어있으면 진도 스케줄 비활성. 관리자가 /admin/homework 에서 지정.';

-- =================================================================
-- 2. backfill — 기존 class_schedules.day_of_week distinct
-- =================================================================
update public.classes c
set homework_days = sub.days
from (
  select cs.class_id,
         array(
           select distinct cs2.day_of_week
           from public.class_schedules cs2
           where cs2.class_id = cs.class_id
           order by cs2.day_of_week
         ) as days
  from public.class_schedules cs
  group by cs.class_id
) as sub
where c.id = sub.class_id
  and (c.homework_days is null or c.homework_days = '{}');
