"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const studentItems = [
  { href: "/admin/students", label: "학생 목록", section: null },
  { href: "/admin/students?section=add", label: "학생 추가", section: "add" },
  { href: "/admin/students/classes", label: "반 이동", section: null },
] as const;

const teacherItems = [
  { href: "/admin/teachers", label: "선생 목록", section: null },
  { href: "/admin/teachers?section=add", label: "선생 추가", section: "add" },
] as const;

function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  );
}

const itemIcons = [ListIcon, PlusIcon, ArrowRightIcon] as const;

type SubSidebarVariant = "students" | "teachers";

export function AdminSubSidebar({ variant }: { variant: SubSidebarVariant }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const section = searchParams.get("section");
  const items = variant === "students" ? studentItems : teacherItems;
  const title = variant === "students" ? "학생 관리" : "선생 관리";

  return (
    <aside className="w-52 min-h-screen bg-slate-800 flex flex-col shrink-0 border-r border-slate-700/60">
      <div className="p-4 border-b border-slate-700/60">
        <span className="text-slate-200 font-medium text-sm">{title}</span>
      </div>
      <nav className="py-4 px-3">
        <ul className="space-y-0.5">
          {items.map((item, i) => {
            const basePath = item.href.split("?")[0];
            const isActive =
              pathname === basePath &&
              (item.section === null ? !section : section === item.section);
            const Icon = itemIcons[i] ?? ListIcon;
            return (
              <li key={item.href + (item.section ?? "")}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-slate-700 text-white"
                      : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
