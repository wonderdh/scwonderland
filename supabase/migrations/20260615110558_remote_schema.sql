create extension if not exists "hypopg" with schema "extensions";

create extension if not exists "index_advisor" with schema "extensions";

drop extension if exists "pg_net";

drop trigger if exists "tg_bus_change_requests_guard_self_update" on "public"."bus_change_requests";

drop policy "bus_change_requests_update" on "public"."bus_change_requests";

drop policy "class_schedules_select" on "public"."class_schedules";

drop policy "class_students_select" on "public"."class_students";

drop policy "class_teachers_select" on "public"."class_teachers";

drop policy "classes_select" on "public"."classes";

drop policy "notices_public_read_published" on "public"."notices";

drop policy "weekly_sentence_config_public_read" on "public"."weekly_sentence_config";

drop policy "weekly_sentences_public_read" on "public"."weekly_sentences";

revoke references on table "public"."academy_periods" from "anon";

revoke trigger on table "public"."academy_periods" from "anon";

revoke truncate on table "public"."academy_periods" from "anon";

revoke references on table "public"."academy_periods" from "authenticated";

revoke trigger on table "public"."academy_periods" from "authenticated";

revoke truncate on table "public"."academy_periods" from "authenticated";

revoke references on table "public"."afterschool_enrollments" from "anon";

revoke trigger on table "public"."afterschool_enrollments" from "anon";

revoke truncate on table "public"."afterschool_enrollments" from "anon";

revoke references on table "public"."afterschool_enrollments" from "authenticated";

revoke trigger on table "public"."afterschool_enrollments" from "authenticated";

revoke truncate on table "public"."afterschool_enrollments" from "authenticated";

revoke references on table "public"."class_schedules" from "anon";

revoke trigger on table "public"."class_schedules" from "anon";

revoke truncate on table "public"."class_schedules" from "anon";

revoke references on table "public"."class_schedules" from "authenticated";

revoke trigger on table "public"."class_schedules" from "authenticated";

revoke truncate on table "public"."class_schedules" from "authenticated";

revoke references on table "public"."class_students" from "anon";

revoke trigger on table "public"."class_students" from "anon";

revoke truncate on table "public"."class_students" from "anon";

revoke references on table "public"."class_students" from "authenticated";

revoke trigger on table "public"."class_students" from "authenticated";

revoke truncate on table "public"."class_students" from "authenticated";

revoke references on table "public"."class_teachers" from "anon";

revoke trigger on table "public"."class_teachers" from "anon";

revoke truncate on table "public"."class_teachers" from "anon";

revoke references on table "public"."class_teachers" from "authenticated";

revoke trigger on table "public"."class_teachers" from "authenticated";

revoke truncate on table "public"."class_teachers" from "authenticated";

revoke references on table "public"."classes" from "anon";

revoke trigger on table "public"."classes" from "anon";

revoke truncate on table "public"."classes" from "anon";

revoke references on table "public"."classes" from "authenticated";

revoke trigger on table "public"."classes" from "authenticated";

revoke truncate on table "public"."classes" from "authenticated";

revoke references on table "public"."profiles" from "anon";

revoke trigger on table "public"."profiles" from "anon";

revoke truncate on table "public"."profiles" from "anon";

revoke references on table "public"."profiles" from "authenticated";

revoke trigger on table "public"."profiles" from "authenticated";

revoke truncate on table "public"."profiles" from "authenticated";

revoke references on table "public"."students" from "anon";

revoke trigger on table "public"."students" from "anon";

revoke truncate on table "public"."students" from "anon";

revoke references on table "public"."students" from "authenticated";

revoke trigger on table "public"."students" from "authenticated";

revoke truncate on table "public"."students" from "authenticated";

revoke references on table "public"."teachers" from "anon";

revoke trigger on table "public"."teachers" from "anon";

revoke truncate on table "public"."teachers" from "anon";

revoke references on table "public"."teachers" from "authenticated";

revoke trigger on table "public"."teachers" from "authenticated";

revoke truncate on table "public"."teachers" from "authenticated";

drop function if exists "private"."my_student_class_ids"();

