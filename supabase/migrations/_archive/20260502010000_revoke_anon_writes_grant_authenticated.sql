-- ============================================================
-- 보안 보강 — anon mutation 권한 회수 + authenticated mutation 부여
-- + get_my_role() EXECUTE 안전화
--
-- 배경:
--   - 20260430033000_admin_ops_grants.sql 가 13 개 테이블에 anon
--     INSERT/UPDATE/DELETE 권한을 일괄 부여 → defense-in-depth 위반
--     (RLS 한 줄 실수 시 익명 변조 가능 폭발 반경).
--   - 20260430050000 의 admins 도 동일 패턴.
--   - 20260430023000 가 9 개 코어 테이블에 SELECT 만 부여해 authenticated
--     사용자는 RLS write 정책 통과해도 grant 단계에서 거부됨.
--   - get_my_role() 가 PUBLIC 에 EXECUTE 노출.
--
-- 정책:
--   - anon : weekly_sentences / weekly_sentence_config / notices 만 SELECT 유지
--            (위젯/공지 공개 의도). 그 외 테이블은 모든 권한 회수.
--   - authenticated : 코어 9 테이블에 mutation 권한 부여 (RLS 정책이 게이트).
--   - service_role : 변경 없음 (RLS 우회용 server action 경로).
-- ============================================================

-- ── 1. anon mutation 권한 회수 ──────────────────────────────
revoke insert, update, delete on
  public.attendance,
  public.admins,
  public.bus_numbers,
  public.bus_time_slots,
  public.bus_stops,
  public.bus_stop_day_assignments,
  public.bus_stop_schedules,
  public.student_bus_defaults,
  public.bus_change_requests,
  public.bus_check_records,
  public.report_cards,
  public.weekly_sentences,
  public.weekly_sentence_config,
  public.notices
from anon;

-- ── 2. anon SELECT 회수 (공개 위젯 3 테이블 제외) ────────────
revoke select on
  public.attendance,
  public.admins,
  public.bus_numbers,
  public.bus_time_slots,
  public.bus_stops,
  public.bus_stop_day_assignments,
  public.bus_stop_schedules,
  public.student_bus_defaults,
  public.bus_change_requests,
  public.bus_check_records,
  public.report_cards
from anon;

-- ── 3. authenticated 에 mutation 부여 (RLS write 정책 게이트) ─
grant insert, update, delete on
  public.profiles,
  public.students,
  public.teachers,
  public.classes,
  public.class_students,
  public.class_teachers,
  public.academy_periods,
  public.afterschool_enrollments,
  public.class_schedules
to authenticated;

-- ── 4. get_my_role() EXECUTE 안전화 ─────────────────────────
revoke execute on function public.get_my_role() from public;
revoke execute on function public.get_my_role() from anon;
grant execute on function public.get_my_role() to authenticated, service_role;
