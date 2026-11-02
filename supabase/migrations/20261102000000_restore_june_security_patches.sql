-- reviewed-by: wonderdh 2026-11-02 (세션 리뷰 후 운영 DB 적용 완료)
-- 2026-11-02
-- `20260615110558_remote_schema.sql` (db pull 산출물) 이 되돌린 2026-06-01 보안·정합성 패치 재적용
-- + 리뷰(docs/2026-11-02) 에서 새로 확인된 🔴 2건.
--
-- 운영 DB 2026-11-02 조회로 아래 상태를 전부 확인함:
--   A. bus_change_requests_update 정책에 status='pending' 조건 없음, 가드 트리거 없음  → 학생 셀프승인 가능
--   B. anon 에 public 테이블 다수 GRANT ALL (DELETE/TRUNCATE 포함), DEFAULT PRIVILEGES 도 anon 포함
--   C. classes / class_students / class_teachers / class_schedules SELECT 가 USING(true), 헬퍼 함수 없음
--   D. student_bus_defaults UNIQUE(student_id, day_of_week) 가 PK 와 모순
--   E. storage 정책 17개 소실
--   F. handle_attendance_bus_sync 가 admin 입력 reason 을 sentinel 로 덮어씀
--   G. tg_class_student_reactivate_seed 트리거가 drop 된 테이블 3개를 참조 (잠복 장애)
--   H. report_cards.class_student_id ON DELETE CASCADE → 반 탈퇴 시 성적표 소실
--
-- 원문: 20260601000000 / 010000 / 020000+050000 / 030000 / 040000, 20260521010000.
-- 전부 idempotent. 데이터 삭제 없음.

-- =================================================================
-- A. 셀프승인 가드 (20260601000000 재적용)
-- =================================================================
drop policy if exists "bus_change_requests_update" on public.bus_change_requests;
create policy "bus_change_requests_update" on public.bus_change_requests
  for update to authenticated
  using (
    (student_id = (select auth.uid()) and status = 'pending'::public.bus_change_status)
    or (select private.get_my_role()) = any (array['admin'::public.user_role, 'teacher'::public.user_role])
  )
  with check (
    (student_id = (select auth.uid()) and status = 'pending'::public.bus_change_status)
    or (select private.get_my_role()) = any (array['admin'::public.user_role, 'teacher'::public.user_role])
  );

create or replace function public.tg_bus_change_requests_guard_self_update()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_catalog'
as $$
declare
  v_role public.user_role;
begin
  v_role := private.get_my_role();
  if v_role = any (array['admin'::public.user_role, 'teacher'::public.user_role]) then
    return new;
  end if;
  if new.status is distinct from old.status then
    raise exception 'bus_change_requests: 학생은 status 를 변경할 수 없습니다.' using errcode = '42501';
  end if;
  if new.reviewed_by is distinct from old.reviewed_by then
    raise exception 'bus_change_requests: 학생은 reviewed_by 를 변경할 수 없습니다.' using errcode = '42501';
  end if;
  if new.reviewed_at is distinct from old.reviewed_at then
    raise exception 'bus_change_requests: 학생은 reviewed_at 을 변경할 수 없습니다.' using errcode = '42501';
  end if;
  if new.student_id is distinct from old.student_id then
    raise exception 'bus_change_requests: 학생은 student_id 를 변경할 수 없습니다.' using errcode = '42501';
  end if;
  return new;
end;
$$;

alter function public.tg_bus_change_requests_guard_self_update() owner to postgres;
revoke all on function public.tg_bus_change_requests_guard_self_update() from public;
grant execute on function public.tg_bus_change_requests_guard_self_update() to authenticated;
grant execute on function public.tg_bus_change_requests_guard_self_update() to service_role;
comment on function public.tg_bus_change_requests_guard_self_update() is
  'SECURITY DEFINER: 학생 self-update 시 status/reviewed_*/student_id 컬럼 변경 차단. staff 는 통과. RLS update 정책의 보조 가드.';

drop trigger if exists tg_bus_change_requests_guard_self_update on public.bus_change_requests;
create trigger tg_bus_change_requests_guard_self_update
  before update on public.bus_change_requests
  for each row execute function public.tg_bus_change_requests_guard_self_update();

-- =================================================================
-- B. anon 권한 회수 (20260601010000 재적용 + 범위 확장)
--    원본은 13 테이블만 지정해 8개가 빠졌음(07-12 리뷰). 이번엔 public 전체 회수 후
--    공개 read 가 필요한 3 테이블(notices / weekly_sentences / weekly_sentence_config) 만 SELECT 재부여.
--    앱은 authenticated(RLS) 와 service_role 만 사용하므로 anon 은 그 외 어디에도 필요 없음.
-- =================================================================
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

grant select on table public.notices to anon;
grant select on table public.weekly_sentences to anon;
grant select on table public.weekly_sentence_config to anon;

alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;

-- =================================================================
-- C. 반 테이블 SELECT 좁히기 (20260601050000 재적용 — 020000 의 recursion-free 버전)
-- =================================================================
create or replace function private.my_student_class_ids()
returns setof uuid
language sql
security definer
stable
set search_path = ''
as $$
  select cs.class_id from public.class_students cs where cs.student_id = (select auth.uid());
