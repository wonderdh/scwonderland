import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";

export default async function BusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/academy/login?next=/bus");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "bus") redirect("/academy/dashboard");

  const admin = createAdminClient();
  const { data: staff } = await admin
    .from("bus_staff")
    .select("name, bus_number_id")
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

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 헤더 */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200/80">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2.5 min-w-0">
            {busLabel && (
              <span className="shrink-0 text-xs font-bold bg-slate-800 text-white px-2.5 py-1 rounded-md">
                {busLabel}
              </span>
            )}
            <span className="text-sm font-medium text-slate-600 truncate">
              {staff?.name ?? ""}
            </span>
          </div>
          <LogoutButton className="shrink-0 text-xs text-slate-400 hover:text-red-500 px-2 py-1.5 transition-colors" />
        </div>
      </header>

      <main className="px-4 py-4">{children}</main>
    </div>
  );
}
