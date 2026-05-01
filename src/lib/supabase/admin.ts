import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.generated";

/**
 * 서버 전용. RLS 무시, 사용자 생성/삭제 등 Admin API 사용.
 * SUPABASE_SERVICE_ROLE_KEY는 절대 클라이언트에 노출하지 말 것.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for admin client"
    );
  }
  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
