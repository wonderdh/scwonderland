


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."teacher_type_enum" AS ENUM (
    'korean',
    'native'
);


ALTER TYPE "public"."teacher_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'admin',
    'teacher',
    'student',
    'bus'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_bus_number_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
  SELECT bus_number_id FROM public.bus_staff WHERE profile_id = auth.uid();
$$;


ALTER FUNCTION "public"."current_user_bus_number_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_enrolled_class_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
  SELECT class_id FROM public.class_students WHERE student_profile_id = auth.uid();
$$;


ALTER FUNCTION "public"."current_user_enrolled_class_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_student_ids_for_teacher"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
  SELECT DISTINCT cs.student_profile_id
  FROM public.class_students cs
  WHERE cs.class_id IN (SELECT public.current_user_teaching_class_ids());
$$;


ALTER FUNCTION "public"."current_user_student_ids_for_teacher"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_teaching_class_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
  SELECT class_id FROM public.class_teachers WHERE teacher_profile_id = auth.uid();
$$;


ALTER FUNCTION "public"."current_user_teaching_class_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_profile_immutable_columns"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
BEGIN
  -- Only JWT-based roles are untrusted.  All other DB roles (service_role,
  -- postgres, supabase_admin, supabase_auth_admin, authenticator) bypass.
  IF current_user IN ('authenticated', 'anon') THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION
        'profiles.role is immutable for JWT-scoped callers (caller: %)',
        current_user;
    END IF;
    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      RAISE EXCEPTION
        'profiles.deleted_at is immutable for JWT-scoped callers (caller: %)',
        current_user;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_profile_immutable_columns"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_report_card_student_columns_fn"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
BEGIN
  -- Only restrict JWT-based roles (authenticated/anon).
  -- Service_role, postgres, supabase_admin bypass.
  IF current_user IN ('authenticated', 'anon') THEN
    IF NEW.student_profile_id IS DISTINCT FROM OLD.student_profile_id THEN
      RAISE EXCEPTION 'report_cards.student_profile_id is immutable for JWT-scoped callers';
    END IF;
    IF NEW.author_id IS DISTINCT FROM OLD.author_id THEN
      RAISE EXCEPTION 'report_cards.author_id is immutable for JWT-scoped callers';
    END IF;
    IF NEW.year IS DISTINCT FROM OLD.year THEN
      RAISE EXCEPTION 'report_cards.year is immutable for JWT-scoped callers';
    END IF;
    IF NEW.month IS DISTINCT FROM OLD.month THEN
      RAISE EXCEPTION 'report_cards.month is immutable for JWT-scoped callers';
    END IF;
    IF NEW.content IS DISTINCT FROM OLD.content THEN
      RAISE EXCEPTION 'report_cards.content may not be changed by JWT-scoped callers';
    END IF;
    IF NEW.content_ko IS DISTINCT FROM OLD.content_ko THEN
      RAISE EXCEPTION 'report_cards.content_ko may not be changed by JWT-scoped callers';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_report_card_student_columns_fn"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_student_number"() RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
DECLARE
  current_year text;
  seq_name text;
  seq_num text;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::text;
  seq_name := 'student_number_seq_' || current_year;
  IF NOT EXISTS (
    SELECT 1 FROM pg_sequences
    WHERE schemaname = 'public' AND sequencename = seq_name
  ) THEN
    EXECUTE format('CREATE SEQUENCE public.%I START 1', seq_name);
  END IF;
  EXECUTE format('SELECT LPAD(nextval(%L)::text, 3, %L)', 'public.' || seq_name, '0') INTO seq_num;
  RETURN 'S_' || current_year || seq_num;
END;
$$;


ALTER FUNCTION "public"."generate_student_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_teacher_number"() RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
DECLARE
  current_year text;
  seq_name text;
  seq_num text;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::text;
  seq_name := 'teacher_number_seq_' || current_year;
  IF NOT EXISTS (
    SELECT 1 FROM pg_sequences
    WHERE schemaname = 'public' AND sequencename = seq_name
  ) THEN
    EXECUTE format('CREATE SEQUENCE public.%I START 1', seq_name);
  END IF;
  EXECUTE format('SELECT LPAD(nextval(%L)::text, 3, %L)', 'public.' || seq_name, '0') INTO seq_num;
  RETURN 'T_' || current_year || seq_num;
END;
$$;


ALTER FUNCTION "public"."generate_teacher_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_class_report_status"("p_year" integer, "p_month" integer) RETURNS TABLE("class_id" "uuid", "class_name" "text", "total_students" bigint, "written_count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
  SELECT
    c.id AS class_id,
    c.name AS class_name,
    COUNT(DISTINCT cs.student_profile_id) AS total_students,
    COUNT(DISTINCT rc.student_profile_id) FILTER (
      WHERE rc.year = p_year
        AND rc.month = p_month
        AND rc.content IS NOT NULL
        AND rc.content != ''
    ) AS written_count
  FROM classes c
  LEFT JOIN class_students cs ON cs.class_id = c.id
  LEFT JOIN report_cards rc ON rc.student_profile_id = cs.student_profile_id
  GROUP BY c.id, c.name
  ORDER BY c.name;
$$;


ALTER FUNCTION "public"."get_class_report_status"("p_year" integer, "p_month" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_attendance_bus_sync"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
DECLARE
  v_day integer;
  v_absent_reason text := '출결 결석 자동 등록';
BEGIN
  v_day := EXTRACT(DOW FROM NEW.attendance_date::date);
  IF v_day = 0 OR v_day = 6 THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'absent' THEN
    INSERT INTO bus_change_requests (
      student_profile_id, request_date,
      change_type, status, reason,
      new_bus_time_slot_id, new_bus_number_id, new_bus_stop_id
    )
    VALUES
      (NEW.student_profile_id, NEW.attendance_date,
       'absent', 'approved', v_absent_reason, null, null, null)
    ON CONFLICT (student_profile_id, request_date)
    DO UPDATE SET
      change_type = 'absent',
      status = 'approved',
      reason = v_absent_reason,
      new_bus_time_slot_id = null,
      new_bus_number_id = null,
      new_bus_stop_id = null;

  ELSE
    DELETE FROM bus_change_requests
    WHERE student_profile_id = NEW.student_profile_id
      AND request_date = NEW.attendance_date
      AND change_type = 'absent'
      AND reason = v_absent_reason;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'bus sync failed for attendance (%,%): %',
    NEW.student_profile_id, NEW.attendance_date, SQLERRM;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_attendance_bus_sync"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_deleted_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  DELETE FROM public.profiles WHERE id = old.id;
  RETURN old;
END;
$$;


ALTER FUNCTION "public"."handle_deleted_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_role text;
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, role)
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    CASE
      WHEN new.raw_user_meta_data ->> 'role' IN ('admin', 'teacher', 'student', 'bus')
      THEN (new.raw_user_meta_data ->> 'role')::public.user_role
      ELSE NULL
    END
  );

  v_role := new.raw_user_meta_data ->> 'role';

  IF v_role = 'student' THEN
    PERFORM public.insert_student_from_profile(new.id, new.raw_user_meta_data);
  END IF;

  IF v_role = 'teacher' THEN
    PERFORM public.insert_teacher_from_profile(new.id, new.raw_user_meta_data);
  END IF;

  IF v_role = 'bus' THEN
    PERFORM public.insert_bus_staff_from_profile(new.id, new.raw_user_meta_data);
  END IF;

  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_bus_staff_from_profile"("p_profile_id" "uuid", "p_meta" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  INSERT INTO public.bus_staff (profile_id, name)
  VALUES (
    p_profile_id,
    coalesce(
      nullif(trim(p_meta ->> 'name'), ''),
      nullif(trim(p_meta ->> 'first_name'), ''),
      '이름 미정'
    )
  );
END;
$$;


ALTER FUNCTION "public"."insert_bus_staff_from_profile"("p_profile_id" "uuid", "p_meta" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_student_from_profile"("p_profile_id" "uuid", "p_meta" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  INSERT INTO public.students (profile_id, korean_name, english_name)
  VALUES (
    p_profile_id,
    coalesce(
      nullif(trim(p_meta ->> 'korean_name'), ''),
      nullif(trim(p_meta ->> 'first_name'), ''),
      '이름 미정'
    ),
    nullif(trim(p_meta ->> 'english_name'), '')
  );
END;
$$;


ALTER FUNCTION "public"."insert_student_from_profile"("p_profile_id" "uuid", "p_meta" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_teacher_from_profile"("p_profile_id" "uuid", "p_meta" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  INSERT INTO public.teachers (profile_id, name)
  VALUES (
    p_profile_id,
    coalesce(
      nullif(trim(p_meta ->> 'name'), ''),
      nullif(trim(p_meta ->> 'korean_name'), ''),
      nullif(trim(
        coalesce(p_meta ->> 'first_name', '') || ' ' || coalesce(p_meta ->> 'last_name', '')
      ), ''),
      '이름 미정'
    )
  );
END;
$$;


ALTER FUNCTION "public"."insert_teacher_from_profile"("p_profile_id" "uuid", "p_meta" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_current_user_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'::user_role AND deleted_at IS NULL
  );
$$;


ALTER FUNCTION "public"."is_current_user_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_current_user_bus_staff"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bus_staff WHERE profile_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_current_user_bus_staff"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_current_user_native_teacher"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teachers t
    JOIN public.profiles p ON p.id = t.profile_id
    WHERE t.profile_id = auth.uid()
      AND t.teacher_type = 'native'::teacher_type_enum
      AND p.deleted_at IS NULL
  );
$$;


ALTER FUNCTION "public"."is_current_user_native_teacher"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_current_user_teacher"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'teacher'::user_role AND deleted_at IS NULL
  );
$$;


ALTER FUNCTION "public"."is_current_user_teacher"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_classes_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_classes_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_report_cards_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_report_cards_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_student_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
BEGIN
  IF NEW.student_number IS NULL THEN
    NEW.student_number := public.generate_student_number();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_student_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_teacher_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
