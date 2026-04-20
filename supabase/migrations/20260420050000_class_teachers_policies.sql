-- =============================================================================
-- Migration: class_teachers_policies
-- Purpose:   Prerequisite for Phase 1 RLS rollout.
--            class_teachers had RLS ENABLED but ZERO policies, which silently
--            blocked all JWT-based reads.  Policy subqueries inside Phase 1
--            teacher policies (students_teacher_select, teachers_coworker_select)
--            evaluate under the calling user's RLS context — so without these
--            policies, any class_teachers subquery from a non-service-role caller
--            returns 0 rows and teacher access is silently empty.
--
--            This file MUST be applied before (or together with)
--            20260420000000_enable_rls_phase1_users.sql.
--
-- Note on class_teachers_coworker_select self-reference
-- ──────────────────────────────────────────────────────
-- This policy uses a subquery `SELECT 1 FROM class_teachers ct2 WHERE
-- ct2.class_id = class_teachers.class_id AND ct2.teacher_profile_id = auth.uid()`.
-- This IS self-referential on class_teachers (outer row vs. inner alias ct2).
-- Risk evaluation:
--   • In Postgres, a PERMISSIVE policy that self-references via a subquery is safe
--     when the inner scan has at least one non-recursive anchor path.  Here the
--     inner SELECT uses ct2.teacher_profile_id = auth.uid() — a direct comparison
--     that does not re-evaluate the policy predicate.  Postgres 15+ (and 17.x)
--     applies RLS once per top-level statement, so nested sub-SELECTs on the same
--     table under the same policy do NOT recurse infinitely.
--   • The class_teachers_admin_all policy (below) provides an independent grant
--     path for admins, further preventing any deadlock scenario.
--   • Staging test: run as teacher JWT, SELECT * FROM class_teachers — should
--     return only rows for the caller's classes without hanging.
--
-- Rollback SQL (run to undo this migration)
-- ─────────────────────────────────────────
-- DROP POLICY IF EXISTS "class_teachers_self_select"      ON public.class_teachers;
-- DROP POLICY IF EXISTS "class_teachers_student_select"   ON public.class_teachers;
-- DROP POLICY IF EXISTS "class_teachers_coworker_select"  ON public.class_teachers;
-- DROP POLICY IF EXISTS "class_teachers_admin_all"        ON public.class_teachers;
-- =============================================================================


-------------------------------------------------------------------------------
-- 1. Teacher reads their own class_teachers rows
--    Needed for any future createClient() path where a teacher fetches their
--    own class assignments.
-------------------------------------------------------------------------------
CREATE POLICY "class_teachers_self_select"
  ON public.class_teachers
  FOR SELECT
  TO authenticated
  USING (teacher_profile_id = auth.uid());


-------------------------------------------------------------------------------
-- 2. Student reads class_teachers rows for their own classes
--    Needed if student-facing pages ever join to teacher info via createClient().
--    Currently all such joins use createAdminClient(), but this is defence-in-depth
--    and ensures the subqueries in Phase 1 student-side policies can resolve.
-------------------------------------------------------------------------------
CREATE POLICY "class_teachers_student_select"
  ON public.class_teachers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.class_students
      WHERE class_students.class_id = class_teachers.class_id
        AND class_students.student_profile_id = auth.uid()
    )
  );


-------------------------------------------------------------------------------
-- 3. Co-teachers in the same class can read each other's class_teachers rows
--    Required for Phase 1's teachers_coworker_select policy to resolve: that
--    policy checks class_teachers ct_other / ct_self via JOIN — both of those
--    sub-SELECTs need class_teachers to be readable by the teacher JWT.
--
--    Self-reference safety: see header note above.
-------------------------------------------------------------------------------
CREATE POLICY "class_teachers_coworker_select"
  ON public.class_teachers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.class_teachers ct2
      WHERE ct2.class_id = class_teachers.class_id
        AND ct2.teacher_profile_id = auth.uid()
    )
  );


-------------------------------------------------------------------------------
-- 4. Admin: full access to class_teachers (all commands)
--    Admin manages class-teacher assignments via createAdminClient() today, but
--    adding a JWT-level policy keeps the door open for future createClient() paths
--    and avoids a silent "no rows" result if ever called with user JWT accidentally.
-------------------------------------------------------------------------------
CREATE POLICY "class_teachers_admin_all"
  ON public.class_teachers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'::user_role
        AND profiles.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'::user_role
        AND profiles.deleted_at IS NULL
    )
  );