drop function if exists "private"."my_teacher_class_ids"();

drop function if exists "public"."tg_bus_change_requests_guard_self_update"();

CREATE UNIQUE INDEX student_bus_defaults_student_id_day_of_week_key ON public.student_bus_defaults USING btree (student_id, day_of_week);

alter table "public"."student_bus_defaults" add constraint "student_bus_defaults_student_id_day_of_week_key" UNIQUE using index "student_bus_defaults_student_id_day_of_week_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.is_korean_teacher()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.teachers t
    where t.id = auth.uid() and t.teacher_type = 'korean'::public.teacher_type
  )
$function$
;

CREATE OR REPLACE FUNCTION public.handle_attendance_bus_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_day           integer;
  v_absent_reason text := '출결 연동 (결석)';
begin
  -- 주말은 버스 운행 없음
  v_day := extract(isodow from NEW.attendance_date);
  if v_day in (6, 7) then
    return NEW;
  end if;

  if NEW.status = 'absent'::public.attendance_status then
    insert into public.bus_change_requests (
      student_id, request_date,
      change_type, status, reason,
      new_bus_time_slot_id, new_bus_number_id, new_bus_stop_id
    )
    values (
      NEW.student_id, NEW.attendance_date,
      'absent'::public.bus_change_type,
      'approved'::public.bus_change_status,
      v_absent_reason,
      null, null, null
    )
    on conflict (student_id, request_date)
    do update set
      change_type          = 'absent'::public.bus_change_type,
      status               = 'approved'::public.bus_change_status,
      reason               = v_absent_reason,
      new_bus_time_slot_id = null,
      new_bus_number_id    = null,
      new_bus_stop_id      = null;

  else
    -- 결석 이외 상태로 변경되면 자동 생성된 버스 결석 요청 삭제
    delete from public.bus_change_requests
    where student_id  = NEW.student_id
      and request_date = NEW.attendance_date
      and change_type  = 'absent'::public.bus_change_type
      and reason       = v_absent_reason;
  end if;

  return NEW;
exception when others then
  raise warning 'bus sync failed for attendance (%, %): %',
    NEW.student_id, NEW.attendance_date, sqlerrm;
  return NEW;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_class_homework_book_seed_students()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.student_homework_books (class_student_id, class_homework_book_id)
  select cs.id, NEW.id from public.class_students cs
  where cs.class_id = NEW.class_id and cs.is_active = true
  on conflict (class_student_id, class_homework_book_id) do nothing;
  return NEW;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_class_student_reactivate_seed_units()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if NEW.is_active is not true then return NEW; end if;
  if OLD.is_active is true then return NEW; end if;
  insert into public.homework_unit_progress (student_id, textbook_id, unit_number)
  select NEW.student_id, ct.textbook_id, gs.n from public.class_textbooks ct
    join public.textbooks tb on tb.id = ct.textbook_id
    cross join lateral generate_series(1, tb.total_units) as gs(n)
  where ct.class_id = NEW.class_id and tb.is_active = true and tb.total_units > 0
  on conflict (student_id, textbook_id, unit_number) do nothing;
  return NEW;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_class_student_seed_homework_books()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if NEW.is_active is not true then return NEW; end if;
  insert into public.student_homework_books (class_student_id, class_homework_book_id)
  select NEW.id, chb.id from public.class_homework_books chb
  where chb.class_id = NEW.class_id
  on conflict (class_student_id, class_homework_book_id) do nothing;
  return NEW;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.tg_student_homework_book_seed_progress()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_total integer;
begin
  select s.total_units into v_total
  from public.class_homework_books chb
    join public.homework_books hb on hb.id = chb.textbook_id
    join public.series s on s.id = hb.series_id
  where chb.id = NEW.class_homework_book_id;

  if v_total is null or v_total <= 0 then
    return NEW;
  end if;

  insert into public.student_homework_progress (
    student_homework_book_id, unit_number, status
  )
  select NEW.id, gs.n, 'pending'
  from generate_series(1, v_total) as gs(n)
  on conflict (student_homework_book_id, unit_number) do nothing;
  return NEW;
