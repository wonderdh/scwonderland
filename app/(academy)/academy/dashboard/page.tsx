import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";

export default async function AcademyDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/academy/login?next=/academy/dashboard");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin") {
    redirect("/admin");
  }

  if (profile?.role === "student") {
    redirect("/academy/student");
  }

  if (profile?.role === "teacher") {
    redirect("/academy/teacher");
  }

  // 역할 미지정 사용자 (fallback)
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold text-slate-800 mb-2">
        로그인 성공
      </h1>
      <p className="text-slate-600 mb-6">
        역할이 지정되지 않았습니다. 관리자에게 문의하세요.
      </p>
      <p className="mt-6">
        <LogoutButton />
      </p>
    </div>
  );
}
