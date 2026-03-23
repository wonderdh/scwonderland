-- bus_check_records 를 Supabase Realtime publication에 추가
-- bus_change_requests 는 20260319000000 에서 이미 추가됨
ALTER PUBLICATION supabase_realtime ADD TABLE bus_check_records;
