create type "public"."class_group" as enum ('kindergarten', 'afterschool', 'afternoon');

create type "public"."teacher_type" as enum ('korean', 'native');

drop trigger if exists "after_attendance_bus_sync" on "public"."attendance";

drop trigger if exists "trigger_classes_updated_at" on "public"."classes";

drop trigger if exists "enforce_profile_immutable_columns_trigger" on "public"."profiles";

drop trigger if exists "enforce_report_card_student_columns" on "public"."report_cards";

drop trigger if exists "trigger_report_cards_updated_at" on "public"."report_cards";

drop trigger if exists "trigger_set_student_number" on "public"."students";

drop trigger if exists "trigger_set_teacher_number" on "public"."teachers";

drop policy "academy_notice_attachments_admin_all" on "public"."academy_notice_attachments";

drop policy "academy_notice_attachments_read" on "public"."academy_notice_attachments";

drop policy "academy_notices_admin_all" on "public"."academy_notices";

drop policy "academy_notices_authenticated_read" on "public"."academy_notices";

drop policy "academy_periods_admin_all" on "public"."academy_periods";

drop policy "academy_periods_auth_read" on "public"."academy_periods";

drop policy "ae_admin_all" on "public"."afterschool_enrollments";

drop policy "ae_student_read" on "public"."afterschool_enrollments";

drop policy "ae_teacher_read" on "public"."afterschool_enrollments";

drop policy "att_admin_all" on "public"."attendance";

drop policy "att_student_select" on "public"."attendance";

drop policy "att_teacher_delete" on "public"."attendance";

drop policy "att_teacher_insert" on "public"."attendance";

drop policy "att_teacher_select" on "public"."attendance";

drop policy "att_teacher_update" on "public"."attendance";

drop policy "bcreq_admin_all" on "public"."bus_change_requests";

drop policy "bcreq_self_insert" on "public"."bus_change_requests";

drop policy "bcreq_self_read" on "public"."bus_change_requests";

drop policy "bcreq_student_delete" on "public"."bus_change_requests";

drop policy "bcreq_student_update_pending" on "public"."bus_change_requests";

drop policy "bcreq_teacher_read" on "public"."bus_change_requests";

drop policy "bcr_admin_all" on "public"."bus_check_records";

drop policy "bcr_bus_staff_all" on "public"."bus_check_records";

drop policy "bcr_student_read" on "public"."bus_check_records";

drop policy "bcr_teacher_read" on "public"."bus_check_records";

drop policy "bn_admin_all" on "public"."bus_numbers";

drop policy "bn_auth_read" on "public"."bus_numbers";

drop policy "bstaff_admin_all" on "public"."bus_staff";

drop policy "bstaff_self_read" on "public"."bus_staff";

drop policy "bsda_admin_all" on "public"."bus_stop_day_assignments";

drop policy "bsda_bus_staff_read" on "public"."bus_stop_day_assignments";

drop policy "bsda_student_read" on "public"."bus_stop_day_assignments";

drop policy "bsda_teacher_read" on "public"."bus_stop_day_assignments";

drop policy "bss_admin_all" on "public"."bus_stop_schedules";

drop policy "bss_bus_staff_read" on "public"."bus_stop_schedules";

drop policy "bss_student_read" on "public"."bus_stop_schedules";

drop policy "bss_teacher_read" on "public"."bus_stop_schedules";

drop policy "bstops_admin_all" on "public"."bus_stops";

drop policy "bstops_auth_read" on "public"."bus_stops";

drop policy "bts_admin_all" on "public"."bus_time_slots";

drop policy "bts_auth_read" on "public"."bus_time_slots";

drop policy "class_notice_attachments_admin_all" on "public"."class_notice_attachments";

drop policy "class_notice_attachments_read" on "public"."class_notice_attachments";

drop policy "class_notice_attachments_teacher_delete" on "public"."class_notice_attachments";

drop policy "class_notice_attachments_teacher_insert" on "public"."class_notice_attachments";

drop policy "class_notices_admin_all" on "public"."class_notices";

drop policy "class_notices_student_select" on "public"."class_notices";

drop policy "class_notices_teacher_delete" on "public"."class_notices";

drop policy "class_notices_teacher_insert" on "public"."class_notices";

drop policy "class_notices_teacher_select" on "public"."class_notices";

drop policy "class_notices_teacher_update" on "public"."class_notices";

drop policy "class_schedules_admin_all" on "public"."class_schedules";

drop policy "class_schedules_student_select" on "public"."class_schedules";

drop policy "class_schedules_teacher_select" on "public"."class_schedules";

drop policy "class_students_admin_all" on "public"."class_students";

drop policy "class_students_student_select" on "public"."class_students";

drop policy "class_students_teacher_select" on "public"."class_students";

drop policy "class_teachers_admin_all" on "public"."class_teachers";

drop policy "class_teachers_coworker_select" on "public"."class_teachers";

drop policy "class_teachers_self_select" on "public"."class_teachers";

drop policy "class_teachers_student_select" on "public"."class_teachers";

drop policy "class_textbooks_admin_all" on "public"."class_textbooks";

drop policy "class_textbooks_student_select" on "public"."class_textbooks";

drop policy "class_textbooks_teacher_select" on "public"."class_textbooks";

drop policy "classes_admin_all" on "public"."classes";

drop policy "classes_student_select" on "public"."classes";

drop policy "classes_teacher_select" on "public"."classes";

drop policy "ha_admin_all" on "public"."homework_assignments";

drop policy "ha_student_select" on "public"."homework_assignments";

drop policy "ha_teacher_all" on "public"."homework_assignments";

drop policy "hsf_admin_all" on "public"."homework_submission_files";

drop policy "hsf_student_delete" on "public"."homework_submission_files";

drop policy "hsf_student_insert" on "public"."homework_submission_files";

drop policy "hsf_student_select" on "public"."homework_submission_files";

drop policy "hsf_teacher_select" on "public"."homework_submission_files";

drop policy "hs_admin_all" on "public"."homework_submissions";

drop policy "hs_student_insert" on "public"."homework_submissions";

drop policy "hs_student_select" on "public"."homework_submissions";

drop policy "hs_student_update" on "public"."homework_submissions";

drop policy "hs_teacher_select" on "public"."homework_submissions";

drop policy "hs_teacher_update" on "public"."homework_submissions";

drop policy "lr_admin_all" on "public"."learning_records";

drop policy "lr_student_select" on "public"."learning_records";

drop policy "lr_teacher_delete" on "public"."learning_records";

drop policy "lr_teacher_insert" on "public"."learning_records";

drop policy "lr_teacher_select" on "public"."learning_records";

drop policy "lr_teacher_update" on "public"."learning_records";

drop policy "lcoa_admin_all" on "public"."lunch_class_order_anchors";

drop policy "lla_admin_all" on "public"."lunch_leader_anchors";

drop policy "notice_attachments_admin_all" on "public"."notice_attachments";

drop policy "notice_attachments_authenticated_read" on "public"."notice_attachments";

drop policy "notice_attachments_public_read" on "public"."notice_attachments";

drop policy "notices_admin_all" on "public"."notices";

drop policy "notices_authenticated_read" on "public"."notices";

drop policy "notices_public_read" on "public"."notices";

drop policy "profiles_admin_all" on "public"."profiles";

drop policy "profiles_self_select" on "public"."profiles";

drop policy "profiles_self_update" on "public"."profiles";

drop policy "rc_admin_all" on "public"."report_cards";

drop policy "rc_student_select" on "public"."report_cards";

drop policy "rc_student_update" on "public"."report_cards";

drop policy "rc_teacher_delete" on "public"."report_cards";

drop policy "rc_teacher_insert" on "public"."report_cards";

drop policy "rc_teacher_select" on "public"."report_cards";

drop policy "rc_teacher_update" on "public"."report_cards";

drop policy "sbd_admin_all" on "public"."student_bus_defaults";

drop policy "sbd_self_read" on "public"."student_bus_defaults";

drop policy "sbd_teacher_read" on "public"."student_bus_defaults";

drop policy "student_textbook_progress_admin_all" on "public"."student_textbook_progress";

drop policy "student_textbook_progress_student_select" on "public"."student_textbook_progress";

drop policy "student_textbook_progress_teacher_select" on "public"."student_textbook_progress";

drop policy "student_textbook_progress_teacher_update" on "public"."student_textbook_progress";

drop policy "students_admin_all" on "public"."students";

drop policy "students_self_select" on "public"."students";

drop policy "students_teacher_select" on "public"."students";

drop policy "teachers_admin_all" on "public"."teachers";

drop policy "teachers_coworker_select" on "public"."teachers";

drop policy "teachers_self_select" on "public"."teachers";

drop policy "textbooks_admin_all" on "public"."textbooks";

drop policy "textbooks_authenticated_read" on "public"."textbooks";

drop policy "public read weekly_sentence_config" on "public"."weekly_sentence_config";

drop policy "weekly_sentence_config_admin_all" on "public"."weekly_sentence_config";

drop policy "public read weekly_sentences" on "public"."weekly_sentences";

drop policy "weekly_sentences_admin_all" on "public"."weekly_sentences";

revoke delete on table "public"."academy_notice_attachments" from "anon";

revoke insert on table "public"."academy_notice_attachments" from "anon";

revoke references on table "public"."academy_notice_attachments" from "anon";

revoke select on table "public"."academy_notice_attachments" from "anon";

revoke trigger on table "public"."academy_notice_attachments" from "anon";

revoke truncate on table "public"."academy_notice_attachments" from "anon";

revoke update on table "public"."academy_notice_attachments" from "anon";

revoke delete on table "public"."academy_notice_attachments" from "authenticated";

revoke insert on table "public"."academy_notice_attachments" from "authenticated";

revoke references on table "public"."academy_notice_attachments" from "authenticated";

revoke select on table "public"."academy_notice_attachments" from "authenticated";

revoke trigger on table "public"."academy_notice_attachments" from "authenticated";

revoke truncate on table "public"."academy_notice_attachments" from "authenticated";

revoke update on table "public"."academy_notice_attachments" from "authenticated";

revoke delete on table "public"."academy_notice_attachments" from "service_role";

revoke insert on table "public"."academy_notice_attachments" from "service_role";

revoke references on table "public"."academy_notice_attachments" from "service_role";

revoke select on table "public"."academy_notice_attachments" from "service_role";

revoke trigger on table "public"."academy_notice_attachments" from "service_role";

revoke truncate on table "public"."academy_notice_attachments" from "service_role";

revoke update on table "public"."academy_notice_attachments" from "service_role";

revoke delete on table "public"."academy_notices" from "anon";

revoke insert on table "public"."academy_notices" from "anon";

