grant usage on schema public to anon, authenticated, service_role;

grant select on table
  public.profiles,
  public.user_roles,
  public.students,
  public.teachers,
  public.classes,
  public.class_students,
  public.class_teachers,
  public.academy_periods,
  public.class_schedules,
  public.afterschool_enrollments
to anon, authenticated;

grant all privileges on all tables in schema public to service_role;

alter default privileges in schema public
grant select on tables to anon, authenticated;

alter default privileges in schema public
grant all on tables to service_role;
