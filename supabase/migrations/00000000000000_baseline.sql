


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


CREATE SCHEMA IF NOT EXISTS "private";


ALTER SCHEMA "private" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."attendance_status" AS ENUM (
    'present',
    'absent',
    'late',
    'early_leave',
    'excused'
);


ALTER TYPE "public"."attendance_status" OWNER TO "postgres";


CREATE TYPE "public"."bus_change_status" AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE "public"."bus_change_status" OWNER TO "postgres";


CREATE TYPE "public"."bus_change_type" AS ENUM (
    'absent',
    'change',
    'no_ride',
    'temporary_change'
);


ALTER TYPE "public"."bus_change_type" OWNER TO "postgres";


CREATE TYPE "public"."bus_direction" AS ENUM (
    'pickup',
    'dropoff'
);


ALTER TYPE "public"."bus_direction" OWNER TO "postgres";


CREATE TYPE "public"."class_group" AS ENUM (
    'kindergarten',
    'afterschool',
    'afternoon'
);


ALTER TYPE "public"."class_group" OWNER TO "postgres";


CREATE TYPE "public"."teacher_type" AS ENUM (
    'korean',
    'native'
);


ALTER TYPE "public"."teacher_type" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'admin',
    'teacher',
    'student'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE TYPE "public"."weekly_sentence_mode" AS ENUM (
    'auto',
    'manual'
);


ALTER TYPE "public"."weekly_sentence_mode" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."get_my_role"() RETURNS "public"."user_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ select role from public.profiles where id = auth.uid() $$;


ALTER FUNCTION "private"."get_my_role"() OWNER TO "postgres";


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
      reason               = v_absent_reason,
      new_bus_time_slot_id = null,
      new_bus_number_id    = null,
      new_bus_stop_id      = null;

  else
    -- 결석 이외 상태로 변경되면 자동 생성된 버스 결석 요청 삭제
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


ALTER FUNCTION "public"."handle_attendance_bus_sync"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end $$;


ALTER FUNCTION "public"."tg_set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."academy_periods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "group_type" "public"."class_group" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "has_dropoff" boolean DEFAULT false NOT NULL,
    "group_label" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "academy_periods_time_check" CHECK (("start_time" < "end_time"))
);


ALTER TABLE "public"."academy_periods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."afterschool_enrollments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "class_id" "uuid" NOT NULL,
    "day_of_week" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "academy_period_id" "uuid",
    "student_id" "uuid" NOT NULL,
    CONSTRAINT "afterschool_enrollments_day_check" CHECK ((("day_of_week" >= 1) AND ("day_of_week" <= 5)))
);


ALTER TABLE "public"."afterschool_enrollments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "attendance_date" "date" NOT NULL,
    "status" "public"."attendance_status" NOT NULL,
    "note" "text",
    "recorded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."attendance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bus_change_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "request_date" "date" NOT NULL,
    "change_type" "public"."bus_change_type" NOT NULL,
    "new_bus_time_slot_id" "uuid",
    "new_bus_number_id" "uuid",
    "new_bus_stop_id" "uuid",
    "reason" "text",
    "status" "public"."bus_change_status" DEFAULT 'pending'::"public"."bus_change_status" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "review_note" "text",
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bus_change_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bus_check_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "check_date" "date" NOT NULL,
    "bus_time_slot_id" "uuid",
    "bus_number_id" "uuid",
    "boarded_at" timestamp with time zone,
    "checked_at" timestamp with time zone,
    "checked_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bus_check_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bus_numbers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "label" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bus_numbers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bus_stop_day_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bus_stop_id" "uuid" NOT NULL,
    "bus_number_id" "uuid" NOT NULL,
    "day_of_week" integer NOT NULL,
    "bus_time_slot_id" "uuid",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bus_stop_day_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bus_stop_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bus_stop_id" "uuid" NOT NULL,
    "day_of_week" integer NOT NULL,
    "bus_time_slot_id" "uuid",
    "estimated_time" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bus_stop_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bus_stops" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bus_number_id" "uuid",
    "name" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bus_stops" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bus_time_slots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "label" "text" NOT NULL,
    "time" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "show_empty_stops" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bus_time_slots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."class_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "class_id" "uuid" NOT NULL,
    "academy_period_id" "uuid" NOT NULL,
    "day_of_week" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "label" "text",
    "teacher_id" "uuid",
    CONSTRAINT "class_schedules_day_check" CHECK ((("day_of_week" >= 1) AND ("day_of_week" <= 5)))
);


