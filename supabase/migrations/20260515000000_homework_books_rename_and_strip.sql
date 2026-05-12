-- 1) 테이블 rename
--    class_textbooks   → class_homework_books
--    student_textbooks → student_homework_books
-- 2) 두 테이블에서 homework_days, skip_dates, start_unit 컬럼 제거
-- 3) rename 후 깨지는 plpgsql 트리거 함수 재선언

set search_path = public;

-- =================================================================
-- 1. Rename
-- =================================================================

alter table public.class_textbooks rename to class_homework_books;
alter table public.student_textbooks rename to student_homework_books;

-- =================================================================
-- 2. 컬럼 제거 (CASCADE 로 GIN 인덱스, check 제약 동반 정리)
-- =================================================================

alter table public.class_homework_books
  drop column if exists homework_days cascade,
  drop column if exists skip_dates cascade,
  drop column if exists start_unit cascade;

alter table public.student_homework_books
  drop column if exists homework_days cascade,
  drop column if exists skip_dates cascade,
  drop column if exists start_unit cascade;

-- =================================================================
-- 3. plpgsql 트리거 함수 재선언 (hardcoded 테이블명 갱신)
--    rename 으로 트리거 자체는 따라오지만 함수 본문은 늦은 바인딩이라
--    실행 시점에 `class_textbooks` 를 못 찾아 실패함. 재선언 필요.
-- =================================================================

create or replace function public.tg_class_student_seed_units() returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  if NEW.is_active is not true then
    return NEW;
  end if;

  insert into public.homework_unit_progress (student_id, textbook_id, unit_number)
  select NEW.student_id, ct.textbook_id, gs.n
  from public.class_homework_books ct
    join public.textbooks tb on tb.id = ct.textbook_id
    cross join lateral generate_series(1, tb.total_units) as gs(n)
  where ct.class_id = NEW.class_id
    and tb.is_active = true
    and tb.total_units > 0
  on conflict (student_id, textbook_id, unit_number) do nothing;

  return NEW;
end;
$$;

create or replace function public.tg_class_student_seed_progress() returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  if NEW.is_active then
    insert into public.student_textbook_progress (student_id, textbook_id)
    select NEW.student_id, ct.textbook_id
    from public.class_homework_books ct
      join public.textbooks tb on tb.id = ct.textbook_id
    where ct.class_id = NEW.class_id
      and tb.is_active = true
    on conflict (student_id, textbook_id) do nothing;
  end if;
  return NEW;
end;
$$;
