import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.generated";
import { requireEnv } from "@/lib/env";

/**
 * 서버 전용. RLS 무시, 사용자 생성/삭제 등 Admin API 사용.
 * SUPABASE_SERVICE_ROLE_KEY는 절대 클라이언트에 노출하지 말 것.
 */
export function createAdminClient() {
  const url = requireEnv(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    "NEXT_PUBLIC_SUPABASE_URL",
  );
  const key = requireEnv(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SERVICE_ROLE_KEY",
  );
  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