end;
$function$
;

grant delete on table "public"."academy_closed_days" to "anon";

grant insert on table "public"."academy_closed_days" to "anon";

grant references on table "public"."academy_closed_days" to "anon";

grant select on table "public"."academy_closed_days" to "anon";

grant trigger on table "public"."academy_closed_days" to "anon";

grant truncate on table "public"."academy_closed_days" to "anon";

grant update on table "public"."academy_closed_days" to "anon";

grant delete on table "public"."attendance" to "anon";

grant insert on table "public"."attendance" to "anon";

grant references on table "public"."attendance" to "anon";

grant select on table "public"."attendance" to "anon";

grant trigger on table "public"."attendance" to "anon";

grant truncate on table "public"."attendance" to "anon";

grant update on table "public"."attendance" to "anon";

grant delete on table "public"."bus_change_requests" to "anon";

grant insert on table "public"."bus_change_requests" to "anon";

grant references on table "public"."bus_change_requests" to "anon";

grant select on table "public"."bus_change_requests" to "anon";

grant trigger on table "public"."bus_change_requests" to "anon";

grant truncate on table "public"."bus_change_requests" to "anon";

grant update on table "public"."bus_change_requests" to "anon";

grant delete on table "public"."bus_check_records" to "anon";

grant insert on table "public"."bus_check_records" to "anon";

grant references on table "public"."bus_check_records" to "anon";

grant select on table "public"."bus_check_records" to "anon";

grant trigger on table "public"."bus_check_records" to "anon";

grant truncate on table "public"."bus_check_records" to "anon";

grant update on table "public"."bus_check_records" to "anon";

grant delete on table "public"."bus_numbers" to "anon";

grant insert on table "public"."bus_numbers" to "anon";

grant references on table "public"."bus_numbers" to "anon";

grant select on table "public"."bus_numbers" to "anon";

grant trigger on table "public"."bus_numbers" to "anon";

grant truncate on table "public"."bus_numbers" to "anon";

grant update on table "public"."bus_numbers" to "anon";

grant delete on table "public"."bus_stop_day_assignments" to "anon";

grant insert on table "public"."bus_stop_day_assignments" to "anon";

grant references on table "public"."bus_stop_day_assignments" to "anon";

grant select on table "public"."bus_stop_day_assignments" to "anon";

grant trigger on table "public"."bus_stop_day_assignments" to "anon";

grant truncate on table "public"."bus_stop_day_assignments" to "anon";

grant update on table "public"."bus_stop_day_assignments" to "anon";

grant delete on table "public"."bus_stop_schedules" to "anon";

grant insert on table "public"."bus_stop_schedules" to "anon";

grant references on table "public"."bus_stop_schedules" to "anon";

grant select on table "public"."bus_stop_schedules" to "anon";

grant trigger on table "public"."bus_stop_schedules" to "anon";

grant truncate on table "public"."bus_stop_schedules" to "anon";

grant update on table "public"."bus_stop_schedules" to "anon";

grant delete on table "public"."bus_stops" to "anon";

grant insert on table "public"."bus_stops" to "anon";

grant references on table "public"."bus_stops" to "anon";

grant select on table "public"."bus_stops" to "anon";

grant trigger on table "public"."bus_stops" to "anon";

grant truncate on table "public"."bus_stops" to "anon";

grant update on table "public"."bus_stops" to "anon";

grant delete on table "public"."bus_time_slots" to "anon";

grant insert on table "public"."bus_time_slots" to "anon";

grant references on table "public"."bus_time_slots" to "anon";

grant select on table "public"."bus_time_slots" to "anon";

grant trigger on table "public"."bus_time_slots" to "anon";

grant truncate on table "public"."bus_time_slots" to "anon";

grant update on table "public"."bus_time_slots" to "anon";

grant delete on table "public"."notices" to "anon";

grant insert on table "public"."notices" to "anon";

grant references on table "public"."notices" to "anon";

grant trigger on table "public"."notices" to "anon";

grant truncate on table "public"."notices" to "anon";

grant update on table "public"."notices" to "anon";

