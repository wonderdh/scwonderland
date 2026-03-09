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

  // 헤더 정보 조회
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

  const staffName = staff?.name ?? "";
  const headerText = [busLabel, staffName].filter(Boolean).join(" · ");

  return (
    <div className="min-h-screen bg-slate-100">
      {/* 헤더 */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base font-bold text-slate-800 shrink-0">
              SC Wonderland
            </span>
            {headerText && (
              <>
                <span className="text-slate-300">|</span>
                <span className="text-sm font-medium text-slate-600 truncate">
                  {headerText}
                </span>
              </>
            )}
          </div>
          <LogoutButton className="shrink-0 text-xs text-slate-500 hover:text-red-600 px-2 py-1.5" />
        </div>
      </header>

      {/* 본문 */}
      <main className="p-4">{children}</main>
    </div>
  );
}