revoke references on table "public"."academy_notices" from "anon";

revoke select on table "public"."academy_notices" from "anon";

revoke trigger on table "public"."academy_notices" from "anon";

revoke truncate on table "public"."academy_notices" from "anon";

revoke update on table "public"."academy_notices" from "anon";

revoke delete on table "public"."academy_notices" from "authenticated";

revoke insert on table "public"."academy_notices" from "authenticated";

revoke references on table "public"."academy_notices" from "authenticated";

revoke select on table "public"."academy_notices" from "authenticated";

revoke trigger on table "public"."academy_notices" from "authenticated";

revoke truncate on table "public"."academy_notices" from "authenticated";

revoke update on table "public"."academy_notices" from "authenticated";

revoke delete on table "public"."academy_notices" from "service_role";

revoke insert on table "public"."academy_notices" from "service_role";

revoke references on table "public"."academy_notices" from "service_role";

revoke select on table "public"."academy_notices" from "service_role";

revoke trigger on table "public"."academy_notices" from "service_role";

revoke truncate on table "public"."academy_notices" from "service_role";

revoke update on table "public"."academy_notices" from "service_role";

revoke delete on table "public"."academy_periods" from "anon";

revoke insert on table "public"."academy_periods" from "anon";

revoke references on table "public"."academy_periods" from "anon";

revoke select on table "public"."academy_periods" from "anon";

revoke trigger on table "public"."academy_periods" from "anon";

revoke truncate on table "public"."academy_periods" from "anon";

revoke update on table "public"."academy_periods" from "anon";

revoke delete on table "public"."academy_periods" from "authenticated";

revoke insert on table "public"."academy_periods" from "authenticated";

revoke references on table "public"."academy_periods" from "authenticated";

revoke select on table "public"."academy_periods" from "authenticated";

revoke trigger on table "public"."academy_periods" from "authenticated";

revoke truncate on table "public"."academy_periods" from "authenticated";

revoke update on table "public"."academy_periods" from "authenticated";

revoke delete on table "public"."academy_periods" from "service_role";

revoke insert on table "public"."academy_periods" from "service_role";

revoke references on table "public"."academy_periods" from "service_role";

revoke select on table "public"."academy_periods" from "service_role";

revoke trigger on table "public"."academy_periods" from "service_role";

revoke truncate on table "public"."academy_periods" from "service_role";

revoke update on table "public"."academy_periods" from "service_role";

revoke delete on table "public"."afterschool_enrollments" from "anon";

revoke insert on table "public"."afterschool_enrollments" from "anon";

revoke references on table "public"."afterschool_enrollments" from "anon";

revoke select on table "public"."afterschool_enrollments" from "anon";

revoke trigger on table "public"."afterschool_enrollments" from "anon";

revoke truncate on table "public"."afterschool_enrollments" from "anon";

revoke update on table "public"."afterschool_enrollments" from "anon";

revoke delete on table "public"."afterschool_enrollments" from "authenticated";

revoke insert on table "public"."afterschool_enrollments" from "authenticated";

revoke references on table "public"."afterschool_enrollments" from "authenticated";

revoke select on table "public"."afterschool_enrollments" from "authenticated";

revoke trigger on table "public"."afterschool_enrollments" from "authenticated";

revoke truncate on table "public"."afterschool_enrollments" from "authenticated";

revoke update on table "public"."afterschool_enrollments" from "authenticated";

revoke delete on table "public"."afterschool_enrollments" from "service_role";

revoke insert on table "public"."afterschool_enrollments" from "service_role";

revoke references on table "public"."afterschool_enrollments" from "service_role";

revoke select on table "public"."afterschool_enrollments" from "service_role";

revoke trigger on table "public"."afterschool_enrollments" from "service_role";

revoke truncate on table "public"."afterschool_enrollments" from "service_role";

revoke update on table "public"."afterschool_enrollments" from "service_role";

revoke delete on table "public"."attendance" from "anon";

revoke insert on table "public"."attendance" from "anon";

revoke references on table "public"."attendance" from "anon";

revoke select on table "public"."attendance" from "anon";

revoke trigger on table "public"."attendance" from "anon";

revoke truncate on table "public"."attendance" from "anon";

revoke update on table "public"."attendance" from "anon";

revoke delete on table "public"."attendance" from "authenticated";

revoke insert on table "public"."attendance" from "authenticated";

revoke references on table "public"."attendance" from "authenticated";

revoke select on table "public"."attendance" from "authenticated";

revoke trigger on table "public"."attendance" from "authenticated";

revoke truncate on table "public"."attendance" from "authenticated";

revoke update on table "public"."attendance" from "authenticated";

revoke delete on table "public"."attendance" from "service_role";

revoke insert on table "public"."attendance" from "service_role";

revoke references on table "public"."attendance" from "service_role";

revoke select on table "public"."attendance" from "service_role";

revoke trigger on table "public"."attendance" from "service_role";

revoke truncate on table "public"."attendance" from "service_role";

revoke update on table "public"."attendance" from "service_role";

revoke delete on table "public"."bus_change_requests" from "anon";

revoke insert on table "public"."bus_change_requests" from "anon";

revoke references on table "public"."bus_change_requests" from "anon";

revoke select on table "public"."bus_change_requests" from "anon";

revoke trigger on table "public"."bus_change_requests" from "anon";

revoke truncate on table "public"."bus_change_requests" from "anon";

revoke update on table "public"."bus_change_requests" from "anon";

revoke delete on table "public"."bus_change_requests" from "authenticated";

revoke insert on table "public"."bus_change_requests" from "authenticated";

revoke references on table "public"."bus_change_requests" from "authenticated";

revoke select on table "public"."bus_change_requests" from "authenticated";

revoke trigger on table "public"."bus_change_requests" from "authenticated";

revoke truncate on table "public"."bus_change_requests" from "authenticated";

revoke update on table "public"."bus_change_requests" from "authenticated";

revoke delete on table "public"."bus_change_requests" from "service_role";

revoke insert on table "public"."bus_change_requests" from "service_role";

revoke references on table "public"."bus_change_requests" from "service_role";

revoke select on table "public"."bus_change_requests" from "service_role";

revoke trigger on table "public"."bus_change_requests" from "service_role";

revoke truncate on table "public"."bus_change_requests" from "service_role";

revoke update on table "public"."bus_change_requests" from "service_role";

revoke delete on table "public"."bus_check_records" from "anon";

revoke insert on table "public"."bus_check_records" from "anon";

revoke references on table "public"."bus_check_records" from "anon";

revoke select on table "public"."bus_check_records" from "anon";

revoke trigger on table "public"."bus_check_records" from "anon";

revoke truncate on table "public"."bus_check_records" from "anon";

revoke update on table "public"."bus_check_records" from "anon";

revoke delete on table "public"."bus_check_records" from "authenticated";

revoke insert on table "public"."bus_check_records" from "authenticated";

revoke references on table "public"."bus_check_records" from "authenticated";

revoke select on table "public"."bus_check_records" from "authenticated";

revoke trigger on table "public"."bus_check_records" from "authenticated";

revoke truncate on table "public"."bus_check_records" from "authenticated";

revoke update on table "public"."bus_check_records" from "authenticated";

revoke delete on table "public"."bus_check_records" from "service_role";

revoke insert on table "public"."bus_check_records" from "service_role";

revoke references on table "public"."bus_check_records" from "service_role";

revoke select on table "public"."bus_check_records" from "service_role";

revoke trigger on table "public"."bus_check_records" from "service_role";

revoke truncate on table "public"."bus_check_records" from "service_role";

revoke update on table "public"."bus_check_records" from "service_role";

revoke delete on table "public"."bus_numbers" from "anon";

revoke insert on table "public"."bus_numbers" from "anon";

revoke references on table "public"."bus_numbers" from "anon";

revoke select on table "public"."bus_numbers" from "anon";

revoke trigger on table "public"."bus_numbers" from "anon";

revoke truncate on table "public"."bus_numbers" from "anon";

revoke update on table "public"."bus_numbers" from "anon";

revoke delete on table "public"."bus_numbers" from "authenticated";

revoke insert on table "public"."bus_numbers" from "authenticated";

revoke references on table "public"."bus_numbers" from "authenticated";

revoke select on table "public"."bus_numbers" from "authenticated";

revoke trigger on table "public"."bus_numbers" from "authenticated";

revoke truncate on table "public"."bus_numbers" from "authenticated";

revoke update on table "public"."bus_numbers" from "authenticated";

revoke delete on table "public"."bus_numbers" from "service_role";

revoke insert on table "public"."bus_numbers" from "service_role";

revoke references on table "public"."bus_numbers" from "service_role";

revoke select on table "public"."bus_numbers" from "service_role";

revoke trigger on table "public"."bus_numbers" from "service_role";

revoke truncate on table "public"."bus_numbers" from "service_role";

revoke update on table "public"."bus_numbers" from "service_role";

revoke delete on table "public"."bus_staff" from "anon";

revoke insert on table "public"."bus_staff" from "anon";

revoke references on table "public"."bus_staff" from "anon";

revoke select on table "public"."bus_staff" from "anon";

revoke trigger on table "public"."bus_staff" from "anon";

revoke truncate on table "public"."bus_staff" from "anon";

revoke update on table "public"."bus_staff" from "anon";

revoke delete on table "public"."bus_staff" from "authenticated";

revoke insert on table "public"."bus_staff" from "authenticated";

revoke references on table "public"."bus_staff" from "authenticated";

revoke select on table "public"."bus_staff" from "authenticated";

revoke trigger on table "public"."bus_staff" from "authenticated";

revoke truncate on table "public"."bus_staff" from "authenticated";

revoke update on table "public"."bus_staff" from "authenticated";

revoke delete on table "public"."bus_staff" from "service_role";

revoke insert on table "public"."bus_staff" from "service_role";

revoke references on table "public"."bus_staff" from "service_role";

revoke select on table "public"."bus_staff" from "service_role";

revoke trigger on table "public"."bus_staff" from "service_role";

revoke truncate on table "public"."bus_staff" from "service_role";

revoke update on table "public"."bus_staff" from "service_role";

revoke delete on table "public"."bus_stop_day_assignments" from "anon";

revoke insert on table "public"."bus_stop_day_assignments" from "anon";

revoke references on table "public"."bus_stop_day_assignments" from "anon";

revoke select on table "public"."bus_stop_day_assignments" from "anon";

revoke trigger on table "public"."bus_stop_day_assignments" from "anon";

revoke truncate on table "public"."bus_stop_day_assignments" from "anon";

revoke update on table "public"."bus_stop_day_assignments" from "anon";

revoke delete on table "public"."bus_stop_day_assignments" from "authenticated";

