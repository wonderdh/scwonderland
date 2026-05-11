-- ============================================================
-- P3 safe cleanups
--
-- 처리:
--   1) admins 테이블 드롭 (0 rows, 코드 미사용 — profiles.role 이 source of truth)
--   2) notices.published_at: default 제거 + nullable 전환 (draft 행에 가짜 시각 채워지는 문제 해소)
--   3) bus_stop_*_unique_idx 두 개를 nulls not distinct 패턴으로 리팩 (PG15+ 가독성 개선)
--
-- 안전성 검증 (live):
--   - admins 0 rows
--   - notices: 0 drafts, 1 published — 행동 변화 없음
--   - bus_stop_*_unique_idx: 동일 동작 보장 (coalesce sentinel UUID 와 nulls not distinct 동등)
-- ============================================================

-- ── 1. admins 드롭 ──────────────────────────────────────────
-- 의존 정책 먼저 제거
drop policy if exists "admins_select"        on public.admins;
drop policy if exists "admins_admin_insert"  on public.admins;
drop policy if exists "admins_admin_update"  on public.admins;
drop policy if exists "admins_admin_delete"  on public.admins;

drop table if exists public.admins;

-- ── 2. notices.published_at nullable + drop default ────────
alter table public.notices
  alter column published_at drop default,
  alter column published_at drop not null;

-- ── 3. bus_stop_*_unique_idx → nulls not distinct ──────────
drop index if exists public.bus_stop_day_assignments_unique_idx;
create unique index bus_stop_day_assignments_unique_idx
  on public.bus_stop_day_assignments (bus_stop_id, day_of_week, bus_time_slot_id)
  nulls not distinct;

drop index if exists public.bus_stop_schedules_unique_idx;
create unique index bus_stop_schedules_unique_idx
  on public.bus_stop_schedules (bus_stop_id, day_of_week, bus_time_slot_id)
  nulls not distinct;
