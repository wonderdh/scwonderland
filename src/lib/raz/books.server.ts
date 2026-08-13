import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import type { RazBook } from "@/lib/types";

// 정적 카탈로그 — 무기한 캐시. 재적재 시 revalidateTag("raz-books") 또는 재배포.
// admin client 사용: 유저 무관 공개(authenticated) 데이터라 캐시 공유에 적합.
export const getRazBooks = unstable_cache(
  async (): Promise<RazBook[]> => {
    const admin = createAdminClient();
    return fetchAllRows<RazBook>((from, to) =>
      admin
        .from("raz_books")
        .select("*")
        .order("level_order")
        .order("title")
        .order("id")
        .range(from, to),
    );
  },
  ["raz-books"],
  { tags: ["raz-books"] },
);