revoke insert on table "public"."bus_stop_day_assignments" from "authenticated";

revoke references on table "public"."bus_stop_day_assignments" from "authenticated";

revoke select on table "public"."bus_stop_day_assignments" from "authenticated";

revoke trigger on table "public"."bus_stop_day_assignments" from "authenticated";

revoke truncate on table "public"."bus_stop_day_assignments" from "authenticated";

revoke update on table "public"."bus_stop_day_assignments" from "authenticated";

revoke delete on table "public"."bus_stop_day_assignments" from "service_role";

revoke insert on table "public"."bus_stop_day_assignments" from "service_role";

revoke references on table "public"."bus_stop_day_assignments" from "service_role";

revoke select on table "public"."bus_stop_day_assignments" from "service_role";

revoke trigger on table "public"."bus_stop_day_assignments" from "service_role";

revoke truncate on table "public"."bus_stop_day_assignments" from "service_role";

revoke update on table "public"."bus_stop_day_assignments" from "service_role";

revoke delete on table "public"."bus_stop_schedules" from "anon";

revoke insert on table "public"."bus_stop_schedules" from "anon";

revoke references on table "public"."bus_stop_schedules" from "anon";

revoke select on table "public"."bus_stop_schedules" from "anon";

revoke trigger on table "public"."bus_stop_schedules" from "anon";

revoke truncate on table "public"."bus_stop_schedules" from "anon";

revoke update on table "public"."bus_stop_schedules" from "anon";

revoke delete on table "public"."bus_stop_schedules" from "authenticated";

revoke insert on table "public"."bus_stop_schedules" from "authenticated";

revoke references on table "public"."bus_stop_schedules" from "authenticated";

revoke select on table "public"."bus_stop_schedules" from "authenticated";

revoke trigger on table "public"."bus_stop_schedules" from "authenticated";

revoke truncate on table "public"."bus_stop_schedules" from "authenticated";

revoke update on table "public"."bus_stop_schedules" from "authenticated";

revoke delete on table "public"."bus_stop_schedules" from "service_role";

revoke insert on table "public"."bus_stop_schedules" from "service_role";

revoke references on table "public"."bus_stop_schedules" from "service_role";

revoke select on table "public"."bus_stop_schedules" from "service_role";

revoke trigger on table "public"."bus_stop_schedules" from "service_role";

revoke truncate on table "public"."bus_stop_schedules" from "service_role";

revoke update on table "public"."bus_stop_schedules" from "service_role";

revoke delete on table "public"."bus_stops" from "anon";

revoke insert on table "public"."bus_stops" from "anon";

revoke references on table "public"."bus_stops" from "anon";

revoke select on table "public"."bus_stops" from "anon";

revoke trigger on table "public"."bus_stops" from "anon";

revoke truncate on table "public"."bus_stops" from "anon";

revoke update on table "public"."bus_stops" from "anon";

revoke delete on table "public"."bus_stops" from "authenticated";

revoke insert on table "public"."bus_stops" from "authenticated";

revoke references on table "public"."bus_stops" from "authenticated";

revoke select on table "public"."bus_stops" from "authenticated";

revoke trigger on table "public"."bus_stops" from "authenticated";

revoke truncate on table "public"."bus_stops" from "authenticated";

revoke update on table "public"."bus_stops" from "authenticated";

revoke delete on table "public"."bus_stops" from "service_role";

revoke insert on table "public"."bus_stops" from "service_role";

revoke references on table "public"."bus_stops" from "service_role";

revoke select on table "public"."bus_stops" from "service_role";

revoke trigger on table "public"."bus_stops" from "service_role";

revoke truncate on table "public"."bus_stops" from "service_role";

revoke update on table "public"."bus_stops" from "service_role";

revoke delete on table "public"."bus_time_slots" from "anon";

revoke insert on table "public"."bus_time_slots" from "anon";

revoke references on table "public"."bus_time_slots" from "anon";

revoke select on table "public"."bus_time_slots" from "anon";

revoke trigger on table "public"."bus_time_slots" from "anon";

revoke truncate on table "public"."bus_time_slots" from "anon";

revoke update on table "public"."bus_time_slots" from "anon";

revoke delete on table "public"."bus_time_slots" from "authenticated";

revoke insert on table "public"."bus_time_slots" from "authenticated";

revoke references on table "public"."bus_time_slots" from "authenticated";

revoke select on table "public"."bus_time_slots" from "authenticated";

revoke trigger on table "public"."bus_time_slots" from "authenticated";

revoke truncate on table "public"."bus_time_slots" from "authenticated";

revoke update on table "public"."bus_time_slots" from "authenticated";

revoke delete on table "public"."bus_time_slots" from "service_role";

revoke insert on table "public"."bus_time_slots" from "service_role";

revoke references on table "public"."bus_time_slots" from "service_role";

revoke select on table "public"."bus_time_slots" from "service_role";

revoke trigger on table "public"."bus_time_slots" from "service_role";

revoke truncate on table "public"."bus_time_slots" from "service_role";

revoke update on table "public"."bus_time_slots" from "service_role";

revoke delete on table "public"."class_notice_attachments" from "anon";

revoke insert on table "public"."class_notice_attachments" from "anon";

revoke references on table "public"."class_notice_attachments" from "anon";

revoke select on table "public"."class_notice_attachments" from "anon";

revoke trigger on table "public"."class_notice_attachments" from "anon";

revoke truncate on table "public"."class_notice_attachments" from "anon";

revoke update on table "public"."class_notice_attachments" from "anon";

revoke delete on table "public"."class_notice_attachments" from "authenticated";

revoke insert on table "public"."class_notice_attachments" from "authenticated";

revoke references on table "public"."class_notice_attachments" from "authenticated";

revoke select on table "public"."class_notice_attachments" from "authenticated";

revoke trigger on table "public"."class_notice_attachments" from "authenticated";

revoke truncate on table "public"."class_notice_attachments" from "authenticated";

revoke update on table "public"."class_notice_attachments" from "authenticated";

revoke delete on table "public"."class_notice_attachments" from "service_role";

revoke insert on table "public"."class_notice_attachments" from "service_role";

revoke references on table "public"."class_notice_attachments" from "service_role";

revoke select on table "public"."class_notice_attachments" from "service_role";

revoke trigger on table "public"."class_notice_attachments" from "service_role";

revoke truncate on table "public"."class_notice_attachments" from "service_role";

revoke update on table "public"."class_notice_attachments" from "service_role";

revoke delete on table "public"."class_notices" from "anon";

revoke insert on table "public"."class_notices" from "anon";

revoke references on table "public"."class_notices" from "anon";

revoke select on table "public"."class_notices" from "anon";

revoke trigger on table "public"."class_notices" from "anon";

revoke truncate on table "public"."class_notices" from "anon";

revoke update on table "public"."class_notices" from "anon";

revoke delete on table "public"."class_notices" from "authenticated";

revoke insert on table "public"."class_notices" from "authenticated";

revoke references on table "public"."class_notices" from "authenticated";

revoke select on table "public"."class_notices" from "authenticated";

revoke trigger on table "public"."class_notices" from "authenticated";

revoke truncate on table "public"."class_notices" from "authenticated";

revoke update on table "public"."class_notices" from "authenticated";

revoke delete on table "public"."class_notices" from "service_role";

revoke insert on table "public"."class_notices" from "service_role";

revoke references on table "public"."class_notices" from "service_role";

revoke select on table "public"."class_notices" from "service_role";

revoke trigger on table "public"."class_notices" from "service_role";

revoke truncate on table "public"."class_notices" from "service_role";

revoke update on table "public"."class_notices" from "service_role";

revoke delete on table "public"."class_schedules" from "anon";

revoke insert on table "public"."class_schedules" from "anon";

revoke references on table "public"."class_schedules" from "anon";

revoke select on table "public"."class_schedules" from "anon";

revoke trigger on table "public"."class_schedules" from "anon";

revoke truncate on table "public"."class_schedules" from "anon";

revoke update on table "public"."class_schedules" from "anon";

revoke delete on table "public"."class_schedules" from "authenticated";

revoke insert on table "public"."class_schedules" from "authenticated";

revoke references on table "public"."class_schedules" from "authenticated";

revoke select on table "public"."class_schedules" from "authenticated";

revoke trigger on table "public"."class_schedules" from "authenticated";

revoke truncate on table "public"."class_schedules" from "authenticated";

revoke update on table "public"."class_schedules" from "authenticated";

revoke delete on table "public"."class_schedules" from "service_role";

revoke insert on table "public"."class_schedules" from "service_role";

revoke references on table "public"."class_schedules" from "service_role";

revoke select on table "public"."class_schedules" from "service_role";

revoke trigger on table "public"."class_schedules" from "service_role";

revoke truncate on table "public"."class_schedules" from "service_role";

revoke update on table "public"."class_schedules" from "service_role";

revoke delete on table "public"."class_students" from "anon";

revoke insert on table "public"."class_students" from "anon";

revoke references on table "public"."class_students" from "anon";

revoke select on table "public"."class_students" from "anon";

revoke trigger on table "public"."class_students" from "anon";

revoke truncate on table "public"."class_students" from "anon";

revoke update on table "public"."class_students" from "anon";

revoke delete on table "public"."class_students" from "authenticated";

revoke insert on table "public"."class_students" from "authenticated";

revoke references on table "public"."class_students" from "authenticated";

revoke select on table "public"."class_students" from "authenticated";

revoke trigger on table "public"."class_students" from "authenticated";

revoke truncate on table "public"."class_students" from "authenticated";

revoke update on table "public"."class_students" from "authenticated";

revoke delete on table "public"."class_students" from "service_role";

revoke insert on table "public"."class_students" from "service_role";

revoke references on table "public"."class_students" from "service_role";

revoke select on table "public"."class_students" from "service_role";

revoke trigger on table "public"."class_students" from "service_role";

revoke truncate on table "public"."class_students" from "service_role";

revoke update on table "public"."class_students" from "service_role";

revoke delete on table "public"."class_teachers" from "anon";

revoke insert on table "public"."class_teachers" from "anon";

revoke references on table "public"."class_teachers" from "anon";

revoke select on table "public"."class_teachers" from "anon";

revoke trigger on table "public"."class_teachers" from "anon";

revoke truncate on table "public"."class_teachers" from "anon";

revoke update on table "public"."class_teachers" from "anon";

revoke delete on table "public"."class_teachers" from "authenticated";

revoke insert on table "public"."class_teachers" from "authenticated";

revoke references on table "public"."class_teachers" from "authenticated";

revoke select on table "public"."class_teachers" from "authenticated";

revoke trigger on table "public"."class_teachers" from "authenticated";

