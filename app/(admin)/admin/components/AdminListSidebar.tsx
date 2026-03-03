"use client";

import type { UserWithProfile } from "@/lib/types";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Variant = "students" | "teachers";

function matchSearch(user: UserWithProfile, q: string, variant: Variant): boolean {
  if (!q.trim()) return true;
  const lower = q.trim().toLowerCase();
  const fields: (string | null | undefined)[] =
    variant === "students"
      ? [user.korean_name, user.english_name, user.first_name, user.last_name, user.student_number, user.email]
      : [user.name, user.first_name, user.last_name, user.teacher_number, user.email];
  return fields.some((f) => f && String(f).toLowerCase().includes(lower));
}

export function AdminListSidebar({
  users,
  variant,
}: {
  users: UserWithProfile[];
  variant: Variant;
}) {
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("selected");
  const basePath = variant === "students" ? "/admin/students" : "/admin/teachers";
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () => (users ?? []).filter((u) => matchSearch(u, search, variant)),
    [users, search, variant]
  );

  const title = variant === "students" ? "학생 목록" : "선생 목록";
  const searchPlaceholder = "이름, 아이디 검색";

  return (
    <aside className="w-52 min-h-screen bg-sidebar flex flex-col shrink-0 border-r border-sidebar-border">
      <div className="p-3 border-b border-sidebar-border flex items-center justify-between gap-2">
        <span className="text-sidebar-foreground font-medium text-xs">{title}</span>
        <Button asChild size="sm" className="h-6 px-2 text-xs">
          <Link href={`${basePath}?section=add`}>
            {variant === "students" ? "학생 추가" : "선생 추가"}
          </Link>
        </Button>
      </div>
      <div className="p-2 border-b border-sidebar-border">
        <Input
          type="search"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 text-xs bg-sidebar-accent/50 border-sidebar-border"
        />
      </div>
      <div className="px-2 py-2 border-b border-sidebar-border">
        <Link
          href={`${basePath}?section=trash`}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors ${
            searchParams.get("section") === "trash"
              ? "bg-sidebar-primary text-sidebar-primary-foreground"
              : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          휴지통
        </Link>
      </div>
      <ul className="flex-1 overflow-y-auto min-h-0">
        {filtered.length === 0 ? (
          <li className="px-3 py-4 text-muted-foreground text-xs">
            {search.trim() ? "검색 결과 없음" : "없음"}
          </li>
        ) : (
          filtered.map((user) => {
            const name =
              variant === "students"
                ? [user.korean_name, user.english_name].filter(Boolean).join(" / ") ||
                  user.first_name ||
                  "—"
                : user.name ?? user.first_name ?? "—";
            const isSelected = selectedId === user.id;
            return (
              <li key={user.id}>
                <Link
                  href={`${basePath}?selected=${user.id}`}
                  className={`block px-3 py-2 border-b border-sidebar-border text-xs transition-colors ${
                    isSelected
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <span className="font-medium block truncate">{name}</span>
                  <span className="text-[10px] opacity-50 block truncate">{user.email?.split("@")[0]}</span>
                </Link>
              </li>
            );
          })
        )}
      </ul>
    </aside>
  );
}
