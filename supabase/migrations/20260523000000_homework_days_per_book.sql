-- 숙제 요일 단위 이동: 반(classes.homework_days) → 부여(class_homework_books.homework_days).
--
-- 이전 마이그레이션(20260522000000) 이 추가한 classes.homework_days 의 값을
-- 각 반의 모든 class_homework_books row 에 복사한 뒤, classes.homework_days 컬럼은 제거.

set search_path = public;

-- =================================================================
-- 1. 컬럼 추가
-- =================================================================
alter table public.class_homework_books
  add column if not exists homework_days int[] not null default '{}';

alter table public.class_homework_books
  drop constraint if exists class_homework_books_homework_days_range_check;
alter table public.class_homework_books
  add constraint class_homework_books_homework_days_range_check
  check (
    homework_days <@ array[0,1,2,3,4,5,6]::int[]
  );

comment on column public.class_homework_books.homework_days is
  '이 부여의 숙제 요일 (0=일~6=토, KST). 비어있으면 진도 스케줄 비활성. 관리자가 /admin/homework 에서 지정.';

-- =================================================================
-- 2. backfill — classes.homework_days 값을 그 반의 모든 책에 복사
-- =================================================================
update public.class_homework_books chb
set homework_days = c.homework_days
from public.classes c
where chb.class_id = c.id
  and (chb.homework_days is null or chb.homework_days = '{}')
  and c.homework_days is not null
  and c.homework_days <> '{}';

-- =================================================================
-- 3. classes.homework_days 제거
-- =================================================================
alter table public.classes drop constraint if exists classes_homework_days_range_check;
alter table public.classes drop column if exists homework_days;
