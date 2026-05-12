-- 20260515 의 class_textbooks → class_homework_books 이름 변경 이후, 옛날에 만들어진
-- class_homework_books row 는 자동 시드 트리거가 한 번도 fire 되지 않은 상태.
-- 신규 INSERT 만 시드되므로, 기존 row 에 대해 일회성 backfill 을 실행한다.
--
-- 멱등: ON CONFLICT DO NOTHING.

set search_path = public;

-- 1. 누락된 student_homework_books 생성
insert into public.student_homework_books (class_student_id, class_homework_book_id)
select cs.id, chb.id
from public.class_homework_books chb
  join public.class_students cs
    on cs.class_id = chb.class_id
   and cs.is_active = true
on conflict (class_student_id, class_homework_book_id) do nothing;

-- 2. 누락된 student_homework_progress 생성
--    (student_homework_books INSERT 트리거가 위 1번 단계에서 fire 되므로 자동 시드.
--     보험으로 명시 backfill 한 번 더 — total_units 만큼 row 생성.)
insert into public.student_homework_progress (student_homework_book_id, unit_number, status)
select shb.id, gs.unit_number, 'pending'
from public.student_homework_books shb
  join public.class_homework_books chb on chb.id = shb.class_homework_book_id
  join public.homework_books hb on hb.id = chb.textbook_id
  cross join lateral generate_series(1, hb.total_units) as gs(unit_number)
where hb.total_units > 0
on conflict (student_homework_book_id, unit_number) do nothing;
