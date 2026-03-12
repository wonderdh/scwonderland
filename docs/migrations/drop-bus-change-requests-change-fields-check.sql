-- ============================================
-- Migration: drop_bus_change_requests_change_fields_check
-- Date: 2026-03-12
-- ============================================
-- Business requirement change: students can now submit bus change requests
-- without specifying new_bus_time_slot_id or new_bus_number_id.
-- Admin fills those in when reviewing and approving the request.
--
-- Drops the CHECK constraint that previously required both fields to be NOT NULL
-- whenever change_type = 'change'.
-- ============================================

ALTER TABLE public.bus_change_requests
  DROP CONSTRAINT bus_change_requests_change_fields_check;
