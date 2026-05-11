-- 숙제 진도 — Unit Grid 시스템
-- · 학생-책-unit 단위 (UNIQUE: student_id + textbook_id + unit_number)
-- · status: pending | completed | missed
-- · 부여 시 트리거로 1~total_units row 자동 생성
-- · mutation 권한: admin only (한국 교사도 read-only)
-- · 기존 homework_completion 테이블 DROP (일별 체크 폐기)
-- 참고: .omc/plans/homework-unit-grid.md

set search_path = public;

-- =================================================================
-- 1. 기존 homework_completion 폐기 (일별 체크 시스템 → unit grid 로 대체)
-- =================================================================

drop trigger if exists tg_homework_completion_set_updated_at on public.homework_completion;
drop table if exists public.homework_completion cascade;

-- =================================================================
-- 2. homework_unit_progress 테이블
-- =================================================================

create table if not exists public.homework_unit_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  textbook_id uuid not null references public.textbooks(id) on delete cascade,
  unit_number integer not null check (unit_number >= 1),
  status text not null default 'pending'
    check (status in ('pending','completed','missed')),
  completed_at timestamptz,
  marked_by uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, textbook_id, unit_number)
);

alter table public.homework_unit_progress owner to postgres;

comment on table public.homework_unit_progress is '학생-책-unit 단위 숙제 진도. 부여 시 1~total_units 만큼 pending row 자동 생성.';
comment on column public.homework_unit_progress.unit_number is '1-based unit 번호. textbook.total_units 까지.';
comment on column public.homework_unit_progress.status is 'pending | completed | missed. UI 색상: pending+예정일경과 = overdue (점선), missed = admin 명시 거부.';
comment on column public.homework_unit_progress.completed_at is 'status=completed 일 때 자동 채움. pending 으로 되돌리면 NULL.';
comment on column public.homework_unit_progress.marked_by is '마지막 status 변경한 admin profile id.';

create index if not exists hup_student_idx on public.homework_unit_progress (student_id);
create index if not exists hup_textbook_idx on public.homework_unit_progress (textbook_id);
create index if not exists hup_student_textbook_idx on public.homework_unit_progress (student_id, textbook_id);
create index if not exists hup_status_idx on public.homework_unit_progress (status);

-- =================================================================
-- 3. updated_at 트리거
-- =================================================================

drop trigger if exists tg_hup_set_updated_at on public.homework_unit_progress;
create trigger tg_hup_set_updated_at
  before update on public.homework_unit_progress
  for each row execute function public.tg_set_updated_at();

-- =================================================================
-- 4. RLS — SELECT 본인/admin/teacher, mutation admin only
-- =================================================================

alter table public.homework_unit_progress enable row level security;

drop policy if exists "hup_select" on public.homework_unit_progress;
create policy "hup_select" on public.homework_unit_progress
  for select to authenticated
  using (
    student_id = auth.uid()
    or (select private.get_my_role()) = any (array['admin'::public.user_role, 'teacher'::public.user_role])
  );

drop policy if exists "hup_admin_insert" on public.homework_unit_progress;
create policy "hup_admin_insert" on public.homework_unit_progress
  for insert to authenticated
  with check ((select private.get_my_role()) = 'admin'::public.user_role);

drop policy if exists "hup_admin_update" on public.homework_unit_progress;
create policy "hup_admin_update" on public.homework_unit_progress
  for update to authenticated
  using ((select private.get_my_role()) = 'admin'::public.user_role)
  with check ((select private.get_my_role()) = 'admin'::public.user_role);

drop policy if exists "hup_admin_delete" on public.homework_unit_progress;
create policy "hup_admin_delete" on public.homework_unit_progress
  for delete to authenticated
  using ((select private.get_my_role()) = 'admin'::public.user_role);

grant select, insert, update, delete on public.homework_unit_progress to authenticated;

-- =================================================================
-- 5. Auto-seed 트리거 — 부여 시 1~total_units row 생성
-- =================================================================

-- 5-1. class_textbooks INSERT → 그 반의 active 학생 × 1~total_units row
create or replace function public.tg_class_textbook_seed_units() returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_total integer;
begin
  select total_units into v_total
  from public.textbooks
  where id = NEW.textbook_id;

  if v_total is null or v_total <= 0 then
    return NEW;
  end if;

  insert into public.homework_unit_progress (student_id, textbook_id, unit_number)
  select cs.student_id, NEW.textbook_id, gs.n
  from public.class_students cs
    cross join generate_series(1, v_total) as gs(n)
  where cs.class_id = NEW.class_id
    and cs.is_active = true
  on conflict (student_id, textbook_id, unit_number) do nothing;

  return NEW;
end;
$$;

alter function public.tg_class_textbook_seed_units() owner to postgres;

drop trigger if exists tg_class_textbook_seed_units on public.class_textbooks;
create trigger tg_class_textbook_seed_units
  after insert on public.class_textbooks
  for each row execute function public.tg_class_textbook_seed_units();

-- 5-2. student_textbooks INSERT → 그 학생 × 1~total_units row
create or replace function public.tg_student_textbook_seed_units() returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_total integer;
begin
  select total_units into v_total
  from public.textbooks
  where id = NEW.textbook_id;

  if v_total is null or v_total <= 0 then
    return NEW;
  end if;

  insert into public.homework_unit_progress (student_id, textbook_id, unit_number)
  select NEW.student_id, NEW.textbook_id, gs.n
  from generate_series(1, v_total) as gs(n)
  on conflict (student_id, textbook_id, unit_number) do nothing;

  return NEW;
end;
$$;

alter function public.tg_student_textbook_seed_units() owner to postgres;

drop trigger if exists tg_student_textbook_seed_units on public.student_textbooks;
create trigger tg_student_textbook_seed_units
  after insert on public.student_textbooks
  for each row execute function public.tg_student_textbook_seed_units();

-- 5-3. class_students INSERT → 그 반의 모든 active textbook × 1~total_units row
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

alter function public.tg_class_student_seed_units() owner to postgres;

drop trigger if exists tg_class_student_seed_units on public.class_students;
create trigger tg_class_student_seed_units
  after insert on public.class_students
  for each row execute function public.tg_class_student_seed_units();

-- =================================================================
-- 6. 기존 데이터 일회 backfill
-- =================================================================

-- 6-1. class_textbooks × class_students × 1~total_units
insert into public.homework_unit_progress (student_id, textbook_id, unit_number)
select cs.student_id, ct.textbook_id, gs.n
from public.class_textbooks ct
  join public.class_students cs on cs.class_id = ct.class_id
  join public.textbooks tb on tb.id = ct.textbook_id
  cross join lateral generate_series(1, tb.total_units) as gs(n)
where cs.is_active = true
  and tb.is_active = true
  and tb.total_units > 0
on conflict (student_id, textbook_id, unit_number) do nothing;

-- 6-2. student_textbooks × 1~total_units
insert into public.homework_unit_progress (student_id, textbook_id, unit_number)
select st.student_id, st.textbook_id, gs.n
from public.student_textbooks st
  join public.textbooks tb on tb.id = st.textbook_id
  cross join lateral generate_series(1, tb.total_units) as gs(n)
where tb.is_active = true
  and tb.total_units > 0
on conflict (student_id, textbook_id, unit_number) do nothing;