BEGIN
  IF NEW.teacher_number IS NULL THEN
    NEW.teacher_number := public.generate_teacher_number();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_teacher_number"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."academy_notice_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "academy_notice_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "original_filename" "text" NOT NULL,
    "mime_type" "text" NOT NULL,
    "file_size" bigint NOT NULL,
    "file_type" "text" DEFAULT 'attachment'::"text" NOT NULL,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."academy_notice_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."academy_notices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "content" "text",
    "excerpt" "text",
    "author_id" "uuid",
    "is_published" boolean DEFAULT true,
    "is_pinned" boolean DEFAULT false,
    "published_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."academy_notices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."academy_periods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "has_dropoff" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "group_label" "text",
    CONSTRAINT "chk_group_label" CHECK (("group_label" = ANY (ARRAY['유치부'::"text", '방과후'::"text", '오후반'::"text"])))
);


ALTER TABLE "public"."academy_periods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."afterschool_enrollments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "class_id" "uuid" NOT NULL,
    "student_profile_id" "uuid" NOT NULL,
    "day_of_week" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "second_period" boolean DEFAULT false NOT NULL,
    CONSTRAINT "afterschool_enrollments_day_of_week_check" CHECK ((("day_of_week" >= 1) AND ("day_of_week" <= 5)))
);


ALTER TABLE "public"."afterschool_enrollments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_profile_id" "uuid" NOT NULL,
    "attendance_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "status" "text" DEFAULT 'present'::"text" NOT NULL,
    "note" "text",
    "recorded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "attendance_status_check" CHECK (("status" = ANY (ARRAY['present'::"text", 'absent'::"text", 'late'::"text", 'early_leave'::"text"])))
);


ALTER TABLE "public"."attendance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bus_change_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_profile_id" "uuid" NOT NULL,
    "request_date" "date" NOT NULL,
    "change_type" "text" NOT NULL,
    "new_bus_number_id" "uuid",
    "reason" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "review_note" "text",
    "requested_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "new_bus_time_slot_id" "uuid",
    "new_bus_stop_id" "uuid",
    CONSTRAINT "bus_change_requests_change_type_check" CHECK (("change_type" = ANY (ARRAY['change'::"text", 'no_ride'::"text", 'absent'::"text"]))),
    CONSTRAINT "bus_change_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);

ALTER TABLE ONLY "public"."bus_change_requests" REPLICA IDENTITY FULL;


ALTER TABLE "public"."bus_change_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bus_check_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_profile_id" "uuid" NOT NULL,
    "check_date" "date" NOT NULL,
    "bus_time_slot_id" "uuid" NOT NULL,
    "bus_number_id" "uuid" NOT NULL,
    "checked_at" timestamp with time zone,
    "checked_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "boarded_at" timestamp with time zone
);

ALTER TABLE ONLY "public"."bus_check_records" REPLICA IDENTITY FULL;


ALTER TABLE "public"."bus_check_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bus_numbers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "label" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bus_numbers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bus_staff" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "bus_number_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bus_staff" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bus_stop_day_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bus_stop_id" "uuid" NOT NULL,
    "bus_number_id" "uuid" NOT NULL,
    "day_of_week" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "sort_order" integer DEFAULT 0 NOT NULL,
    "bus_time_slot_id" "uuid",
    CONSTRAINT "bus_stop_day_assignments_day_of_week_check" CHECK ((("day_of_week" >= 1) AND ("day_of_week" <= 5)))
);


ALTER TABLE "public"."bus_stop_day_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bus_stop_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bus_stop_id" "uuid" NOT NULL,
    "day_of_week" integer NOT NULL,
    "estimated_time" time without time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "bus_time_slot_id" "uuid",
    CONSTRAINT "bus_stop_schedules_day_of_week_check" CHECK ((("day_of_week" >= 1) AND ("day_of_week" <= 5)))
);


ALTER TABLE "public"."bus_stop_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bus_stops" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bus_stops" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bus_time_slots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "label" "text" NOT NULL,
    "time" time without time zone NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "show_empty_stops" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."bus_time_slots" OWNER TO "postgres";


COMMENT ON COLUMN "public"."bus_time_slots"."show_empty_stops" IS '하원 버스 모니터에서 학생 없는 정류장도 이름을 노출할지 여부. 기본 false, 오후반 등 특정 시간대만 관리자에서 체크.';



CREATE TABLE IF NOT EXISTS "public"."class_notice_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "class_notice_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "original_filename" "text" NOT NULL,
    "mime_type" "text" NOT NULL,
    "file_size" bigint NOT NULL,
    "file_type" "text" DEFAULT 'attachment'::"text" NOT NULL,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."class_notice_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."class_notices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "class_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text",
    "is_pinned" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."class_notices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."class_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "class_id" "uuid",
    "academy_period_id" "uuid" NOT NULL,
    "day_of_week" integer NOT NULL,
    "teacher_profile_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "label" "text",
    "textbook_id" "uuid",
    "student_profile_id" "uuid",
    CONSTRAINT "chk_class_or_student" CHECK (((("class_id" IS NOT NULL) AND ("student_profile_id" IS NULL)) OR (("class_id" IS NULL) AND ("student_profile_id" IS NOT NULL)))),
    CONSTRAINT "class_schedules_day_of_week_check" CHECK ((("day_of_week" >= 1) AND ("day_of_week" <= 5)))
);


ALTER TABLE "public"."class_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."class_students" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "class_id" "uuid" NOT NULL,
    "student_profile_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."class_students" OWNER TO "postgres";


COMMENT ON TABLE "public"."class_students" IS '반에 소속된 학생. 한 학생이 여러 반 소속 가능.';



CREATE TABLE IF NOT EXISTS "public"."class_teachers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "class_id" "uuid" NOT NULL,
    "teacher_profile_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."class_teachers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."class_textbooks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "class_id" "uuid" NOT NULL,
    "textbook_id" "uuid" NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."class_textbooks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."classes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "group_label" "text",
    "color_index" integer,
    "english_name" "text",
    "lunch_group" "text",
    CONSTRAINT "classes_group_label_check" CHECK (("group_label" = ANY (ARRAY['유치부'::"text", '방과후'::"text", '오후반'::"text"]))),
    CONSTRAINT "classes_lunch_group_check" CHECK ((("lunch_group" IS NULL) OR ("lunch_group" = ANY (ARRAY['7세'::"text", '6세'::"text"]))))
);


ALTER TABLE "public"."classes" OWNER TO "postgres";


COMMENT ON TABLE "public"."classes" IS '반. 담당 선생은 0명 또는 1명.';



CREATE TABLE IF NOT EXISTS "public"."homework_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "class_id" "uuid" NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "due_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."homework_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."homework_submission_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "submission_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "original_filename" "text" NOT NULL,
    "mime_type" "text" NOT NULL,
    "file_size" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."homework_submission_files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."homework_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "assignment_id" "uuid" NOT NULL,
    "student_profile_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "text_content" "text",
    "submitted_at" timestamp with time zone,
    "teacher_feedback" "text",
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "homework_submissions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'submitted'::"text", 'reviewed'::"text"])))
);


ALTER TABLE "public"."homework_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."learning_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_profile_id" "uuid" NOT NULL,
    "record_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "category" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text",
    "score" numeric,
    "max_score" numeric,
    "author_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "learning_records_category_check" CHECK (("category" = ANY (ARRAY['test'::"text", 'assessment'::"text", 'note'::"text", 'level_change'::"text"])))
);


ALTER TABLE "public"."learning_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lunch_class_order_anchors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "effective_from" "date" NOT NULL,
    "lunch_group" "text" NOT NULL,
    "first_class_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lunch_class_order_anchors_lunch_group_check" CHECK (("lunch_group" = ANY (ARRAY['7세'::"text", '6세'::"text"])))
);


ALTER TABLE "public"."lunch_class_order_anchors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lunch_leader_anchors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "effective_from" "date" NOT NULL,
    "class_id" "uuid" NOT NULL,
    "leader_student_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lunch_leader_anchors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notice_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "notice_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "original_filename" "text" NOT NULL,
    "mime_type" "text" NOT NULL,
    "file_size" bigint NOT NULL,
    "file_type" "text" NOT NULL,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "notice_attachments_file_type_check" CHECK (("file_type" = ANY (ARRAY['image'::"text", 'attachment'::"text"])))
);


ALTER TABLE "public"."notice_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "content" "text",
    "excerpt" "text",
    "author_id" "uuid",
    "is_published" boolean DEFAULT true,
    "is_pinned" boolean DEFAULT false,
    "published_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "role" "public"."user_role",
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."report_cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_profile_id" "uuid" NOT NULL,
    "year" smallint NOT NULL,
    "month" smallint NOT NULL,
    "author_id" "uuid",
    "content" "text",
    "reply" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "content_ko" "text",
    "reply_en" "text",
    CONSTRAINT "report_cards_month_check" CHECK ((("month" >= 1) AND ("month" <= 12))),
    CONSTRAINT "report_cards_year_check" CHECK ((("year" >= 2000) AND ("year" <= 2100)))
);


ALTER TABLE "public"."report_cards" OWNER TO "postgres";


COMMENT ON COLUMN "public"."report_cards"."student_profile_id" IS '학생의 profile id (선택 시 사용하는 id와 동일)';



COMMENT ON COLUMN "public"."report_cards"."author_id" IS '리포트 작성자 (선생 또는 admin)';



COMMENT ON COLUMN "public"."report_cards"."content" IS '리포트 본문';



COMMENT ON COLUMN "public"."report_cards"."reply" IS '학생이 다는 답글';



