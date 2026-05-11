grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on table
  public.attendance,
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
to anon, authenticated, service_role;
