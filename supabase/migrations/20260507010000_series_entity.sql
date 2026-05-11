-- 시리즈 1급 entity 화
-- · series 테이블 신규
-- · textbooks.series_id uuid FK 추가 (ON DELETE SET NULL)
-- · 기존 textbooks.series (text) distinct 값 → series row 자동 backfill
-- · textbooks.series text 컬럼은 보존 (deprecated, 1 릴리스 후 DROP 예정)
-- 참고: .omc/plans/homework-management-v3.md 의 결정 1번

set search_path = public;

-- =================================================================
-- 1. series 테이블
-- =================================================================

create table if not exists public.series (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.series owner to postgres;

comment on table public.series is '교재 시리즈 (1급 entity). textbooks.series_id 가 참조. name 은 활성 row 사이에서만 unique.';

-- 활성 시리즈 사이에서만 name unique (soft delete 후 동일 이름 재사용 가능)
create unique index if not exists series_name_active_uidx on public.series (lower(name)) where is_active = true;
create index if not exists series_active_idx on public.series (is_active);

drop trigger if exists tg_series_set_updated_at on public.series;
create trigger tg_series_set_updated_at
  before update on public.series
  for each row execute function public.tg_set_updated_at();

alter table public.series enable row level security;

drop policy if exists "series_select" on public.series;
create policy "series_select" on public.series
  for select to authenticated
  using (
    is_active = true
    or (select private.get_my_role()) = any (array['admin'::public.user_role, 'teacher'::public.user_role])
  );

drop policy if exists "series_admin_insert" on public.series;
create policy "series_admin_insert" on public.series
  for insert to authenticated
  with check ((select private.get_my_role()) = 'admin'::public.user_role);

drop policy if exists "series_admin_update" on public.series;
create policy "series_admin_update" on public.series
  for update to authenticated
  using ((select private.get_my_role()) = 'admin'::public.user_role)
  with check ((select private.get_my_role()) = 'admin'::public.user_role);

drop policy if exists "series_admin_delete" on public.series;
create policy "series_admin_delete" on public.series
  for delete to authenticated
  using ((select private.get_my_role()) = 'admin'::public.user_role);

grant select, insert, update, delete on public.series to authenticated;

-- =================================================================
-- 2. textbooks.series_id FK
-- =================================================================

alter table public.textbooks
  add column if not exists series_id uuid references public.series(id) on delete set null;

create index if not exists textbooks_series_id_idx on public.textbooks (series_id);

-- =================================================================
-- 3. Backfill: textbooks.series (text) distinct 값 → series row + textbooks.series_id 매칭
-- =================================================================

insert into public.series (name)
select distinct trim(t.series)
from public.textbooks t
where t.series is not null
  and trim(t.series) <> ''
  and not exists (
    select 1 from public.series s
    where lower(s.name) = lower(trim(t.series))
      and s.is_active = true
  )
on conflict do nothing;

update public.textbooks t
set series_id = s.id
from public.series s
where t.series is not null
  and trim(t.series) <> ''
  and lower(s.name) = lower(trim(t.series))
  and s.is_active = true
  and t.series_id is null;