revoke truncate on table "public"."class_teachers" from "authenticated";

revoke update on table "public"."class_teachers" from "authenticated";

revoke delete on table "public"."class_teachers" from "service_role";

revoke insert on table "public"."class_teachers" from "service_role";

revoke references on table "public"."class_teachers" from "service_role";

revoke select on table "public"."class_teachers" from "service_role";

revoke trigger on table "public"."class_teachers" from "service_role";

revoke truncate on table "public"."class_teachers" from "service_role";

revoke update on table "public"."class_teachers" from "service_role";

revoke delete on table "public"."class_textbooks" from "anon";

revoke insert on table "public"."class_textbooks" from "anon";

revoke references on table "public"."class_textbooks" from "anon";

revoke select on table "public"."class_textbooks" from "anon";

revoke trigger on table "public"."class_textbooks" from "anon";

revoke truncate on table "public"."class_textbooks" from "anon";

revoke update on table "public"."class_textbooks" from "anon";

revoke delete on table "public"."class_textbooks" from "authenticated";

revoke insert on table "public"."class_textbooks" from "authenticated";

revoke references on table "public"."class_textbooks" from "authenticated";

revoke select on table "public"."class_textbooks" from "authenticated";

revoke trigger on table "public"."class_textbooks" from "authenticated";

revoke truncate on table "public"."class_textbooks" from "authenticated";

revoke update on table "public"."class_textbooks" from "authenticated";

revoke delete on table "public"."class_textbooks" from "service_role";

revoke insert on table "public"."class_textbooks" from "service_role";

revoke references on table "public"."class_textbooks" from "service_role";

revoke select on table "public"."class_textbooks" from "service_role";

revoke trigger on table "public"."class_textbooks" from "service_role";

revoke truncate on table "public"."class_textbooks" from "service_role";

revoke update on table "public"."class_textbooks" from "service_role";

revoke delete on table "public"."classes" from "anon";

revoke insert on table "public"."classes" from "anon";

revoke references on table "public"."classes" from "anon";

revoke select on table "public"."classes" from "anon";

revoke trigger on table "public"."classes" from "anon";

revoke truncate on table "public"."classes" from "anon";

revoke update on table "public"."classes" from "anon";

revoke delete on table "public"."classes" from "authenticated";

revoke insert on table "public"."classes" from "authenticated";

revoke references on table "public"."classes" from "authenticated";

revoke select on table "public"."classes" from "authenticated";

revoke trigger on table "public"."classes" from "authenticated";

revoke truncate on table "public"."classes" from "authenticated";

revoke update on table "public"."classes" from "authenticated";

revoke delete on table "public"."classes" from "service_role";

revoke insert on table "public"."classes" from "service_role";

revoke references on table "public"."classes" from "service_role";

revoke select on table "public"."classes" from "service_role";

revoke trigger on table "public"."classes" from "service_role";

revoke truncate on table "public"."classes" from "service_role";

revoke update on table "public"."classes" from "service_role";

revoke delete on table "public"."homework_assignments" from "anon";

revoke insert on table "public"."homework_assignments" from "anon";

revoke references on table "public"."homework_assignments" from "anon";

revoke select on table "public"."homework_assignments" from "anon";

revoke trigger on table "public"."homework_assignments" from "anon";

revoke truncate on table "public"."homework_assignments" from "anon";

revoke update on table "public"."homework_assignments" from "anon";

revoke delete on table "public"."homework_assignments" from "authenticated";

revoke insert on table "public"."homework_assignments" from "authenticated";

revoke references on table "public"."homework_assignments" from "authenticated";

revoke select on table "public"."homework_assignments" from "authenticated";

revoke trigger on table "public"."homework_assignments" from "authenticated";

revoke truncate on table "public"."homework_assignments" from "authenticated";

revoke update on table "public"."homework_assignments" from "authenticated";

revoke delete on table "public"."homework_assignments" from "service_role";

revoke insert on table "public"."homework_assignments" from "service_role";

revoke references on table "public"."homework_assignments" from "service_role";

revoke select on table "public"."homework_assignments" from "service_role";

revoke trigger on table "public"."homework_assignments" from "service_role";

revoke truncate on table "public"."homework_assignments" from "service_role";

revoke update on table "public"."homework_assignments" from "service_role";

revoke delete on table "public"."homework_submission_files" from "anon";

revoke insert on table "public"."homework_submission_files" from "anon";

revoke references on table "public"."homework_submission_files" from "anon";

revoke select on table "public"."homework_submission_files" from "anon";

revoke trigger on table "public"."homework_submission_files" from "anon";

revoke truncate on table "public"."homework_submission_files" from "anon";

revoke update on table "public"."homework_submission_files" from "anon";

revoke delete on table "public"."homework_submission_files" from "authenticated";

revoke insert on table "public"."homework_submission_files" from "authenticated";

revoke references on table "public"."homework_submission_files" from "authenticated";

revoke select on table "public"."homework_submission_files" from "authenticated";

revoke trigger on table "public"."homework_submission_files" from "authenticated";

revoke truncate on table "public"."homework_submission_files" from "authenticated";

revoke update on table "public"."homework_submission_files" from "authenticated";

revoke delete on table "public"."homework_submission_files" from "service_role";

revoke insert on table "public"."homework_submission_files" from "service_role";

revoke references on table "public"."homework_submission_files" from "service_role";

revoke select on table "public"."homework_submission_files" from "service_role";

revoke trigger on table "public"."homework_submission_files" from "service_role";

revoke truncate on table "public"."homework_submission_files" from "service_role";

revoke update on table "public"."homework_submission_files" from "service_role";

revoke delete on table "public"."homework_submissions" from "anon";

revoke insert on table "public"."homework_submissions" from "anon";

revoke references on table "public"."homework_submissions" from "anon";

revoke select on table "public"."homework_submissions" from "anon";

revoke trigger on table "public"."homework_submissions" from "anon";

revoke truncate on table "public"."homework_submissions" from "anon";

revoke update on table "public"."homework_submissions" from "anon";

revoke delete on table "public"."homework_submissions" from "authenticated";

revoke insert on table "public"."homework_submissions" from "authenticated";

revoke references on table "public"."homework_submissions" from "authenticated";

revoke select on table "public"."homework_submissions" from "authenticated";

revoke trigger on table "public"."homework_submissions" from "authenticated";

revoke truncate on table "public"."homework_submissions" from "authenticated";

revoke update on table "public"."homework_submissions" from "authenticated";

revoke delete on table "public"."homework_submissions" from "service_role";

revoke insert on table "public"."homework_submissions" from "service_role";

revoke references on table "public"."homework_submissions" from "service_role";

revoke select on table "public"."homework_submissions" from "service_role";

revoke trigger on table "public"."homework_submissions" from "service_role";

revoke truncate on table "public"."homework_submissions" from "service_role";

revoke update on table "public"."homework_submissions" from "service_role";

revoke delete on table "public"."learning_records" from "anon";

revoke insert on table "public"."learning_records" from "anon";

revoke references on table "public"."learning_records" from "anon";

revoke select on table "public"."learning_records" from "anon";

revoke trigger on table "public"."learning_records" from "anon";

revoke truncate on table "public"."learning_records" from "anon";

revoke update on table "public"."learning_records" from "anon";

revoke delete on table "public"."learning_records" from "authenticated";

revoke insert on table "public"."learning_records" from "authenticated";

revoke references on table "public"."learning_records" from "authenticated";

revoke select on table "public"."learning_records" from "authenticated";

revoke trigger on table "public"."learning_records" from "authenticated";

revoke truncate on table "public"."learning_records" from "authenticated";

revoke update on table "public"."learning_records" from "authenticated";

revoke delete on table "public"."learning_records" from "service_role";

revoke insert on table "public"."learning_records" from "service_role";

revoke references on table "public"."learning_records" from "service_role";

revoke select on table "public"."learning_records" from "service_role";

revoke trigger on table "public"."learning_records" from "service_role";

revoke truncate on table "public"."learning_records" from "service_role";

revoke update on table "public"."learning_records" from "service_role";

revoke delete on table "public"."lunch_class_order_anchors" from "anon";

revoke insert on table "public"."lunch_class_order_anchors" from "anon";

revoke references on table "public"."lunch_class_order_anchors" from "anon";

revoke select on table "public"."lunch_class_order_anchors" from "anon";

revoke trigger on table "public"."lunch_class_order_anchors" from "anon";

revoke truncate on table "public"."lunch_class_order_anchors" from "anon";

revoke update on table "public"."lunch_class_order_anchors" from "anon";

revoke delete on table "public"."lunch_class_order_anchors" from "authenticated";

revoke insert on table "public"."lunch_class_order_anchors" from "authenticated";

revoke references on table "public"."lunch_class_order_anchors" from "authenticated";

revoke select on table "public"."lunch_class_order_anchors" from "authenticated";

revoke trigger on table "public"."lunch_class_order_anchors" from "authenticated";

revoke truncate on table "public"."lunch_class_order_anchors" from "authenticated";

revoke update on table "public"."lunch_class_order_anchors" from "authenticated";

revoke delete on table "public"."lunch_class_order_anchors" from "service_role";

revoke insert on table "public"."lunch_class_order_anchors" from "service_role";

revoke references on table "public"."lunch_class_order_anchors" from "service_role";

revoke select on table "public"."lunch_class_order_anchors" from "service_role";

revoke trigger on table "public"."lunch_class_order_anchors" from "service_role";

revoke truncate on table "public"."lunch_class_order_anchors" from "service_role";

revoke update on table "public"."lunch_class_order_anchors" from "service_role";

revoke delete on table "public"."lunch_leader_anchors" from "anon";

revoke insert on table "public"."lunch_leader_anchors" from "anon";

revoke references on table "public"."lunch_leader_anchors" from "anon";

revoke select on table "public"."lunch_leader_anchors" from "anon";

revoke trigger on table "public"."lunch_leader_anchors" from "anon";

revoke truncate on table "public"."lunch_leader_anchors" from "anon";

revoke update on table "public"."lunch_leader_anchors" from "anon";

revoke delete on table "public"."lunch_leader_anchors" from "authenticated";

revoke insert on table "public"."lunch_leader_anchors" from "authenticated";

revoke references on table "public"."lunch_leader_anchors" from "authenticated";

revoke select on table "public"."lunch_leader_anchors" from "authenticated";

revoke trigger on table "public"."lunch_leader_anchors" from "authenticated";

revoke truncate on table "public"."lunch_leader_anchors" from "authenticated";

revoke update on table "public"."lunch_leader_anchors" from "authenticated";

revoke delete on table "public"."lunch_leader_anchors" from "service_role";

revoke insert on table "public"."lunch_leader_anchors" from "service_role";