CREATE TABLE IF NOT EXISTS "public"."student_bus_defaults" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_profile_id" "uuid" NOT NULL,
    "day_of_week" integer NOT NULL,
    "estimated_time" time without time zone,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "bus_time_slot_id" "uuid" NOT NULL,
    "bus_stop_id" "uuid",
    CONSTRAINT "student_bus_defaults_day_of_week_check" CHECK ((("day_of_week" >= 1) AND ("day_of_week" <= 5)))
);


ALTER TABLE "public"."student_bus_defaults" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."student_number_seq_2026"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."student_number_seq_2026" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_textbook_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_profile_id" "uuid" NOT NULL,
    "textbook_id" "uuid" NOT NULL,
    "source_type" "text" NOT NULL,
    "source_class_id" "uuid",
    "status" "text" DEFAULT 'not_started'::"text" NOT NULL,
    "completed_units" integer DEFAULT 0 NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "assigned_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "student_textbook_progress_source_type_check" CHECK (("source_type" = ANY (ARRAY['class'::"text", 'individual'::"text"]))),
    CONSTRAINT "student_textbook_progress_status_check" CHECK (("status" = ANY (ARRAY['not_started'::"text", 'in_progress'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."student_textbook_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."students" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "korean_name" "text" NOT NULL,
    "english_name" "text",
    "student_number" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "age" integer,
    "group_type" "text"
);


ALTER TABLE "public"."students" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."teacher_number_seq_2026"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."teacher_number_seq_2026" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teachers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "teacher_number" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "teacher_type" "public"."teacher_type_enum" DEFAULT 'korean'::"public"."teacher_type_enum" NOT NULL,
    "is_bus_supervisor" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."teachers" OWNER TO "postgres";


COMMENT ON COLUMN "public"."teachers"."teacher_type" IS '한국인(korean) 또는 원어민(native) 교사';



CREATE TABLE IF NOT EXISTS "public"."textbooks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "series" "text",
    "level" "text",
    "category" "text" DEFAULT 'general'::"text" NOT NULL,
    "total_units" integer DEFAULT 1 NOT NULL,
    "cover_image" "text",
    "description" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."textbooks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."weekly_sentence_config" (
    "id" smallint DEFAULT 1 NOT NULL,
    "mode" "text" DEFAULT 'auto'::"text" NOT NULL,
    "manual_week" smallint,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "auto_base_week" smallint DEFAULT 1,
    "auto_base_sunday" "date" DEFAULT '2026-04-12'::"date",
    CONSTRAINT "weekly_sentence_config_id_check" CHECK (("id" = 1)),
    CONSTRAINT "weekly_sentence_config_manual_week_check" CHECK ((("manual_week" IS NULL) OR (("manual_week" >= 1) AND ("manual_week" <= 52)))),
    CONSTRAINT "weekly_sentence_config_mode_check" CHECK (("mode" = ANY (ARRAY['auto'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."weekly_sentence_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."weekly_sentences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "week_number" smallint NOT NULL,
    "level" smallint NOT NULL,
    "english" "text" NOT NULL,
    "korean" "text",
    "example" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "answer" "text",
    CONSTRAINT "weekly_sentences_level_check" CHECK ((("level" >= 1) AND ("level" <= 3))),
    CONSTRAINT "weekly_sentences_week_number_check" CHECK ((("week_number" >= 1) AND ("week_number" <= 48)))
);


ALTER TABLE "public"."weekly_sentences" OWNER TO "postgres";


ALTER TABLE ONLY "public"."academy_notice_attachments"
    ADD CONSTRAINT "academy_notice_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."academy_notices"
    ADD CONSTRAINT "academy_notices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."academy_periods"
    ADD CONSTRAINT "academy_periods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."afterschool_enrollments"
    ADD CONSTRAINT "afterschool_enrollments_class_id_student_profile_id_day_of__key" UNIQUE ("class_id", "student_profile_id", "day_of_week");



ALTER TABLE ONLY "public"."afterschool_enrollments"
    ADD CONSTRAINT "afterschool_enrollments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_student_profile_id_date_key" UNIQUE ("student_profile_id", "attendance_date");



ALTER TABLE ONLY "public"."bus_change_requests"
    ADD CONSTRAINT "bus_change_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bus_change_requests"
    ADD CONSTRAINT "bus_change_requests_student_date_key" UNIQUE ("student_profile_id", "request_date");



ALTER TABLE ONLY "public"."bus_check_records"
    ADD CONSTRAINT "bus_check_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bus_check_records"
    ADD CONSTRAINT "bus_check_records_student_date_key" UNIQUE ("student_profile_id", "check_date");



ALTER TABLE ONLY "public"."bus_numbers"
    ADD CONSTRAINT "bus_numbers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bus_staff"
    ADD CONSTRAINT "bus_staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bus_staff"
    ADD CONSTRAINT "bus_staff_profile_id_key" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."bus_stop_day_assignments"
    ADD CONSTRAINT "bus_stop_day_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bus_stop_schedules"
    ADD CONSTRAINT "bus_stop_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bus_stop_schedules"
    ADD CONSTRAINT "bus_stop_schedules_stop_day_slot_key" UNIQUE ("bus_stop_id", "day_of_week", "bus_time_slot_id");



ALTER TABLE ONLY "public"."bus_stops"
    ADD CONSTRAINT "bus_stops_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bus_time_slots"
    ADD CONSTRAINT "bus_time_slots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."class_notice_attachments"
    ADD CONSTRAINT "class_notice_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."class_notices"
    ADD CONSTRAINT "class_notices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."class_schedules"
    ADD CONSTRAINT "class_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."class_students"
    ADD CONSTRAINT "class_students_class_id_student_profile_id_key" UNIQUE ("class_id", "student_profile_id");



ALTER TABLE ONLY "public"."class_students"
    ADD CONSTRAINT "class_students_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."class_teachers"
    ADD CONSTRAINT "class_teachers_class_id_teacher_profile_id_key" UNIQUE ("class_id", "teacher_profile_id");



ALTER TABLE ONLY "public"."class_teachers"
    ADD CONSTRAINT "class_teachers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."class_textbooks"
    ADD CONSTRAINT "class_textbooks_class_id_textbook_id_key" UNIQUE ("class_id", "textbook_id");



ALTER TABLE ONLY "public"."class_textbooks"
    ADD CONSTRAINT "class_textbooks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."homework_assignments"
    ADD CONSTRAINT "homework_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."homework_submission_files"
    ADD CONSTRAINT "homework_submission_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."homework_submissions"
    ADD CONSTRAINT "homework_submissions_assignment_id_student_profile_id_key" UNIQUE ("assignment_id", "student_profile_id");



ALTER TABLE ONLY "public"."homework_submissions"
    ADD CONSTRAINT "homework_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."learning_records"
    ADD CONSTRAINT "learning_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lunch_class_order_anchors"
    ADD CONSTRAINT "lunch_class_order_anchors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lunch_class_order_anchors"
    ADD CONSTRAINT "lunch_class_order_anchors_unique" UNIQUE ("effective_from", "lunch_group");



ALTER TABLE ONLY "public"."lunch_leader_anchors"
    ADD CONSTRAINT "lunch_leader_anchors_unique" UNIQUE ("effective_from", "class_id");



ALTER TABLE ONLY "public"."lunch_leader_anchors"
    ADD CONSTRAINT "lunch_leader_overrides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notice_attachments"
    ADD CONSTRAINT "notice_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notices"
    ADD CONSTRAINT "notices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."report_cards"
    ADD CONSTRAINT "report_cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."report_cards"
    ADD CONSTRAINT "report_cards_student_profile_id_year_month_key" UNIQUE ("student_profile_id", "year", "month");



ALTER TABLE ONLY "public"."student_bus_defaults"
    ADD CONSTRAINT "student_bus_defaults_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_bus_defaults"
    ADD CONSTRAINT "student_bus_defaults_student_day_key" UNIQUE ("student_profile_id", "day_of_week");



ALTER TABLE ONLY "public"."student_textbook_progress"
    ADD CONSTRAINT "student_textbook_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_textbook_progress"
    ADD CONSTRAINT "student_textbook_progress_student_profile_id_textbook_id_so_key" UNIQUE ("student_profile_id", "textbook_id", "source_class_id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_profile_id_key" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_student_number_key" UNIQUE ("student_number");



ALTER TABLE ONLY "public"."teachers"
    ADD CONSTRAINT "teachers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teachers"
    ADD CONSTRAINT "teachers_profile_id_key" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."teachers"
    ADD CONSTRAINT "teachers_teacher_number_key" UNIQUE ("teacher_number");



ALTER TABLE ONLY "public"."textbooks"
    ADD CONSTRAINT "textbooks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_sentence_config"
    ADD CONSTRAINT "weekly_sentence_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_sentences"
    ADD CONSTRAINT "weekly_sentences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_sentences"
    ADD CONSTRAINT "weekly_sentences_week_number_level_key" UNIQUE ("week_number", "level");



CREATE INDEX "idx_academy_notice_attachments_notice" ON "public"."academy_notice_attachments" USING "btree" ("academy_notice_id");



CREATE INDEX "idx_academy_notices_published" ON "public"."academy_notices" USING "btree" ("is_published", "is_pinned" DESC, "published_at" DESC);



CREATE INDEX "idx_attendance_student" ON "public"."attendance" USING "btree" ("student_profile_id", "attendance_date" DESC);



CREATE INDEX "idx_bcr_pending" ON "public"."bus_change_requests" USING "btree" ("status") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_bcr_student" ON "public"."bus_change_requests" USING "btree" ("student_profile_id");



CREATE INDEX "idx_bus_stop_schedules_stop" ON "public"."bus_stop_schedules" USING "btree" ("bus_stop_id");



CREATE INDEX "idx_class_notice_attachments_notice" ON "public"."class_notice_attachments" USING "btree" ("class_notice_id");



CREATE INDEX "idx_class_notices_class" ON "public"."class_notices" USING "btree" ("class_id", "created_at" DESC);



CREATE INDEX "idx_class_schedules_grid" ON "public"."class_schedules" USING "btree" ("class_id", "academy_period_id", "day_of_week");



CREATE INDEX "idx_class_schedules_student" ON "public"."class_schedules" USING "btree" ("student_profile_id") WHERE ("student_profile_id" IS NOT NULL);



CREATE INDEX "idx_class_students_class_id" ON "public"."class_students" USING "btree" ("class_id");



CREATE INDEX "idx_class_students_student" ON "public"."class_students" USING "btree" ("student_profile_id", "class_id");



CREATE INDEX "idx_class_students_student_profile_id" ON "public"."class_students" USING "btree" ("student_profile_id");



CREATE INDEX "idx_class_teachers_class" ON "public"."class_teachers" USING "btree" ("class_id");



CREATE INDEX "idx_class_teachers_teacher" ON "public"."class_teachers" USING "btree" ("teacher_profile_id");



CREATE INDEX "idx_class_textbooks_class" ON "public"."class_textbooks" USING "btree" ("class_id");



CREATE INDEX "idx_class_textbooks_textbook" ON "public"."class_textbooks" USING "btree" ("textbook_id");



CREATE INDEX "idx_cs_class" ON "public"."class_schedules" USING "btree" ("class_id");



CREATE INDEX "idx_cs_day" ON "public"."class_schedules" USING "btree" ("day_of_week");



CREATE INDEX "idx_cs_period" ON "public"."class_schedules" USING "btree" ("academy_period_id");



CREATE INDEX "idx_cs_teacher" ON "public"."class_schedules" USING "btree" ("teacher_profile_id");



CREATE INDEX "idx_homework_assignments_class" ON "public"."homework_assignments" USING "btree" ("class_id", "due_date" DESC);



CREATE INDEX "idx_homework_assignments_teacher" ON "public"."homework_assignments" USING "btree" ("teacher_id");



CREATE INDEX "idx_homework_submission_files" ON "public"."homework_submission_files" USING "btree" ("submission_id");



CREATE INDEX "idx_homework_submissions_assignment" ON "public"."homework_submissions" USING "btree" ("assignment_id");



CREATE INDEX "idx_homework_submissions_student" ON "public"."homework_submissions" USING "btree" ("student_profile_id", "status");



CREATE INDEX "idx_learning_records_student_date" ON "public"."learning_records" USING "btree" ("student_profile_id", "record_date" DESC);



CREATE INDEX "idx_notice_attachments_notice" ON "public"."notice_attachments" USING "btree" ("notice_id", "file_type", "sort_order");



CREATE INDEX "idx_notices_published" ON "public"."notices" USING "btree" ("is_published", "is_pinned" DESC, "published_at" DESC);



CREATE INDEX "idx_report_cards_student_profile_id" ON "public"."report_cards" USING "btree" ("student_profile_id");



CREATE INDEX "idx_report_cards_year_month" ON "public"."report_cards" USING "btree" ("year", "month");



CREATE INDEX "idx_sbd_student" ON "public"."student_bus_defaults" USING "btree" ("student_profile_id");



CREATE INDEX "idx_stop_schedules_stop_day" ON "public"."bus_stop_schedules" USING "btree" ("bus_stop_id", "day_of_week");



CREATE INDEX "idx_stp_source_class" ON "public"."student_textbook_progress" USING "btree" ("source_class_id");



CREATE INDEX "idx_stp_student" ON "public"."student_textbook_progress" USING "btree" ("student_profile_id");



CREATE INDEX "idx_stp_textbook" ON "public"."student_textbook_progress" USING "btree" ("textbook_id");



CREATE INDEX "idx_students_number" ON "public"."students" USING "btree" ("student_number");



CREATE INDEX "idx_students_profile_id" ON "public"."students" USING "btree" ("profile_id");



CREATE INDEX "idx_teachers_number" ON "public"."teachers" USING "btree" ("teacher_number");



CREATE INDEX "idx_teachers_profile_id" ON "public"."teachers" USING "btree" ("profile_id");



CREATE INDEX "ix_afterschool_enrollments_class" ON "public"."afterschool_enrollments" USING "btree" ("class_id");



CREATE INDEX "ix_afterschool_enrollments_student" ON "public"."afterschool_enrollments" USING "btree" ("student_profile_id");



CREATE INDEX "lunch_class_order_anchors_date_idx" ON "public"."lunch_class_order_anchors" USING "btree" ("effective_from");



CREATE INDEX "lunch_leader_anchors_date_idx" ON "public"."lunch_leader_anchors" USING "btree" ("effective_from");



CREATE UNIQUE INDEX "uq_bus_numbers_label" ON "public"."bus_numbers" USING "btree" ("label") WHERE ("is_active" = true);



CREATE UNIQUE INDEX "ux_student_schedule_slot" ON "public"."class_schedules" USING "btree" ("student_profile_id", "academy_period_id", "day_of_week") WHERE ("class_id" IS NULL);



CREATE INDEX "weekly_sentences_week_idx" ON "public"."weekly_sentences" USING "btree" ("week_number");



CREATE OR REPLACE TRIGGER "after_attendance_bus_sync" AFTER INSERT OR UPDATE OF "status" ON "public"."attendance" FOR EACH ROW EXECUTE FUNCTION "public"."handle_attendance_bus_sync"();



CREATE OR REPLACE TRIGGER "enforce_profile_immutable_columns_trigger" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_profile_immutable_columns"();



CREATE OR REPLACE TRIGGER "enforce_report_card_student_columns" BEFORE UPDATE ON "public"."report_cards" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_report_card_student_columns_fn"();



CREATE OR REPLACE TRIGGER "trigger_classes_updated_at" BEFORE UPDATE ON "public"."classes" FOR EACH ROW EXECUTE FUNCTION "public"."set_classes_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_report_cards_updated_at" BEFORE UPDATE ON "public"."report_cards" FOR EACH ROW EXECUTE FUNCTION "public"."set_report_cards_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_set_student_number" BEFORE INSERT ON "public"."students" FOR EACH ROW EXECUTE FUNCTION "public"."set_student_number"();



CREATE OR REPLACE TRIGGER "trigger_set_teacher_number" BEFORE INSERT ON "public"."teachers" FOR EACH ROW EXECUTE FUNCTION "public"."set_teacher_number"();



ALTER TABLE ONLY "public"."academy_notice_attachments"
    ADD CONSTRAINT "academy_notice_attachments_academy_notice_id_fkey" FOREIGN KEY ("academy_notice_id") REFERENCES "public"."academy_notices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."academy_notices"
    ADD CONSTRAINT "academy_notices_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."afterschool_enrollments"
    ADD CONSTRAINT "afterschool_enrollments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."afterschool_enrollments"
    ADD CONSTRAINT "afterschool_enrollments_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bus_change_requests"
    ADD CONSTRAINT "bus_change_requests_new_bus_number_id_fkey" FOREIGN KEY ("new_bus_number_id") REFERENCES "public"."bus_numbers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."bus_change_requests"
    ADD CONSTRAINT "bus_change_requests_new_bus_stop_id_fkey" FOREIGN KEY ("new_bus_stop_id") REFERENCES "public"."bus_stops"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bus_change_requests"
    ADD CONSTRAINT "bus_change_requests_new_bus_time_slot_id_fkey" FOREIGN KEY ("new_bus_time_slot_id") REFERENCES "public"."bus_time_slots"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."bus_change_requests"
    ADD CONSTRAINT "bus_change_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bus_change_requests"
    ADD CONSTRAINT "bus_change_requests_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bus_check_records"
    ADD CONSTRAINT "bus_check_records_bus_number_id_fkey" FOREIGN KEY ("bus_number_id") REFERENCES "public"."bus_numbers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."bus_check_records"
    ADD CONSTRAINT "bus_check_records_bus_time_slot_id_fkey" FOREIGN KEY ("bus_time_slot_id") REFERENCES "public"."bus_time_slots"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."bus_check_records"
    ADD CONSTRAINT "bus_check_records_checked_by_fkey" FOREIGN KEY ("checked_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."bus_check_records"
    ADD CONSTRAINT "bus_check_records_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bus_staff"
    ADD CONSTRAINT "bus_staff_bus_number_id_fkey" FOREIGN KEY ("bus_number_id") REFERENCES "public"."bus_numbers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bus_staff"
    ADD CONSTRAINT "bus_staff_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bus_stop_day_assignments"
    ADD CONSTRAINT "bus_stop_day_assignments_bus_number_id_fkey" FOREIGN KEY ("bus_number_id") REFERENCES "public"."bus_numbers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bus_stop_day_assignments"
    ADD CONSTRAINT "bus_stop_day_assignments_bus_stop_id_fkey" FOREIGN KEY ("bus_stop_id") REFERENCES "public"."bus_stops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bus_stop_day_assignments"
    ADD CONSTRAINT "bus_stop_day_assignments_bus_time_slot_id_fkey" FOREIGN KEY ("bus_time_slot_id") REFERENCES "public"."bus_time_slots"("id");



ALTER TABLE ONLY "public"."bus_stop_schedules"
    ADD CONSTRAINT "bus_stop_schedules_bus_stop_id_fkey" FOREIGN KEY ("bus_stop_id") REFERENCES "public"."bus_stops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bus_stop_schedules"
    ADD CONSTRAINT "bus_stop_schedules_bus_time_slot_id_fkey" FOREIGN KEY ("bus_time_slot_id") REFERENCES "public"."bus_time_slots"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_notice_attachments"
    ADD CONSTRAINT "class_notice_attachments_class_notice_id_fkey" FOREIGN KEY ("class_notice_id") REFERENCES "public"."class_notices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_notices"
    ADD CONSTRAINT "class_notices_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_notices"
    ADD CONSTRAINT "class_notices_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_schedules"
    ADD CONSTRAINT "class_schedules_academy_period_id_fkey" FOREIGN KEY ("academy_period_id") REFERENCES "public"."academy_periods"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."class_schedules"
    ADD CONSTRAINT "class_schedules_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_schedules"
    ADD CONSTRAINT "class_schedules_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_schedules"
    ADD CONSTRAINT "class_schedules_teacher_profile_id_fkey" FOREIGN KEY ("teacher_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_schedules"
    ADD CONSTRAINT "class_schedules_textbook_id_fkey" FOREIGN KEY ("textbook_id") REFERENCES "public"."textbooks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."class_students"
    ADD CONSTRAINT "class_students_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_students"
    ADD CONSTRAINT "class_students_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_teachers"
    ADD CONSTRAINT "class_teachers_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_teachers"
    ADD CONSTRAINT "class_teachers_teacher_profile_id_fkey" FOREIGN KEY ("teacher_profile_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_textbooks"
    ADD CONSTRAINT "class_textbooks_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_textbooks"
    ADD CONSTRAINT "class_textbooks_textbook_id_fkey" FOREIGN KEY ("textbook_id") REFERENCES "public"."textbooks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."homework_assignments"
    ADD CONSTRAINT "homework_assignments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."homework_assignments"
    ADD CONSTRAINT "homework_assignments_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."homework_submission_files"
    ADD CONSTRAINT "homework_submission_files_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."homework_submissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."homework_submissions"
    ADD CONSTRAINT "homework_submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."homework_assignments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."homework_submissions"
    ADD CONSTRAINT "homework_submissions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."homework_submissions"
    ADD CONSTRAINT "homework_submissions_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."learning_records"
    ADD CONSTRAINT "learning_records_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."learning_records"
    ADD CONSTRAINT "learning_records_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lunch_class_order_anchors"
    ADD CONSTRAINT "lunch_class_order_anchors_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lunch_class_order_anchors"
    ADD CONSTRAINT "lunch_class_order_anchors_first_class_id_fkey" FOREIGN KEY ("first_class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lunch_leader_anchors"
    ADD CONSTRAINT "lunch_leader_overrides_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lunch_leader_anchors"
    ADD CONSTRAINT "lunch_leader_overrides_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lunch_leader_anchors"
    ADD CONSTRAINT "lunch_leader_overrides_leader_student_id_fkey" FOREIGN KEY ("leader_student_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notice_attachments"
    ADD CONSTRAINT "notice_attachments_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "public"."notices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notices"
    ADD CONSTRAINT "notices_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_cards"
    ADD CONSTRAINT "report_cards_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."report_cards"
    ADD CONSTRAINT "report_cards_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_bus_defaults"
    ADD CONSTRAINT "student_bus_defaults_bus_stop_id_fkey" FOREIGN KEY ("bus_stop_id") REFERENCES "public"."bus_stops"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."student_bus_defaults"
    ADD CONSTRAINT "student_bus_defaults_bus_time_slot_id_fkey" FOREIGN KEY ("bus_time_slot_id") REFERENCES "public"."bus_time_slots"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."student_bus_defaults"
    ADD CONSTRAINT "student_bus_defaults_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_textbook_progress"
    ADD CONSTRAINT "student_textbook_progress_source_class_id_fkey" FOREIGN KEY ("source_class_id") REFERENCES "public"."classes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."student_textbook_progress"
    ADD CONSTRAINT "student_textbook_progress_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_textbook_progress"
    ADD CONSTRAINT "student_textbook_progress_textbook_id_fkey" FOREIGN KEY ("textbook_id") REFERENCES "public"."textbooks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teachers"
    ADD CONSTRAINT "teachers_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE "public"."academy_notice_attachments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "academy_notice_attachments_admin_all" ON "public"."academy_notice_attachments" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."user_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "academy_notice_attachments_read" ON "public"."academy_notice_attachments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."academy_notices" "an"
  WHERE (("an"."id" = "academy_notice_attachments"."academy_notice_id") AND ("an"."is_published" = true)))));



ALTER TABLE "public"."academy_notices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "academy_notices_admin_all" ON "public"."academy_notices" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."user_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "academy_notices_authenticated_read" ON "public"."academy_notices" FOR SELECT TO "authenticated" USING (("is_published" = true));



ALTER TABLE "public"."academy_periods" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "academy_periods_admin_all" ON "public"."academy_periods" USING ((( SELECT "auth"."uid"() AS "uid") IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"public"."user_role"))));



CREATE POLICY "academy_periods_auth_read" ON "public"."academy_periods" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "ae_admin_all" ON "public"."afterschool_enrollments" TO "authenticated" USING (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin")) WITH CHECK (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin"));



CREATE POLICY "ae_student_read" ON "public"."afterschool_enrollments" FOR SELECT TO "authenticated" USING (("student_profile_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "ae_teacher_read" ON "public"."afterschool_enrollments" FOR SELECT TO "authenticated" USING (("class_id" IN ( SELECT "public"."current_user_teaching_class_ids"() AS "current_user_teaching_class_ids")));



ALTER TABLE "public"."afterschool_enrollments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "att_admin_all" ON "public"."attendance" USING (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin")) WITH CHECK (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin"));



CREATE POLICY "att_student_select" ON "public"."attendance" FOR SELECT USING (("student_profile_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "att_teacher_delete" ON "public"."attendance" FOR DELETE USING ((( SELECT "public"."is_current_user_teacher"() AS "is_current_user_teacher") AND ("student_profile_id" IN ( SELECT "public"."current_user_student_ids_for_teacher"() AS "current_user_student_ids_for_teacher"))));



CREATE POLICY "att_teacher_insert" ON "public"."attendance" FOR INSERT WITH CHECK ((( SELECT "public"."is_current_user_teacher"() AS "is_current_user_teacher") AND ("student_profile_id" IN ( SELECT "public"."current_user_student_ids_for_teacher"() AS "current_user_student_ids_for_teacher"))));



CREATE POLICY "att_teacher_select" ON "public"."attendance" FOR SELECT USING ((( SELECT "public"."is_current_user_teacher"() AS "is_current_user_teacher") AND ("student_profile_id" IN ( SELECT "public"."current_user_student_ids_for_teacher"() AS "current_user_student_ids_for_teacher"))));



CREATE POLICY "att_teacher_update" ON "public"."attendance" FOR UPDATE USING ((( SELECT "public"."is_current_user_teacher"() AS "is_current_user_teacher") AND ("student_profile_id" IN ( SELECT "public"."current_user_student_ids_for_teacher"() AS "current_user_student_ids_for_teacher")))) WITH CHECK ((( SELECT "public"."is_current_user_teacher"() AS "is_current_user_teacher") AND ("student_profile_id" IN ( SELECT "public"."current_user_student_ids_for_teacher"() AS "current_user_student_ids_for_teacher"))));



ALTER TABLE "public"."attendance" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bcr_admin_all" ON "public"."bus_check_records" TO "authenticated" USING (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin")) WITH CHECK (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin"));



CREATE POLICY "bcr_bus_staff_all" ON "public"."bus_check_records" TO "authenticated" USING (("bus_number_id" IN ( SELECT "public"."current_user_bus_number_ids"() AS "current_user_bus_number_ids"))) WITH CHECK (("bus_number_id" IN ( SELECT "public"."current_user_bus_number_ids"() AS "current_user_bus_number_ids")));



CREATE POLICY "bcr_student_read" ON "public"."bus_check_records" FOR SELECT TO "authenticated" USING (("student_profile_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "bcr_teacher_read" ON "public"."bus_check_records" FOR SELECT TO "authenticated" USING (("student_profile_id" IN ( SELECT "public"."current_user_student_ids_for_teacher"() AS "current_user_student_ids_for_teacher")));



CREATE POLICY "bcreq_admin_all" ON "public"."bus_change_requests" TO "authenticated" USING (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin")) WITH CHECK (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin"));



CREATE POLICY "bcreq_self_insert" ON "public"."bus_change_requests" FOR INSERT TO "authenticated" WITH CHECK (("student_profile_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "bcreq_self_read" ON "public"."bus_change_requests" FOR SELECT TO "authenticated" USING (("student_profile_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "bcreq_student_delete" ON "public"."bus_change_requests" FOR DELETE TO "authenticated" USING (("student_profile_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "bcreq_student_update_pending" ON "public"."bus_change_requests" FOR UPDATE TO "authenticated" USING ((("student_profile_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = 'pending'::"text"))) WITH CHECK (("student_profile_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "bcreq_teacher_read" ON "public"."bus_change_requests" FOR SELECT TO "authenticated" USING (( SELECT "public"."is_current_user_teacher"() AS "is_current_user_teacher"));



CREATE POLICY "bn_admin_all" ON "public"."bus_numbers" TO "authenticated" USING (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin")) WITH CHECK (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin"));



CREATE POLICY "bn_auth_read" ON "public"."bus_numbers" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "bsda_admin_all" ON "public"."bus_stop_day_assignments" TO "authenticated" USING (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin")) WITH CHECK (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin"));



CREATE POLICY "bsda_bus_staff_read" ON "public"."bus_stop_day_assignments" FOR SELECT TO "authenticated" USING (("bus_number_id" IN ( SELECT "public"."current_user_bus_number_ids"() AS "current_user_bus_number_ids")));



CREATE POLICY "bsda_student_read" ON "public"."bus_stop_day_assignments" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'student'::"public"."user_role"))));



CREATE POLICY "bsda_teacher_read" ON "public"."bus_stop_day_assignments" FOR SELECT TO "authenticated" USING (( SELECT "public"."is_current_user_teacher"() AS "is_current_user_teacher"));



CREATE POLICY "bss_admin_all" ON "public"."bus_stop_schedules" TO "authenticated" USING (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin")) WITH CHECK (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin"));



CREATE POLICY "bss_bus_staff_read" ON "public"."bus_stop_schedules" FOR SELECT TO "authenticated" USING (("bus_stop_id" IN ( SELECT DISTINCT "bsda"."bus_stop_id"
   FROM "public"."bus_stop_day_assignments" "bsda"
  WHERE ("bsda"."bus_number_id" IN ( SELECT "public"."current_user_bus_number_ids"() AS "current_user_bus_number_ids")))));



CREATE POLICY "bss_student_read" ON "public"."bus_stop_schedules" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'student'::"public"."user_role"))));



CREATE POLICY "bss_teacher_read" ON "public"."bus_stop_schedules" FOR SELECT TO "authenticated" USING (( SELECT "public"."is_current_user_teacher"() AS "is_current_user_teacher"));



CREATE POLICY "bstaff_admin_all" ON "public"."bus_staff" TO "authenticated" USING (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin")) WITH CHECK (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin"));



