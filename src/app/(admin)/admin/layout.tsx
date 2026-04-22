import { AdminLayoutClient } from "@/app/(admin)/admin/components/AdminLayoutClient";
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    // 세션 유지 — 교사/학생은 로그아웃 강제하지 말고 역할 홈으로 안내.
    if (profile?.role === "teacher") redirect("/academy/teacher");
    if (profile?.role === "student") redirect("/academy/student");
    redirect("/academy/login?error=admin_only");
  }

  const adminId = user.email?.split("@")[0] ?? "";

  return <AdminLayoutClient adminId={adminId}>{children}</AdminLayoutClient>;
}