revoke references on table "public"."lunch_leader_anchors" from "service_role";

revoke select on table "public"."lunch_leader_anchors" from "service_role";

revoke trigger on table "public"."lunch_leader_anchors" from "service_role";

revoke truncate on table "public"."lunch_leader_anchors" from "service_role";

revoke update on table "public"."lunch_leader_anchors" from "service_role";

revoke delete on table "public"."notice_attachments" from "anon";

revoke insert on table "public"."notice_attachments" from "anon";

revoke references on table "public"."notice_attachments" from "anon";

revoke select on table "public"."notice_attachments" from "anon";

revoke trigger on table "public"."notice_attachments" from "anon";

revoke truncate on table "public"."notice_attachments" from "anon";

revoke update on table "public"."notice_attachments" from "anon";

revoke delete on table "public"."notice_attachments" from "authenticated";

revoke insert on table "public"."notice_attachments" from "authenticated";

revoke references on table "public"."notice_attachments" from "authenticated";

revoke select on table "public"."notice_attachments" from "authenticated";

revoke trigger on table "public"."notice_attachments" from "authenticated";

revoke truncate on table "public"."notice_attachments" from "authenticated";

revoke update on table "public"."notice_attachments" from "authenticated";

revoke delete on table "public"."notice_attachments" from "service_role";

revoke insert on table "public"."notice_attachments" from "service_role";

revoke references on table "public"."notice_attachments" from "service_role";

revoke select on table "public"."notice_attachments" from "service_role";

revoke trigger on table "public"."notice_attachments" from "service_role";

revoke truncate on table "public"."notice_attachments" from "service_role";

revoke update on table "public"."notice_attachments" from "service_role";

revoke delete on table "public"."notices" from "anon";

revoke insert on table "public"."notices" from "anon";

revoke references on table "public"."notices" from "anon";

revoke select on table "public"."notices" from "anon";

revoke trigger on table "public"."notices" from "anon";

revoke truncate on table "public"."notices" from "anon";

revoke update on table "public"."notices" from "anon";

revoke delete on table "public"."notices" from "authenticated";

revoke insert on table "public"."notices" from "authenticated";

revoke references on table "public"."notices" from "authenticated";

revoke select on table "public"."notices" from "authenticated";

revoke trigger on table "public"."notices" from "authenticated";

revoke truncate on table "public"."notices" from "authenticated";

revoke update on table "public"."notices" from "authenticated";

revoke delete on table "public"."notices" from "service_role";

revoke insert on table "public"."notices" from "service_role";

revoke references on table "public"."notices" from "service_role";

revoke select on table "public"."notices" from "service_role";

revoke trigger on table "public"."notices" from "service_role";

revoke truncate on table "public"."notices" from "service_role";

revoke update on table "public"."notices" from "service_role";

revoke delete on table "public"."profiles" from "anon";

revoke insert on table "public"."profiles" from "anon";

revoke references on table "public"."profiles" from "anon";

revoke select on table "public"."profiles" from "anon";

revoke trigger on table "public"."profiles" from "anon";

revoke truncate on table "public"."profiles" from "anon";

revoke update on table "public"."profiles" from "anon";

revoke delete on table "public"."profiles" from "authenticated";

revoke insert on table "public"."profiles" from "authenticated";

revoke references on table "public"."profiles" from "authenticated";

revoke select on table "public"."profiles" from "authenticated";

revoke trigger on table "public"."profiles" from "authenticated";

revoke truncate on table "public"."profiles" from "authenticated";

revoke update on table "public"."profiles" from "authenticated";

revoke delete on table "public"."profiles" from "service_role";

revoke insert on table "public"."profiles" from "service_role";

revoke references on table "public"."profiles" from "service_role";

revoke select on table "public"."profiles" from "service_role";

revoke trigger on table "public"."profiles" from "service_role";

revoke truncate on table "public"."profiles" from "service_role";

revoke update on table "public"."profiles" from "service_role";

revoke delete on table "public"."report_cards" from "anon";

revoke insert on table "public"."report_cards" from "anon";

revoke references on table "public"."report_cards" from "anon";

revoke select on table "public"."report_cards" from "anon";

revoke trigger on table "public"."report_cards" from "anon";

revoke truncate on table "public"."report_cards" from "anon";

revoke update on table "public"."report_cards" from "anon";

revoke delete on table "public"."report_cards" from "authenticated";

revoke insert on table "public"."report_cards" from "authenticated";

revoke references on table "public"."report_cards" from "authenticated";

revoke select on table "public"."report_cards" from "authenticated";

revoke trigger on table "public"."report_cards" from "authenticated";

revoke truncate on table "public"."report_cards" from "authenticated";

revoke update on table "public"."report_cards" from "authenticated";

revoke delete on table "public"."report_cards" from "service_role";

revoke insert on table "public"."report_cards" from "service_role";

revoke references on table "public"."report_cards" from "service_role";

revoke select on table "public"."report_cards" from "service_role";

revoke trigger on table "public"."report_cards" from "service_role";

revoke truncate on table "public"."report_cards" from "service_role";

revoke update on table "public"."report_cards" from "service_role";

revoke delete on table "public"."student_bus_defaults" from "anon";

revoke insert on table "public"."student_bus_defaults" from "anon";

revoke references on table "public"."student_bus_defaults" from "anon";

revoke select on table "public"."student_bus_defaults" from "anon";

revoke trigger on table "public"."student_bus_defaults" from "anon";

revoke truncate on table "public"."student_bus_defaults" from "anon";

revoke update on table "public"."student_bus_defaults" from "anon";

revoke delete on table "public"."student_bus_defaults" from "authenticated";

revoke insert on table "public"."student_bus_defaults" from "authenticated";

revoke references on table "public"."student_bus_defaults" from "authenticated";

revoke select on table "public"."student_bus_defaults" from "authenticated";

revoke trigger on table "public"."student_bus_defaults" from "authenticated";

revoke truncate on table "public"."student_bus_defaults" from "authenticated";

revoke update on table "public"."student_bus_defaults" from "authenticated";

revoke delete on table "public"."student_bus_defaults" from "service_role";

revoke insert on table "public"."student_bus_defaults" from "service_role";

revoke references on table "public"."student_bus_defaults" from "service_role";

revoke select on table "public"."student_bus_defaults" from "service_role";

revoke trigger on table "public"."student_bus_defaults" from "service_role";

revoke truncate on table "public"."student_bus_defaults" from "service_role";

revoke update on table "public"."student_bus_defaults" from "service_role";

revoke delete on table "public"."student_textbook_progress" from "anon";

revoke insert on table "public"."student_textbook_progress" from "anon";

revoke references on table "public"."student_textbook_progress" from "anon";

revoke select on table "public"."student_textbook_progress" from "anon";

revoke trigger on table "public"."student_textbook_progress" from "anon";

revoke truncate on table "public"."student_textbook_progress" from "anon";

revoke update on table "public"."student_textbook_progress" from "anon";

revoke delete on table "public"."student_textbook_progress" from "authenticated";

revoke insert on table "public"."student_textbook_progress" from "authenticated";

revoke references on table "public"."student_textbook_progress" from "authenticated";

revoke select on table "public"."student_textbook_progress" from "authenticated";

revoke trigger on table "public"."student_textbook_progress" from "authenticated";

revoke truncate on table "public"."student_textbook_progress" from "authenticated";

revoke update on table "public"."student_textbook_progress" from "authenticated";

revoke delete on table "public"."student_textbook_progress" from "service_role";

revoke insert on table "public"."student_textbook_progress" from "service_role";

revoke references on table "public"."student_textbook_progress" from "service_role";

revoke select on table "public"."student_textbook_progress" from "service_role";

revoke trigger on table "public"."student_textbook_progress" from "service_role";

revoke truncate on table "public"."student_textbook_progress" from "service_role";

revoke update on table "public"."student_textbook_progress" from "service_role";

revoke delete on table "public"."students" from "anon";

revoke insert on table "public"."students" from "anon";

revoke references on table "public"."students" from "anon";

revoke select on table "public"."students" from "anon";

revoke trigger on table "public"."students" from "anon";

revoke truncate on table "public"."students" from "anon";

revoke update on table "public"."students" from "anon";

revoke delete on table "public"."students" from "authenticated";

revoke insert on table "public"."students" from "authenticated";

revoke references on table "public"."students" from "authenticated";

revoke select on table "public"."students" from "authenticated";

revoke trigger on table "public"."students" from "authenticated";

revoke truncate on table "public"."students" from "authenticated";

revoke update on table "public"."students" from "authenticated";

revoke delete on table "public"."students" from "service_role";

revoke insert on table "public"."students" from "service_role";

revoke references on table "public"."students" from "service_role";

revoke select on table "public"."students" from "service_role";

revoke trigger on table "public"."students" from "service_role";

revoke truncate on table "public"."students" from "service_role";

revoke update on table "public"."students" from "service_role";

revoke delete on table "public"."teachers" from "anon";

revoke insert on table "public"."teachers" from "anon";

revoke references on table "public"."teachers" from "anon";

revoke select on table "public"."teachers" from "anon";

revoke trigger on table "public"."teachers" from "anon";

revoke truncate on table "public"."teachers" from "anon";

revoke update on table "public"."teachers" from "anon";

revoke delete on table "public"."teachers" from "authenticated";

revoke insert on table "public"."teachers" from "authenticated";

revoke references on table "public"."teachers" from "authenticated";

revoke select on table "public"."teachers" from "authenticated";

revoke trigger on table "public"."teachers" from "authenticated";

revoke truncate on table "public"."teachers" from "authenticated";

revoke update on table "public"."teachers" from "authenticated";

revoke delete on table "public"."teachers" from "service_role";

revoke insert on table "public"."teachers" from "service_role";

revoke references on table "public"."teachers" from "service_role";

revoke select on table "public"."teachers" from "service_role";

revoke trigger on table "public"."teachers" from "service_role";

revoke truncate on table "public"."teachers" from "service_role";

revoke update on table "public"."teachers" from "service_role";

revoke delete on table "public"."textbooks" from "anon";

revoke insert on table "public"."textbooks" from "anon";

revoke references on table "public"."textbooks" from "anon";

revoke select on table "public"."textbooks" from "anon";

revoke trigger on table "public"."textbooks" from "anon";

revoke truncate on table "public"."textbooks" from "anon";

revoke update on table "public"."textbooks" from "anon";

revoke delete on table "public"."textbooks" from "authenticated";

revoke insert on table "public"."textbooks" from "authenticated";

revoke references on table "public"."textbooks" from "authenticated";

revoke select on table "public"."textbooks" from "authenticated";

revoke trigger on table "public"."textbooks" from "authenticated";

