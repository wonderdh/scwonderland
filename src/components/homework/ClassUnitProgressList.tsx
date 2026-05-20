"use client";

import { useState } from "react";
import type {
  ClassUnitProgressDetailed,
  StudentTextbookUnits,
  UnitStatus,
} from "@/app/(admin)/admin/actions";
import { UnitProgressGrid } from "@/components/homework/UnitProgressGrid";

type Props = {
  students: ClassUnitProgressDetailed["students"];
  byStudent: ClassUnitProgressDetailed["byStudent"];
  editable?: boolean;
  onSave?: (
    studentId: string,
    textbookId: string,
    changes: { unitNumber: number; status: UnitStatus }[]
  ) => Promise<void>;
  loading?: boolean;
  emptyMessage?: string;
};

export function ClassUnitProgressList({
  students,
  byStudent,
  editable = false,
  onSave,
  loading = false,
  emptyMessage = "이 반에 등록된 학생이 없습니다.",
}: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggle(studentId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  function expandAll() {
    setCollapsed(new Set());
  }
  function collapseAll() {
    setCollapsed(new Set(students.map((s) => s.id)));
  }

  if (loading) {
    return (
      <div className="rounded-xl border bg-card py-12 text-center">
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="rounded-xl border bg-card py-12 text-center">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 컨트롤 + 가이드 */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {editable ? (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 flex-1 min-w-0">
            셀 클릭: <span className="font-semibold">미완료</span> →{" "}
            <span className="font-semibold text-emerald-700">완료</span> →{" "}
            <span className="font-semibold text-red-600">결손</span> →{" "}
            <span className="font-semibold">미완료</span>. 빨강 점선 = 예정일
            지남, amber = 오늘 예정. 변경 후 책 하단 <span className="font-semibold">저장</span> 버튼으로 일괄 저장.
          </div>
        ) : (
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700 flex-1 min-w-0">
            <span className="text-emerald-700 font-semibold">완료</span> /{" "}
            <span className="text-red-600 font-semibold">결손</span> / 점선 =
            예정일 지남 / amber = 오늘 예정 (읽기 전용)
          </div>
        )}
        <div className="flex gap-1.5 shrink-0">
          <button
            type="button"
            onClick={expandAll}
            className="px-3 py-1 text-xs rounded-md border border-slate-200 hover:bg-slate-50"
          >
            모두 펼치기
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="px-3 py-1 text-xs rounded-md border border-slate-200 hover:bg-slate-50"
          >
            모두 접기
          </button>
        </div>
      </div>

      {/* 학생 카드 */}
      <div className="space-y-4">
        {students.map((student) => {
          const list = byStudent[student.id] ?? [];
          const isCollapsed = collapsed.has(student.id);

          return (
            <section
              key={student.id}
              className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggle(student.id)}
                className="w-full flex items-center gap-3 bg-slate-50/60 hover:bg-slate-100 px-4 py-3 border-b border-slate-200 transition-colors text-left"
              >
                <span
                  className={`text-slate-500 transition-transform shrink-0 ${
                    isCollapsed ? "" : "rotate-90"
                  }`}
                >
                  ▶
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {student.korean_name ?? student.id.slice(0, 6)}
                    {student.english_name && (
                      <span className="ml-1.5 text-xs font-normal text-slate-500">
                        ({student.english_name})
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {list.length}권 부여
                  </p>
                </div>
              </button>

              {!isCollapsed && (
                <div className="p-3 space-y-3">
                  {list.length === 0 ? (
                    <p className="py-4 text-center text-xs text-slate-400">
                      부여된 책이 없습니다.
                    </p>
                  ) : (
                    list.map((tb) => (
                      <UnitProgressGrid
                        key={tb.id}
                        textbook={tb}
                        units={tb.units}
                        editable={editable}
                        onSave={
                          editable && onSave
                            ? (changes) => onSave(student.id, tb.id, changes)
                            : undefined
                        }
                      />
                    ))
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
