import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserRoles, type UserRole } from "@/lib/auth/user-roles";
import { AcademyShell } from "./_components/AcademyShell";

export default async function AcademyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: UserRole | null = null;
  let displayName: string | null = null;
  let isNative = false;

  if (user) {
    const admin = createAdminClient();
    const [{ data: teacher }, { data: profile }, roleInfo] = await Promise.all([
      admin.from("teachers").select("teacher_type").eq("id", user.id).maybeSingle(),
      admin.from("profiles").select("username").eq("id", user.id).maybeSingle(),
      getUserRoles(admin, user.id),
    ]);
    role = roleInfo.primaryRole;
    isNative = teacher?.teacher_type === "native";
    displayName = profile?.username ?? user.email?.split("@")[0] ?? null;
  }

  return (
    <AcademyShell role={role} displayName={displayName} isNative={isNative}>
      {children}
    </AcademyShell>
  );
}
