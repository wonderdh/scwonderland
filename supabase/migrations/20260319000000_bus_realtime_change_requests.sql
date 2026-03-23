-- bus_change_requests 를 Realtime publication에 추가
ALTER PUBLICATION supabase_realtime ADD TABLE bus_change_requests;

-- bus 역할(동승자) 에게 bus_change_requests SELECT 허용
-- (Realtime payload.new 에 데이터가 포함되려면 SELECT 권한 필요)
CREATE POLICY "bcr_bus_read" ON public.bus_change_requests
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'bus')
  );