$$;

create or replace function private.my_teacher_class_ids()
returns setof uuid
language sql
security definer
stable
set search_path = ''
as $$
  select ct.class_id from public.class_teachers ct where ct.teacher_id = (select auth.uid());
$$;

revoke all on function private.my_student_class_ids() from public;
revoke all on function private.my_teacher_class_ids() from public;
grant execute on function private.my_student_class_ids() to authenticated;
grant execute on function private.my_teacher_class_ids() to authenticated;

drop policy if exists "classes_select" on public.classes;
create policy "classes_select" on public.classes
  for select to authenticated
  using (
    (select private.get_my_role()) = any (array['admin'::public.user_role, 'teacher'::public.user_role])
    or classes.id in (select private.my_student_class_ids())
    or classes.id in (select private.my_teacher_class_ids())
  );

drop policy if exists "class_students_select" on public.class_students;
create policy "class_students_select" on public.class_students
  for select to authenticated
  using (
    (select private.get_my_role()) = any (array['admin'::public.user_role, 'teacher'::public.user_role])
    or class_students.student_id = (select auth.uid())
    or class_students.class_id in (select private.my_student_class_ids())
    or class_students.class_id in (select private.my_teacher_class_ids())
  );

drop policy if exists "class_teachers_select" on public.class_teachers;
create policy "class_teachers_select" on public.class_teachers
  for select to authenticated
  using (
    (select private.get_my_role()) = any (array['admin'::public.user_role, 'teacher'::public.user_role])
    or class_teachers.teacher_id = (select auth.uid())
    or class_teachers.class_id in (select private.my_student_class_ids())
  );

drop policy if exists "class_schedules_select" on public.class_schedules;
create policy "class_schedules_select" on public.class_schedules
  for select to authenticated
  using (
    (select private.get_my_role()) = any (array['admin'::public.user_role, 'teacher'::public.user_role])
    or class_schedules.class_id in (select private.my_student_class_ids())
    or class_schedules.class_id in (select private.my_teacher_class_ids())
  );

-- =================================================================
-- D. student_bus_defaults 모순 UNIQUE 제거 (20260601030000 재적용)
-- =================================================================
alter table public.student_bus_defaults
  drop constraint if exists student_bus_defaults_student_id_day_of_week_key;

-- =================================================================
-- E. storage 버킷 정책 (20260601040000 재적용)
-- =================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('notice-files', 'notice-files', false, 20971520, null),
  ('class-notices', 'class-notices', false, 20971520, null),
  ('academy-notices', 'academy-notices', false, 20971520, null),
  ('homework-submissions', 'homework-submissions', false, 52428800, null)
on conflict (id) do nothing;

drop policy if exists "notice_files_authenticated_read" on storage.objects;
create policy "notice_files_authenticated_read" on storage.objects
  for select to authenticated using (bucket_id = 'notice-files');
drop policy if exists "notice_files_admin_insert" on storage.objects;
create policy "notice_files_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'notice-files' and (select private.get_my_role()) = 'admin'::public.user_role);
drop policy if exists "notice_files_admin_update" on storage.objects;
create policy "notice_files_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'notice-files' and (select private.get_my_role()) = 'admin'::public.user_role)
  with check (bucket_id = 'notice-files' and (select private.get_my_role()) = 'admin'::public.user_role);
drop policy if exists "notice_files_admin_delete" on storage.objects;
create policy "notice_files_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'notice-files' and (select private.get_my_role()) = 'admin'::public.user_role);

drop policy if exists "class_notices_authenticated_read" on storage.objects;
create policy "class_notices_authenticated_read" on storage.objects
  for select to authenticated using (bucket_id = 'class-notices');
drop policy if exists "class_notices_staff_insert" on storage.objects;
create policy "class_notices_staff_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'class-notices'
    and (select private.get_my_role()) = any (array['admin'::public.user_role, 'teacher'::public.user_role]));
drop policy if exists "class_notices_staff_update" on storage.objects;
create policy "class_notices_staff_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'class-notices'
    and (select private.get_my_role()) = any (array['admin'::public.user_role, 'teacher'::public.user_role]))
  with check (bucket_id = 'class-notices'
    and (select private.get_my_role()) = any (array['admin'::public.user_role, 'teacher'::public.user_role]));
drop policy if exists "class_notices_staff_delete" on storage.objects;
create policy "class_notices_staff_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'class-notices'
    and (select private.get_my_role()) = any (array['admin'::public.user_role, 'teacher'::public.user_role]));

drop policy if exists "academy_notices_authenticated_read" on storage.objects;
create policy "academy_notices_authenticated_read" on storage.objects
  for select to authenticated using (bucket_id = 'academy-notices');
drop policy if exists "academy_notices_admin_insert" on storage.objects;
create policy "academy_notices_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'academy-notices' and (select private.get_my_role()) = 'admin'::public.user_role);
drop policy if exists "academy_notices_admin_update" on storage.objects;
create policy "academy_notices_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'academy-notices' and (select private.get_my_role()) = 'admin'::public.user_role)
  with check (bucket_id = 'academy-notices' and (select private.get_my_role()) = 'admin'::public.user_role);
