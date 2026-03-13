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
    redirect("/academy/login?error=admin_only");
  }

  const adminId = user.email?.split("@")[0] ?? "";

  return <AdminLayoutClient adminId={adminId}>{children}</AdminLayoutClient>;
}
