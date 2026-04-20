"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export type PortalNavLink = {
  href: string;
  label: string;
  activeColor: string;
  icon: React.ReactNode;
};

export function PortalNav({
  links,
  rootHref,
  badge,
}: {
  links: PortalNavLink[];
  rootHref: string;
  badge?: string;
}) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  // 네비게이션 완료 시 pending 초기화
  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const activeHref = pendingHref ?? pathname;

  return (
    <div className="mb-6 space-y-2">
      {badge && (
        <div className="flex items-center gap-2 px-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            <svg className="size-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
            {badge}
          </span>
        </div>
      )}
      <nav className="rounded-xl border bg-card shadow-sm">
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-1 p-1.5 min-w-max">
            {links.map(({ href, label, icon, activeColor }) => {
              const isActive =
                href === rootHref
                  ? activeHref === rootHref
                  : activeHref.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setPendingHref(href)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                    isActive
                      ? activeColor
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {icon}
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
