-- 숙제 일정 자동 배정 — start_date + start_unit 컬럼 추가
-- · class_textbooks / student_textbooks 양쪽 동일
-- · schedule 자체는 저장 X (계산식). start_date + start_unit + homework_days + skip_dates + total_units 로 동적 계산.
-- 참고: .omc/plans/homework-scheduling.md

set search_path = public;

-- =================================================================
-- class_textbooks
-- =================================================================

alter table public.class_textbooks
  add column if not exists start_date date;

alter table public.class_textbooks
  add column if not exists start_unit integer not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'class_textbooks_start_unit_check'
      and conrelid = 'public.class_textbooks'::regclass
  ) then
    alter table public.class_textbooks
      add constraint class_textbooks_start_unit_check check (start_unit >= 1);
  end if;
end$$;

comment on column public.class_textbooks.start_date is '숙제 일정 시작일. NULL 이면 schedule 미입력 (자동 배정 비활성).';
comment on column public.class_textbooks.start_unit is '시작 unit (1-based). default 1.';

-- =================================================================
-- student_textbooks
-- =================================================================

alter table public.student_textbooks
  add column if not exists start_date date;

alter table public.student_textbooks
  add column if not exists start_unit integer not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'student_textbooks_start_unit_check'
      and conrelid = 'public.student_textbooks'::regclass
  ) then
    alter table public.student_textbooks
      add constraint student_textbooks_start_unit_check check (start_unit >= 1);
  end if;
end$$;

comment on column public.student_textbooks.start_date is '숙제 일정 시작일. NULL 이면 schedule 미입력.';
comment on column public.student_textbooks.start_unit is '시작 unit (1-based). default 1.';
