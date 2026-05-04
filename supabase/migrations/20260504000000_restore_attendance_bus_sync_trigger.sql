-- 20260504000000_restore_attendance_bus_sync_trigger.sql
--
-- 문제: 20260430020118_core_role_split.sql 이 after_attendance_bus_sync 트리거와
--       handle_attendance_bus_sync() 함수를 drop 한 뒤 재생성하지 않았음.
--       컬럼명이 student_profile_id → student_id 로 변경됐고,
--       attendance/bus_change_requests 의 (student_id, date) unique 제약도 함께 사라졌음.
--
-- 수정:
--   1) unique index 복원 (upsert ON CONFLICT 에 필요)
--   2) handle_attendance_bus_sync() 재생성 (student_id 컬럼, enum 타입 사용)
--   3) after_attendance_bus_sync 트리거 재부착

-- ── 1. Unique index 복원 ──────────────────────────────────────────────────────

create unique index if not exists attendance_student_id_date_key
  on public.attendance (student_id, attendance_date);

create unique index if not exists bus_change_requests_student_id_date_key
  on public.bus_change_requests (student_id, request_date);

-- ── 2. 트리거 함수 재생성 ──────────────────────────────────────────────────────

create or replace function public.handle_attendance_bus_sync()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $$
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
$$;

-- ── 3. 트리거 재부착 ──────────────────────────────────────────────────────────

drop trigger if exists after_attendance_bus_sync on public.attendance;

create trigger after_attendance_bus_sync
  after insert or update of status
  on public.attendance
  for each row
  execute function public.handle_attendance_bus_sync();
