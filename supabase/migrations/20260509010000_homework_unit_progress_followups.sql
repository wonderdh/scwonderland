-- 숙제 unit progress — 첫 마이그레이션 followups
-- 1. 기존 homework_completion 의 잔여 trigger 함수 제거
-- 2. class_students UPDATE 시 is_active 재활성화에서도 unit row 시드
-- 참고: code review §5, §6

set search_path = public;

-- =================================================================
-- 1. 잔여 함수 제거 (DROP TABLE CASCADE 가 trigger 만 정리해서 함수가 남음)
-- =================================================================

drop function if exists public.tg_homework_completion_set_updated_at() cascade;

-- =================================================================
-- 2. class_students 재활성화 시에도 unit row 시드
--    - is_active false → true 로 전환되는 UPDATE 만 처리
--    - 새 INSERT 는 기존 tg_class_student_seed_units 트리거가 처리
-- =================================================================

create or replace function public.tg_class_student_reactivate_seed_units() returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  -- false → true 전환만 처리 (true → true 의 다른 컬럼 변경은 skip)
  if NEW.is_active is not true then
    return NEW;
  end if;
  if OLD.is_active is true then
    return NEW;
  end if;

  insert into public.homework_unit_progress (student_id, textbook_id, unit_number)
  select NEW.student_id, ct.textbook_id, gs.n
  from public.class_textbooks ct
    join public.textbooks tb on tb.id = ct.textbook_id
    cross join lateral generate_series(1, tb.total_units) as gs(n)
  where ct.class_id = NEW.class_id
    and tb.is_active = true
    and tb.total_units > 0
  on conflict (student_id, textbook_id, unit_number) do nothing;

  return NEW;
end;
$$;

alter function public.tg_class_student_reactivate_seed_units() owner to postgres;

comment on function public.tg_class_student_reactivate_seed_units() is
  'SECURITY DEFINER: relies on parent table RLS to gate which class_students rows can be updated. Do not relax class_students RLS without auditing this function.';

drop trigger if exists tg_class_student_reactivate_seed on public.class_students;
create trigger tg_class_student_reactivate_seed
  after update of is_active on public.class_students
  for each row execute function public.tg_class_student_reactivate_seed_units();

-- =================================================================
-- 3. 기존 시드 트리거에 SECURITY DEFINER 계약 코멘트 추가
-- =================================================================

comment on function public.tg_class_textbook_seed_units() is
  'SECURITY DEFINER: relies on parent class_textbooks RLS (admin only insert). Do not relax without audit.';
comment on function public.tg_student_textbook_seed_units() is
  'SECURITY DEFINER: relies on parent student_textbooks RLS (admin only insert). Do not relax without audit.';
comment on function public.tg_class_student_seed_units() is
  'SECURITY DEFINER: relies on parent class_students RLS (admin only insert). Do not relax without audit.';
