alter table public.attendance enable row level security;
alter table public.bus_numbers enable row level security;
alter table public.bus_time_slots enable row level security;
alter table public.bus_stops enable row level security;
alter table public.bus_stop_day_assignments enable row level security;
alter table public.bus_stop_schedules enable row level security;
alter table public.student_bus_defaults enable row level security;
alter table public.bus_change_requests enable row level security;
alter table public.bus_check_records enable row level security;
alter table public.report_cards enable row level security;
alter table public.weekly_sentences enable row level security;
alter table public.weekly_sentence_config enable row level security;
alter table public.notices enable row level security;

create policy "attendance_select_own_or_staff" on public.attendance
for select to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.profile_id = auth.uid()
      and ur.role in ('admin', 'teacher')
  )
  or exists (
    select 1
    from public.students s
    where s.id = attendance.student_id
      and s.profile_id = auth.uid()
  )
);

create policy "attendance_write_staff" on public.attendance
for all to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.profile_id = auth.uid()
      and ur.role in ('admin', 'teacher')
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.profile_id = auth.uid()
      and ur.role in ('admin', 'teacher')
  )
);

create policy "bus_master_read_authenticated" on public.bus_numbers
for select to authenticated using (true);
create policy "bus_master_write_admin" on public.bus_numbers
for all to authenticated
using (exists (select 1 from public.user_roles ur where ur.profile_id = auth.uid() and ur.role = 'admin'))
with check (exists (select 1 from public.user_roles ur where ur.profile_id = auth.uid() and ur.role = 'admin'));

create policy "bus_slots_read_authenticated" on public.bus_time_slots
for select to authenticated using (true);
create policy "bus_slots_write_admin" on public.bus_time_slots
for all to authenticated
using (exists (select 1 from public.user_roles ur where ur.profile_id = auth.uid() and ur.role = 'admin'))
with check (exists (select 1 from public.user_roles ur where ur.profile_id = auth.uid() and ur.role = 'admin'));

create policy "bus_stops_read_authenticated" on public.bus_stops
for select to authenticated using (true);
create policy "bus_stops_write_admin" on public.bus_stops
for all to authenticated
using (exists (select 1 from public.user_roles ur where ur.profile_id = auth.uid() and ur.role = 'admin'))
with check (exists (select 1 from public.user_roles ur where ur.profile_id = auth.uid() and ur.role = 'admin'));

create policy "bus_assignments_read_authenticated" on public.bus_stop_day_assignments
for select to authenticated using (true);
create policy "bus_assignments_write_admin" on public.bus_stop_day_assignments
for all to authenticated
using (exists (select 1 from public.user_roles ur where ur.profile_id = auth.uid() and ur.role = 'admin'))
with check (exists (select 1 from public.user_roles ur where ur.profile_id = auth.uid() and ur.role = 'admin'));

create policy "bus_schedules_read_authenticated" on public.bus_stop_schedules
for select to authenticated using (true);
create policy "bus_schedules_write_admin" on public.bus_stop_schedules
for all to authenticated
using (exists (select 1 from public.user_roles ur where ur.profile_id = auth.uid() and ur.role = 'admin'))
with check (exists (select 1 from public.user_roles ur where ur.profile_id = auth.uid() and ur.role = 'admin'));

create policy "bus_defaults_select_own_or_staff" on public.student_bus_defaults
for select to authenticated
using (
  exists (select 1 from public.user_roles ur where ur.profile_id = auth.uid() and ur.role in ('admin', 'teacher'))
  or exists (select 1 from public.students s where s.id = student_bus_defaults.student_id and s.profile_id = auth.uid())
);
create policy "bus_defaults_write_staff" on public.student_bus_defaults
for all to authenticated
using (exists (select 1 from public.user_roles ur where ur.profile_id = auth.uid() and ur.role in ('admin', 'teacher')))
with check (exists (select 1 from public.user_roles ur where ur.profile_id = auth.uid() and ur.role in ('admin', 'teacher')));

