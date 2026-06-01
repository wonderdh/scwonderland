"use client";

import { UnitProgressGrid } from "@/components/homework/UnitProgressGrid";
import { todayKst } from "@/lib/utils/date-kst";
import type { BoardStudent, StudentTextbookUnits } from "@/app/(admin)/admin/actions/homework-unit-actions";

/** 학생의 책들에서 오늘(todayKst) 채점 예정 유닛 번호 1개(가장 이른 책 기준). 없으면 null. */
export function deriveTodayUnit(books: StudentTextbookUnits[], today: string): number | null {
  for (const b of books) {
    const hit = b.units.find((u) => u.expectedDate === today && u.status === "pending");
    if (hit) return hit.unitNumber;
  }
  return null;
}

/** 학생의 책들 합산 완료/전체 유닛 수. */
export function deriveProgress(books: StudentTextbookUnits[]): { completed: number; total: number } {
  let completed = 0;
  let total = 0;
  for (const b of books) {
    total += b.total_units;
    completed += b.units.filter((u) => u.status === "completed").length;
  }
  return { completed, total };
}

type CardProps = {
  student: BoardStudent;
  books: StudentTextbookUnits[];
  isAbsent: boolean;
  expanded: boolean;
  onToggle: () => void;
  editable: boolean;
  onUnitClick: (textbookId: string, unitNumber: number) => void;
  dirtyNumbers: (textbookId: string) => Set<number>;
};

export function BoardStudentCard({
  student,
  books,
  isAbsent,
  expanded,
  onToggle,
  editable,
  onUnitClick,
  dirtyNumbers,
}: CardProps) {
  const today = todayKst();
  const todayUnit = deriveTodayUnit(books, today);
  const { completed, total } = deriveProgress(books);
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const displayName = student.english_name ?? student.korean_name ?? student.id.slice(0, 6);

  return (
    <section
      className={`rounded-xl border shadow-sm overflow-hidden ${isAbsent ? "border-slate-200 bg-slate-100/70" : "border-slate-200 bg-white"}`}
    >
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isAbsent ? "bg-slate-100 hover:bg-slate-150" : "bg-slate-50/60 hover:bg-slate-100"}`}
      >
        <span className={`text-slate-500 transition-transform shrink-0 ${expanded ? "rotate-90" : ""}`}>▶</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-semibold truncate ${isAbsent ? "text-slate-500" : "text-slate-900"}`}>
              {displayName}
            </p>
            {student.korean_name && student.english_name && (
              <span className="text-xs font-normal text-slate-400 truncate">{student.korean_name}</span>
            )}
            <span className="text-[11px] text-slate-400 shrink-0">· {student.className}</span>
            {isAbsent && (
              <span className="inline-flex items-center rounded-full bg-slate-300 px-2 py-0.5 text-[11px] font-semibold text-slate-600 shrink-0">
                결석
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[11px] font-medium text-amber-700 shrink-0">
              {todayUnit !== null ? `오늘 U${todayUnit}` : "오늘 없음"}
            </span>
            <span className="h-1.5 flex-1 max-w-[120px] rounded-full bg-slate-200 overflow-hidden">
              <span className="block h-full bg-emerald-500" style={{ width: `${pct}%` }} />
            </span>
            <span className="text-[11px] text-slate-500 tabular-nums shrink-0">{completed}/{total}</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="p-3 space-y-3">
          {books.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400">부여된 책이 없습니다.</p>
          ) : (
            books.map((tb) => (
              <UnitProgressGrid
                key={tb.id}
                textbook={tb}
                units={tb.units}
                editable={editable && !isAbsent}
                dirtyNumbers={dirtyNumbers(tb.id)}
                onUnitClick={
                  editable && !isAbsent ? (unitNumber) => onUnitClick(tb.id, unitNumber) : undefined
                }
              />
            ))
          )}
        </div>
      )}
    </section>
  );
}
