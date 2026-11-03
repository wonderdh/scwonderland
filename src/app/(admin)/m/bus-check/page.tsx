import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BusStaffMonitor } from "@/app/bus/_components/BusStaffMonitor";
import { ChevronLeft } from "lucide-react";

export default async function MobileBusCheckPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/m/bus-check");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <Link
          href="/m"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-base font-semibold text-foreground">승하차 관리</h1>
      </header>
      <div className="flex-1">
        <BusStaffMonitor busNumberId={null} />
      </div>
    </div>
  );
}
