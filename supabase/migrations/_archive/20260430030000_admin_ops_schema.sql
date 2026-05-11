alter table public.students
  add column if not exists age integer,
  add column if not exists group_type text,
  add column if not exists updated_at timestamp with time zone not null default now();

alter table public.teachers
  add column if not exists name text,
  add column if not exists updated_at timestamp with time zone not null default now();

alter table public.classes
  add column if not exists group_label text;

alter table public.academy_periods
  add column if not exists has_dropoff boolean not null default false,
  add column if not exists group_label text,
  add column if not exists updated_at timestamp with time zone not null default now();

update public.students
set group_type = case
  when group_type is not null then group_type
  else null
end
where true;

update public.teachers t
set name = trim(concat_ws(' ', p.first_name, p.last_name))
from public.profiles p
where p.id = t.profile_id
  and (t.name is null or t.name = '');

update public.classes
set group_label = case group_type
  when 'kindergarten' then '유치부'
  when 'afternoon' then '오후반'
  when 'afterschool' then '방과후'
  else null
end
where group_label is null;

update public.academy_periods
set group_label = case group_type
  when 'kindergarten' then '유치부'
  when 'afternoon' then '오후반'
  when 'afterschool' then '방과후'
  else null
end
where group_label is null;

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  attendance_date date not null,
  status text not null,
  note text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (student_id, attendance_date)
);

create table if not exists public.bus_numbers (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.bus_time_slots (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  time text not null,
  is_active boolean not null default true,
  show_empty_stops boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.bus_stops (
  id uuid primary key default gen_random_uuid(),
  bus_number_id uuid references public.bus_numbers(id) on delete set null,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.bus_stop_day_assignments (
  id uuid primary key default gen_random_uuid(),
  bus_stop_id uuid not null references public.bus_stops(id) on delete cascade,
  bus_number_id uuid not null references public.bus_numbers(id) on delete cascade,
  day_of_week integer not null,
  bus_time_slot_id uuid references public.bus_time_slots(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create unique index if not exists bus_stop_day_assignments_unique_idx
  on public.bus_stop_day_assignments (bus_stop_id, day_of_week, coalesce(bus_time_slot_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table if not exists public.bus_stop_schedules (
  id uuid primary key default gen_random_uuid(),
  bus_stop_id uuid not null references public.bus_stops(id) on delete cascade,
  day_of_week integer not null,
  bus_time_slot_id uuid references public.bus_time_slots(id) on delete cascade,
  estimated_time text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create unique index if not exists bus_stop_schedules_unique_idx
  on public.bus_stop_schedules (bus_stop_id, day_of_week, coalesce(bus_time_slot_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table if not exists public.student_bus_defaults (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  day_of_week integer not null,
  bus_time_slot_id uuid not null references public.bus_time_slots(id) on delete cascade,
  bus_stop_id uuid references public.bus_stops(id) on delete set null,
  estimated_time text,
  note text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (student_id, day_of_week)
);

create table if not exists public.bus_change_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  request_date date not null,
  change_type text not null,
  new_bus_time_slot_id uuid references public.bus_time_slots(id) on delete set null,
  new_bus_number_id uuid references public.bus_numbers(id) on delete set null,
  new_bus_stop_id uuid references public.bus_stops(id) on delete set null,
  reason text,
  status text not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamp with time zone,
  review_note text,
  requested_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (student_id, request_date)
);

create table if not exists public.bus_check_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  check_date date not null,
  bus_time_slot_id uuid references public.bus_time_slots(id) on delete set null,
  bus_number_id uuid references public.bus_numbers(id) on delete set null,
  boarded_at timestamp with time zone,
  checked_at timestamp with time zone,
  checked_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  unique (student_id, check_date)
);

create table if not exists public.report_cards (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  year integer not null,
  month integer not null,
  author_id uuid references public.profiles(id) on delete set null,
  content text,
  content_ko text,
  reply text,
  reply_en text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (student_id, year, month)
);

create table if not exists public.weekly_sentences (
  id uuid primary key default gen_random_uuid(),
  week_number integer not null,
  level integer not null,
  english text not null,
  korean text not null default '',
  example text,
  answer text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (week_number, level)
);

create table if not exists public.weekly_sentence_config (
  id integer primary key,
  mode text not null default 'auto',
  manual_week integer,
  auto_base_week integer not null default 1,
  auto_base_sunday date not null default current_date,
  updated_at timestamp with time zone not null default now()
);

insert into public.weekly_sentence_config (id, mode, manual_week, auto_base_week, auto_base_sunday)
values (1, 'auto', null, 1, current_date)
on conflict (id) do nothing;

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  content text,
  excerpt text,
  author_id uuid references public.profiles(id) on delete set null,
  is_published boolean not null default false,
  is_pinned boolean not null default false,
  published_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
