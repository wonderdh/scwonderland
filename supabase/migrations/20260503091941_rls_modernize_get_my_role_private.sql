-- ============================================================
-- RLS modernization
--
-- 목적:
--   1) public.get_my_role() → private.get_my_role() 로 이동
--      (advisor 0028/0029: SECURITY DEFINER function in exposed schema 노출 차단)
--   2) 모든 RLS 정책의 auth.uid() / get_my_role() 호출을 (select ...) 로 wrap
--      (advisor 0003 auth_rls_initplan: 행마다 재호출 방지)
--   3) FOR ALL 형태의 *_write 정책을 INSERT/UPDATE/DELETE 로 분할
--      (advisor 0006 multiple_permissive_policies: SELECT 시점 중복 평가 제거)
--
-- 안전성:
--   - get_my_role 이동은 함수 본문 동일 (search_path 만 private 으로 갱신)
--   - 정책 drop+create 패턴 (단일 트랜잭션 내 atomic)
--   - service_role 은 RLS bypass → 영향 없음
-- ============================================================

-- ── 1. private 스키마 + get_my_role 이동 ────────────────────
create schema if not exists private;
grant usage on schema private to service_role;
grant usage on schema private to authenticated;

create or replace function private.get_my_role()
returns public.user_role
language sql stable security definer
set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

revoke execute on function private.get_my_role() from public;
revoke execute on function private.get_my_role() from anon;
grant execute on function private.get_my_role() to authenticated, service_role;

-- ── 2. 정책 일괄 drop + 재정의 (4-policy 분할 패턴) ──────────

-- profiles
drop policy if exists "profiles_self_or_staff_select" on public.profiles;
drop policy if exists "profiles_admin_write"         on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.get_my_role()) in ('admin','teacher'));
create policy "profiles_admin_insert" on public.profiles
  for insert to authenticated
  with check ((select private.get_my_role()) = 'admin');
create policy "profiles_admin_update" on public.profiles
  for update to authenticated
  using ((select private.get_my_role()) = 'admin')
  with check ((select private.get_my_role()) = 'admin');
create policy "profiles_admin_delete" on public.profiles
  for delete to authenticated
  using ((select private.get_my_role()) = 'admin');

-- students
drop policy if exists "students_self_or_staff_select" on public.students;
drop policy if exists "students_admin_write"          on public.students;
create policy "students_select" on public.students
  for select to authenticated
  using (id = (select auth.uid()) or (select private.get_my_role()) in ('admin','teacher'));
create policy "students_admin_insert" on public.students
  for insert to authenticated
  with check ((select private.get_my_role()) = 'admin');
create policy "students_admin_update" on public.students
  for update to authenticated
  using ((select private.get_my_role()) = 'admin')
  with check ((select private.get_my_role()) = 'admin');
create policy "students_admin_delete" on public.students
  for delete to authenticated
  using ((select private.get_my_role()) = 'admin');

-- teachers
drop policy if exists "teachers_self_or_staff_select" on public.teachers;
drop policy if exists "teachers_admin_write"          on public.teachers;
create policy "teachers_select" on public.teachers
  for select to authenticated
  using (id = (select auth.uid()) or (select private.get_my_role()) in ('admin','teacher'));
create policy "teachers_admin_insert" on public.teachers
  for insert to authenticated
  with check ((select private.get_my_role()) = 'admin');
create policy "teachers_admin_update" on public.teachers
  for update to authenticated
  using ((select private.get_my_role()) = 'admin')
  with check ((select private.get_my_role()) = 'admin');
create policy "teachers_admin_delete" on public.teachers
  for delete to authenticated
  using ((select private.get_my_role()) = 'admin');

-- admins
drop policy if exists "admins_self_read"   on public.admins;
drop policy if exists "admins_admin_write" on public.admins;
create policy "admins_select" on public.admins
  for select to authenticated
  using (id = (select auth.uid()) or (select private.get_my_role()) = 'admin');
create policy "admins_admin_insert" on public.admins
  for insert to authenticated
  with check ((select private.get_my_role()) = 'admin');