grant delete on table "public"."report_cards" to "anon";

grant insert on table "public"."report_cards" to "anon";

grant references on table "public"."report_cards" to "anon";

grant select on table "public"."report_cards" to "anon";

grant trigger on table "public"."report_cards" to "anon";

grant truncate on table "public"."report_cards" to "anon";

grant update on table "public"."report_cards" to "anon";

grant delete on table "public"."student_bus_defaults" to "anon";

grant insert on table "public"."student_bus_defaults" to "anon";

grant references on table "public"."student_bus_defaults" to "anon";

grant select on table "public"."student_bus_defaults" to "anon";

grant trigger on table "public"."student_bus_defaults" to "anon";

grant truncate on table "public"."student_bus_defaults" to "anon";

grant update on table "public"."student_bus_defaults" to "anon";

grant delete on table "public"."weekly_sentence_config" to "anon";

grant insert on table "public"."weekly_sentence_config" to "anon";

grant references on table "public"."weekly_sentence_config" to "anon";

grant trigger on table "public"."weekly_sentence_config" to "anon";

grant truncate on table "public"."weekly_sentence_config" to "anon";

grant update on table "public"."weekly_sentence_config" to "anon";

grant delete on table "public"."weekly_sentences" to "anon";

grant insert on table "public"."weekly_sentences" to "anon";

grant references on table "public"."weekly_sentences" to "anon";

grant trigger on table "public"."weekly_sentences" to "anon";

grant truncate on table "public"."weekly_sentences" to "anon";

grant update on table "public"."weekly_sentences" to "anon";


  create policy "bus_change_requests_update"
  on "public"."bus_change_requests"
  as permissive
  for update
  to authenticated
using (((student_id = ( SELECT auth.uid() AS uid)) OR (( SELECT private.get_my_role() AS get_my_role) = ANY (ARRAY['admin'::public.user_role, 'teacher'::public.user_role]))))
with check (((student_id = ( SELECT auth.uid() AS uid)) OR (( SELECT private.get_my_role() AS get_my_role) = ANY (ARRAY['admin'::public.user_role, 'teacher'::public.user_role]))));



  create policy "class_schedules_select"
  on "public"."class_schedules"
  as permissive
  for select
  to authenticated
using (true);



  create policy "class_students_select"
  on "public"."class_students"
  as permissive
  for select
  to authenticated
using (true);



  create policy "class_teachers_select"
  on "public"."class_teachers"
  as permissive
  for select
  to authenticated
using (true);



  create policy "classes_select"
  on "public"."classes"
  as permissive
  for select
  to authenticated
using (true);



  create policy "notices_public_read_published"
  on "public"."notices"
  as permissive
  for select
  to anon, authenticated
using (((is_published = true) OR (( SELECT private.get_my_role() AS get_my_role) = 'admin'::public.user_role)));



  create policy "weekly_sentence_config_public_read"
  on "public"."weekly_sentence_config"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "weekly_sentences_public_read"
  on "public"."weekly_sentences"
  as permissive
  for select
  to anon, authenticated
using (true);


drop policy "academy_notices_admin_delete" on "storage"."objects";

drop policy "academy_notices_admin_insert" on "storage"."objects";

drop policy "academy_notices_admin_update" on "storage"."objects";

drop policy "academy_notices_authenticated_read" on "storage"."objects";

drop policy "class_notices_authenticated_read" on "storage"."objects";

drop policy "class_notices_staff_delete" on "storage"."objects";

drop policy "class_notices_staff_insert" on "storage"."objects";

drop policy "class_notices_staff_update" on "storage"."objects";

drop policy "homework_submissions_insert" on "storage"."objects";

drop policy "homework_submissions_select" on "storage"."objects";

drop policy "homework_submissions_staff_delete" on "storage"."objects";

drop policy "homework_submissions_staff_update" on "storage"."objects";

drop policy "notice_files_admin_delete" on "storage"."objects";

drop policy "notice_files_admin_insert" on "storage"."objects";

drop policy "notice_files_admin_update" on "storage"."objects";

drop policy "notice_files_authenticated_read" on "storage"."objects";


