"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BusStaffProfile } from "@/lib/types";

export async function getCurrentBusStaffProfile(): Promise<BusStaffProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, username")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "bus") return null;

  const { data: staff } = await admin
    .from("bus_staff")
    .select("id, profile_id, name, bus_number_id, created_at")
    .eq("profile_id", user.id)
    .single();

  let busLabel: string | null = null;
  if (staff?.bus_number_id) {
    const { data: bus } = await admin
      .from("bus_numbers")
      .select("label")
      .eq("id", staff.bus_number_id)
      .single();
    busLabel = bus?.label ?? null;
  }

  return {
    id: staff?.id ?? "",
    profile_id: user.id,
    email: user.email ?? "",
    name: staff?.name ?? profile?.username ?? "",
    bus_number_id: staff?.bus_number_id ?? null,
    bus_label: busLabel,
    created_at: staff?.created_at ?? "",
  };
}
