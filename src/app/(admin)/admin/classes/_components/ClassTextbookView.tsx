"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { listClassTextbooks, listTextbooks } from "../../actions";
import { ClassTextbookTab } from "./ClassTextbookTab";
import type { ClassWithDetails } from "@/lib/types";
import type { ClassTextbookWithDetails } from "../../actions";
import type { Database } from "@/lib/types/database.generated";

type TextbookRow = Database["public"]["Tables"]["homework_books"]["Row"];

export function ClassTextbookView({
  classes,
}: {
  classes: ClassWithDetails[];
}) {
  const visibleClasses = useMemo(
    () => classes.filter((c) => c.group_label !== "방과후"),
    [classes]
  );

  const [selectedClassId, setSelectedClassId] = useState<string>(
    visibleClasses[0]?.id ?? ""
  );
  const [assignments, setAssignments] = useState<ClassTextbookWithDetails[]>([]);
  const [allTextbooks, setAllTextbooks] = useState<TextbookRow[]>([]);
  const [isPending, startTransition] = useTransition();
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch when selected class changes (or after a save).
  useEffect(() => {
    if (!selectedClassId) return;
    let cancelled = false;
    startTransition(async () => {
      const [assigned, texts] = await Promise.all([
        listClassTextbooks(selectedClassId),
        listTextbooks(),
      ]);
      if (cancelled) return;
      setAssignments(assigned);
      setAllTextbooks(texts);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedClassId, refreshKey]);

  const loading = isPending;

  function handleSaved() {
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="space-y-4">
      {/* Class selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-slate-700 shrink-0">반 선택</label>
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="rounded-lg border border-input px-3 py-2 text-sm bg-background"
        >
          {visibleClasses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.group_label ? ` (${c.group_label})` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      {visibleClasses.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-slate-50/50 p-8 text-center text-sm text-slate-400">
          등록된 반이 없습니다.
        </div>
      ) : loading ? (
        <div className="py-8 text-center text-sm text-slate-400">불러오는 중...</div>
      ) : selectedClassId ? (
        <ClassTextbookTab
          classId={selectedClassId}
          initialAssignments={assignments}
          allTextbooks={allTextbooks}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  );
}
