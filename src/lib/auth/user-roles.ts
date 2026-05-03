import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.generated";

export const USER_ROLE_PRIORITY = ["admin", "teacher", "student"] as const;

export type UserRole = (typeof USER_ROLE_PRIORITY)[number];

type RoleLookup = {
  roles: UserRole[];
  primaryRole: UserRole | null;
};

type Client = SupabaseClient<Database>;

export async function getUserRoles(
  supabase: Client,
  profileId: string
): Promise<RoleLookup> {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", profileId)
    .maybeSingle();

  const role = (data?.role ?? null) as UserRole | null;
  const roles: UserRole[] = role ? [role] : [];
  return { roles, primaryRole: role };
}

export async function hasUserRole(
  supabase: Client,
  profileId: string,
  role: UserRole
): Promise<boolean> {
  const { primaryRole } = await getUserRoles(supabase, profileId);
  return primaryRole === role;
}
