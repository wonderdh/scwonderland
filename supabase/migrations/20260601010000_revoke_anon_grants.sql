-- Task A2 (REVIEW_DB §8.2, HIGH):
-- anon 역할에 GRANT ALL 로 묶여 있던 PII 테이블들 정리.
-- 마케팅 사이트 `(site)` 라우트는 Supabase 클라이언트를 직접 호출하지 않음(서버 액션 admin client 만 사용).
-- 따라서 anon SELECT 가 실제로 필요한 케이스는 baseline 의 `notices_public_read_published` /
-- `weekly_sentences_public_read` / `weekly_sentence_config_public_read` 정책 대상 3개뿐.
--
-- 정책: 그 3개 테이블은 anon SELECT 만 유지, 나머지는 anon 권한 전부 REVOKE.

-- 1) 완전 REVOKE (anon 접근 차단)
revoke all on table public.attendance from anon;
revoke all on table public.bus_change_requests from anon;
revoke all on table public.bus_check_records from anon;
revoke all on table public.report_cards from anon;
revoke all on table public.student_bus_defaults from anon;

-- 2) bus 마스터데이터 (코드는 학생용 client 에서 RLS 통해 읽지만 anon 은 필요 없음)
revoke all on table public.bus_numbers from anon;
revoke all on table public.bus_stop_day_assignments from anon;
revoke all on table public.bus_stop_schedules from anon;
revoke all on table public.bus_stops from anon;
revoke all on table public.bus_time_slots from anon;

-- 3) notices: anon SELECT 만 (published 글) 유지, INSERT/UPDATE/DELETE 박탈
revoke all on table public.notices from anon;
grant select on table public.notices to anon;

-- 4) weekly_sentences / weekly_sentence_config: anon SELECT 만 유지
revoke all on table public.weekly_sentences from anon;
grant select on table public.weekly_sentences to anon;

revoke all on table public.weekly_sentence_config from anon;
grant select on table public.weekly_sentence_config to anon;

-- 5) 기본 권한 (DEFAULT PRIVILEGES) 도 anon TABLES grant all 제거 → 앞으로 새 테이블 자동 노출 막기.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;

-- ROLLBACK:
-- BEGIN;
-- GRANT ALL ON TABLE public.attendance TO anon;
-- GRANT ALL ON TABLE public.bus_change_requests TO anon;
-- GRANT ALL ON TABLE public.bus_check_records TO anon;
-- GRANT ALL ON TABLE public.report_cards TO anon;
-- GRANT ALL ON TABLE public.student_bus_defaults TO anon;
-- GRANT ALL ON TABLE public.bus_numbers TO anon;
-- GRANT ALL ON TABLE public.bus_stop_day_assignments TO anon;
-- GRANT ALL ON TABLE public.bus_stop_schedules TO anon;
-- GRANT ALL ON TABLE public.bus_stops TO anon;
-- GRANT ALL ON TABLE public.bus_time_slots TO anon;
-- GRANT ALL ON TABLE public.notices TO anon;
-- GRANT ALL ON TABLE public.weekly_sentences TO anon;
-- GRANT ALL ON TABLE public.weekly_sentence_config TO anon;
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
-- COMMIT;
