-- 2026-05-21
-- handle_attendance_bus_sync 트리거의 reason 덮어쓰기 결함 수정.
--
-- 기존: attendance INSERT/UPDATE → bus_change_requests upsert 시 reason 을
--       항상 sentinel ('출결 연동 (결석)') 으로 덮어써서 admin 이 직접 입력한
--       reason (예: "병원 검진") 이 silently 사라짐.
--
-- 수정: on conflict do update 시 기존 row 의 reason 이 있으면 보존,
--       없을 때만 sentinel 사용 (coalesce). delete 분기는 그대로 — sentinel
--       reason 인 row 만 삭제하므로 admin 이 만든 reason 의 row 는 자동 정리
--       대상에서 제외 (의도된 동작).
--
-- 스키마 변경 없음 (함수 본문만 재정의). 데이터 손실 없음.

CREATE OR REPLACE FUNCTION "public"."handle_attendance_bus_sync"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
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
      -- 기존 reason 이 있으면 보존 (admin 이 직접 입력한 메모 보호).
      -- nullif 로 빈 문자열도 null 취급 → sentinel 로 채움.
      reason               = coalesce(nullif(bus_change_requests.reason, ''), v_absent_reason),
      new_bus_time_slot_id = null,
      new_bus_number_id    = null,
      new_bus_stop_id      = null;

  else
    -- 결석 이외 상태로 변경되면 자동 생성된 버스 결석 요청 삭제.
    -- reason = sentinel 인 row 만 삭제 → admin 이 직접 입력한 reason 의 row 는
    -- 보존 (자동 sync 가 만든 row 가 아니므로 자동 정리 대상 아님).
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
