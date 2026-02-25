"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
} = {}) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/academy/login");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        className={
          "text-sm font-medium cursor-pointer transition-colors active:scale-95 " +
          (className ??
            "px-4 py-2 text-muted-foreground bg-secondary rounded-lg hover:bg-destructive/10 hover:text-destructive")
        }
      >
        {children}
        <span>로그아웃</span>
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowConfirm(false)}
            aria-hidden
          />
          <div className="relative w-full max-w-xs rounded-xl border bg-card p-5 shadow-xl animate-in fade-in-0 zoom-in-95">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                <svg className="size-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">로그아웃</h3>
                <p className="mt-1 text-sm text-muted-foreground">정말 로그아웃 하시겠습니까?</p>
              </div>
              <div className="flex gap-2 w-full mt-1">
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {loggingOut ? "로그아웃 중…" : "로그아웃"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