create policy "admins_admin_update" on public.admins
  for update to authenticated
  using ((select private.get_my_role()) = 'admin')
  with check ((select private.get_my_role()) = 'admin');
create policy "admins_admin_delete" on public.admins
  for delete to authenticated
  using ((select private.get_my_role()) = 'admin');

-- classes
drop policy if exists "classes_authenticated_select" on public.classes;
drop policy if exists "classes_admin_write"           on public.classes;
create policy "classes_select" on public.classes
  for select to authenticated using (true);
create policy "classes_admin_insert" on public.classes
  for insert to authenticated
  with check ((select private.get_my_role()) = 'admin');
create policy "classes_admin_update" on public.classes
  for update to authenticated
  using ((select private.get_my_role()) = 'admin')
  with check ((select private.get_my_role()) = 'admin');
create policy "classes_admin_delete" on public.classes
  for delete to authenticated
  using ((select private.get_my_role()) = 'admin');

-- class_students
drop policy if exists "class_students_authenticated_select" on public.class_students;
drop policy if exists "class_students_admin_write"          on public.class_students;
create policy "class_students_select" on public.class_students
  for select to authenticated using (true);
create policy "class_students_admin_insert" on public.class_students
  for insert to authenticated
  with check ((select private.get_my_role()) = 'admin');
create policy "class_students_admin_update" on public.class_students
  for update to authenticated
  using ((select private.get_my_role()) = 'admin')
  with check ((select private.get_my_role()) = 'admin');
create policy "class_students_admin_delete" on public.class_students
  for delete to authenticated
  using ((select private.get_my_role()) = 'admin');

-- class_teachers
drop policy if exists "class_teachers_authenticated_select" on public.class_teachers;
drop policy if exists "class_teachers_admin_write"          on public.class_teachers;
create policy "class_teachers_select" on public.class_teachers
  for select to authenticated using (true);
create policy "class_teachers_admin_insert" on public.class_teachers
  for insert to authenticated
  with check ((select private.get_my_role()) = 'admin');
create policy "class_teachers_admin_update" on public.class_teachers
  for update to authenticated
  using ((select private.get_my_role()) = 'admin')
  with check ((select private.get_my_role()) = 'admin');
create policy "class_teachers_admin_delete" on public.class_teachers
  for delete to authenticated
  using ((select private.get_my_role()) = 'admin');

-- academy_periods
drop policy if exists "academy_periods_authenticated_select" on public.academy_periods;
drop policy if exists "academy_periods_admin_write"           on public.academy_periods;
create policy "academy_periods_select" on public.academy_periods
  for select to authenticated using (true);
create policy "academy_periods_admin_insert" on public.academy_periods
  for insert to authenticated
  with check ((select private.get_my_role()) = 'admin');
create policy "academy_periods_admin_update" on public.academy_periods
  for update to authenticated
  using ((select private.get_my_role()) = 'admin')
  with check ((select private.get_my_role()) = 'admin');
create policy "academy_periods_admin_delete" on public.academy_periods
  for delete to authenticated
  using ((select private.get_my_role()) = 'admin');

-- afterschool_enrollments
drop policy if exists "afterschool_enrollments_self_or_staff_select" on public.afterschool_enrollments;
drop policy if exists "afterschool_enrollments_staff_write"           on public.afterschool_enrollments;
create policy "afterschool_enrollments_select" on public.afterschool_enrollments
  for select to authenticated
  using (student_id = (select auth.uid()) or (select private.get_my_role()) in ('admin','teacher'));
create policy "afterschool_enrollments_staff_insert" on public.afterschool_enrollments
  for insert to authenticated
  with check ((select private.get_my_role()) in ('admin','teacher'));
create policy "afterschool_enrollments_staff_update" on public.afterschool_enrollments
  for update to authenticated
  using ((select private.get_my_role()) in ('admin','teacher'))
  with check ((select private.get_my_role()) in ('admin','teacher'));
create policy "afterschool_enrollments_staff_delete" on public.afterschool_enrollments
  for delete to authenticated
  using ((select private.get_my_role()) in ('admin','teacher'));

