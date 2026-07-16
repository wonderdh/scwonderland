import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./academy/login/LoginForm";

export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 로그인 상태면 /academy 엔트리가 역할별로 분기 (admin → /admin 등)
  if (user) {
    redirect("/academy");
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-[70vh] flex items-center justify-center px-4">
          <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm animate-pulse">
            <div className="flex flex-col items-center mb-4">
              <div className="size-12 rounded-full bg-muted mb-3" />
              <div className="h-6 bg-muted rounded w-40 mb-2" />
              <div className="h-4 bg-muted rounded w-56" />
            </div>
            <div className="space-y-4">
              <div className="h-4 bg-muted rounded w-16" />
              <div className="h-10 bg-muted rounded" />
              <div className="h-4 bg-muted rounded w-20" />
              <div className="h-10 bg-muted rounded" />
              <div className="h-10 bg-muted rounded" />
            </div>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
