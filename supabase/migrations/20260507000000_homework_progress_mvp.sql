-- 학생 숙제 진도 추적 MVP
-- 4 신규 테이블: textbooks, class_textbooks, student_textbooks, student_textbook_progress
-- + is_korean_teacher() 헬퍼 함수
-- + 부여 시 progress 자동 생성 트리거 3개
-- 참고: .omc/plans/homework-progress-mvp.md
--
-- 컨벤션:
-- · student_id 컬럼은 profiles.id (= auth.uid()) 를 가리킴 (shared PK 정책)
-- · RLS: private.get_my_role() 사용. korean teacher 는 private.is_korean_teacher() 사용.
-- · updated_at 은 public.tg_set_updated_at() 트리거로 갱신.
-- · 모든 정책은 TO authenticated.

set search_path = public;

-- =================================================================
-- 0. is_korean_teacher 헬퍼 함수
-- =================================================================

create or replace function private.is_korean_teacher() returns boolean
  language sql
  stable
  security definer
  set search_path to 'public'
as $$
  select exists (
    select 1
    from public.teachers t
    where t.id = auth.uid()
      and t.teacher_type = 'korean'::public.teacher_type
  )
$$;

alter function private.is_korean_teacher() owner to postgres;

revoke all on function private.is_korean_teacher() from public;
grant execute on function private.is_korean_teacher() to authenticated;

-- =================================================================
-- 1. textbooks — 교재 카탈로그
-- =================================================================

create table if not exists public.textbooks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  series text,
  publisher text,
  level text,
  category text not null default 'main',
  cover_image_url text,
  total_units integer not null check (total_units > 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.textbooks owner to postgres;

comment on table public.textbooks is '교재 카탈로그. 표지·시리즈·출판사·총 단원 수 정보.';
comment on column public.textbooks.series is '시리즈 이름. MVP 단계에서는 자유 텍스트 + datalist autocomplete 로 일관성 유지.';
comment on column public.textbooks.total_units is '교재 전체 단원 수. 진도 % 계산 기준.';

create index if not exists textbooks_series_idx on public.textbooks (series) where series is not null;
create index if not exists textbooks_active_idx on public.textbooks (is_active);

drop trigger if exists tg_textbooks_set_updated_at on public.textbooks;
create trigger tg_textbooks_set_updated_at
  before update on public.textbooks
  for each row execute function public.tg_set_updated_at();

alter table public.textbooks enable row level security;

drop policy if exists "textbooks_select" on public.textbooks;
create policy "textbooks_select" on public.textbooks
  for select to authenticated
  using (
    is_active = true
    or (select private.get_my_role()) = any (array['admin'::public.user_role, 'teacher'::public.user_role])
  );

drop policy if exists "textbooks_admin_insert" on public.textbooks;
create policy "textbooks_admin_insert" on public.textbooks
  for insert to authenticated
  with check ((select private.get_my_role()) = 'admin'::public.user_role);

drop policy if exists "textbooks_admin_update" on public.textbooks;
create policy "textbooks_admin_update" on public.textbooks
  for update to authenticated
  using ((select private.get_my_role()) = 'admin'::public.user_role)
  with check ((select private.get_my_role()) = 'admin'::public.user_role);

drop policy if exists "textbooks_admin_delete" on public.textbooks;
create policy "textbooks_admin_delete" on public.textbooks
  for delete to authenticated
  using ((select private.get_my_role()) = 'admin'::public.user_role);

grant select, insert, update, delete on public.textbooks to authenticated;

-- =================================================================
-- 2. class_textbooks — 반에 책 부여
-- =================================================================

create table if not exists public.class_textbooks (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  textbook_id uuid not null references public.textbooks(id) on delete cascade,
  homework_days integer[] not null default '{}'::integer[],
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  note text,
  unique (class_id, textbook_id),
  check (homework_days <@ array[0,1,2,3,4,5,6])
);

alter table public.class_textbooks owner to postgres;

comment on table public.class_textbooks is '반에 부여된 교재. 같은 (class_id, textbook_id) 중복 불가. homework_days 는 0=일~6=토.';
comment on column public.class_textbooks.homework_days is '숙제 요일 배열. 0=일요일, 1=월요일, ..., 6=토요일.';

create index if not exists class_textbooks_class_idx on public.class_textbooks (class_id);
create index if not exists class_textbooks_textbook_idx on public.class_textbooks (textbook_id);

alter table public.class_textbooks enable row level security;

drop policy if exists "class_textbooks_select" on public.class_textbooks;
create policy "class_textbooks_select" on public.class_textbooks
  for select to authenticated
  using (
    (select private.get_my_role()) = any (array['admin'::public.user_role, 'teacher'::public.user_role])
    or exists (
      select 1 from public.class_students cs
      where cs.class_id = class_textbooks.class_id
        and cs.student_id = auth.uid()
    )
  );

drop policy if exists "class_textbooks_staff_insert" on public.class_textbooks;
create policy "class_textbooks_staff_insert" on public.class_textbooks
  for insert to authenticated
  with check (
    (select private.get_my_role()) = 'admin'::public.user_role
    or private.is_korean_teacher()
  );

drop policy if exists "class_textbooks_staff_update" on public.class_textbooks;
create policy "class_textbooks_staff_update" on public.class_textbooks
  for update to authenticated
  using (
    (select private.get_my_role()) = 'admin'::public.user_role
    or private.is_korean_teacher()
  )
  with check (
    (select private.get_my_role()) = 'admin'::public.user_role
    or private.is_korean_teacher()
  );

drop policy if exists "class_textbooks_staff_delete" on public.class_textbooks;
create policy "class_textbooks_staff_delete" on public.class_textbooks
  for delete to authenticated
  using (
    (select private.get_my_role()) = 'admin'::public.user_role
    or private.is_korean_teacher()
  );

grant select, insert, update, delete on public.class_textbooks to authenticated;

-- =================================================================
-- 3. student_textbooks — 개인 학생에게 직접 책 부여
-- =================================================================

create table if not exists public.student_textbooks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  textbook_id uuid not null references public.textbooks(id) on delete cascade,
  homework_days integer[] not null default '{}'::integer[],
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  note text,
  unique (student_id, textbook_id),
  check (homework_days <@ array[0,1,2,3,4,5,6])
);