create policy "bus_changes_select_own_or_staff" on public.bus_change_requests
for select to authenticated
using (
  exists (select 1 from public.user_roles ur where ur.profile_id = auth.uid() and ur.role in ('admin', 'teacher'))
  or exists (select 1 from public.students s where s.id = bus_change_requests.student_id and s.profile_id = auth.uid())
);
create policy "bus_changes_insert_own_or_staff" on public.bus_change_requests
for insert to authenticated
with check (
  exists (select 1 from public.user_roles ur where ur.profile_id = auth.uid() and ur.role in ('admin', 'teacher'))
  or exists (select 1 from public.students s where s.id = bus_change_requests.student_id and s.profile_id = auth.uid())
);
create policy "bus_changes_update_own_or_staff" on public.bus_change_requests
for update to authenticated
using (
  exists (select 1 from public.user_roles ur where ur.profile_id = auth.uid() and ur.role in ('admin', 'teacher'))
  or exists (select 1 from public.students s where s.id = bus_change_requests.student_id and s.profile_id = auth.uid())
)
with check (
  exists (select 1 from public.user_roles ur where ur.profile_id = auth.uid() and ur.role in ('admin', 'teacher'))
  or exists (select 1 from public.students s where s.id = bus_change_requests.student_id and s.profile_id = auth.uid())
);
create policy "bus_changes_delete_own_or_staff" on public.bus_change_requests
for delete to authenticated
using (
  exists (select 1 from public.user_roles ur where ur.profile_id = auth.uid() and ur.role in ('admin', 'teacher'))
  or exists (select 1 from public.students s where s.id = bus_change_requests.student_id and s.profile_id = auth.uid())
);

create policy "bus_checks_select_own_or_staff" on public.bus_check_records
for select to authenticated
using (
  exists (select 1 from public.user_roles ur where ur.profile_id = auth.uid() and ur.role in ('admin', 'teacher'))
  or exists (select 1 from public.students s where s.id = bus_check_records.student_id and s.profile_id = auth.uid())
);
create policy "bus_checks_write_staff" on public.bus_check_records
for all to authenticated
using (exists (select 1 from public.user_roles ur where ur.profile_id = auth.uid() and ur.role in ('admin', 'teacher')))
with check (exists (select 1 from public.user_roles ur where ur.profile_id = auth.uid() and ur.role in ('admin', 'teacher')));

create policy "report_cards_select_own_or_staff" on public.report_cards
for select to authenticated
using (
  exists (select 1 from public.user_roles ur where ur.profile_id = auth.uid() and ur.role in ('admin', 'teacher'))
  or exists (select 1 from public.students s where s.id = report_cards.student_id and s.profile_id = auth.uid())
);
create policy "report_cards_insert_staff" on public.report_cards
for insert to authenticated
with check (
  exists (select 1 from public.user_roles ur where ur.profile_id = auth.uid() and ur.role in ('admin', 'teacher'))
);
create policy "report_cards_update_own_or_staff" on public.report_cards
for update to authenticated
using (
  exists (select 1 from public.user_roles ur where ur.profile_id = auth.uid() and ur.role in ('admin', 'teacher'))
  or exists (select 1 from public.students s where s.id = report_cards.student_id and s.profile_id = auth.uid())
)
with check (
  exists (select 1 from public.user_roles ur where ur.profile_id = auth.uid() and ur.role in ('admin', 'teacher'))
  or exists (select 1 from public.students s where s.id = report_cards.student_id and s.profile_id = auth.uid())
);
create policy "report_cards_delete_staff" on public.report_cards
for delete to authenticated
using (
  exists (select 1 from public.user_roles ur where ur.profile_id = auth.uid() and ur.role in ('admin', 'teacher'))
);

create policy "weekly_sentences_public_read" on public.weekly_sentences
for select to anon, authenticated using (true);
create policy "weekly_sentences_admin_write" on public.weekly_sentences
for all to authenticated
using (exists (select 1 from public.user_roles ur where ur.profile_id = auth.uid() and ur.role = 'admin'))
with check (exists (select 1 from public.user_roles ur where ur.profile_id = auth.uid() and ur.role = 'admin'));

create policy "weekly_sentence_config_public_read" on public.weekly_sentence_config
for select to anon, authenticated using (true);
create policy "weekly_sentence_config_admin_write" on public.weekly_sentence_config
for all to authenticated
using (exists (select 1 from public.user_roles ur where ur.profile_id = auth.uid() and ur.role = 'admin'))
with check (exists (select 1 from public.user_roles ur where ur.profile_id = auth.uid() and ur.role = 'admin'));

create policy "notices_public_read_published" on public.notices
for select to anon, authenticated using (is_published = true or exists (select 1 from public.user_roles ur where ur.profile_id = auth.uid() and ur.role = 'admin'));
create policy "notices_admin_write" on public.notices
for all to authenticated
using (exists (select 1 from public.user_roles ur where ur.profile_id = auth.uid() and ur.role = 'admin'))
with check (exists (select 1 from public.user_roles ur where ur.profile_id = auth.uid() and ur.role = 'admin'));
