import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database.generated";
import { requireEnv } from "@/lib/env";

export function createClient() {
  return createBrowserClient<Database>(
    requireEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );
}
