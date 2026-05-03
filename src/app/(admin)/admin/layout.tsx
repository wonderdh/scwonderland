import { AdminLayoutClient } from "@/app/(admin)/admin/_components/AdminLayoutClient";
import { getUserRoles } from "@/lib/auth/user-roles";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/academy/login?next=/admin");
  }

  const { primaryRole, roles } = await getUserRoles(supabase, user.id);

  if (!roles.includes("admin")) {
    // 세션 유지 — 교사/학생은 로그아웃 강제하지 말고 역할 홈으로 안내.
    if (primaryRole === "teacher") redirect("/academy/teacher");
    if (primaryRole === "student") redirect("/academy/student");
    redirect("/academy/login?error=admin_only");
  }

  const adminId = user.email?.split("@")[0] ?? "";

  return <AdminLayoutClient adminId={adminId}>{children}</AdminLayoutClient>;
}