ALTER TABLE "public"."class_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."class_students" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "class_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "student_id" "uuid" NOT NULL
);


ALTER TABLE "public"."class_students" OWNER TO "postgres";


COMMENT ON TABLE "public"."class_students" IS '반에 소속된 학생. 한 학생이 여러 반 소속 가능.';



CREATE TABLE IF NOT EXISTS "public"."class_teachers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "class_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "teacher_id" "uuid" NOT NULL
);


ALTER TABLE "public"."class_teachers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."classes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "color_index" integer,
    "english_name" "text",
    "group_type" "public"."class_group" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "group_label" "text"
);


ALTER TABLE "public"."classes" OWNER TO "postgres";


COMMENT ON TABLE "public"."classes" IS '반. 담당 선생은 0명 또는 1명.';



CREATE TABLE IF NOT EXISTS "public"."notices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" DEFAULT ''::"text" NOT NULL,
    "content" "text",
    "excerpt" "text",
    "author_id" "uuid",
    "is_published" boolean DEFAULT false NOT NULL,
    "is_pinned" boolean DEFAULT false NOT NULL,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "deleted_at" timestamp with time zone,
    "username" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "role" "public"."user_role"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."report_cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "year" integer NOT NULL,
    "month" integer NOT NULL,
    "author_id" "uuid",
    "content_en" "text",
    "content_ko" "text",
    "reply_ko" "text",
    "reply_en" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."report_cards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_bus_defaults" (
    "student_id" "uuid" NOT NULL,
    "day_of_week" integer NOT NULL,
    "bus_time_slot_id" "uuid" NOT NULL,
    "bus_stop_id" "uuid",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "direction" "public"."bus_direction" NOT NULL
);


ALTER TABLE "public"."student_bus_defaults" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."students" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "korean_name" "text" NOT NULL,
    "english_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "age" integer,
    "group_type" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."students" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teachers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "teacher_type" "public"."teacher_type" DEFAULT 'korean'::"public"."teacher_type" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "name" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."teachers" OWNER TO "postgres";


COMMENT ON COLUMN "public"."teachers"."teacher_type" IS '한국인(korean) 또는 원어민(native) 교사';



