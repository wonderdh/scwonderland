"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
  const [pendingTab, setPendingTab] = useState<string | null>(null);

  // 서버에서 새 currentTab이 오면 pending 초기화
  useEffect(() => {
    setPendingTab(null);
  }, [currentTab]);

  const displayTab = pendingTab ?? currentTab;

  return (
    <nav className="flex border-b bg-card rounded-t-xl overflow-x-auto">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={`${baseHref}&tab=${t.id}`}
          onClick={() => setPendingTab(t.id)}
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