-- class_schedules
drop policy if exists "class_schedules_authenticated_select" on public.class_schedules;
drop policy if exists "class_schedules_staff_write"           on public.class_schedules;
create policy "class_schedules_select" on public.class_schedules
  for select to authenticated using (true);
create policy "class_schedules_staff_insert" on public.class_schedules
  for insert to authenticated
  with check ((select private.get_my_role()) in ('admin','teacher'));
create policy "class_schedules_staff_update" on public.class_schedules
  for update to authenticated
  using ((select private.get_my_role()) in ('admin','teacher'))
  with check ((select private.get_my_role()) in ('admin','teacher'));
create policy "class_schedules_staff_delete" on public.class_schedules
  for delete to authenticated
  using ((select private.get_my_role()) in ('admin','teacher'));

-- attendance
drop policy if exists "attendance_select_own_or_staff" on public.attendance;
drop policy if exists "attendance_write_staff"          on public.attendance;
create policy "attendance_select" on public.attendance
  for select to authenticated
  using (student_id = (select auth.uid()) or (select private.get_my_role()) in ('admin','teacher'));
create policy "attendance_staff_insert" on public.attendance
  for insert to authenticated
  with check ((select private.get_my_role()) in ('admin','teacher'));
create policy "attendance_staff_update" on public.attendance
  for update to authenticated
  using ((select private.get_my_role()) in ('admin','teacher'))
  with check ((select private.get_my_role()) in ('admin','teacher'));
create policy "attendance_staff_delete" on public.attendance
  for delete to authenticated
  using ((select private.get_my_role()) in ('admin','teacher'));

-- bus_numbers
drop policy if exists "bus_master_read_authenticated" on public.bus_numbers;
drop policy if exists "bus_master_write_admin"         on public.bus_numbers;
create policy "bus_numbers_select" on public.bus_numbers
  for select to authenticated using (true);
create policy "bus_numbers_admin_insert" on public.bus_numbers
  for insert to authenticated
  with check ((select private.get_my_role()) = 'admin');
create policy "bus_numbers_admin_update" on public.bus_numbers
  for update to authenticated
  using ((select private.get_my_role()) = 'admin')
  with check ((select private.get_my_role()) = 'admin');
create policy "bus_numbers_admin_delete" on public.bus_numbers
  for delete to authenticated
  using ((select private.get_my_role()) = 'admin');

-- bus_time_slots
drop policy if exists "bus_slots_read_authenticated" on public.bus_time_slots;
drop policy if exists "bus_slots_write_admin"         on public.bus_time_slots;
create policy "bus_time_slots_select" on public.bus_time_slots
  for select to authenticated using (true);
create policy "bus_time_slots_admin_insert" on public.bus_time_slots
  for insert to authenticated
  with check ((select private.get_my_role()) = 'admin');
create policy "bus_time_slots_admin_update" on public.bus_time_slots
  for update to authenticated
  using ((select private.get_my_role()) = 'admin')
  with check ((select private.get_my_role()) = 'admin');
create policy "bus_time_slots_admin_delete" on public.bus_time_slots
  for delete to authenticated
  using ((select private.get_my_role()) = 'admin');

-- bus_stops
drop policy if exists "bus_stops_read_authenticated" on public.bus_stops;
drop policy if exists "bus_stops_write_admin"         on public.bus_stops;
create policy "bus_stops_select" on public.bus_stops
  for select to authenticated using (true);
create policy "bus_stops_admin_insert" on public.bus_stops
  for insert to authenticated
  with check ((select private.get_my_role()) = 'admin');
create policy "bus_stops_admin_update" on public.bus_stops
  for update to authenticated
  using ((select private.get_my_role()) = 'admin')
  with check ((select private.get_my_role()) = 'admin');
create policy "bus_stops_admin_delete" on public.bus_stops
  for delete to authenticated
  using ((select private.get_my_role()) = 'admin');

-- bus_stop_day_assignments
drop policy if exists "bus_assignments_read_authenticated" on public.bus_stop_day_assignments;
drop policy if exists "bus_assignments_write_admin"         on public.bus_stop_day_assignments;
create policy "bus_stop_day_assignments_select" on public.bus_stop_day_assignments
  for select to authenticated using (true);