CREATE TABLE IF NOT EXISTS "public"."weekly_sentence_config" (
    "id" integer NOT NULL,
    "mode" "public"."weekly_sentence_mode" DEFAULT 'auto'::"public"."weekly_sentence_mode" NOT NULL,
    "manual_week" integer,
    "auto_base_week" integer DEFAULT 1 NOT NULL,
    "auto_base_sunday" "date" DEFAULT CURRENT_DATE NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."weekly_sentence_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."weekly_sentences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "week_number" integer NOT NULL,
    "level" integer NOT NULL,
    "english" "text" NOT NULL,
    "korean" "text" DEFAULT ''::"text" NOT NULL,
    "example" "text",
    "answer" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."weekly_sentences" OWNER TO "postgres";


ALTER TABLE ONLY "public"."academy_periods"
    ADD CONSTRAINT "academy_periods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."afterschool_enrollments"
    ADD CONSTRAINT "afterschool_enrollments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."afterschool_enrollments"
    ADD CONSTRAINT "afterschool_enrollments_unique" UNIQUE ("class_id", "student_id", "day_of_week", "academy_period_id");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_student_id_attendance_date_key" UNIQUE ("student_id", "attendance_date");



ALTER TABLE ONLY "public"."bus_change_requests"
    ADD CONSTRAINT "bus_change_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bus_change_requests"
    ADD CONSTRAINT "bus_change_requests_student_id_request_date_key" UNIQUE ("student_id", "request_date");



ALTER TABLE ONLY "public"."bus_check_records"
    ADD CONSTRAINT "bus_check_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bus_check_records"
    ADD CONSTRAINT "bus_check_records_student_id_check_date_key" UNIQUE ("student_id", "check_date");



ALTER TABLE ONLY "public"."bus_numbers"
    ADD CONSTRAINT "bus_numbers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bus_stop_day_assignments"
    ADD CONSTRAINT "bus_stop_day_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bus_stop_schedules"
    ADD CONSTRAINT "bus_stop_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bus_stops"
    ADD CONSTRAINT "bus_stops_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bus_time_slots"
    ADD CONSTRAINT "bus_time_slots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."class_schedules"
    ADD CONSTRAINT "class_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."class_schedules"
    ADD CONSTRAINT "class_schedules_unique" UNIQUE ("class_id", "academy_period_id", "day_of_week");



ALTER TABLE ONLY "public"."class_students"
    ADD CONSTRAINT "class_students_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."class_students"
    ADD CONSTRAINT "class_students_unique" UNIQUE ("class_id", "student_id");



ALTER TABLE ONLY "public"."class_teachers"
    ADD CONSTRAINT "class_teachers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."class_teachers"
    ADD CONSTRAINT "class_teachers_unique" UNIQUE ("class_id", "teacher_id");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notices"
    ADD CONSTRAINT "notices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."report_cards"
    ADD CONSTRAINT "report_cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."report_cards"
    ADD CONSTRAINT "report_cards_student_id_year_month_key" UNIQUE ("student_id", "year", "month");



ALTER TABLE ONLY "public"."student_bus_defaults"
    ADD CONSTRAINT "student_bus_defaults_pkey" PRIMARY KEY ("student_id", "direction", "day_of_week");



ALTER TABLE ONLY "public"."student_bus_defaults"
    ADD CONSTRAINT "student_bus_defaults_student_id_day_of_week_key" UNIQUE ("student_id", "day_of_week");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teachers"
    ADD CONSTRAINT "teachers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_sentence_config"
    ADD CONSTRAINT "weekly_sentence_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_sentences"
    ADD CONSTRAINT "weekly_sentences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_sentences"
    ADD CONSTRAINT "weekly_sentences_week_number_level_key" UNIQUE ("week_number", "level");



CREATE UNIQUE INDEX "attendance_student_id_date_key" ON "public"."attendance" USING "btree" ("student_id", "attendance_date");



CREATE UNIQUE INDEX "bus_change_requests_student_id_date_key" ON "public"."bus_change_requests" USING "btree" ("student_id", "request_date");



CREATE UNIQUE INDEX "bus_stop_day_assignments_unique_idx" ON "public"."bus_stop_day_assignments" USING "btree" ("bus_stop_id", "day_of_week", "bus_time_slot_id") NULLS NOT DISTINCT;



CREATE UNIQUE INDEX "bus_stop_schedules_unique_idx" ON "public"."bus_stop_schedules" USING "btree" ("bus_stop_id", "day_of_week", "bus_time_slot_id") NULLS NOT DISTINCT;



CREATE INDEX "idx_afterschool_class_day" ON "public"."afterschool_enrollments" USING "btree" ("class_id", "day_of_week");



CREATE INDEX "idx_afterschool_enrollments_period" ON "public"."afterschool_enrollments" USING "btree" ("academy_period_id");



CREATE INDEX "idx_afterschool_enrollments_student_day" ON "public"."afterschool_enrollments" USING "btree" ("student_id", "day_of_week");



CREATE INDEX "idx_attendance_recorded_by" ON "public"."attendance" USING "btree" ("recorded_by");



CREATE INDEX "idx_bcr_new_bus_number" ON "public"."bus_change_requests" USING "btree" ("new_bus_number_id");



CREATE INDEX "idx_bcr_new_bus_stop" ON "public"."bus_change_requests" USING "btree" ("new_bus_stop_id");



CREATE INDEX "idx_bcr_new_bus_time_slot" ON "public"."bus_change_requests" USING "btree" ("new_bus_time_slot_id");



CREATE INDEX "idx_bcr_reviewed_by" ON "public"."bus_change_requests" USING "btree" ("reviewed_by");



CREATE INDEX "idx_bus_check_records_bus_number" ON "public"."bus_check_records" USING "btree" ("bus_number_id");



CREATE INDEX "idx_bus_check_records_bus_time_slot" ON "public"."bus_check_records" USING "btree" ("bus_time_slot_id");



CREATE INDEX "idx_bus_check_records_checked_by" ON "public"."bus_check_records" USING "btree" ("checked_by");



CREATE INDEX "idx_bus_stop_day_assignments_bus_number" ON "public"."bus_stop_day_assignments" USING "btree" ("bus_number_id");



CREATE INDEX "idx_bus_stop_day_assignments_bus_time_slot" ON "public"."bus_stop_day_assignments" USING "btree" ("bus_time_slot_id");



CREATE INDEX "idx_bus_stop_schedules_bus_time_slot" ON "public"."bus_stop_schedules" USING "btree" ("bus_time_slot_id");



CREATE INDEX "idx_bus_stops_bus_number" ON "public"."bus_stops" USING "btree" ("bus_number_id");



CREATE INDEX "idx_class_schedules_class_day" ON "public"."class_schedules" USING "btree" ("class_id", "day_of_week");



CREATE INDEX "idx_class_schedules_period" ON "public"."class_schedules" USING "btree" ("academy_period_id");



CREATE INDEX "idx_class_schedules_teacher_day" ON "public"."class_schedules" USING "btree" ("teacher_id", "day_of_week");



CREATE INDEX "idx_class_schedules_teacher_id" ON "public"."class_schedules" USING "btree" ("teacher_id");



CREATE INDEX "idx_class_students_class" ON "public"."class_students" USING "btree" ("class_id");



CREATE INDEX "idx_class_students_student" ON "public"."class_students" USING "btree" ("student_id");



CREATE INDEX "idx_class_teachers_class" ON "public"."class_teachers" USING "btree" ("class_id");



CREATE INDEX "idx_class_teachers_teacher" ON "public"."class_teachers" USING "btree" ("teacher_id");



CREATE INDEX "idx_classes_group_type" ON "public"."classes" USING "btree" ("group_type");



CREATE INDEX "idx_notices_author" ON "public"."notices" USING "btree" ("author_id");



CREATE INDEX "idx_report_cards_author" ON "public"."report_cards" USING "btree" ("author_id");



CREATE INDEX "idx_student_bus_defaults_bus_stop" ON "public"."student_bus_defaults" USING "btree" ("bus_stop_id");



CREATE INDEX "idx_student_bus_defaults_bus_time_slot" ON "public"."student_bus_defaults" USING "btree" ("bus_time_slot_id");



CREATE UNIQUE INDEX "profiles_username_unique" ON "public"."profiles" USING "btree" ("username") WHERE ("username" IS NOT NULL);



CREATE OR REPLACE TRIGGER "after_attendance_bus_sync" AFTER INSERT OR UPDATE OF "status" ON "public"."attendance" FOR EACH ROW EXECUTE FUNCTION "public"."handle_attendance_bus_sync"();



CREATE OR REPLACE TRIGGER "tg_set_updated_at" BEFORE UPDATE ON "public"."academy_periods" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "tg_set_updated_at" BEFORE UPDATE ON "public"."attendance" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "tg_set_updated_at" BEFORE UPDATE ON "public"."bus_change_requests" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "tg_set_updated_at" BEFORE UPDATE ON "public"."bus_numbers" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "tg_set_updated_at" BEFORE UPDATE ON "public"."bus_stop_day_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "tg_set_updated_at" BEFORE UPDATE ON "public"."bus_stop_schedules" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "tg_set_updated_at" BEFORE UPDATE ON "public"."bus_stops" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "tg_set_updated_at" BEFORE UPDATE ON "public"."bus_time_slots" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "tg_set_updated_at" BEFORE UPDATE ON "public"."class_schedules" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "tg_set_updated_at" BEFORE UPDATE ON "public"."classes" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "tg_set_updated_at" BEFORE UPDATE ON "public"."notices" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "tg_set_updated_at" BEFORE UPDATE ON "public"."report_cards" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "tg_set_updated_at" BEFORE UPDATE ON "public"."student_bus_defaults" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "tg_set_updated_at" BEFORE UPDATE ON "public"."students" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "tg_set_updated_at" BEFORE UPDATE ON "public"."teachers" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "tg_set_updated_at" BEFORE UPDATE ON "public"."weekly_sentence_config" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "tg_set_updated_at" BEFORE UPDATE ON "public"."weekly_sentences" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();



ALTER TABLE ONLY "public"."afterschool_enrollments"
    ADD CONSTRAINT "afterschool_enrollments_academy_period_id_fkey" FOREIGN KEY ("academy_period_id") REFERENCES "public"."academy_periods"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."afterschool_enrollments"
    ADD CONSTRAINT "afterschool_enrollments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."afterschool_enrollments"
    ADD CONSTRAINT "afterschool_enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bus_change_requests"
    ADD CONSTRAINT "bus_change_requests_new_bus_number_id_fkey" FOREIGN KEY ("new_bus_number_id") REFERENCES "public"."bus_numbers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bus_change_requests"
    ADD CONSTRAINT "bus_change_requests_new_bus_stop_id_fkey" FOREIGN KEY ("new_bus_stop_id") REFERENCES "public"."bus_stops"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bus_change_requests"
    ADD CONSTRAINT "bus_change_requests_new_bus_time_slot_id_fkey" FOREIGN KEY ("new_bus_time_slot_id") REFERENCES "public"."bus_time_slots"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bus_change_requests"
    ADD CONSTRAINT "bus_change_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bus_change_requests"
    ADD CONSTRAINT "bus_change_requests_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bus_check_records"
    ADD CONSTRAINT "bus_check_records_bus_number_id_fkey" FOREIGN KEY ("bus_number_id") REFERENCES "public"."bus_numbers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bus_check_records"
    ADD CONSTRAINT "bus_check_records_bus_time_slot_id_fkey" FOREIGN KEY ("bus_time_slot_id") REFERENCES "public"."bus_time_slots"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bus_check_records"
    ADD CONSTRAINT "bus_check_records_checked_by_fkey" FOREIGN KEY ("checked_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bus_check_records"
    ADD CONSTRAINT "bus_check_records_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bus_stop_day_assignments"
    ADD CONSTRAINT "bus_stop_day_assignments_bus_number_id_fkey" FOREIGN KEY ("bus_number_id") REFERENCES "public"."bus_numbers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bus_stop_day_assignments"
    ADD CONSTRAINT "bus_stop_day_assignments_bus_stop_id_fkey" FOREIGN KEY ("bus_stop_id") REFERENCES "public"."bus_stops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bus_stop_day_assignments"
    ADD CONSTRAINT "bus_stop_day_assignments_bus_time_slot_id_fkey" FOREIGN KEY ("bus_time_slot_id") REFERENCES "public"."bus_time_slots"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bus_stop_schedules"
    ADD CONSTRAINT "bus_stop_schedules_bus_stop_id_fkey" FOREIGN KEY ("bus_stop_id") REFERENCES "public"."bus_stops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bus_stop_schedules"
    ADD CONSTRAINT "bus_stop_schedules_bus_time_slot_id_fkey" FOREIGN KEY ("bus_time_slot_id") REFERENCES "public"."bus_time_slots"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bus_stops"
    ADD CONSTRAINT "bus_stops_bus_number_id_fkey" FOREIGN KEY ("bus_number_id") REFERENCES "public"."bus_numbers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."class_schedules"
    ADD CONSTRAINT "class_schedules_academy_period_id_fkey" FOREIGN KEY ("academy_period_id") REFERENCES "public"."academy_periods"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."class_schedules"
    ADD CONSTRAINT "class_schedules_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_schedules"
    ADD CONSTRAINT "class_schedules_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."class_students"
    ADD CONSTRAINT "class_students_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_students"
    ADD CONSTRAINT "class_students_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_teachers"
    ADD CONSTRAINT "class_teachers_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_teachers"
    ADD CONSTRAINT "class_teachers_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notices"
    ADD CONSTRAINT "notices_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_cards"
    ADD CONSTRAINT "report_cards_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."report_cards"
    ADD CONSTRAINT "report_cards_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_bus_defaults"
    ADD CONSTRAINT "student_bus_defaults_bus_stop_id_fkey" FOREIGN KEY ("bus_stop_id") REFERENCES "public"."bus_stops"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."student_bus_defaults"
    ADD CONSTRAINT "student_bus_defaults_bus_time_slot_id_fkey" FOREIGN KEY ("bus_time_slot_id") REFERENCES "public"."bus_time_slots"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_bus_defaults"
    ADD CONSTRAINT "student_bus_defaults_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_profiles_fkey" FOREIGN KEY ("id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teachers"
    ADD CONSTRAINT "teachers_profiles_fkey" FOREIGN KEY ("id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE "public"."academy_periods" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "academy_periods_admin_delete" ON "public"."academy_periods" FOR DELETE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "academy_periods_admin_insert" ON "public"."academy_periods" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "academy_periods_admin_update" ON "public"."academy_periods" FOR UPDATE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role")) WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "academy_periods_select" ON "public"."academy_periods" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."afterschool_enrollments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "afterschool_enrollments_select" ON "public"."afterschool_enrollments" FOR SELECT TO "authenticated" USING ((("student_id" = ( SELECT "auth"."uid"() AS "uid")) OR (( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"]))));