revoke truncate on table "public"."textbooks" from "authenticated";

revoke update on table "public"."textbooks" from "authenticated";

revoke delete on table "public"."textbooks" from "service_role";

revoke insert on table "public"."textbooks" from "service_role";

revoke references on table "public"."textbooks" from "service_role";

revoke select on table "public"."textbooks" from "service_role";

revoke trigger on table "public"."textbooks" from "service_role";

revoke truncate on table "public"."textbooks" from "service_role";

revoke update on table "public"."textbooks" from "service_role";

revoke delete on table "public"."weekly_sentence_config" from "anon";

revoke insert on table "public"."weekly_sentence_config" from "anon";

revoke references on table "public"."weekly_sentence_config" from "anon";

revoke select on table "public"."weekly_sentence_config" from "anon";

revoke trigger on table "public"."weekly_sentence_config" from "anon";

revoke truncate on table "public"."weekly_sentence_config" from "anon";

revoke update on table "public"."weekly_sentence_config" from "anon";

revoke delete on table "public"."weekly_sentence_config" from "authenticated";

revoke insert on table "public"."weekly_sentence_config" from "authenticated";

revoke references on table "public"."weekly_sentence_config" from "authenticated";

revoke select on table "public"."weekly_sentence_config" from "authenticated";

revoke trigger on table "public"."weekly_sentence_config" from "authenticated";

revoke truncate on table "public"."weekly_sentence_config" from "authenticated";

revoke update on table "public"."weekly_sentence_config" from "authenticated";

revoke delete on table "public"."weekly_sentence_config" from "service_role";

revoke insert on table "public"."weekly_sentence_config" from "service_role";

revoke references on table "public"."weekly_sentence_config" from "service_role";

revoke select on table "public"."weekly_sentence_config" from "service_role";

revoke trigger on table "public"."weekly_sentence_config" from "service_role";

revoke truncate on table "public"."weekly_sentence_config" from "service_role";

revoke update on table "public"."weekly_sentence_config" from "service_role";

revoke delete on table "public"."weekly_sentences" from "anon";

revoke insert on table "public"."weekly_sentences" from "anon";

revoke references on table "public"."weekly_sentences" from "anon";

revoke select on table "public"."weekly_sentences" from "anon";

revoke trigger on table "public"."weekly_sentences" from "anon";

revoke truncate on table "public"."weekly_sentences" from "anon";

revoke update on table "public"."weekly_sentences" from "anon";

revoke delete on table "public"."weekly_sentences" from "authenticated";

revoke insert on table "public"."weekly_sentences" from "authenticated";

revoke references on table "public"."weekly_sentences" from "authenticated";

revoke select on table "public"."weekly_sentences" from "authenticated";

revoke trigger on table "public"."weekly_sentences" from "authenticated";

revoke truncate on table "public"."weekly_sentences" from "authenticated";

revoke update on table "public"."weekly_sentences" from "authenticated";

revoke delete on table "public"."weekly_sentences" from "service_role";

revoke insert on table "public"."weekly_sentences" from "service_role";

revoke references on table "public"."weekly_sentences" from "service_role";

revoke select on table "public"."weekly_sentences" from "service_role";

revoke trigger on table "public"."weekly_sentences" from "service_role";

revoke truncate on table "public"."weekly_sentences" from "service_role";

revoke update on table "public"."weekly_sentences" from "service_role";

alter table "public"."academy_notice_attachments" drop constraint "academy_notice_attachments_academy_notice_id_fkey";

alter table "public"."academy_notices" drop constraint "academy_notices_author_id_fkey";

alter table "public"."academy_periods" drop constraint "chk_group_label";

alter table "public"."afterschool_enrollments" drop constraint "afterschool_enrollments_class_id_student_profile_id_day_of__key";

alter table "public"."afterschool_enrollments" drop constraint "afterschool_enrollments_day_of_week_check";

alter table "public"."afterschool_enrollments" drop constraint "afterschool_enrollments_student_profile_id_fkey";

alter table "public"."attendance" drop constraint "attendance_recorded_by_fkey";

alter table "public"."attendance" drop constraint "attendance_status_check";

alter table "public"."attendance" drop constraint "attendance_student_profile_id_date_key";

alter table "public"."attendance" drop constraint "attendance_student_profile_id_fkey";

alter table "public"."bus_change_requests" drop constraint "bus_change_requests_change_type_check";

alter table "public"."bus_change_requests" drop constraint "bus_change_requests_new_bus_number_id_fkey";

alter table "public"."bus_change_requests" drop constraint "bus_change_requests_new_bus_stop_id_fkey";

alter table "public"."bus_change_requests" drop constraint "bus_change_requests_new_bus_time_slot_id_fkey";

alter table "public"."bus_change_requests" drop constraint "bus_change_requests_reviewed_by_fkey";

alter table "public"."bus_change_requests" drop constraint "bus_change_requests_status_check";

alter table "public"."bus_change_requests" drop constraint "bus_change_requests_student_date_key";

alter table "public"."bus_change_requests" drop constraint "bus_change_requests_student_profile_id_fkey";

alter table "public"."bus_check_records" drop constraint "bus_check_records_bus_number_id_fkey";

alter table "public"."bus_check_records" drop constraint "bus_check_records_bus_time_slot_id_fkey";

alter table "public"."bus_check_records" drop constraint "bus_check_records_checked_by_fkey";

alter table "public"."bus_check_records" drop constraint "bus_check_records_student_date_key";

alter table "public"."bus_check_records" drop constraint "bus_check_records_student_profile_id_fkey";

alter table "public"."bus_staff" drop constraint "bus_staff_bus_number_id_fkey";

alter table "public"."bus_staff" drop constraint "bus_staff_profile_id_fkey";

alter table "public"."bus_staff" drop constraint "bus_staff_profile_id_key";

alter table "public"."bus_stop_day_assignments" drop constraint "bus_stop_day_assignments_bus_number_id_fkey";

alter table "public"."bus_stop_day_assignments" drop constraint "bus_stop_day_assignments_bus_stop_id_fkey";

alter table "public"."bus_stop_day_assignments" drop constraint "bus_stop_day_assignments_bus_time_slot_id_fkey";

alter table "public"."bus_stop_day_assignments" drop constraint "bus_stop_day_assignments_day_of_week_check";

alter table "public"."bus_stop_schedules" drop constraint "bus_stop_schedules_bus_stop_id_fkey";

alter table "public"."bus_stop_schedules" drop constraint "bus_stop_schedules_bus_time_slot_id_fkey";

alter table "public"."bus_stop_schedules" drop constraint "bus_stop_schedules_day_of_week_check";

alter table "public"."bus_stop_schedules" drop constraint "bus_stop_schedules_stop_day_slot_key";

alter table "public"."class_notice_attachments" drop constraint "class_notice_attachments_class_notice_id_fkey";

alter table "public"."class_notices" drop constraint "class_notices_author_id_fkey";

alter table "public"."class_notices" drop constraint "class_notices_class_id_fkey";

alter table "public"."class_schedules" drop constraint "chk_class_or_student";

alter table "public"."class_schedules" drop constraint "class_schedules_day_of_week_check";

alter table "public"."class_schedules" drop constraint "class_schedules_student_profile_id_fkey";

alter table "public"."class_schedules" drop constraint "class_schedules_teacher_profile_id_fkey";

alter table "public"."class_schedules" drop constraint "class_schedules_textbook_id_fkey";

alter table "public"."class_students" drop constraint "class_students_class_id_student_profile_id_key";

alter table "public"."class_students" drop constraint "class_students_student_profile_id_fkey";

alter table "public"."class_teachers" drop constraint "class_teachers_class_id_teacher_profile_id_key";

alter table "public"."class_teachers" drop constraint "class_teachers_teacher_profile_id_fkey";

alter table "public"."class_textbooks" drop constraint "class_textbooks_class_id_fkey";

alter table "public"."class_textbooks" drop constraint "class_textbooks_class_id_textbook_id_key";

alter table "public"."class_textbooks" drop constraint "class_textbooks_textbook_id_fkey";

alter table "public"."classes" drop constraint "classes_group_label_check";

alter table "public"."classes" drop constraint "classes_lunch_group_check";

alter table "public"."homework_assignments" drop constraint "homework_assignments_class_id_fkey";

alter table "public"."homework_assignments" drop constraint "homework_assignments_teacher_id_fkey";

alter table "public"."homework_submission_files" drop constraint "homework_submission_files_submission_id_fkey";

alter table "public"."homework_submissions" drop constraint "homework_submissions_assignment_id_fkey";

alter table "public"."homework_submissions" drop constraint "homework_submissions_assignment_id_student_profile_id_key";

alter table "public"."homework_submissions" drop constraint "homework_submissions_reviewed_by_fkey";

alter table "public"."homework_submissions" drop constraint "homework_submissions_status_check";

alter table "public"."homework_submissions" drop constraint "homework_submissions_student_profile_id_fkey";

alter table "public"."learning_records" drop constraint "learning_records_author_id_fkey";

alter table "public"."learning_records" drop constraint "learning_records_category_check";

alter table "public"."learning_records" drop constraint "learning_records_student_profile_id_fkey";

alter table "public"."lunch_class_order_anchors" drop constraint "lunch_class_order_anchors_created_by_fkey";

alter table "public"."lunch_class_order_anchors" drop constraint "lunch_class_order_anchors_first_class_id_fkey";

alter table "public"."lunch_class_order_anchors" drop constraint "lunch_class_order_anchors_lunch_group_check";

alter table "public"."lunch_class_order_anchors" drop constraint "lunch_class_order_anchors_unique";

alter table "public"."lunch_leader_anchors" drop constraint "lunch_leader_anchors_unique";

alter table "public"."lunch_leader_anchors" drop constraint "lunch_leader_overrides_class_id_fkey";

alter table "public"."lunch_leader_anchors" drop constraint "lunch_leader_overrides_created_by_fkey";

alter table "public"."lunch_leader_anchors" drop constraint "lunch_leader_overrides_leader_student_id_fkey";

alter table "public"."notice_attachments" drop constraint "notice_attachments_file_type_check";

alter table "public"."notice_attachments" drop constraint "notice_attachments_notice_id_fkey";

alter table "public"."notices" drop constraint "notices_author_id_fkey";

alter table "public"."report_cards" drop constraint "report_cards_author_id_fkey";

alter table "public"."report_cards" drop constraint "report_cards_month_check";

alter table "public"."report_cards" drop constraint "report_cards_student_profile_id_fkey";

alter table "public"."report_cards" drop constraint "report_cards_student_profile_id_year_month_key";

alter table "public"."report_cards" drop constraint "report_cards_year_check";

