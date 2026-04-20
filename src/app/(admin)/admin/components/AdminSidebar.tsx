"use client";

import { LogoutButton } from "@/components/navigation/LogoutButton";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Users,
  GraduationCap,
  School,
  Book,
  Bell,
  Megaphone,
  Calendar,
  Bus,
  ClipboardCheck,
  CalendarDays,
  FileText,
  Sparkles,
  School2,
  LogOut,
  ExternalLink,
} from "lucide-react";
import { ADMIN_NAV_GROUPS, type AdminNavItem } from "@/lib/navigation/admin-nav";

const ICON_MAP: Record<AdminNavItem["icon"], React.ComponentType<{ className?: string }>> = {
  home: Home,
  users: Users,
  "graduation-cap": GraduationCap,
  school: School,
  book: Book,
  bell: Bell,
  megaphone: Megaphone,
  calendar: Calendar,
  bus: Bus,
  "clipboard-check": ClipboardCheck,
  "calendar-days": CalendarDays,
  "file-text": FileText,
  sparkles: Sparkles,
  "school-2": School2,
};

export function AdminSidebar({
  adminId,
  onItemClick,
}: {
  adminId: string;
  onItemClick?: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside className="w-60 h-screen bg-sidebar flex flex-col shrink-0 border-r border-sidebar-border">
      <div className="p-4 border-b border-sidebar-border">
        <Link href="/admin" className="block" onClick={onItemClick}>
          <span className="text-sidebar-foreground font-semibold text-base tracking-tight">
            Admin Panel
          </span>
        </Link>
        {adminId && (
          <span className="text-xs text-sidebar-foreground/60 mt-1 block truncate">
            {adminId}
          </span>
        )}
      </div>
      <nav className="flex-1 py-3 px-2 overflow-y-auto">
        {ADMIN_NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <div className="text-xs uppercase tracking-wider text-slate-400 mt-6 mb-2 px-3 first:mt-2">
              {group.title}
            </div>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const Icon = ICON_MAP[item.icon];
                const isActive =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                const base =
                  "h-12 px-3 rounded-lg flex items-center gap-3 text-base transition-colors";
                const activeCls =
                  "bg-orange-50 text-orange-700 font-semibold border-l-4 border-orange-500 pl-2";
                const inactiveCls =
                  "text-sidebar-foreground/80 hover:bg-slate-100 hover:text-sidebar-foreground";
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onItemClick}
                      className={`${base} ${isActive ? activeCls : inactiveCls}`}
                    >
                      <Icon className="h-6 w-6 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="p-2 space-y-1 border-t border-sidebar-border">
        <Link
          href="/"
          onClick={onItemClick}
          className="h-11 px-3 rounded-lg flex items-center gap-3 text-sm text-sidebar-foreground/80 hover:bg-slate-100 transition-colors"
        >
          <ExternalLink className="h-5 w-5 shrink-0" />
          사이트로 이동
        </Link>
        <LogoutButton className="h-11 px-3 rounded-lg flex items-center gap-3 text-sm text-sidebar-foreground/80 hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer w-full">
          <LogOut className="h-5 w-5 shrink-0" />
          로그아웃
        </LogoutButton>
      </div>
    </aside>
  );
}
