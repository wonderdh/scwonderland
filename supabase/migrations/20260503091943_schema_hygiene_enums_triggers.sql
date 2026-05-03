-- ============================================================
-- Schema hygiene
--
-- 목적:
--   1) updated_at 자동 갱신 트리거 — public.tg_set_updated_at() + 15개 테이블 부착
--   2) text → enum 전환:
--        attendance.status              → attendance_status
--        bus_change_requests.change_type → bus_change_type
--        bus_change_requests.status      → bus_change_status
--        weekly_sentence_config.mode     → weekly_sentence_mode
--
-- 데이터 검증 (live):
--   - attendance.status:           present(1), absent(63), early_leave(2)
--   - bus_change_requests.change_type: absent(64), change(67), no_ride(71)
--   - bus_change_requests.status:    approved(200), rejected(2)  (default 'pending')
--   - weekly_sentence_config.mode:   auto(1)
--   → 모든 기존 값이 신규 enum 멤버에 포함됨, 데이터 손실 없음
--
-- 미포함 (P3 로 이관):
--   - students.group_type: 174 행 전부 NULL → 컬럼 사용 미정, drop 여부 별도 결정
--   - report_cards 양국어 컬럼 rename: 코드베이스 영향 큼, 별도 PR
--   - notices.published_at default: app 코드 의존성 검토 필요
-- ============================================================

-- ── 1. updated_at 자동 갱신 트리거 ──────────────────────────
create or replace function public.tg_set_updated_at()
  returns trigger
  language plpgsql
  set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end $$;

revoke execute on function public.tg_set_updated_at() from public;
revoke execute on function public.tg_set_updated_at() from anon;
-- 트리거 함수는 트리거 컨텍스트에서만 실행되므로 EXECUTE 별도 부여 불필요

do $$
declare
  t text;
  tables text[] := array[
    'academy_periods', 'attendance', 'bus_change_requests',
    'bus_numbers', 'bus_stop_day_assignments', 'bus_stop_schedules',
    'bus_stops', 'bus_time_slots', 'class_schedules', 'classes',
    'notices', 'report_cards', 'student_bus_defaults',
    'students', 'teachers', 'weekly_sentence_config', 'weekly_sentences'
  ];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists tg_set_updated_at on public.%I', t);
    execute format(
      'create trigger tg_set_updated_at before update on public.%I
       for each row execute function public.tg_set_updated_at()',
      t
    );
  end loop;
end $$;

-- ── 2. 신규 enum 생성 ────────────────────────────────────
create type public.attendance_status as enum (
  'present', 'absent', 'late', 'early_leave', 'excused'
);

create type public.bus_change_type as enum (
  'absent', 'change', 'no_ride'
);

create type public.bus_change_status as enum (
  'pending', 'approved', 'rejected'
);

create type public.weekly_sentence_mode as enum (
  'auto', 'manual'
);

-- ── 3. 컬럼 타입 변환 (default 도 새 enum 으로 재설정) ───────

-- attendance.status (default 없음)
alter table public.attendance
  alter column status type public.attendance_status
  using status::public.attendance_status;

-- bus_change_requests.change_type (default 없음)
alter table public.bus_change_requests
  alter column change_type type public.bus_change_type
  using change_type::public.bus_change_type;

-- bus_change_requests.status (default 'pending' → enum default)
alter table public.bus_change_requests
  alter column status drop default;
alter table public.bus_change_requests
  alter column status type public.bus_change_status
  using status::public.bus_change_status;
alter table public.bus_change_requests
  alter column status set default 'pending'::public.bus_change_status;

-- weekly_sentence_config.mode (default 'auto')
alter table public.weekly_sentence_config
  alter column mode drop default;
alter table public.weekly_sentence_config
  alter column mode type public.weekly_sentence_mode
  using mode::public.weekly_sentence_mode;
alter table public.weekly_sentence_config
  alter column mode set default 'auto'::public.weekly_sentence_mode;
