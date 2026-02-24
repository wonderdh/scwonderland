"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/academy/student", label: "내 정보" },
  { href: "/academy/student/reports", label: "리포트카드" },
  { href: "/academy/student/textbooks", label: "교재" },
  { href: "/academy/student/homework", label: "숙제" },
];

export function StudentNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
      {links.map(({ href, label }) => {
        const isActive =
          href === "/academy/student"
            ? pathname === "/academy/student"
            : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-slate-800 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
