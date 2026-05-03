import { createClient } from "@/lib/supabase/server";
import { getUserRoles } from "@/lib/auth/user-roles";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/navigation/LogoutButton";

export default async function AcademyEntryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/academy/login?next=/academy");
  }

  const { primaryRole } = await getUserRoles(supabase, user.id);

  if (primaryRole === "admin") {
    redirect("/admin");
  }
  if (primaryRole === "student") {
    redirect("/academy/student");
  }
  if (primaryRole === "teacher") {
    redirect("/academy/teacher");
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold text-slate-800 mb-2">로그인 성공</h1>
      <p className="text-slate-600 mb-6">
        역할이 지정되지 않았습니다. 관리자에게 문의하세요.
      </p>
      <p className="mt-6">
        <LogoutButton />
      </p>
    </div>
  );
}