alter table "public"."student_bus_defaults" drop constraint "student_bus_defaults_bus_stop_id_fkey";

alter table "public"."student_bus_defaults" drop constraint "student_bus_defaults_bus_time_slot_id_fkey";

alter table "public"."student_bus_defaults" drop constraint "student_bus_defaults_day_of_week_check";

alter table "public"."student_bus_defaults" drop constraint "student_bus_defaults_student_day_key";

alter table "public"."student_bus_defaults" drop constraint "student_bus_defaults_student_profile_id_fkey";

alter table "public"."student_textbook_progress" drop constraint "student_textbook_progress_source_class_id_fkey";

alter table "public"."student_textbook_progress" drop constraint "student_textbook_progress_source_type_check";

alter table "public"."student_textbook_progress" drop constraint "student_textbook_progress_status_check";

alter table "public"."student_textbook_progress" drop constraint "student_textbook_progress_student_profile_id_fkey";

alter table "public"."student_textbook_progress" drop constraint "student_textbook_progress_student_profile_id_textbook_id_so_key";

alter table "public"."student_textbook_progress" drop constraint "student_textbook_progress_textbook_id_fkey";

alter table "public"."students" drop constraint "students_student_number_key";

alter table "public"."teachers" drop constraint "teachers_teacher_number_key";

alter table "public"."weekly_sentence_config" drop constraint "weekly_sentence_config_id_check";

alter table "public"."weekly_sentence_config" drop constraint "weekly_sentence_config_manual_week_check";

alter table "public"."weekly_sentence_config" drop constraint "weekly_sentence_config_mode_check";

alter table "public"."weekly_sentences" drop constraint "weekly_sentences_level_check";

alter table "public"."weekly_sentences" drop constraint "weekly_sentences_week_number_check";

alter table "public"."weekly_sentences" drop constraint "weekly_sentences_week_number_level_key";

drop function if exists "public"."current_user_bus_number_ids"();

drop function if exists "public"."current_user_enrolled_class_ids"();

drop function if exists "public"."current_user_student_ids_for_teacher"();

drop function if exists "public"."current_user_teaching_class_ids"();

drop function if exists "public"."enforce_profile_immutable_columns"();

drop function if exists "public"."enforce_report_card_student_columns_fn"();

drop function if exists "public"."generate_student_number"();

drop function if exists "public"."generate_teacher_number"();

drop function if exists "public"."get_class_report_status"(p_year integer, p_month integer);

drop function if exists "public"."handle_attendance_bus_sync"();

-- auth.users 의 trigger 들이 public 함수에 의존 → trigger 먼저 drop
drop trigger if exists on_auth_user_deleted on auth.users;
drop trigger if exists on_auth_user_created on auth.users;

drop function if exists "public"."handle_deleted_user"();

drop function if exists "public"."handle_new_user"();

drop function if exists "public"."insert_bus_staff_from_profile"(p_profile_id uuid, p_meta jsonb);

drop function if exists "public"."insert_student_from_profile"(p_profile_id uuid, p_meta jsonb);

drop function if exists "public"."insert_teacher_from_profile"(p_profile_id uuid, p_meta jsonb);

drop function if exists "public"."is_current_user_admin"();

drop function if exists "public"."is_current_user_bus_staff"();

drop function if exists "public"."is_current_user_native_teacher"();

drop function if exists "public"."is_current_user_teacher"();

drop event trigger if exists ensure_rls;

drop function if exists "public"."rls_auto_enable"();

drop function if exists "public"."set_classes_updated_at"();

drop function if exists "public"."set_report_cards_updated_at"();

drop function if exists "public"."set_student_number"();

drop function if exists "public"."set_teacher_number"();

alter table "public"."academy_notice_attachments" drop constraint "academy_notice_attachments_pkey";

alter table "public"."academy_notices" drop constraint "academy_notices_pkey";

alter table "public"."attendance" drop constraint "attendance_pkey";

alter table "public"."bus_change_requests" drop constraint "bus_change_requests_pkey";

alter table "public"."bus_check_records" drop constraint "bus_check_records_pkey";

alter table "public"."bus_numbers" drop constraint "bus_numbers_pkey";

alter table "public"."bus_staff" drop constraint "bus_staff_pkey";

alter table "public"."bus_stop_day_assignments" drop constraint "bus_stop_day_assignments_pkey";

alter table "public"."bus_stop_schedules" drop constraint "bus_stop_schedules_pkey";

alter table "public"."bus_stops" drop constraint "bus_stops_pkey";

alter table "public"."bus_time_slots" drop constraint "bus_time_slots_pkey";

alter table "public"."class_notice_attachments" drop constraint "class_notice_attachments_pkey";

alter table "public"."class_notices" drop constraint "class_notices_pkey";

alter table "public"."class_textbooks" drop constraint "class_textbooks_pkey";

alter table "public"."homework_assignments" drop constraint "homework_assignments_pkey";

alter table "public"."homework_submission_files" drop constraint "homework_submission_files_pkey";

alter table "public"."homework_submissions" drop constraint "homework_submissions_pkey";

alter table "public"."learning_records" drop constraint "learning_records_pkey";

alter table "public"."lunch_class_order_anchors" drop constraint "lunch_class_order_anchors_pkey";

alter table "public"."lunch_leader_anchors" drop constraint "lunch_leader_overrides_pkey";

alter table "public"."notice_attachments" drop constraint "notice_attachments_pkey";

alter table "public"."notices" drop constraint "notices_pkey";

alter table "public"."report_cards" drop constraint "report_cards_pkey";

alter table "public"."student_bus_defaults" drop constraint "student_bus_defaults_pkey";

alter table "public"."student_textbook_progress" drop constraint "student_textbook_progress_pkey";

alter table "public"."textbooks" drop constraint "textbooks_pkey";

alter table "public"."weekly_sentence_config" drop constraint "weekly_sentence_config_pkey";

alter table "public"."weekly_sentences" drop constraint "weekly_sentences_pkey";

drop index if exists "public"."academy_notice_attachments_pkey";

drop index if exists "public"."academy_notices_pkey";

drop index if exists "public"."afterschool_enrollments_class_id_student_profile_id_day_of__key";

drop index if exists "public"."attendance_pkey";

drop index if exists "public"."attendance_student_profile_id_date_key";

drop index if exists "public"."bus_change_requests_pkey";

drop index if exists "public"."bus_change_requests_student_date_key";

drop index if exists "public"."bus_check_records_pkey";

drop index if exists "public"."bus_check_records_student_date_key";

drop index if exists "public"."bus_numbers_pkey";

drop index if exists "public"."bus_staff_pkey";

drop index if exists "public"."bus_staff_profile_id_key";

drop index if exists "public"."bus_stop_day_assignments_pkey";

drop index if exists "public"."bus_stop_schedules_pkey";

drop index if exists "public"."bus_stop_schedules_stop_day_slot_key";

drop index if exists "public"."bus_stops_pkey";

drop index if exists "public"."bus_time_slots_pkey";

drop index if exists "public"."class_notice_attachments_pkey";

drop index if exists "public"."class_notices_pkey";

drop index if exists "public"."class_students_class_id_student_profile_id_key";

drop index if exists "public"."class_teachers_class_id_teacher_profile_id_key";

drop index if exists "public"."class_textbooks_class_id_textbook_id_key";

drop index if exists "public"."class_textbooks_pkey";

drop index if exists "public"."homework_assignments_pkey";

drop index if exists "public"."homework_submission_files_pkey";

drop index if exists "public"."homework_submissions_assignment_id_student_profile_id_key";

drop index if exists "public"."homework_submissions_pkey";

drop index if exists "public"."idx_academy_notice_attachments_notice";

drop index if exists "public"."idx_academy_notices_published";

drop index if exists "public"."idx_attendance_student";

drop index if exists "public"."idx_bcr_pending";

drop index if exists "public"."idx_bcr_student";

drop index if exists "public"."idx_bus_stop_schedules_stop";

drop index if exists "public"."idx_class_notice_attachments_notice";

drop index if exists "public"."idx_class_notices_class";

drop index if exists "public"."idx_class_schedules_grid";

drop index if exists "public"."idx_class_schedules_student";

drop index if exists "public"."idx_class_students_class_id";

drop index if exists "public"."idx_class_students_student_profile_id";

drop index if exists "public"."idx_class_textbooks_class";

drop index if exists "public"."idx_class_textbooks_textbook";

drop index if exists "public"."idx_cs_class";

drop index if exists "public"."idx_cs_day";

drop index if exists "public"."idx_cs_period";

drop index if exists "public"."idx_cs_teacher";

drop index if exists "public"."idx_homework_assignments_class";

drop index if exists "public"."idx_homework_assignments_teacher";

drop index if exists "public"."idx_homework_submission_files";

drop index if exists "public"."idx_homework_submissions_assignment";

drop index if exists "public"."idx_homework_submissions_student";

drop index if exists "public"."idx_learning_records_student_date";

drop index if exists "public"."idx_notice_attachments_notice";

drop index if exists "public"."idx_notices_published";

drop index if exists "public"."idx_report_cards_student_profile_id";

drop index if exists "public"."idx_report_cards_year_month";

drop index if exists "public"."idx_sbd_student";

drop index if exists "public"."idx_stop_schedules_stop_day";

drop index if exists "public"."idx_stp_source_class";

drop index if exists "public"."idx_stp_student";

drop index if exists "public"."idx_stp_textbook";

drop index if exists "public"."idx_students_number";

drop index if exists "public"."idx_teachers_number";

drop index if exists "public"."ix_afterschool_enrollments_class";

drop index if exists "public"."ix_afterschool_enrollments_student";

drop index if exists "public"."learning_records_pkey";

drop index if exists "public"."lunch_class_order_anchors_date_idx";

drop index if exists "public"."lunch_class_order_anchors_pkey";

drop index if exists "public"."lunch_class_order_anchors_unique";

drop index if exists "public"."lunch_leader_anchors_date_idx";

drop index if exists "public"."lunch_leader_anchors_unique";

drop index if exists "public"."lunch_leader_overrides_pkey";

drop index if exists "public"."notice_attachments_pkey";

drop index if exists "public"."notices_pkey";

drop index if exists "public"."report_cards_pkey";

drop index if exists "public"."report_cards_student_profile_id_year_month_key";

drop index if exists "public"."student_bus_defaults_pkey";

drop index if exists "public"."student_bus_defaults_student_day_key";

drop index if exists "public"."student_textbook_progress_pkey";

drop index if exists "public"."student_textbook_progress_student_profile_id_textbook_id_so_key";

drop index if exists "public"."students_student_number_key";

drop index if exists "public"."teachers_teacher_number_key";

