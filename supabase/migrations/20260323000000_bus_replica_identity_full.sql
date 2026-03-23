-- Realtime column filter (check_date=eq.X, request_date=eq.X)가
-- UPDATE/DELETE 이벤트에서도 동작하려면 REPLICA IDENTITY FULL 필요
-- DEFAULT(PK only)에서는 UPDATE 이벤트에 column filter가 동작하지 않아 이벤트 드롭됨
ALTER TABLE public.bus_check_records REPLICA IDENTITY FULL;
ALTER TABLE public.bus_change_requests REPLICA IDENTITY FULL;
