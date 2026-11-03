"use client";

import Link from "next/link";
import { useState, type ComponentType } from "react";

export interface QueryTab {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
}

interface QueryTabNavProps {
  tabs: readonly QueryTab[];
  currentTab: string;
  /** `?tab=` 을 붙일 기준 경로. 이미 쿼리가 있으면 `&tab=` 로 이어 붙인다. */
  baseHref: string;
  "aria-label"?: string;
}

/** `?tab=` 쿼리로 전환하는 탭 내비. 클릭 직후부터 서버 리렌더 전까지 낙관적으로 활성 표시. */
export function QueryTabNav({ tabs, currentTab, baseHref, "aria-label": ariaLabel }: QueryTabNavProps) {
  // pending.from === 서버에서 받은 currentTab일 때만 유효.
  // 서버가 새 currentTab으로 리렌더하면 from 불일치 → pending 자연 무효화(effect 불필요).
  const [pending, setPending] = useState<{ from: string; to: string } | null>(null);
  const displayTab = pending && pending.from === currentTab ? pending.to : currentTab;
  const sep = baseHref.includes("?") ? "&" : "?";

  return (
    <nav className="flex border-b bg-card rounded-t-xl overflow-x-auto" role="tablist" aria-label={ariaLabel}>
      {tabs.map((t) => {
        const active = displayTab === t.id;
        const Icon = t.icon;
        return (
          <Link
            key={t.id}
            href={`${baseHref}${sep}tab=${t.id}`}
            role="tab"
            aria-selected={active}
            onClick={() => setPending({ from: currentTab, to: t.id })}
            className={`flex items-center gap-2 px-5 h-12 text-base font-medium transition-colors whitespace-nowrap border-b-[3px] ${
              active
                ? "bg-orange-50 text-orange-700 border-orange-500"
                : "text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            {Icon && <Icon className="h-6 w-6 shrink-0" aria-hidden />}
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
