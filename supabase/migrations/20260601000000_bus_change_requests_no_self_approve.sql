-- Task A1 (REVIEW_DB §8.1, CRITICAL):
-- bus_change_requests_update 정책에서 학생 셀프 승인 가능성 차단.
--
-- 기존 정책: USING/WITH CHECK 가 student_id = auth.uid() OR staff.
--   → 학생이 자기 row 의 status='approved' 로 직접 UPDATE 가능.
--
-- 수정:
--   - status / reviewed_by / reviewed_at 변경은 staff 만.
--   - 학생은 자신의 pending 요청에서 새 버스 정보(new_*) 등 본문만 수정 가능 (status='pending' 유지 강제).
--   - 취소(삭제)는 기존 *_delete 정책에서 학생 본인 허용 — 변경 없음.
--
-- 컬럼 변경 감지는 row-level trigger (security definer) 를 통해 강제. WITH CHECK 만으로는
-- 학생이 같은 status 로 self-UPDATE 할 때 reviewed_by 만 바꾸는 경우를 막을 수 없어 trigger 가 더 안전.

-- 1) 정책 교체: 학생은 자기 row 의 status = 'pending' 인 row 만 update 가능 + 결과 status 도 pending 유지.
drop policy if exists "bus_change_requests_update" on public.bus_change_requests;

create policy "bus_change_requests_update" on public.bus_change_requests
  for update to authenticated
  using (
    (
      student_id = (select auth.uid())
      and status = 'pending'::public.bus_change_status
    )
    or (
      (select private.get_my_role()) = any (
        array['admin'::public.user_role, 'teacher'::public.user_role]
      )
    )
  )
  with check (
    (
      student_id = (select auth.uid())
      and status = 'pending'::public.bus_change_status
    )
    or (
      (select private.get_my_role()) = any (
        array['admin'::public.user_role, 'teacher'::public.user_role]
      )
    )
  );

-- 2) 컬럼 레벨 가드 — 학생이 reviewed_by / reviewed_at 컬럼을 만지지 못하도록 trigger 강제.
--    student_id 자체도 바꿀 수 없음 (이관 금지). new_* 만 수정 허용.
create or replace function public.tg_bus_change_requests_guard_self_update()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_catalog'
as $$
declare
  v_role public.user_role;
begin
  -- staff 는 통과 (모든 컬럼 변경 허용)
  v_role := private.get_my_role();
  if v_role = any (array['admin'::public.user_role, 'teacher'::public.user_role]) then
    return new;
  end if;

  -- 그 외 (학생 본인) 는 status / reviewed_by / reviewed_at / student_id 변경 금지.
  if new.status is distinct from old.status then
    raise exception 'bus_change_requests: 학생은 status 를 변경할 수 없습니다.'
      using errcode = '42501';
  end if;
  if new.reviewed_by is distinct from old.reviewed_by then
    raise exception 'bus_change_requests: 학생은 reviewed_by 를 변경할 수 없습니다.'
      using errcode = '42501';
  end if;
  if new.reviewed_at is distinct from old.reviewed_at then
    raise exception 'bus_change_requests: 학생은 reviewed_at 을 변경할 수 없습니다.'
      using errcode = '42501';
  end if;
  if new.student_id is distinct from old.student_id then
    raise exception 'bus_change_requests: 학생은 student_id 를 변경할 수 없습니다.'
      using errcode = '42501';
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

-- ROLLBACK:
-- BEGIN;
-- DROP TRIGGER IF EXISTS tg_bus_change_requests_guard_self_update ON public.bus_change_requests;
-- DROP FUNCTION IF EXISTS public.tg_bus_change_requests_guard_self_update();
-- DROP POLICY IF EXISTS "bus_change_requests_update" ON public.bus_change_requests;
-- CREATE POLICY "bus_change_requests_update" ON public.bus_change_requests
--   FOR UPDATE TO authenticated
--   USING ((student_id = (select auth.uid())) OR ((select private.get_my_role()) = ANY (ARRAY['admin'::public.user_role,'teacher'::public.user_role])))
--   WITH CHECK ((student_id = (select auth.uid())) OR ((select private.get_my_role()) = ANY (ARRAY['admin'::public.user_role,'teacher'::public.user_role])));
-- COMMIT;
