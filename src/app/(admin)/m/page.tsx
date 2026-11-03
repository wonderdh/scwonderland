import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DailyBusChanges } from "@/components/bus/DailyBusChanges";
import { CalendarDays, CircleCheck, ClipboardList, BookOpen, Bus, BadgeCheck, Monitor, ChevronRight } from "lucide-react";

const cards = [
  {
    href: "/m/today",
    title: "오늘 수업",
    subtitle: "당일 시간대별 반 — 출결·숙제 한 번에",
    icon: (
      <CalendarDays className="w-8 h-8" strokeWidth={1.5} />
    ),
  },
  {
    href: "/m/attendance",
    title: "출결 관리",
    subtitle: "반별·학생별 출결 입력",
    icon: (
      <CircleCheck className="w-8 h-8" strokeWidth={1.5} />
    ),
  },
  {
    href: "/m/homework",
    title: "숙제 관리",
    subtitle: "반별 학생 unit 진도 체크",
    icon: (
      <ClipboardList className="w-8 h-8" strokeWidth={1.5} />
    ),
  },
  {
    href: "/m/reading",
    title: "리딩 관리",
    subtitle: "Raz 책 학생별 읽음 체크",
    icon: (
      <BookOpen className="w-8 h-8" strokeWidth={1.5} />
    ),
  },
  {
    href: "/m/bus-change",
    title: "버스 당일변경",
    subtitle: "학생 버스 정류장 임시 변경",
    icon: (
      <Bus className="w-8 h-8" strokeWidth={1.5} />
    ),
  },
  {
    href: "/m/bus-check",
    title: "승하차 관리",
    subtitle: "전 호차 승하차 체크",
    icon: (
      <BadgeCheck className="w-8 h-8" strokeWidth={1.5} />
    ),
  },
  {
    href: "/bus-monitor",
    title: "버스 모니터",
    subtitle: "실시간 승하차 현황",
    icon: (
      <Monitor className="w-8 h-8" strokeWidth={1.5} />
    ),
  },
];

export default async function MobileHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const adminId = user?.email?.split("@")[0] ?? "";

  async function logout() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-base font-semibold text-foreground">관리자 메뉴</h1>
        <div className="flex items-center gap-2">
          {adminId && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">{adminId}</span>
          )}
          <form action={logout}>
            <button
              type="submit"
              className="text-xs text-muted-foreground hover:text-destructive px-2 py-1 rounded-md hover:bg-muted transition-colors"
            >
              로그아웃
            </button>
          </form>
        </div>
      </header>
      <div className="flex-1 px-4 py-4 flex flex-col gap-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="flex items-center gap-4 px-5 py-5 min-h-[100px] rounded-2xl border border-border bg-card hover:bg-muted transition-colors"
          >
            <div className="text-muted-foreground shrink-0">{card.icon}</div>
            <div className="flex-1">
              <div className="text-base font-semibold text-foreground">{card.title}</div>
              <div className="text-sm text-muted-foreground mt-0.5">{card.subtitle}</div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
          </Link>
        ))}
        <DailyBusChanges />
      </div>
    </div>
  );
}
