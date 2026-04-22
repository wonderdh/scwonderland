"use client";

import Link from "next/link";
import { useState } from "react";

interface Tab {
  id: string;
  label: string;
}

interface QueryTabNavProps {
  tabs: Tab[];
  currentTab: string;
  baseHref: string; // e.g. "/admin/students?selected=xxx"
}

export function QueryTabNav({ tabs, currentTab, baseHref }: QueryTabNavProps) {
  // pending.from === 서버에서 받은 currentTab일 때만 유효.
  // 서버가 새 currentTab으로 리렌더하면 from 불일치 → pending 자연 무효화(effect 불필요).
  const [pending, setPending] = useState<{ from: string; to: string } | null>(null);
  const displayTab = pending && pending.from === currentTab ? pending.to : currentTab;

  return (
    <nav className="flex border-b bg-card rounded-t-xl overflow-x-auto">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={`${baseHref}&tab=${t.id}`}
          onClick={() => setPending({ from: currentTab, to: t.id })}
          className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
            displayTab === t.id
              ? "text-foreground border-b-2 border-primary bg-muted/50"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
