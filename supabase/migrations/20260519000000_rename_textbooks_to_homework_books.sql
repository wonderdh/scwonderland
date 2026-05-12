-- public.textbooks → public.homework_books 로 rename.
--
-- 영향:
--  · 트리거 / 인덱스 / RLS 정책은 rename 따라옴 (Postgres가 OID 기준으로 추적).
--  · plpgsql 함수 본문에서 `textbooks` 를 하드코딩한 곳은 late binding 이라 재선언 필요.
--    현재 해당되는 함수: tg_student_homework_book_seed_progress (homework_unit_progress 폐기 후 유일).

set search_path = public;

alter table public.textbooks rename to homework_books;

-- 본문 안에 `public.textbooks` 가 들어 있던 함수 재선언
create or replace function public.tg_student_homework_book_seed_progress() returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_total integer;
begin
  select hb.total_units into v_total
  from public.class_homework_books chb
    join public.homework_books hb on hb.id = chb.textbook_id
  where chb.id = NEW.class_homework_book_id;

  if v_total is null or v_total <= 0 then
    return NEW;
  end if;

  insert into public.student_homework_progress (
    student_homework_book_id, unit_number, status
  )
  select NEW.id, gs.n, 'pending'
  from generate_series(1, v_total) as gs(n)
  on conflict (student_homework_book_id, unit_number) do nothing;
  return NEW;
end;
$$;
