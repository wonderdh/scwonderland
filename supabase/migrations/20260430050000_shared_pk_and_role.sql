-- ============================================================
-- 1. profiles.role 복원 + user_roles 데이터 마이그레이션
-- ============================================================
alter table public.profiles
  add column if not exists role public.user_role;

update public.profiles p
set role = (
  select ur.role
  from public.user_roles ur
  where ur.profile_id = p.id
  order by case ur.role
    when 'admin'   then 1
    when 'teacher' then 2
    else 3
  end
  limit 1
)
where p.role is null;

-- ============================================================
-- 2. students 테이블 shared PK 전환 (id → profiles.id)
-- ============================================================

-- 2a. 기존 RLS 정책 선제 제거 (students.profile_id 참조하는 정책들)
drop policy if exists "attendance_select_own_or_staff"        on public.attendance;
drop policy if exists "attendance_write_staff"                on public.attendance;
drop policy if exists "bus_defaults_select_own_or_staff"      on public.student_bus_defaults;
drop policy if exists "bus_defaults_write_staff"              on public.student_bus_defaults;
drop policy if exists "bus_changes_select_own_or_staff"       on public.bus_change_requests;
drop policy if exists "bus_changes_insert_own_or_staff"       on public.bus_change_requests;
drop policy if exists "bus_changes_update_own_or_staff"       on public.bus_change_requests;
drop policy if exists "bus_changes_delete_own_or_staff"       on public.bus_change_requests;
drop policy if exists "bus_checks_select_own_or_staff"        on public.bus_check_records;
drop policy if exists "bus_checks_write_staff"                on public.bus_check_records;
drop policy if exists "report_cards_select_own_or_staff"      on public.report_cards;
drop policy if exists "report_cards_insert_staff"             on public.report_cards;
drop policy if exists "report_cards_update_own_or_staff"      on public.report_cards;
drop policy if exists "report_cards_delete_staff"             on public.report_cards;

-- 2b. 의존 FK 드롭
alter table public.afterschool_enrollments drop constraint if exists afterschool_enrollments_student_id_fkey;
alter table public.attendance              drop constraint if exists attendance_student_id_fkey;
alter table public.bus_change_requests     drop constraint if exists bus_change_requests_student_id_fkey;
alter table public.bus_check_records       drop constraint if exists bus_check_records_student_id_fkey;
alter table public.class_students          drop constraint if exists class_students_student_id_fkey;
alter table public.report_cards            drop constraint if exists report_cards_student_id_fkey;
alter table public.student_bus_defaults    drop constraint if exists student_bus_defaults_student_id_fkey;

-- 2b. student_id 값 교체: old random UUID → profile_id
update public.afterschool_enrollments ae
  set student_id = s.profile_id from public.students s where s.id = ae.student_id;
update public.attendance a
  set student_id = s.profile_id from public.students s where s.id = a.student_id;
update public.bus_change_requests bcr
  set student_id = s.profile_id from public.students s where s.id = bcr.student_id;
update public.bus_check_records bck
  set student_id = s.profile_id from public.students s where s.id = bck.student_id;
update public.class_students cs
  set student_id = s.profile_id from public.students s where s.id = cs.student_id;
update public.report_cards rc
  set student_id = s.profile_id from public.students s where s.id = rc.student_id;
update public.student_bus_defaults sbd
  set student_id = s.profile_id from public.students s where s.id = sbd.student_id;

-- 2c. students PK 교체
alter table public.students drop constraint if exists students_profile_id_key;
alter table public.students drop constraint if exists students_profile_id_fkey;
alter table public.students drop constraint students_pkey cascade;

update public.students set id = profile_id;
alter table public.students drop column profile_id;

alter table public.students
  add constraint students_pkey primary key (id);
alter table public.students
  add constraint students_profiles_fkey
  foreign key (id) references public.profiles(id) on delete cascade;

-- 2d. FK 재연결
alter table public.afterschool_enrollments
  add constraint afterschool_enrollments_student_id_fkey
  foreign key (student_id) references public.students(id) on delete cascade;
alter table public.attendance
  add constraint attendance_student_id_fkey
  foreign key (student_id) references public.students(id) on delete cascade;
alter table public.bus_change_requests
  add constraint bus_change_requests_student_id_fkey
  foreign key (student_id) references public.students(id) on delete cascade;
alter table public.bus_check_records
  add constraint bus_check_records_student_id_fkey
  foreign key (student_id) references public.students(id) on delete cascade;
alter table public.class_students
  add constraint class_students_student_id_fkey
  foreign key (student_id) references public.students(id) on delete cascade;
alter table public.report_cards
  add constraint report_cards_student_id_fkey
  foreign key (student_id) references public.students(id) on delete cascade;
alter table public.student_bus_defaults
  add constraint student_bus_defaults_student_id_fkey
  foreign key (student_id) references public.students(id) on delete cascade;

-- ============================================================
-- 3. teachers 테이블 shared PK 전환 (id → profiles.id)
-- ============================================================

