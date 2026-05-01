export const USER_ROLE_PRIORITY = ["admin", "teacher", "student"] as const;

export type UserRole = (typeof USER_ROLE_PRIORITY)[number];

type RoleLookup = {
  roles: UserRole[];
  primaryRole: UserRole | null;
};

export async function getUserRoles(
  supabase: any,
  profileId: string
): Promise<RoleLookup> {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", profileId)
    .maybeSingle();

  const role = data?.role as UserRole | null;
  const roles: UserRole[] = role ? [role] : [];
  return { roles, primaryRole: role ?? null };
}

export async function hasUserRole(
  supabase: any,
  profileId: string,
  role: UserRole
): Promise<boolean> {
  const { primaryRole } = await getUserRoles(supabase, profileId);
  return primaryRole === role;
}