drop policy if exists "academy_notices_admin_delete" on storage.objects;
create policy "academy_notices_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'academy-notices' and (select private.get_my_role()) = 'admin'::public.user_role);

drop policy if exists "homework_submissions_select" on storage.objects;
create policy "homework_submissions_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'homework-submissions' and (
    (select private.get_my_role()) = any (array['admin'::public.user_role, 'teacher'::public.user_role])
    or (storage.foldername(name))[1] = (select auth.uid())::text));
drop policy if exists "homework_submissions_insert" on storage.objects;
create policy "homework_submissions_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'homework-submissions' and (
    (select private.get_my_role()) = any (array['admin'::public.user_role, 'teacher'::public.user_role])
    or (storage.foldername(name))[1] = (select auth.uid())::text));
drop policy if exists "homework_submissions_staff_update" on storage.objects;
create policy "homework_submissions_staff_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'homework-submissions'
    and (select private.get_my_role()) = any (array['admin'::public.user_role, 'teacher'::public.user_role]))
  with check (bucket_id = 'homework-submissions'
    and (select private.get_my_role()) = any (array['admin'::public.user_role, 'teacher'::public.user_role]));
drop policy if exists "homework_submissions_staff_delete" on storage.objects;
create policy "homework_submissions_staff_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'homework-submissions'
    and (select private.get_my_role()) = any (array['admin'::public.user_role, 'teacher'::public.user_role]));

-- =================================================================
-- F. 출결→버스 트리거 reason 보존 (20260521010000 재적용)
-- =================================================================
create or replace function public.handle_attendance_bus_sync() returns trigger
    language plpgsql security definer
    set search_path to 'public', 'pg_catalog'
    as $$
declare
  v_day           integer;
  v_absent_reason text := '출결 연동 (결석)';
begin
  v_day := extract(isodow from NEW.attendance_date);
  if v_day in (6, 7) then
    return NEW;
  end if;

  if NEW.status = 'absent'::public.attendance_status then
    insert into public.bus_change_requests (
      student_id, request_date, change_type, status, reason,
      new_bus_time_slot_id, new_bus_number_id, new_bus_stop_id
    )
    values (
      NEW.student_id, NEW.attendance_date,
      'absent'::public.bus_change_type, 'approved'::public.bus_change_status, v_absent_reason,
      null, null, null
    )
    on conflict (student_id, request_date)
    do update set
      change_type          = 'absent'::public.bus_change_type,
      status               = 'approved'::public.bus_change_status,
      -- 기존 reason 보존 (admin 메모 보호). 빈 문자열은 null 취급 → sentinel.
      reason               = coalesce(nullif(bus_change_requests.reason, ''), v_absent_reason),
      new_bus_time_slot_id = null,
      new_bus_number_id    = null,
      new_bus_stop_id      = null;
  else
    delete from public.bus_change_requests
    where student_id  = NEW.student_id
      and request_date = NEW.attendance_date
      and change_type  = 'absent'::public.bus_change_type
      and reason       = v_absent_reason;
  end if;

  return NEW;
exception when others then
  raise warning 'bus sync failed for attendance (%, %): %', NEW.student_id, NEW.attendance_date, sqlerrm;
  return NEW;
end;
$$;

-- =================================================================
-- G. 고아 트리거 제거 — homework_unit_progress / class_textbooks / textbooks 는 모두 drop·rename 됨
--    (20260516000000, 20260515000000, 20260519000000). 현재 코드는 class_students.is_active 를
--    UPDATE 하지 않아 미발화 상태지만, 발화 시 "relation does not exist" 로 UPDATE 전체가 실패함.
-- =================================================================
drop trigger if exists tg_class_student_reactivate_seed on public.class_students;
drop function if exists public.tg_class_student_reactivate_seed_units();

-- =================================================================
-- H. report_cards: 반 탈퇴(class_students 행 삭제) 가 성적표를 지우지 못하게 RESTRICT
--    앱은 반 구성 변경 시 class_students 를 hard delete 함 (class-actions.ts, afterschool-actions.ts).
--    성적표가 있는 소속은 삭제가 FK 에러로 막히고, 그 에러가 UI 에 그대로 표시됨 — 의도된 동작.
-- =================================================================
alter table public.report_cards
  drop constraint if exists report_cards_class_student_id_fkey;
alter table public.report_cards
  add constraint report_cards_class_student_id_fkey
  foreign key (class_student_id) references public.class_students(id) on delete restrict;

-- ROLLBACK (요약):
--   A: 20260601000000 ROLLBACK 블록 / B: GRANT ALL … TO anon 재부여 / C: USING(true) 복원 + 헬퍼 drop
--   D: ADD CONSTRAINT UNIQUE (student_id, day_of_week) / E: 20260601040000 ROLLBACK 블록
--   F: remote_schema.sql:158-213 함수 본문 / G: 복구 불필요(죽은 코드) / H: on delete cascade 로 재생성