CREATE POLICY "bstaff_self_read" ON "public"."bus_staff" FOR SELECT TO "authenticated" USING (("profile_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "bstops_admin_all" ON "public"."bus_stops" TO "authenticated" USING (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin")) WITH CHECK (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin"));



CREATE POLICY "bstops_auth_read" ON "public"."bus_stops" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "bts_admin_all" ON "public"."bus_time_slots" TO "authenticated" USING (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin")) WITH CHECK (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin"));



CREATE POLICY "bts_auth_read" ON "public"."bus_time_slots" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."bus_change_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bus_check_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bus_numbers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bus_staff" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bus_stop_day_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bus_stop_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bus_stops" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bus_time_slots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."class_notice_attachments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "class_notice_attachments_admin_all" ON "public"."class_notice_attachments" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."user_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "class_notice_attachments_read" ON "public"."class_notice_attachments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."class_notices" "cn"
  WHERE ("cn"."id" = "class_notice_attachments"."class_notice_id"))));



CREATE POLICY "class_notice_attachments_teacher_delete" ON "public"."class_notice_attachments" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."class_notices" "cn"
  WHERE (("cn"."id" = "class_notice_attachments"."class_notice_id") AND ("cn"."author_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "class_notice_attachments_teacher_insert" ON "public"."class_notice_attachments" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."class_notices" "cn"
     JOIN "public"."class_teachers" "ct" ON (("ct"."class_id" = "cn"."class_id")))
  WHERE (("cn"."id" = "class_notice_attachments"."class_notice_id") AND ("ct"."teacher_profile_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."class_notices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "class_notices_admin_all" ON "public"."class_notices" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."user_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "class_notices_student_select" ON "public"."class_notices" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."class_students" "cs"
  WHERE (("cs"."student_profile_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("cs"."class_id" = "class_notices"."class_id")))));



CREATE POLICY "class_notices_teacher_delete" ON "public"."class_notices" FOR DELETE TO "authenticated" USING (("author_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "class_notices_teacher_insert" ON "public"."class_notices" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."class_teachers" "ct"
  WHERE (("ct"."teacher_profile_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("ct"."class_id" = "class_notices"."class_id")))));



CREATE POLICY "class_notices_teacher_select" ON "public"."class_notices" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."class_teachers" "ct"
  WHERE (("ct"."teacher_profile_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("ct"."class_id" = "class_notices"."class_id")))));



CREATE POLICY "class_notices_teacher_update" ON "public"."class_notices" FOR UPDATE TO "authenticated" USING (("author_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("author_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."class_schedules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "class_schedules_admin_all" ON "public"."class_schedules" TO "authenticated" USING (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin")) WITH CHECK (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin"));



CREATE POLICY "class_schedules_student_select" ON "public"."class_schedules" FOR SELECT TO "authenticated" USING ((("student_profile_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("class_id" IN ( SELECT "public"."current_user_enrolled_class_ids"() AS "current_user_enrolled_class_ids"))));



CREATE POLICY "class_schedules_teacher_select" ON "public"."class_schedules" FOR SELECT TO "authenticated" USING ((( SELECT "public"."is_current_user_teacher"() AS "is_current_user_teacher") AND (("teacher_profile_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("class_id" IN ( SELECT "public"."current_user_teaching_class_ids"() AS "current_user_teaching_class_ids")))));



ALTER TABLE "public"."class_students" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "class_students_admin_all" ON "public"."class_students" TO "authenticated" USING (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin")) WITH CHECK (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin"));



CREATE POLICY "class_students_student_select" ON "public"."class_students" FOR SELECT TO "authenticated" USING (("student_profile_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "class_students_teacher_select" ON "public"."class_students" FOR SELECT TO "authenticated" USING ((( SELECT "public"."is_current_user_teacher"() AS "is_current_user_teacher") AND ("class_id" IN ( SELECT "public"."current_user_teaching_class_ids"() AS "current_user_teaching_class_ids"))));



ALTER TABLE "public"."class_teachers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "class_teachers_admin_all" ON "public"."class_teachers" TO "authenticated" USING (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin")) WITH CHECK (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin"));



CREATE POLICY "class_teachers_coworker_select" ON "public"."class_teachers" FOR SELECT TO "authenticated" USING (("class_id" IN ( SELECT "public"."current_user_teaching_class_ids"() AS "current_user_teaching_class_ids")));



CREATE POLICY "class_teachers_self_select" ON "public"."class_teachers" FOR SELECT TO "authenticated" USING (("teacher_profile_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "class_teachers_student_select" ON "public"."class_teachers" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."class_students"
  WHERE (("class_students"."class_id" = "class_teachers"."class_id") AND ("class_students"."student_profile_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."class_textbooks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "class_textbooks_admin_all" ON "public"."class_textbooks" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."user_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "class_textbooks_student_select" ON "public"."class_textbooks" FOR SELECT TO "authenticated" USING (("class_id" IN ( SELECT "public"."current_user_enrolled_class_ids"() AS "current_user_enrolled_class_ids")));



CREATE POLICY "class_textbooks_teacher_select" ON "public"."class_textbooks" FOR SELECT TO "authenticated" USING (("class_id" IN ( SELECT "public"."current_user_teaching_class_ids"() AS "current_user_teaching_class_ids")));



ALTER TABLE "public"."classes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "classes_admin_all" ON "public"."classes" TO "authenticated" USING (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin")) WITH CHECK (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin"));



CREATE POLICY "classes_student_select" ON "public"."classes" FOR SELECT TO "authenticated" USING (("id" IN ( SELECT "public"."current_user_enrolled_class_ids"() AS "current_user_enrolled_class_ids")));



CREATE POLICY "classes_teacher_select" ON "public"."classes" FOR SELECT TO "authenticated" USING ((( SELECT "public"."is_current_user_teacher"() AS "is_current_user_teacher") AND ("id" IN ( SELECT "public"."current_user_teaching_class_ids"() AS "current_user_teaching_class_ids"))));



CREATE POLICY "ha_admin_all" ON "public"."homework_assignments" USING (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin")) WITH CHECK (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin"));



CREATE POLICY "ha_student_select" ON "public"."homework_assignments" FOR SELECT USING (("class_id" IN ( SELECT "public"."current_user_enrolled_class_ids"() AS "current_user_enrolled_class_ids")));



CREATE POLICY "ha_teacher_all" ON "public"."homework_assignments" USING ((( SELECT "public"."is_current_user_teacher"() AS "is_current_user_teacher") AND (("teacher_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("class_id" IN ( SELECT "public"."current_user_teaching_class_ids"() AS "current_user_teaching_class_ids"))))) WITH CHECK ((( SELECT "public"."is_current_user_teacher"() AS "is_current_user_teacher") AND (("teacher_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("class_id" IN ( SELECT "public"."current_user_teaching_class_ids"() AS "current_user_teaching_class_ids")))));



ALTER TABLE "public"."homework_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."homework_submission_files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."homework_submissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hs_admin_all" ON "public"."homework_submissions" USING (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin")) WITH CHECK (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin"));



CREATE POLICY "hs_student_insert" ON "public"."homework_submissions" FOR INSERT WITH CHECK (("student_profile_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "hs_student_select" ON "public"."homework_submissions" FOR SELECT USING (("student_profile_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "hs_student_update" ON "public"."homework_submissions" FOR UPDATE USING (("student_profile_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("student_profile_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "hs_teacher_select" ON "public"."homework_submissions" FOR SELECT USING ((( SELECT "public"."is_current_user_teacher"() AS "is_current_user_teacher") AND ("assignment_id" IN ( SELECT "homework_assignments"."id"
   FROM "public"."homework_assignments"
  WHERE ("homework_assignments"."class_id" IN ( SELECT "public"."current_user_teaching_class_ids"() AS "current_user_teaching_class_ids"))))));



CREATE POLICY "hs_teacher_update" ON "public"."homework_submissions" FOR UPDATE USING ((( SELECT "public"."is_current_user_teacher"() AS "is_current_user_teacher") AND ("assignment_id" IN ( SELECT "homework_assignments"."id"
   FROM "public"."homework_assignments"
  WHERE ("homework_assignments"."class_id" IN ( SELECT "public"."current_user_teaching_class_ids"() AS "current_user_teaching_class_ids")))))) WITH CHECK ((( SELECT "public"."is_current_user_teacher"() AS "is_current_user_teacher") AND ("assignment_id" IN ( SELECT "homework_assignments"."id"
   FROM "public"."homework_assignments"
  WHERE ("homework_assignments"."class_id" IN ( SELECT "public"."current_user_teaching_class_ids"() AS "current_user_teaching_class_ids"))))));



CREATE POLICY "hsf_admin_all" ON "public"."homework_submission_files" USING (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin")) WITH CHECK (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin"));



CREATE POLICY "hsf_student_delete" ON "public"."homework_submission_files" FOR DELETE USING (("submission_id" IN ( SELECT "homework_submissions"."id"
   FROM "public"."homework_submissions"
  WHERE ("homework_submissions"."student_profile_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "hsf_student_insert" ON "public"."homework_submission_files" FOR INSERT WITH CHECK (("submission_id" IN ( SELECT "homework_submissions"."id"
   FROM "public"."homework_submissions"
  WHERE ("homework_submissions"."student_profile_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "hsf_student_select" ON "public"."homework_submission_files" FOR SELECT USING (("submission_id" IN ( SELECT "homework_submissions"."id"
   FROM "public"."homework_submissions"
  WHERE ("homework_submissions"."student_profile_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "hsf_teacher_select" ON "public"."homework_submission_files" FOR SELECT USING ((( SELECT "public"."is_current_user_teacher"() AS "is_current_user_teacher") AND ("submission_id" IN ( SELECT "hs"."id"
   FROM "public"."homework_submissions" "hs"
  WHERE ("hs"."assignment_id" IN ( SELECT "homework_assignments"."id"
           FROM "public"."homework_assignments"
          WHERE ("homework_assignments"."class_id" IN ( SELECT "public"."current_user_teaching_class_ids"() AS "current_user_teaching_class_ids"))))))));



CREATE POLICY "lcoa_admin_all" ON "public"."lunch_class_order_anchors" TO "authenticated" USING (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin")) WITH CHECK (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin"));



ALTER TABLE "public"."learning_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lla_admin_all" ON "public"."lunch_leader_anchors" TO "authenticated" USING (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin")) WITH CHECK (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin"));



CREATE POLICY "lr_admin_all" ON "public"."learning_records" USING (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin")) WITH CHECK (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin"));



CREATE POLICY "lr_student_select" ON "public"."learning_records" FOR SELECT USING (("student_profile_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "lr_teacher_delete" ON "public"."learning_records" FOR DELETE USING ((( SELECT "public"."is_current_user_teacher"() AS "is_current_user_teacher") AND ("student_profile_id" IN ( SELECT "public"."current_user_student_ids_for_teacher"() AS "current_user_student_ids_for_teacher"))));



CREATE POLICY "lr_teacher_insert" ON "public"."learning_records" FOR INSERT WITH CHECK ((( SELECT "public"."is_current_user_teacher"() AS "is_current_user_teacher") AND ("student_profile_id" IN ( SELECT "public"."current_user_student_ids_for_teacher"() AS "current_user_student_ids_for_teacher"))));



CREATE POLICY "lr_teacher_select" ON "public"."learning_records" FOR SELECT USING ((( SELECT "public"."is_current_user_teacher"() AS "is_current_user_teacher") AND ("student_profile_id" IN ( SELECT "public"."current_user_student_ids_for_teacher"() AS "current_user_student_ids_for_teacher"))));



CREATE POLICY "lr_teacher_update" ON "public"."learning_records" FOR UPDATE USING ((( SELECT "public"."is_current_user_teacher"() AS "is_current_user_teacher") AND ("student_profile_id" IN ( SELECT "public"."current_user_student_ids_for_teacher"() AS "current_user_student_ids_for_teacher")))) WITH CHECK ((( SELECT "public"."is_current_user_teacher"() AS "is_current_user_teacher") AND ("student_profile_id" IN ( SELECT "public"."current_user_student_ids_for_teacher"() AS "current_user_student_ids_for_teacher"))));



ALTER TABLE "public"."lunch_class_order_anchors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lunch_leader_anchors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notice_attachments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notice_attachments_admin_all" ON "public"."notice_attachments" USING ((( SELECT "auth"."uid"() AS "uid") IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"public"."user_role"))));



CREATE POLICY "notice_attachments_authenticated_read" ON "public"."notice_attachments" FOR SELECT TO "authenticated" USING (("notice_id" IN ( SELECT "notices"."id"
   FROM "public"."notices"
  WHERE ("notices"."is_published" = true))));



CREATE POLICY "notice_attachments_public_read" ON "public"."notice_attachments" FOR SELECT USING (("notice_id" IN ( SELECT "notices"."id"
   FROM "public"."notices"
  WHERE ("notices"."is_published" = true))));



ALTER TABLE "public"."notices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notices_admin_all" ON "public"."notices" USING ((( SELECT "auth"."uid"() AS "uid") IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"public"."user_role"))));



CREATE POLICY "notices_authenticated_read" ON "public"."notices" FOR SELECT TO "authenticated" USING (("is_published" = true));



CREATE POLICY "notices_public_read" ON "public"."notices" FOR SELECT USING (("is_published" = true));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_admin_all" ON "public"."profiles" TO "authenticated" USING (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin")) WITH CHECK (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin"));



CREATE POLICY "profiles_self_select" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "profiles_self_update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "public read weekly_sentence_config" ON "public"."weekly_sentence_config" FOR SELECT USING (true);



CREATE POLICY "public read weekly_sentences" ON "public"."weekly_sentences" FOR SELECT USING (true);



CREATE POLICY "rc_admin_all" ON "public"."report_cards" USING (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin")) WITH CHECK (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin"));



CREATE POLICY "rc_student_select" ON "public"."report_cards" FOR SELECT USING (("student_profile_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "rc_student_update" ON "public"."report_cards" FOR UPDATE USING (("student_profile_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("student_profile_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "rc_teacher_delete" ON "public"."report_cards" FOR DELETE TO "authenticated" USING ((( SELECT "public"."is_current_user_native_teacher"() AS "is_current_user_native_teacher") AND ("author_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "rc_teacher_insert" ON "public"."report_cards" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."is_current_user_native_teacher"() AS "is_current_user_native_teacher") AND ("author_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("student_profile_id" IN ( SELECT "public"."current_user_student_ids_for_teacher"() AS "current_user_student_ids_for_teacher"))));



CREATE POLICY "rc_teacher_select" ON "public"."report_cards" FOR SELECT USING ((( SELECT "public"."is_current_user_teacher"() AS "is_current_user_teacher") AND (("author_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("student_profile_id" IN ( SELECT "public"."current_user_student_ids_for_teacher"() AS "current_user_student_ids_for_teacher")))));



CREATE POLICY "rc_teacher_update" ON "public"."report_cards" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."is_current_user_native_teacher"() AS "is_current_user_native_teacher") AND ("author_id" = ( SELECT "auth"."uid"() AS "uid")))) WITH CHECK ((( SELECT "public"."is_current_user_native_teacher"() AS "is_current_user_native_teacher") AND ("author_id" = ( SELECT "auth"."uid"() AS "uid"))));



ALTER TABLE "public"."report_cards" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sbd_admin_all" ON "public"."student_bus_defaults" TO "authenticated" USING (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin")) WITH CHECK (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin"));



CREATE POLICY "sbd_self_read" ON "public"."student_bus_defaults" FOR SELECT TO "authenticated" USING (("student_profile_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "sbd_teacher_read" ON "public"."student_bus_defaults" FOR SELECT TO "authenticated" USING (("student_profile_id" IN ( SELECT "public"."current_user_student_ids_for_teacher"() AS "current_user_student_ids_for_teacher")));



ALTER TABLE "public"."student_bus_defaults" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_textbook_progress" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_textbook_progress_admin_all" ON "public"."student_textbook_progress" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."user_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "student_textbook_progress_student_select" ON "public"."student_textbook_progress" FOR SELECT TO "authenticated" USING (("student_profile_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "student_textbook_progress_teacher_select" ON "public"."student_textbook_progress" FOR SELECT TO "authenticated" USING (("student_profile_id" IN ( SELECT "public"."current_user_student_ids_for_teacher"() AS "current_user_student_ids_for_teacher")));



CREATE POLICY "student_textbook_progress_teacher_update" ON "public"."student_textbook_progress" FOR UPDATE TO "authenticated" USING (("student_profile_id" IN ( SELECT "public"."current_user_student_ids_for_teacher"() AS "current_user_student_ids_for_teacher"))) WITH CHECK (("student_profile_id" IN ( SELECT "public"."current_user_student_ids_for_teacher"() AS "current_user_student_ids_for_teacher")));



ALTER TABLE "public"."students" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "students_admin_all" ON "public"."students" TO "authenticated" USING (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin")) WITH CHECK (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin"));



CREATE POLICY "students_self_select" ON "public"."students" FOR SELECT TO "authenticated" USING (("profile_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "students_teacher_select" ON "public"."students" FOR SELECT TO "authenticated" USING ((( SELECT "public"."is_current_user_teacher"() AS "is_current_user_teacher") AND (EXISTS ( SELECT 1
   FROM ("public"."class_students" "cs"
     JOIN "public"."class_teachers" "ct" ON (("ct"."class_id" = "cs"."class_id")))
  WHERE (("cs"."student_profile_id" = "students"."profile_id") AND ("ct"."teacher_profile_id" = ( SELECT "auth"."uid"() AS "uid")))))));



ALTER TABLE "public"."teachers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "teachers_admin_all" ON "public"."teachers" TO "authenticated" USING (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin")) WITH CHECK (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin"));



CREATE POLICY "teachers_coworker_select" ON "public"."teachers" FOR SELECT TO "authenticated" USING ((( SELECT "public"."is_current_user_teacher"() AS "is_current_user_teacher") AND ("profile_id" IN ( SELECT "ct"."teacher_profile_id"
   FROM "public"."class_teachers" "ct"
  WHERE ("ct"."class_id" IN ( SELECT "public"."current_user_teaching_class_ids"() AS "current_user_teaching_class_ids"))))));



CREATE POLICY "teachers_self_select" ON "public"."teachers" FOR SELECT TO "authenticated" USING ((("profile_id" = ( SELECT "auth"."uid"() AS "uid")) AND ( SELECT "public"."is_current_user_teacher"() AS "is_current_user_teacher")));



ALTER TABLE "public"."textbooks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "textbooks_admin_all" ON "public"."textbooks" TO "authenticated" USING (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin")) WITH CHECK (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin"));



CREATE POLICY "textbooks_authenticated_read" ON "public"."textbooks" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."weekly_sentence_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "weekly_sentence_config_admin_all" ON "public"."weekly_sentence_config" TO "authenticated" USING (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin")) WITH CHECK (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin"));



ALTER TABLE "public"."weekly_sentences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "weekly_sentences_admin_all" ON "public"."weekly_sentences" TO "authenticated" USING (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin")) WITH CHECK (( SELECT "public"."is_current_user_admin"() AS "is_current_user_admin"));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_bus_number_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_bus_number_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_bus_number_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_enrolled_class_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_enrolled_class_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_enrolled_class_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_student_ids_for_teacher"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_student_ids_for_teacher"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_student_ids_for_teacher"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_teaching_class_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_teaching_class_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_teaching_class_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_profile_immutable_columns"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_profile_immutable_columns"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_profile_immutable_columns"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_report_card_student_columns_fn"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_report_card_student_columns_fn"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_report_card_student_columns_fn"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_student_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_student_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_student_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_teacher_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_teacher_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_teacher_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_class_report_status"("p_year" integer, "p_month" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_class_report_status"("p_year" integer, "p_month" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_class_report_status"("p_year" integer, "p_month" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_attendance_bus_sync"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_attendance_bus_sync"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_attendance_bus_sync"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_deleted_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_deleted_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_deleted_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_bus_staff_from_profile"("p_profile_id" "uuid", "p_meta" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_bus_staff_from_profile"("p_profile_id" "uuid", "p_meta" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_bus_staff_from_profile"("p_profile_id" "uuid", "p_meta" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_student_from_profile"("p_profile_id" "uuid", "p_meta" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_student_from_profile"("p_profile_id" "uuid", "p_meta" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_student_from_profile"("p_profile_id" "uuid", "p_meta" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_teacher_from_profile"("p_profile_id" "uuid", "p_meta" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_teacher_from_profile"("p_profile_id" "uuid", "p_meta" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_teacher_from_profile"("p_profile_id" "uuid", "p_meta" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_current_user_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_current_user_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_current_user_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_current_user_bus_staff"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_current_user_bus_staff"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_current_user_bus_staff"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_current_user_native_teacher"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_current_user_native_teacher"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_current_user_native_teacher"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_current_user_teacher"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_current_user_teacher"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_current_user_teacher"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_classes_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_classes_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_classes_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_report_cards_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_report_cards_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_report_cards_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_student_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_student_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_student_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_teacher_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_teacher_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_teacher_number"() TO "service_role";



GRANT ALL ON TABLE "public"."academy_notice_attachments" TO "anon";
GRANT ALL ON TABLE "public"."academy_notice_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."academy_notice_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."academy_notices" TO "anon";
GRANT ALL ON TABLE "public"."academy_notices" TO "authenticated";
GRANT ALL ON TABLE "public"."academy_notices" TO "service_role";



GRANT ALL ON TABLE "public"."academy_periods" TO "anon";
GRANT ALL ON TABLE "public"."academy_periods" TO "authenticated";
GRANT ALL ON TABLE "public"."academy_periods" TO "service_role";



GRANT ALL ON TABLE "public"."afterschool_enrollments" TO "anon";
GRANT ALL ON TABLE "public"."afterschool_enrollments" TO "authenticated";
GRANT ALL ON TABLE "public"."afterschool_enrollments" TO "service_role";



GRANT ALL ON TABLE "public"."attendance" TO "anon";
GRANT ALL ON TABLE "public"."attendance" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance" TO "service_role";



GRANT ALL ON TABLE "public"."bus_change_requests" TO "anon";
GRANT ALL ON TABLE "public"."bus_change_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."bus_change_requests" TO "service_role";



GRANT ALL ON TABLE "public"."bus_check_records" TO "anon";
GRANT ALL ON TABLE "public"."bus_check_records" TO "authenticated";
GRANT ALL ON TABLE "public"."bus_check_records" TO "service_role";



GRANT ALL ON TABLE "public"."bus_numbers" TO "anon";
GRANT ALL ON TABLE "public"."bus_numbers" TO "authenticated";
GRANT ALL ON TABLE "public"."bus_numbers" TO "service_role";



GRANT ALL ON TABLE "public"."bus_staff" TO "anon";
GRANT ALL ON TABLE "public"."bus_staff" TO "authenticated";
GRANT ALL ON TABLE "public"."bus_staff" TO "service_role";



GRANT ALL ON TABLE "public"."bus_stop_day_assignments" TO "anon";
GRANT ALL ON TABLE "public"."bus_stop_day_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."bus_stop_day_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."bus_stop_schedules" TO "anon";
GRANT ALL ON TABLE "public"."bus_stop_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."bus_stop_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."bus_stops" TO "anon";
GRANT ALL ON TABLE "public"."bus_stops" TO "authenticated";
GRANT ALL ON TABLE "public"."bus_stops" TO "service_role";



GRANT ALL ON TABLE "public"."bus_time_slots" TO "anon";
GRANT ALL ON TABLE "public"."bus_time_slots" TO "authenticated";
GRANT ALL ON TABLE "public"."bus_time_slots" TO "service_role";



GRANT ALL ON TABLE "public"."class_notice_attachments" TO "anon";
GRANT ALL ON TABLE "public"."class_notice_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."class_notice_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."class_notices" TO "anon";
GRANT ALL ON TABLE "public"."class_notices" TO "authenticated";
GRANT ALL ON TABLE "public"."class_notices" TO "service_role";



GRANT ALL ON TABLE "public"."class_schedules" TO "anon";
GRANT ALL ON TABLE "public"."class_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."class_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."class_students" TO "anon";
GRANT ALL ON TABLE "public"."class_students" TO "authenticated";
GRANT ALL ON TABLE "public"."class_students" TO "service_role";



GRANT ALL ON TABLE "public"."class_teachers" TO "anon";
GRANT ALL ON TABLE "public"."class_teachers" TO "authenticated";
GRANT ALL ON TABLE "public"."class_teachers" TO "service_role";



GRANT ALL ON TABLE "public"."class_textbooks" TO "anon";
GRANT ALL ON TABLE "public"."class_textbooks" TO "authenticated";
GRANT ALL ON TABLE "public"."class_textbooks" TO "service_role";



GRANT ALL ON TABLE "public"."classes" TO "anon";
GRANT ALL ON TABLE "public"."classes" TO "authenticated";
GRANT ALL ON TABLE "public"."classes" TO "service_role";



GRANT ALL ON TABLE "public"."homework_assignments" TO "anon";
GRANT ALL ON TABLE "public"."homework_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."homework_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."homework_submission_files" TO "anon";
GRANT ALL ON TABLE "public"."homework_submission_files" TO "authenticated";
GRANT ALL ON TABLE "public"."homework_submission_files" TO "service_role";



GRANT ALL ON TABLE "public"."homework_submissions" TO "anon";
GRANT ALL ON TABLE "public"."homework_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."homework_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."learning_records" TO "anon";
GRANT ALL ON TABLE "public"."learning_records" TO "authenticated";
GRANT ALL ON TABLE "public"."learning_records" TO "service_role";



GRANT ALL ON TABLE "public"."lunch_class_order_anchors" TO "anon";
GRANT ALL ON TABLE "public"."lunch_class_order_anchors" TO "authenticated";
GRANT ALL ON TABLE "public"."lunch_class_order_anchors" TO "service_role";



GRANT ALL ON TABLE "public"."lunch_leader_anchors" TO "anon";
GRANT ALL ON TABLE "public"."lunch_leader_anchors" TO "authenticated";
GRANT ALL ON TABLE "public"."lunch_leader_anchors" TO "service_role";



GRANT ALL ON TABLE "public"."notice_attachments" TO "anon";
GRANT ALL ON TABLE "public"."notice_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."notice_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."notices" TO "anon";
GRANT ALL ON TABLE "public"."notices" TO "authenticated";
GRANT ALL ON TABLE "public"."notices" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."report_cards" TO "anon";
GRANT ALL ON TABLE "public"."report_cards" TO "authenticated";
GRANT ALL ON TABLE "public"."report_cards" TO "service_role";



GRANT ALL ON TABLE "public"."student_bus_defaults" TO "anon";
GRANT ALL ON TABLE "public"."student_bus_defaults" TO "authenticated";
GRANT ALL ON TABLE "public"."student_bus_defaults" TO "service_role";



GRANT ALL ON SEQUENCE "public"."student_number_seq_2026" TO "anon";
GRANT ALL ON SEQUENCE "public"."student_number_seq_2026" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."student_number_seq_2026" TO "service_role";



GRANT ALL ON TABLE "public"."student_textbook_progress" TO "anon";
GRANT ALL ON TABLE "public"."student_textbook_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."student_textbook_progress" TO "service_role";



GRANT ALL ON TABLE "public"."students" TO "anon";
GRANT ALL ON TABLE "public"."students" TO "authenticated";
GRANT ALL ON TABLE "public"."students" TO "service_role";



GRANT ALL ON SEQUENCE "public"."teacher_number_seq_2026" TO "anon";
GRANT ALL ON SEQUENCE "public"."teacher_number_seq_2026" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."teacher_number_seq_2026" TO "service_role";



GRANT ALL ON TABLE "public"."teachers" TO "anon";
GRANT ALL ON TABLE "public"."teachers" TO "authenticated";
GRANT ALL ON TABLE "public"."teachers" TO "service_role";



GRANT ALL ON TABLE "public"."textbooks" TO "anon";
GRANT ALL ON TABLE "public"."textbooks" TO "authenticated";
GRANT ALL ON TABLE "public"."textbooks" TO "service_role";



GRANT ALL ON TABLE "public"."weekly_sentence_config" TO "anon";
GRANT ALL ON TABLE "public"."weekly_sentence_config" TO "authenticated";
GRANT ALL ON TABLE "public"."weekly_sentence_config" TO "service_role";



GRANT ALL ON TABLE "public"."weekly_sentences" TO "anon";
GRANT ALL ON TABLE "public"."weekly_sentences" TO "authenticated";
GRANT ALL ON TABLE "public"."weekly_sentences" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