alter table public.student_textbooks owner to postgres;

comment on table public.student_textbooks is '개인 학생에게 직접 부여된 교재. 반 부여(class_textbooks)와 별개. 같은 (student_id, textbook_id) 중복 불가.';

create index if not exists student_textbooks_student_idx on public.student_textbooks (student_id);
create index if not exists student_textbooks_textbook_idx on public.student_textbooks (textbook_id);

alter table public.student_textbooks enable row level security;

drop policy if exists "student_textbooks_select" on public.student_textbooks;
create policy "student_textbooks_select" on public.student_textbooks
  for select to authenticated
  using (
    student_id = auth.uid()
    or (select private.get_my_role()) = any (array['admin'::public.user_role, 'teacher'::public.user_role])
  );

drop policy if exists "student_textbooks_staff_insert" on public.student_textbooks;
create policy "student_textbooks_staff_insert" on public.student_textbooks
  for insert to authenticated
  with check (
    (select private.get_my_role()) = 'admin'::public.user_role
    or private.is_korean_teacher()
  );

drop policy if exists "student_textbooks_staff_update" on public.student_textbooks;
create policy "student_textbooks_staff_update" on public.student_textbooks
  for update to authenticated
  using (
    (select private.get_my_role()) = 'admin'::public.user_role
    or private.is_korean_teacher()
  )
  with check (
    (select private.get_my_role()) = 'admin'::public.user_role
    or private.is_korean_teacher()
  );

drop policy if exists "student_textbooks_staff_delete" on public.student_textbooks;
create policy "student_textbooks_staff_delete" on public.student_textbooks
  for delete to authenticated
  using (
    (select private.get_my_role()) = 'admin'::public.user_role
    or private.is_korean_teacher()
  );

grant select, insert, update, delete on public.student_textbooks to authenticated;

-- =================================================================
-- 4. student_textbook_progress — 학생-책 진도 (반·개인 통합)
-- =================================================================

create table if not exists public.student_textbook_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  textbook_id uuid not null references public.textbooks(id) on delete cascade,
  completed_units integer not null default 0 check (completed_units >= 0),
  status text not null default 'not_started'
    check (status in ('not_started','in_progress','completed')),
  started_at timestamptz,
  completed_at timestamptz,
  note text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, textbook_id)
);

alter table public.student_textbook_progress owner to postgres;

comment on table public.student_textbook_progress is '학생-책 진도. 반 부여와 개인 부여가 같은 책이면 1 row 로 통합. completed_units / total_units 로 진도율 계산.';

create index if not exists stp_student_idx on public.student_textbook_progress (student_id);
create index if not exists stp_textbook_idx on public.student_textbook_progress (textbook_id);
create index if not exists stp_status_idx on public.student_textbook_progress (status);

drop trigger if exists tg_stp_set_updated_at on public.student_textbook_progress;
create trigger tg_stp_set_updated_at
  before update on public.student_textbook_progress
  for each row execute function public.tg_set_updated_at();

alter table public.student_textbook_progress enable row level security;

drop policy if exists "stp_select" on public.student_textbook_progress;
create policy "stp_select" on public.student_textbook_progress
  for select to authenticated
  using (
    student_id = auth.uid()
    or (select private.get_my_role()) = any (array['admin'::public.user_role, 'teacher'::public.user_role])
  );

