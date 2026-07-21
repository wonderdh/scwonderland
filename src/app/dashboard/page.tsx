import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRoles } from "@/lib/auth/user-roles";
import { LogoutButton } from "@/components/navigation/LogoutButton";

/**
 * 로그인 게이트 + 역할 디스패처.
 * 인증이 필요한 모든 진입점은 여기로 모이고, 여기서만 역할별 홈으로 분기한다.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  const { primaryRole } = await getUserRoles(supabase, user.id);

  if (primaryRole === "admin") {
    redirect("/admin");
  }
  if (primaryRole === "teacher") {
    redirect("/academy/teacher");
  }
  if (primaryRole === "student") {
    redirect("/academy/student");
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm text-center">
        <h1 className="text-xl font-semibold text-foreground mb-2">로그인 성공</h1>
        <p className="text-sm text-muted-foreground mb-6">
          역할이 지정되지 않았습니다. 관리자에게 문의하세요.
        </p>
        <LogoutButton />
      </div>
    </div>
  );
}