-- 3a. 의존 FK 드롭
alter table public.class_schedules drop constraint if exists class_schedules_teacher_id_fkey;
alter table public.class_teachers   drop constraint if exists class_teachers_teacher_id_fkey;

-- 3b. teacher_id 값 교체
update public.class_schedules cs
  set teacher_id = t.profile_id from public.teachers t where t.id = cs.teacher_id;
update public.class_teachers ct
  set teacher_id = t.profile_id from public.teachers t where t.id = ct.teacher_id;

-- 3c. teachers PK 교체
alter table public.teachers drop constraint if exists teachers_profile_id_key;
alter table public.teachers drop constraint if exists teachers_profile_id_fkey;
alter table public.teachers drop constraint teachers_pkey cascade;

update public.teachers set id = profile_id;
alter table public.teachers drop column profile_id;

alter table public.teachers
  add constraint teachers_pkey primary key (id);
alter table public.teachers
  add constraint teachers_profiles_fkey
  foreign key (id) references public.profiles(id) on delete cascade;

-- 3d. FK 재연결
alter table public.class_schedules
  add constraint class_schedules_teacher_id_fkey
  foreign key (teacher_id) references public.teachers(id) on delete set null;
alter table public.class_teachers
  add constraint class_teachers_teacher_id_fkey
  foreign key (teacher_id) references public.teachers(id) on delete cascade;

-- ============================================================
-- 4. admins 테이블 생성
-- ============================================================
create table if not exists public.admins (
  id         uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamp with time zone not null default now()
);

grant select, insert, update, delete on public.admins to anon, authenticated, service_role;
alter table public.admins enable row level security;

insert into public.admins (id)
  select id from public.profiles where role = 'admin'
on conflict do nothing;

-- ============================================================
-- 5. get_my_role() 헬퍼 + RLS 정책 갱신
-- ============================================================
create or replace function public.get_my_role()
returns public.user_role
language sql stable security definer
set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

-- admins RLS
create policy "admins_self_read" on public.admins
  for select to authenticated using (id = auth.uid());
create policy "admins_admin_write" on public.admins
  for all to authenticated
  using (get_my_role() = 'admin')
  with check (get_my_role() = 'admin');

-- attendance
drop policy if exists "attendance_select_own_or_staff" on public.attendance;
drop policy if exists "attendance_write_staff"          on public.attendance;

create policy "attendance_select_own_or_staff" on public.attendance
  for select to authenticated
  using (
    get_my_role() in ('admin', 'teacher')
    or student_id = auth.uid()
  );
create policy "attendance_write_staff" on public.attendance
  for all to authenticated
  using   (get_my_role() in ('admin', 'teacher'))
  with check (get_my_role() in ('admin', 'teacher'));

-- bus_numbers
drop policy if exists "bus_master_read_authenticated" on public.bus_numbers;
drop policy if exists "bus_master_write_admin"        on public.bus_numbers;
create policy "bus_master_read_authenticated" on public.bus_numbers
  for select to authenticated using (true);
create policy "bus_master_write_admin" on public.bus_numbers
  for all to authenticated
  using   (get_my_role() = 'admin')
  with check (get_my_role() = 'admin');

-- bus_time_slots
drop policy if exists "bus_slots_read_authenticated" on public.bus_time_slots;
drop policy if exists "bus_slots_write_admin"        on public.bus_time_slots;
create policy "bus_slots_read_authenticated" on public.bus_time_slots
  for select to authenticated using (true);
create policy "bus_slots_write_admin" on public.bus_time_slots
  for all to authenticated
  using   (get_my_role() = 'admin')
  with check (get_my_role() = 'admin');

-- bus_stops
drop policy if exists "bus_stops_read_authenticated" on public.bus_stops;
drop policy if exists "bus_stops_write_admin"        on public.bus_stops;
create policy "bus_stops_read_authenticated" on public.bus_stops
  for select to authenticated using (true);
create policy "bus_stops_write_admin" on public.bus_stops
  for all to authenticated
  using   (get_my_role() = 'admin')
  with check (get_my_role() = 'admin');

-- bus_stop_day_assignments
drop policy if exists "bus_assignments_read_authenticated" on public.bus_stop_day_assignments;
drop policy if exists "bus_assignments_write_admin"        on public.bus_stop_day_assignments;
create policy "bus_assignments_read_authenticated" on public.bus_stop_day_assignments
  for select to authenticated using (true);
create policy "bus_assignments_write_admin" on public.bus_stop_day_assignments
  for all to authenticated
  using   (get_my_role() = 'admin')
  with check (get_my_role() = 'admin');

-- bus_stop_schedules
drop policy if exists "bus_schedules_read_authenticated" on public.bus_stop_schedules;
drop policy if exists "bus_schedules_write_admin"        on public.bus_stop_schedules;
create policy "bus_schedules_read_authenticated" on public.bus_stop_schedules
  for select to authenticated using (true);
create policy "bus_schedules_write_admin" on public.bus_stop_schedules
  for all to authenticated
  using   (get_my_role() = 'admin')
  with check (get_my_role() = 'admin');