CREATE POLICY "afterschool_enrollments_staff_delete" ON "public"."afterschool_enrollments" FOR DELETE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"])));



CREATE POLICY "afterschool_enrollments_staff_insert" ON "public"."afterschool_enrollments" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"])));



CREATE POLICY "afterschool_enrollments_staff_update" ON "public"."afterschool_enrollments" FOR UPDATE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"]))) WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"])));



ALTER TABLE "public"."attendance" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "attendance_select" ON "public"."attendance" FOR SELECT TO "authenticated" USING ((("student_id" = ( SELECT "auth"."uid"() AS "uid")) OR (( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"]))));



CREATE POLICY "attendance_staff_delete" ON "public"."attendance" FOR DELETE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"])));



CREATE POLICY "attendance_staff_insert" ON "public"."attendance" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"])));



CREATE POLICY "attendance_staff_update" ON "public"."attendance" FOR UPDATE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"]))) WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"])));



ALTER TABLE "public"."bus_change_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bus_change_requests_delete" ON "public"."bus_change_requests" FOR DELETE TO "authenticated" USING ((("student_id" = ( SELECT "auth"."uid"() AS "uid")) OR (( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"]))));



CREATE POLICY "bus_change_requests_insert" ON "public"."bus_change_requests" FOR INSERT TO "authenticated" WITH CHECK ((("student_id" = ( SELECT "auth"."uid"() AS "uid")) OR (( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"]))));



CREATE POLICY "bus_change_requests_select" ON "public"."bus_change_requests" FOR SELECT TO "authenticated" USING ((("student_id" = ( SELECT "auth"."uid"() AS "uid")) OR (( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"]))));



CREATE POLICY "bus_change_requests_update" ON "public"."bus_change_requests" FOR UPDATE TO "authenticated" USING ((("student_id" = ( SELECT "auth"."uid"() AS "uid")) OR (( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"])))) WITH CHECK ((("student_id" = ( SELECT "auth"."uid"() AS "uid")) OR (( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"]))));



ALTER TABLE "public"."bus_check_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bus_check_records_select" ON "public"."bus_check_records" FOR SELECT TO "authenticated" USING ((("student_id" = ( SELECT "auth"."uid"() AS "uid")) OR (( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"]))));



CREATE POLICY "bus_check_records_staff_delete" ON "public"."bus_check_records" FOR DELETE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"])));



CREATE POLICY "bus_check_records_staff_insert" ON "public"."bus_check_records" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"])));



CREATE POLICY "bus_check_records_staff_update" ON "public"."bus_check_records" FOR UPDATE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"]))) WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"])));



ALTER TABLE "public"."bus_numbers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bus_numbers_admin_delete" ON "public"."bus_numbers" FOR DELETE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "bus_numbers_admin_insert" ON "public"."bus_numbers" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "bus_numbers_admin_update" ON "public"."bus_numbers" FOR UPDATE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role")) WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "bus_numbers_select" ON "public"."bus_numbers" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."bus_stop_day_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bus_stop_day_assignments_admin_delete" ON "public"."bus_stop_day_assignments" FOR DELETE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "bus_stop_day_assignments_admin_insert" ON "public"."bus_stop_day_assignments" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "bus_stop_day_assignments_admin_update" ON "public"."bus_stop_day_assignments" FOR UPDATE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role")) WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "bus_stop_day_assignments_select" ON "public"."bus_stop_day_assignments" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."bus_stop_schedules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bus_stop_schedules_admin_delete" ON "public"."bus_stop_schedules" FOR DELETE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "bus_stop_schedules_admin_insert" ON "public"."bus_stop_schedules" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "bus_stop_schedules_admin_update" ON "public"."bus_stop_schedules" FOR UPDATE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role")) WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "bus_stop_schedules_select" ON "public"."bus_stop_schedules" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."bus_stops" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bus_stops_admin_delete" ON "public"."bus_stops" FOR DELETE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "bus_stops_admin_insert" ON "public"."bus_stops" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "bus_stops_admin_update" ON "public"."bus_stops" FOR UPDATE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role")) WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "bus_stops_select" ON "public"."bus_stops" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."bus_time_slots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bus_time_slots_admin_delete" ON "public"."bus_time_slots" FOR DELETE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "bus_time_slots_admin_insert" ON "public"."bus_time_slots" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "bus_time_slots_admin_update" ON "public"."bus_time_slots" FOR UPDATE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role")) WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "bus_time_slots_select" ON "public"."bus_time_slots" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."class_schedules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "class_schedules_select" ON "public"."class_schedules" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "class_schedules_staff_delete" ON "public"."class_schedules" FOR DELETE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"])));



CREATE POLICY "class_schedules_staff_insert" ON "public"."class_schedules" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"])));



CREATE POLICY "class_schedules_staff_update" ON "public"."class_schedules" FOR UPDATE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"]))) WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"])));