drop index if exists "public"."textbooks_pkey";

drop index if exists "public"."uq_bus_numbers_label";

drop index if exists "public"."ux_student_schedule_slot";

drop index if exists "public"."weekly_sentence_config_pkey";

drop index if exists "public"."weekly_sentences_pkey";

drop index if exists "public"."weekly_sentences_week_idx";

drop index if exists "public"."weekly_sentences_week_number_level_key";

drop index if exists "public"."idx_class_students_student";

drop index if exists "public"."idx_class_teachers_teacher";

drop table "public"."academy_notice_attachments";

drop table "public"."academy_notices";

drop table "public"."attendance";

drop table "public"."bus_change_requests";

drop table "public"."bus_check_records";

drop table "public"."bus_numbers";

drop table "public"."bus_staff";

drop table "public"."bus_stop_day_assignments";

drop table "public"."bus_stop_schedules";

drop table "public"."bus_stops";

drop table "public"."bus_time_slots";

drop table "public"."class_notice_attachments";

drop table "public"."class_notices";

drop table "public"."class_textbooks";

drop table "public"."homework_assignments";

drop table "public"."homework_submission_files";

drop table "public"."homework_submissions";

drop table "public"."learning_records";

drop table "public"."lunch_class_order_anchors";

drop table "public"."lunch_leader_anchors";

drop table "public"."notice_attachments";

drop table "public"."notices";

drop table "public"."report_cards";

drop table "public"."student_bus_defaults";

drop table "public"."student_textbook_progress";

drop table "public"."textbooks";

drop table "public"."weekly_sentence_config";

drop table "public"."weekly_sentences";

-- drop storage policies that reference user_role before type rename
drop policy if exists "class_notices_admin_all" on storage.objects;
drop policy if exists "class_notices_teacher_upload" on storage.objects;
drop policy if exists "academy_notices_admin_all" on storage.objects;
drop policy if exists "homework_admin_all" on storage.objects;
drop policy if exists "homework_teacher_read" on storage.objects;
drop policy if exists "homework_student_upload" on storage.objects;
drop policy if exists "homework_student_read_own" on storage.objects;

-- drop profiles.role before type rename (it depends on user_role)
alter table "public"."profiles" drop column if exists "role";

alter type "public"."user_role" rename to "user_role__old_version_to_be_dropped";

create type "public"."user_role" as enum ('admin', 'teacher', 'student');


  create table "public"."user_roles" (
    "profile_id" uuid not null,
    "role" public.user_role not null,
    "created_at" timestamp with time zone not null default now()
      );


drop type "public"."user_role__old_version_to_be_dropped";

alter table "public"."academy_periods" drop column "group_label";

alter table "public"."academy_periods" drop column "has_dropoff";

alter table "public"."academy_periods" drop column "updated_at";

alter table "public"."academy_periods" add column "group_type" public.class_group not null;

alter table "public"."academy_periods" add column "sort_order" integer not null default 0;

alter table "public"."academy_periods" alter column "created_at" set not null;

alter table "public"."academy_periods" disable row level security;

alter table "public"."afterschool_enrollments" drop column "second_period";

alter table "public"."afterschool_enrollments" drop column "student_profile_id";

alter table "public"."afterschool_enrollments" add column "academy_period_id" uuid;

alter table "public"."afterschool_enrollments" add column "student_id" uuid not null;

alter table "public"."afterschool_enrollments" alter column "created_at" set not null;

alter table "public"."afterschool_enrollments" disable row level security;

alter table "public"."class_schedules" drop column "student_profile_id";

alter table "public"."class_schedules" drop column "teacher_profile_id";

alter table "public"."class_schedules" drop column "textbook_id";

alter table "public"."class_schedules" add column "teacher_id" uuid;

alter table "public"."class_schedules" alter column "class_id" set not null;

alter table "public"."class_schedules" alter column "created_at" set not null;

alter table "public"."class_schedules" alter column "updated_at" set not null;

alter table "public"."class_schedules" disable row level security;

alter table "public"."class_students" drop column "created_at";

alter table "public"."class_students" drop column "student_profile_id";

alter table "public"."class_students" add column "is_active" boolean not null default true;

alter table "public"."class_students" add column "joined_at" timestamp with time zone not null default now();

alter table "public"."class_students" add column "student_id" uuid not null;

alter table "public"."class_students" disable row level security;

alter table "public"."class_teachers" drop column "teacher_profile_id";

alter table "public"."class_teachers" add column "teacher_id" uuid not null;

alter table "public"."class_teachers" alter column "created_at" set not null;

alter table "public"."class_teachers" disable row level security;

alter table "public"."classes" drop column "group_label";

alter table "public"."classes" drop column "lunch_group";

alter table "public"."classes" add column "group_type" public.class_group not null;

alter table "public"."classes" add column "is_active" boolean not null default true;

alter table "public"."classes" disable row level security;

alter table "public"."profiles" drop column if exists "role";

alter table "public"."profiles" disable row level security;

alter table "public"."students" drop column "age";

alter table "public"."students" drop column "group_type";

alter table "public"."students" drop column "student_number";

alter table "public"."students" drop column "updated_at";

alter table "public"."students" add column "is_active" boolean not null default true;

alter table "public"."students" alter column "created_at" set not null;

alter table "public"."students" disable row level security;

alter table "public"."teachers" drop column "is_bus_supervisor";

alter table "public"."teachers" drop column "name";

alter table "public"."teachers" drop column "teacher_number";

alter table "public"."teachers" drop column "updated_at";

alter table "public"."teachers" add column "is_active" boolean not null default true;

alter table "public"."teachers" alter column "created_at" set not null;

alter table "public"."teachers" alter column "teacher_type" drop default;

alter table "public"."teachers" alter column "teacher_type" set data type public.teacher_type using "teacher_type"::text::public.teacher_type;

alter table "public"."teachers" alter column "teacher_type" set default 'korean'::public.teacher_type;

alter table "public"."teachers" disable row level security;

drop sequence if exists "public"."student_number_seq_2026";

drop sequence if exists "public"."teacher_number_seq_2026";

drop type "public"."teacher_type_enum";

CREATE UNIQUE INDEX afterschool_enrollments_unique ON public.afterschool_enrollments USING btree (class_id, student_id, day_of_week, academy_period_id);

CREATE UNIQUE INDEX class_schedules_unique ON public.class_schedules USING btree (class_id, academy_period_id, day_of_week);

CREATE UNIQUE INDEX class_students_unique ON public.class_students USING btree (class_id, student_id);

CREATE UNIQUE INDEX class_teachers_unique ON public.class_teachers USING btree (class_id, teacher_id);

CREATE INDEX idx_afterschool_class_day ON public.afterschool_enrollments USING btree (class_id, day_of_week);

CREATE INDEX idx_afterschool_enrollments_student_day ON public.afterschool_enrollments USING btree (student_id, day_of_week);

CREATE INDEX idx_afterschool_enrollments_student_id ON public.afterschool_enrollments USING btree (student_id);

CREATE INDEX idx_afterschool_student_day ON public.afterschool_enrollments USING btree (student_id, day_of_week);

CREATE INDEX idx_class_schedules_class_day ON public.class_schedules USING btree (class_id, day_of_week);

CREATE INDEX idx_class_schedules_teacher_day ON public.class_schedules USING btree (teacher_id, day_of_week);

CREATE INDEX idx_class_schedules_teacher_id ON public.class_schedules USING btree (teacher_id);

CREATE INDEX idx_class_students_class ON public.class_students USING btree (class_id);

CREATE INDEX idx_class_teachers_teacher_id ON public.class_teachers USING btree (teacher_id);

CREATE INDEX idx_classes_group_type ON public.classes USING btree (group_type);

CREATE INDEX idx_students_profile ON public.students USING btree (profile_id);

CREATE INDEX idx_teachers_profile ON public.teachers USING btree (profile_id);

CREATE INDEX idx_user_roles_role ON public.user_roles USING btree (role);

CREATE UNIQUE INDEX user_roles_pkey ON public.user_roles USING btree (profile_id, role);

CREATE INDEX idx_class_students_student ON public.class_students USING btree (student_id);

CREATE INDEX idx_class_teachers_teacher ON public.class_teachers USING btree (teacher_id);

alter table "public"."user_roles" add constraint "user_roles_pkey" PRIMARY KEY using index "user_roles_pkey";

alter table "public"."academy_periods" add constraint "academy_periods_time_check" CHECK ((start_time < end_time)) not valid;

alter table "public"."academy_periods" validate constraint "academy_periods_time_check";

alter table "public"."afterschool_enrollments" add constraint "afterschool_enrollments_academy_period_id_fkey" FOREIGN KEY (academy_period_id) REFERENCES public.academy_periods(id) ON DELETE SET NULL not valid;

alter table "public"."afterschool_enrollments" validate constraint "afterschool_enrollments_academy_period_id_fkey";

alter table "public"."afterschool_enrollments" add constraint "afterschool_enrollments_day_check" CHECK (((day_of_week >= 1) AND (day_of_week <= 5))) not valid;

alter table "public"."afterschool_enrollments" validate constraint "afterschool_enrollments_day_check";

alter table "public"."afterschool_enrollments" add constraint "afterschool_enrollments_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE not valid;

alter table "public"."afterschool_enrollments" validate constraint "afterschool_enrollments_student_id_fkey";

alter table "public"."afterschool_enrollments" add constraint "afterschool_enrollments_unique" UNIQUE using index "afterschool_enrollments_unique";

alter table "public"."class_schedules" add constraint "class_schedules_day_check" CHECK (((day_of_week >= 1) AND (day_of_week <= 5))) not valid;

alter table "public"."class_schedules" validate constraint "class_schedules_day_check";

alter table "public"."class_schedules" add constraint "class_schedules_teacher_id_fkey" FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE SET NULL not valid;

alter table "public"."class_schedules" validate constraint "class_schedules_teacher_id_fkey";

alter table "public"."class_schedules" add constraint "class_schedules_unique" UNIQUE using index "class_schedules_unique";

alter table "public"."class_students" add constraint "class_students_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE not valid;

alter table "public"."class_students" validate constraint "class_students_student_id_fkey";

alter table "public"."class_students" add constraint "class_students_unique" UNIQUE using index "class_students_unique";

alter table "public"."class_teachers" add constraint "class_teachers_teacher_id_fkey" FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE CASCADE not valid;

alter table "public"."class_teachers" validate constraint "class_teachers_teacher_id_fkey";

alter table "public"."class_teachers" add constraint "class_teachers_unique" UNIQUE using index "class_teachers_unique";

alter table "public"."user_roles" add constraint "user_roles_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."user_roles" validate constraint "user_roles_profile_id_fkey";


