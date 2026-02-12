"use client";

import type { UserWithProfile } from "../actions";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useMemo } from "react";

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
  const searchPlaceholder =
    variant === "students" ? "이름, 학번, 이메일 검색" : "이름, 교번, 이메일 검색";

  return (
    <aside className="w-52 min-h-screen bg-slate-800 flex flex-col shrink-0 border-r border-slate-700/60">
      <div className="p-3 border-b border-slate-700/60 flex items-center justify-between gap-2">
        <span className="text-slate-200 font-medium text-xs">{title}</span>
        {variant === "students" && (
          <Link
            href="/admin/students?section=add"
            className="shrink-0 px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded"
          >
            학생 추가
          </Link>
        )}
      </div>
      <div className="p-2 border-b border-slate-700/60">
        <input
          type="search"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-2.5 py-1.5 rounded border border-slate-600 bg-slate-700/50 text-slate-200 text-xs placeholder-slate-400"
        />
      </div>
      <ul className="flex-1 overflow-y-auto min-h-0">
        {filtered.length === 0 ? (
          <li className="px-3 py-4 text-slate-400 text-xs">
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
            const sub = variant === "students" ? user.student_number : user.teacher_number;
            const isSelected = selectedId === user.id;
            return (
              <li key={user.id}>
                <Link
                  href={`${basePath}?selected=${user.id}`}
                  className={`block px-3 py-2 border-b border-slate-700/60 text-xs transition-colors ${
                    isSelected
                      ? "bg-slate-700 text-white"
                      : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
                  }`}
                >
                  <span className="font-medium block truncate">{name}</span>
                  {sub && <span className="text-[10px] text-slate-400 block truncate">{sub}</span>}
                </Link>
              </li>
            );
          })
        )}
      </ul>
    </aside>
  );
}