ALTER TABLE "public"."class_students" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "class_students_admin_delete" ON "public"."class_students" FOR DELETE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "class_students_admin_insert" ON "public"."class_students" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "class_students_admin_update" ON "public"."class_students" FOR UPDATE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role")) WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "class_students_select" ON "public"."class_students" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."class_teachers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "class_teachers_admin_delete" ON "public"."class_teachers" FOR DELETE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "class_teachers_admin_insert" ON "public"."class_teachers" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "class_teachers_admin_update" ON "public"."class_teachers" FOR UPDATE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role")) WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "class_teachers_select" ON "public"."class_teachers" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."classes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "classes_admin_delete" ON "public"."classes" FOR DELETE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "classes_admin_insert" ON "public"."classes" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "classes_admin_update" ON "public"."classes" FOR UPDATE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role")) WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "classes_select" ON "public"."classes" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."notices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notices_admin_delete" ON "public"."notices" FOR DELETE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "notices_admin_insert" ON "public"."notices" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "notices_admin_update" ON "public"."notices" FOR UPDATE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role")) WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "notices_public_read_published" ON "public"."notices" FOR SELECT TO "authenticated", "anon" USING ((("is_published" = true) OR (( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role")));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_admin_delete" ON "public"."profiles" FOR DELETE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "profiles_admin_insert" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "profiles_admin_update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role")) WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "profiles_select" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR (( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"]))));



ALTER TABLE "public"."report_cards" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "report_cards_select" ON "public"."report_cards" FOR SELECT TO "authenticated" USING ((("student_id" = ( SELECT "auth"."uid"() AS "uid")) OR (( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"]))));



CREATE POLICY "report_cards_staff_delete" ON "public"."report_cards" FOR DELETE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"])));



CREATE POLICY "report_cards_staff_insert" ON "public"."report_cards" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"])));



CREATE POLICY "report_cards_update" ON "public"."report_cards" FOR UPDATE TO "authenticated" USING ((("student_id" = ( SELECT "auth"."uid"() AS "uid")) OR (( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"])))) WITH CHECK ((("student_id" = ( SELECT "auth"."uid"() AS "uid")) OR (( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"]))));



ALTER TABLE "public"."student_bus_defaults" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_bus_defaults_select" ON "public"."student_bus_defaults" FOR SELECT TO "authenticated" USING ((("student_id" = ( SELECT "auth"."uid"() AS "uid")) OR (( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"]))));



CREATE POLICY "student_bus_defaults_staff_delete" ON "public"."student_bus_defaults" FOR DELETE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"])));



CREATE POLICY "student_bus_defaults_staff_insert" ON "public"."student_bus_defaults" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"])));



CREATE POLICY "student_bus_defaults_staff_update" ON "public"."student_bus_defaults" FOR UPDATE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"]))) WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"])));



