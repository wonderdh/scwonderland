import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function MobileAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/academy/login?next=/m");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/academy/login?error=admin_only");
  }

  return <div className="min-h-screen bg-background">{children}</div>;
}
