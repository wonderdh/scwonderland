-- ============================================================
-- auth.users 계정 삭제 시 profiles → students/teachers 연쇄 삭제
-- Supabase SQL Editor에서 한 번 실행하세요.
-- ============================================================
-- 동작: Auth에서 유저 삭제 시
--   1. 이 트리거가 public.profiles 에서 해당 id 행 삭제
--   2. students / teachers 는 profile_id REFERENCES profiles(id) ON DELETE CASCADE
--      이므로 profiles 행이 지워지면 자동으로 삭제됨
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_deleted_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.profiles WHERE id = old.id;
  RETURN old;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_deleted_user();