ALTER TABLE "public"."students" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "students_admin_delete" ON "public"."students" FOR DELETE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "students_admin_insert" ON "public"."students" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "students_admin_update" ON "public"."students" FOR UPDATE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role")) WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "students_select" ON "public"."students" FOR SELECT TO "authenticated" USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR (( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"]))));



ALTER TABLE "public"."teachers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "teachers_admin_delete" ON "public"."teachers" FOR DELETE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "teachers_admin_insert" ON "public"."teachers" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "teachers_admin_update" ON "public"."teachers" FOR UPDATE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role")) WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "teachers_select" ON "public"."teachers" FOR SELECT TO "authenticated" USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR (( SELECT "private"."get_my_role"() AS "get_my_role") = ANY (ARRAY['admin'::"public"."user_role", 'teacher'::"public"."user_role"]))));



ALTER TABLE "public"."weekly_sentence_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "weekly_sentence_config_admin_delete" ON "public"."weekly_sentence_config" FOR DELETE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "weekly_sentence_config_admin_insert" ON "public"."weekly_sentence_config" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "weekly_sentence_config_admin_update" ON "public"."weekly_sentence_config" FOR UPDATE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role")) WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "weekly_sentence_config_public_read" ON "public"."weekly_sentence_config" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."weekly_sentences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "weekly_sentences_admin_delete" ON "public"."weekly_sentences" FOR DELETE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "weekly_sentences_admin_insert" ON "public"."weekly_sentences" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "weekly_sentences_admin_update" ON "public"."weekly_sentences" FOR UPDATE TO "authenticated" USING ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role")) WITH CHECK ((( SELECT "private"."get_my_role"() AS "get_my_role") = 'admin'::"public"."user_role"));



