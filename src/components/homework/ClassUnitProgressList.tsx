"use client";

/**
 * ClassUnitProgressList — 반의 모든 학생 × 모든 책 unit grid 를 한 화면에 표시.
 *
 * 공유 컴포넌트 — 세 곳에서 사용:
 * - admin: /admin/homework?tab=check (editable=true)
 * - teacher: /academy/teacher/homework (editable=false, read-only)
 * - admin mobile: /m/homework (editable=true)
 *
 * 책임:
 * - 학생별 collapsible 카드 (헤더에 진도 N/M + %)
 * - "모두 펼치기/접기" 컨트롤
 * - 색상 가이드 (editable 모드에서만)
 * - 빈 상태 처리
 *
 * 책임 밖:
 * - 반 selector (각 호출 측)
 * - 데이터 fetch (각 호출 측)
 * - URL 라우팅 (각 호출 측)
 */

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
  /** editable=true 일 때 필요. onChange 가 throw 하면 useOptimistic 자동 revert. */
  onMark?: (
    studentId: string,
    textbookId: string,
    unitNumber: number,
    nextStatus: UnitStatus
  ) => Promise<void>;
  /** 외부 트랜지션 진행 중 표시. */
  loading?: boolean;
  /** 학생 0명일 때 노출할 메시지. */
  emptyMessage?: string;
};

function summarize(list: StudentTextbookUnits[]) {
  let total = 0;
  let completed = 0;
  for (const tb of list) {
    total += tb.total_units;
    completed += tb.units.filter((u) => u.status === "completed").length;
  }
  return { total, completed };
}

export function ClassUnitProgressList({
  students,
  byStudent,
  editable = false,
  onMark,
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
            지남, amber = 오늘 예정.
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
          const { total, completed } = summarize(list);
          const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

          return (
            <section
              key={student.id}
              className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggle(student.id)}
                className="w-full flex items-center justify-between gap-3 bg-slate-50/60 hover:bg-slate-100 px-4 py-3 border-b border-slate-200 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
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
                      {list.length}권 부여 · 진도 {completed}/{total} ({pct}%)
                    </p>
                  </div>
                </div>

                <div className="w-24 sm:w-32 shrink-0">
                  <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct >= 100
                          ? "bg-emerald-500"
                          : pct > 0
                            ? "bg-blue-500"
                            : "bg-slate-300"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
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
                        onChange={
                          editable && onMark
                            ? (unitNumber, nextStatus) =>
                                onMark(
                                  student.id,
                                  tb.id,
                                  unitNumber,
                                  nextStatus
                                )
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