create policy "bus_stop_day_assignments_admin_insert" on public.bus_stop_day_assignments
  for insert to authenticated
  with check ((select private.get_my_role()) = 'admin');
create policy "bus_stop_day_assignments_admin_update" on public.bus_stop_day_assignments
  for update to authenticated
  using ((select private.get_my_role()) = 'admin')
  with check ((select private.get_my_role()) = 'admin');
create policy "bus_stop_day_assignments_admin_delete" on public.bus_stop_day_assignments
  for delete to authenticated
  using ((select private.get_my_role()) = 'admin');

-- bus_stop_schedules
drop policy if exists "bus_schedules_read_authenticated" on public.bus_stop_schedules;
drop policy if exists "bus_schedules_write_admin"         on public.bus_stop_schedules;
create policy "bus_stop_schedules_select" on public.bus_stop_schedules
  for select to authenticated using (true);
create policy "bus_stop_schedules_admin_insert" on public.bus_stop_schedules
  for insert to authenticated
  with check ((select private.get_my_role()) = 'admin');
create policy "bus_stop_schedules_admin_update" on public.bus_stop_schedules
  for update to authenticated
  using ((select private.get_my_role()) = 'admin')
  with check ((select private.get_my_role()) = 'admin');
create policy "bus_stop_schedules_admin_delete" on public.bus_stop_schedules
  for delete to authenticated
  using ((select private.get_my_role()) = 'admin');

-- student_bus_defaults
drop policy if exists "bus_defaults_select_own_or_staff" on public.student_bus_defaults;
drop policy if exists "bus_defaults_write_staff"          on public.student_bus_defaults;
create policy "student_bus_defaults_select" on public.student_bus_defaults
  for select to authenticated
  using (student_id = (select auth.uid()) or (select private.get_my_role()) in ('admin','teacher'));
create policy "student_bus_defaults_staff_insert" on public.student_bus_defaults
  for insert to authenticated
  with check ((select private.get_my_role()) in ('admin','teacher'));
create policy "student_bus_defaults_staff_update" on public.student_bus_defaults
  for update to authenticated
  using ((select private.get_my_role()) in ('admin','teacher'))
  with check ((select private.get_my_role()) in ('admin','teacher'));
create policy "student_bus_defaults_staff_delete" on public.student_bus_defaults
  for delete to authenticated
  using ((select private.get_my_role()) in ('admin','teacher'));

-- bus_change_requests
drop policy if exists "bus_changes_select_own_or_staff" on public.bus_change_requests;
drop policy if exists "bus_changes_insert_own_or_staff" on public.bus_change_requests;
drop policy if exists "bus_changes_update_own_or_staff" on public.bus_change_requests;
drop policy if exists "bus_changes_delete_own_or_staff" on public.bus_change_requests;
create policy "bus_change_requests_select" on public.bus_change_requests
  for select to authenticated
  using (student_id = (select auth.uid()) or (select private.get_my_role()) in ('admin','teacher'));
create policy "bus_change_requests_insert" on public.bus_change_requests
  for insert to authenticated
  with check (student_id = (select auth.uid()) or (select private.get_my_role()) in ('admin','teacher'));
create policy "bus_change_requests_update" on public.bus_change_requests
  for update to authenticated
  using (student_id = (select auth.uid()) or (select private.get_my_role()) in ('admin','teacher'))
  with check (student_id = (select auth.uid()) or (select private.get_my_role()) in ('admin','teacher'));
create policy "bus_change_requests_delete" on public.bus_change_requests
  for delete to authenticated
  using (student_id = (select auth.uid()) or (select private.get_my_role()) in ('admin','teacher'));

-- bus_check_records
drop policy if exists "bus_checks_select_own_or_staff" on public.bus_check_records;
drop policy if exists "bus_checks_write_staff"          on public.bus_check_records;
create policy "bus_check_records_select" on public.bus_check_records
  for select to authenticated
  using (student_id = (select auth.uid()) or (select private.get_my_role()) in ('admin','teacher'));