CREATE POLICY "weekly_sentences_public_read" ON "public"."weekly_sentences" FOR SELECT TO "authenticated", "anon" USING (true);



GRANT USAGE ON SCHEMA "private" TO "service_role";
GRANT USAGE ON SCHEMA "private" TO "authenticated";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "private"."get_my_role"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."get_my_role"() TO "authenticated";
GRANT ALL ON FUNCTION "private"."get_my_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_attendance_bus_sync"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_attendance_bus_sync"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_attendance_bus_sync"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."tg_set_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tg_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_set_updated_at"() TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."academy_periods" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."academy_periods" TO "authenticated";
GRANT ALL ON TABLE "public"."academy_periods" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."afterschool_enrollments" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."afterschool_enrollments" TO "authenticated";
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



GRANT SELECT,MAINTAIN ON TABLE "public"."class_schedules" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."class_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."class_schedules" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."class_students" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."class_students" TO "authenticated";
GRANT ALL ON TABLE "public"."class_students" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."class_teachers" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."class_teachers" TO "authenticated";
GRANT ALL ON TABLE "public"."class_teachers" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."classes" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."classes" TO "authenticated";
GRANT ALL ON TABLE "public"."classes" TO "service_role";



GRANT ALL ON TABLE "public"."notices" TO "anon";
GRANT ALL ON TABLE "public"."notices" TO "authenticated";
GRANT ALL ON TABLE "public"."notices" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."report_cards" TO "anon";
GRANT ALL ON TABLE "public"."report_cards" TO "authenticated";
GRANT ALL ON TABLE "public"."report_cards" TO "service_role";



GRANT ALL ON TABLE "public"."student_bus_defaults" TO "anon";
GRANT ALL ON TABLE "public"."student_bus_defaults" TO "authenticated";
GRANT ALL ON TABLE "public"."student_bus_defaults" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."students" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."students" TO "authenticated";
GRANT ALL ON TABLE "public"."students" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."teachers" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."teachers" TO "authenticated";
GRANT ALL ON TABLE "public"."teachers" TO "service_role";



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







