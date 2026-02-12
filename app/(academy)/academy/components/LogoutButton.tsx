"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function LogoutButton({
  className,
}: {
  className?: string;
} = {}) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/academy/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={
        "text-sm font-medium " +
        (className ??
          "px-4 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200")
      }
    >
      로그아웃
    </button>
  );
}