create policy "bus_check_records_staff_insert" on public.bus_check_records
  for insert to authenticated
  with check ((select private.get_my_role()) in ('admin','teacher'));
create policy "bus_check_records_staff_update" on public.bus_check_records
  for update to authenticated
  using ((select private.get_my_role()) in ('admin','teacher'))
  with check ((select private.get_my_role()) in ('admin','teacher'));
create policy "bus_check_records_staff_delete" on public.bus_check_records
  for delete to authenticated
  using ((select private.get_my_role()) in ('admin','teacher'));

-- report_cards
drop policy if exists "report_cards_select_own_or_staff" on public.report_cards;
drop policy if exists "report_cards_insert_staff"          on public.report_cards;
drop policy if exists "report_cards_update_own_or_staff"  on public.report_cards;
drop policy if exists "report_cards_delete_staff"          on public.report_cards;
create policy "report_cards_select" on public.report_cards
  for select to authenticated
  using (student_id = (select auth.uid()) or (select private.get_my_role()) in ('admin','teacher'));
create policy "report_cards_staff_insert" on public.report_cards
  for insert to authenticated
  with check ((select private.get_my_role()) in ('admin','teacher'));
create policy "report_cards_update" on public.report_cards
  for update to authenticated
  using (student_id = (select auth.uid()) or (select private.get_my_role()) in ('admin','teacher'))
  with check (student_id = (select auth.uid()) or (select private.get_my_role()) in ('admin','teacher'));
create policy "report_cards_staff_delete" on public.report_cards
  for delete to authenticated
  using ((select private.get_my_role()) in ('admin','teacher'));

-- weekly_sentences (anon read 유지)
drop policy if exists "weekly_sentences_public_read" on public.weekly_sentences;
drop policy if exists "weekly_sentences_admin_write" on public.weekly_sentences;
create policy "weekly_sentences_public_read" on public.weekly_sentences
  for select to anon, authenticated using (true);
create policy "weekly_sentences_admin_insert" on public.weekly_sentences
  for insert to authenticated
  with check ((select private.get_my_role()) = 'admin');
create policy "weekly_sentences_admin_update" on public.weekly_sentences
  for update to authenticated
  using ((select private.get_my_role()) = 'admin')
  with check ((select private.get_my_role()) = 'admin');
create policy "weekly_sentences_admin_delete" on public.weekly_sentences
  for delete to authenticated
  using ((select private.get_my_role()) = 'admin');

-- weekly_sentence_config
drop policy if exists "weekly_sentence_config_public_read" on public.weekly_sentence_config;
drop policy if exists "weekly_sentence_config_admin_write" on public.weekly_sentence_config;
create policy "weekly_sentence_config_public_read" on public.weekly_sentence_config
  for select to anon, authenticated using (true);
create policy "weekly_sentence_config_admin_insert" on public.weekly_sentence_config
  for insert to authenticated
  with check ((select private.get_my_role()) = 'admin');
create policy "weekly_sentence_config_admin_update" on public.weekly_sentence_config
  for update to authenticated
  using ((select private.get_my_role()) = 'admin')
  with check ((select private.get_my_role()) = 'admin');
create policy "weekly_sentence_config_admin_delete" on public.weekly_sentence_config
  for delete to authenticated
  using ((select private.get_my_role()) = 'admin');

-- notices (anon read published only)
drop policy if exists "notices_public_read_published" on public.notices;
drop policy if exists "notices_admin_write"            on public.notices;
create policy "notices_public_read_published" on public.notices
  for select to anon, authenticated
  using (is_published = true or (select private.get_my_role()) = 'admin');
create policy "notices_admin_insert" on public.notices
  for insert to authenticated
  with check ((select private.get_my_role()) = 'admin');
create policy "notices_admin_update" on public.notices
  for update to authenticated
  using ((select private.get_my_role()) = 'admin')
  with check ((select private.get_my_role()) = 'admin');
create policy "notices_admin_delete" on public.notices
  for delete to authenticated
  using ((select private.get_my_role()) = 'admin');

-- ── 3. 구 public.get_my_role 제거 ─────────────────────────
drop function if exists public.get_my_role();