drop policy if exists "stp_staff_insert" on public.student_textbook_progress;
create policy "stp_staff_insert" on public.student_textbook_progress
  for insert to authenticated
  with check (
    (select private.get_my_role()) = 'admin'::public.user_role
    or private.is_korean_teacher()
  );

drop policy if exists "stp_staff_update" on public.student_textbook_progress;
create policy "stp_staff_update" on public.student_textbook_progress
  for update to authenticated
  using (
    (select private.get_my_role()) = 'admin'::public.user_role
    or private.is_korean_teacher()
  )
  with check (
    (select private.get_my_role()) = 'admin'::public.user_role
    or private.is_korean_teacher()
  );

drop policy if exists "stp_staff_delete" on public.student_textbook_progress;
create policy "stp_staff_delete" on public.student_textbook_progress
  for delete to authenticated
  using (
    (select private.get_my_role()) = 'admin'::public.user_role
    or private.is_korean_teacher()
  );

grant select, insert, update, delete on public.student_textbook_progress to authenticated;

-- =================================================================
-- 5. 트리거: 부여 시 progress 자동 생성 (security definer 로 RLS 우회)
-- =================================================================

-- 5-1. class_textbooks INSERT → 그 반의 모든 학생에 대해 progress upsert
create or replace function public.tg_class_textbook_seed_progress() returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  insert into public.student_textbook_progress (student_id, textbook_id)
  select cs.student_id, NEW.textbook_id
  from public.class_students cs
  where cs.class_id = NEW.class_id
    and cs.is_active = true
  on conflict (student_id, textbook_id) do nothing;
  return NEW;
end;
$$;

alter function public.tg_class_textbook_seed_progress() owner to postgres;

drop trigger if exists tg_class_textbook_seed_progress on public.class_textbooks;
create trigger tg_class_textbook_seed_progress
  after insert on public.class_textbooks
  for each row execute function public.tg_class_textbook_seed_progress();

-- 5-2. student_textbooks INSERT → 해당 학생에 대해 progress upsert
create or replace function public.tg_student_textbook_seed_progress() returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  insert into public.student_textbook_progress (student_id, textbook_id)
  values (NEW.student_id, NEW.textbook_id)
  on conflict (student_id, textbook_id) do nothing;
  return NEW;
end;
$$;

alter function public.tg_student_textbook_seed_progress() owner to postgres;

drop trigger if exists tg_student_textbook_seed_progress on public.student_textbooks;
create trigger tg_student_textbook_seed_progress
  after insert on public.student_textbooks
  for each row execute function public.tg_student_textbook_seed_progress();

-- 5-3. class_students INSERT → 학생이 새 반에 들어오면 그 반의 textbook 들에 대해 progress upsert
create or replace function public.tg_class_student_seed_progress() returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  if NEW.is_active then
    insert into public.student_textbook_progress (student_id, textbook_id)
    select NEW.student_id, ct.textbook_id
    from public.class_textbooks ct
      join public.textbooks tb on tb.id = ct.textbook_id
    where ct.class_id = NEW.class_id
      and tb.is_active = true
    on conflict (student_id, textbook_id) do nothing;
  end if;
  return NEW;
end;
$$;

alter function public.tg_class_student_seed_progress() owner to postgres;

drop trigger if exists tg_class_student_seed_progress on public.class_students;
create trigger tg_class_student_seed_progress
  after insert on public.class_students
  for each row execute function public.tg_class_student_seed_progress();

-- =================================================================
-- 6. Storage bucket: textbook-covers (idempotent)
-- =================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'textbook-covers',
  'textbook-covers',
  true,
  10485760, -- 10MB
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do nothing;

-- public read
drop policy if exists "textbook_covers_public_read" on storage.objects;
create policy "textbook_covers_public_read" on storage.objects
  for select to public
  using (bucket_id = 'textbook-covers');

-- admin/korean-teacher upload
drop policy if exists "textbook_covers_staff_insert" on storage.objects;
create policy "textbook_covers_staff_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'textbook-covers'
    and (
      (select private.get_my_role()) = 'admin'::public.user_role
      or private.is_korean_teacher()
    )
  );

drop policy if exists "textbook_covers_staff_update" on storage.objects;
create policy "textbook_covers_staff_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'textbook-covers'
    and (
      (select private.get_my_role()) = 'admin'::public.user_role
      or private.is_korean_teacher()
    )
  );

drop policy if exists "textbook_covers_staff_delete" on storage.objects;
create policy "textbook_covers_staff_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'textbook-covers'
    and (
      (select private.get_my_role()) = 'admin'::public.user_role
      or private.is_korean_teacher()
    )
  );
