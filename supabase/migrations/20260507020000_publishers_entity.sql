-- 출판사 1급 entity 화 + series.sort_order 제거
-- · publishers 테이블 신규 (id, name, homepage_url, is_active, ...)
-- · series.publisher_id uuid FK 추가 (ON DELETE SET NULL)
-- · series.sort_order 컬럼 DROP (사용자 요청)
-- · 기존 textbooks.publisher (text) distinct 값 → publishers row 자동 backfill
-- · textbooks.publisher text 컬럼은 보존 (deprecated, 1 릴리스 후 DROP 예정)

set search_path = public;

-- =================================================================
-- 1. publishers 테이블
-- =================================================================

create table if not exists public.publishers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  homepage_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.publishers owner to postgres;

comment on table public.publishers is '출판사 (1급 entity). series.publisher_id 가 참조. 활성 row 사이에서 lower(name) UNIQUE.';

-- 활성 출판사 사이에서만 name unique (soft delete 후 동일 이름 재사용 가능)
create unique index if not exists publishers_name_active_uidx on public.publishers (lower(name)) where is_active = true;
create index if not exists publishers_active_idx on public.publishers (is_active);

drop trigger if exists tg_publishers_set_updated_at on public.publishers;
create trigger tg_publishers_set_updated_at
  before update on public.publishers
  for each row execute function public.tg_set_updated_at();

alter table public.publishers enable row level security;

drop policy if exists "publishers_select" on public.publishers;
create policy "publishers_select" on public.publishers
  for select to authenticated
  using (
    is_active = true
    or (select private.get_my_role()) = any (array['admin'::public.user_role, 'teacher'::public.user_role])
  );

drop policy if exists "publishers_admin_insert" on public.publishers;
create policy "publishers_admin_insert" on public.publishers
  for insert to authenticated
  with check ((select private.get_my_role()) = 'admin'::public.user_role);

drop policy if exists "publishers_admin_update" on public.publishers;
create policy "publishers_admin_update" on public.publishers
  for update to authenticated
  using ((select private.get_my_role()) = 'admin'::public.user_role)
  with check ((select private.get_my_role()) = 'admin'::public.user_role);

drop policy if exists "publishers_admin_delete" on public.publishers;
create policy "publishers_admin_delete" on public.publishers
  for delete to authenticated
  using ((select private.get_my_role()) = 'admin'::public.user_role);

grant select, insert, update, delete on public.publishers to authenticated;

-- =================================================================
-- 2. series.publisher_id FK + sort_order DROP
-- =================================================================

alter table public.series
  add column if not exists publisher_id uuid references public.publishers(id) on delete set null;

create index if not exists series_publisher_id_idx on public.series (publisher_id);

-- 사용자 요청: 시리즈에 정렬 순서 필요 없음
alter table public.series drop column if exists sort_order;

-- =================================================================
-- 3. Backfill: textbooks.publisher (text) distinct → publishers row
-- =================================================================

insert into public.publishers (name)
select distinct trim(t.publisher)
from public.textbooks t
where t.publisher is not null
  and trim(t.publisher) <> ''
  and not exists (
    select 1 from public.publishers p
    where lower(p.name) = lower(trim(t.publisher))
      and p.is_active = true
  )
on conflict do nothing;