-- student_bus_defaults
drop policy if exists "bus_defaults_select_own_or_staff" on public.student_bus_defaults;
drop policy if exists "bus_defaults_write_staff"         on public.student_bus_defaults;
create policy "bus_defaults_select_own_or_staff" on public.student_bus_defaults
  for select to authenticated
  using (
    get_my_role() in ('admin', 'teacher')
    or student_id = auth.uid()
  );
create policy "bus_defaults_write_staff" on public.student_bus_defaults
  for all to authenticated
  using   (get_my_role() in ('admin', 'teacher'))
  with check (get_my_role() in ('admin', 'teacher'));

-- bus_change_requests
drop policy if exists "bus_changes_select_own_or_staff"  on public.bus_change_requests;
drop policy if exists "bus_changes_insert_own_or_staff"  on public.bus_change_requests;
drop policy if exists "bus_changes_update_own_or_staff"  on public.bus_change_requests;
drop policy if exists "bus_changes_delete_own_or_staff"  on public.bus_change_requests;
create policy "bus_changes_select_own_or_staff" on public.bus_change_requests
  for select to authenticated
  using (get_my_role() in ('admin', 'teacher') or student_id = auth.uid());
create policy "bus_changes_insert_own_or_staff" on public.bus_change_requests
  for insert to authenticated
  with check (get_my_role() in ('admin', 'teacher') or student_id = auth.uid());
create policy "bus_changes_update_own_or_staff" on public.bus_change_requests
  for update to authenticated
  using   (get_my_role() in ('admin', 'teacher') or student_id = auth.uid())
  with check (get_my_role() in ('admin', 'teacher') or student_id = auth.uid());
create policy "bus_changes_delete_own_or_staff" on public.bus_change_requests
  for delete to authenticated
  using (get_my_role() in ('admin', 'teacher') or student_id = auth.uid());

-- bus_check_records
drop policy if exists "bus_checks_select_own_or_staff" on public.bus_check_records;
drop policy if exists "bus_checks_write_staff"         on public.bus_check_records;
create policy "bus_checks_select_own_or_staff" on public.bus_check_records
  for select to authenticated
  using (get_my_role() in ('admin', 'teacher') or student_id = auth.uid());
create policy "bus_checks_write_staff" on public.bus_check_records
  for all to authenticated
  using   (get_my_role() in ('admin', 'teacher'))
  with check (get_my_role() in ('admin', 'teacher'));

-- report_cards
drop policy if exists "report_cards_select_own_or_staff" on public.report_cards;
drop policy if exists "report_cards_insert_staff"        on public.report_cards;
drop policy if exists "report_cards_update_own_or_staff" on public.report_cards;
drop policy if exists "report_cards_delete_staff"        on public.report_cards;
create policy "report_cards_select_own_or_staff" on public.report_cards
  for select to authenticated
  using (get_my_role() in ('admin', 'teacher') or student_id = auth.uid());
create policy "report_cards_insert_staff" on public.report_cards
  for insert to authenticated
  with check (get_my_role() in ('admin', 'teacher'));
create policy "report_cards_update_own_or_staff" on public.report_cards
  for update to authenticated
  using   (get_my_role() in ('admin', 'teacher') or student_id = auth.uid())
  with check (get_my_role() in ('admin', 'teacher') or student_id = auth.uid());
create policy "report_cards_delete_staff" on public.report_cards
  for delete to authenticated
  using (get_my_role() in ('admin', 'teacher'));

-- weekly_sentences
drop policy if exists "weekly_sentences_public_read" on public.weekly_sentences;
drop policy if exists "weekly_sentences_admin_write" on public.weekly_sentences;
create policy "weekly_sentences_public_read" on public.weekly_sentences
  for select to anon, authenticated using (true);
create policy "weekly_sentences_admin_write" on public.weekly_sentences
  for all to authenticated
  using   (get_my_role() = 'admin')
  with check (get_my_role() = 'admin');

-- weekly_sentence_config
drop policy if exists "weekly_sentence_config_public_read" on public.weekly_sentence_config;
drop policy if exists "weekly_sentence_config_admin_write" on public.weekly_sentence_config;
create policy "weekly_sentence_config_public_read" on public.weekly_sentence_config
  for select to anon, authenticated using (true);
create policy "weekly_sentence_config_admin_write" on public.weekly_sentence_config
  for all to authenticated
  using   (get_my_role() = 'admin')
  with check (get_my_role() = 'admin');

-- notices
drop policy if exists "notices_public_read_published" on public.notices;
drop policy if exists "notices_admin_write"           on public.notices;
create policy "notices_public_read_published" on public.notices
  for select to anon, authenticated
  using (is_published = true or get_my_role() = 'admin');
create policy "notices_admin_write" on public.notices
  for all to authenticated
  using   (get_my_role() = 'admin')
  with check (get_my_role() = 'admin');

-- ============================================================
-- 6. user_roles 삭제
-- ============================================================
drop table if exists public.user_roles;
