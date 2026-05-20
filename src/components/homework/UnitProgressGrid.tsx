"use client";

/**
 * UnitProgressGrid — 한 책의 unit 진도 grid.
 *
 * - editable=false: read-only.
 * - editable=true: 셀 클릭 → onUnitClick(unitNumber) 콜백만 호출 (state 없음).
 *   저장 로직은 부모(ClassUnitProgressList)가 담당.
 *
 * 색상 규칙:
 * - completed:                       emerald 배경 (✓)
 * - missed:                          red 배경 (✗)
 * - pending + 예정일 < today:        red 테두리 점선 (overdue)
 * - pending + 예정일 == today:       amber 배경
 * - pending + 예정일 미래/없음:      slate 배경
 */

import Image from "next/image";
import { todayKst } from "@/lib/utils/date-kst";
import type { UnitStatus } from "@/app/(admin)/admin/actions/homework-unit-actions";

export type UnitGridUnit = {
  unitNumber: number;
  status: UnitStatus;
  expectedDate: string | null;
  completedAt: string | null;
  note: string | null;
};

export type UnitGridTextbook = {
  id: string;
  title: string;
  series_name: string | null;
  level: string | null;
  cover_image_url: string | null;
  total_units: number;
  hasSchedule: boolean;
};

type Props = {
  textbook: UnitGridTextbook;
  units: UnitGridUnit[];
  editable?: boolean;
  /** 미저장 변경이 있는 unitNumber 집합 — orange dot 표시용 */
  dirtyNumbers?: Set<number>;
  /** 셀 클릭 시 호출 (동기). state 관리는 부모 책임. */
  onUnitClick?: (unitNumber: number) => void;
};

function formatMonthDay(ymd: string): string {
  const [, m, d] = ymd.split("-").map(Number);
  return `${m}/${d}`;
}

function statusClasses(
  status: UnitStatus,
  expectedDate: string | null,
  today: string,
  editable: boolean
): string {
  const base =
    "relative flex flex-col items-center justify-center min-h-9 sm:min-h-10 py-0.5 rounded-md border text-center transition-colors select-none";
  const interactive = editable ? "cursor-pointer active:scale-95" : "cursor-default";

  if (status === "completed") {
    return `${base} ${interactive} bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600`;
  }
  if (status === "missed") {
    return `${base} ${interactive} bg-red-500 text-white border-red-600 hover:bg-red-600`;
  }
  const isOverdue = expectedDate !== null && expectedDate < today;
  const isToday = expectedDate !== null && expectedDate === today;
  if (isOverdue) {
    return `${base} ${interactive} bg-white text-red-600 border-red-400 border-dashed hover:bg-red-50`;
  }
  if (isToday) {
    return `${base} ${interactive} bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200`;
  }
  return `${base} ${interactive} bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100`;
}

export function UnitProgressGrid({
  textbook,
  units,
  editable = false,
  dirtyNumbers,
  onUnitClick,
}: Props) {
  const today = todayKst();
  const completedCount = units.filter((u) => u.status === "completed").length;
  const displayTitle = textbook.series_name ?? textbook.title;

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <header className="flex items-start gap-3 border-b border-slate-200 bg-slate-50/50 px-4 py-3">
        <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md bg-slate-100">
          {textbook.cover_image_url ? (
            <Image
              src={textbook.cover_image_url}
              alt={displayTitle}
              width={40}
              height={56}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <svg
                className="h-5 w-5 text-slate-300"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
                />
              </svg>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-slate-900">{displayTitle}</h3>
          {textbook.level && (
            <p className="truncate text-xs text-slate-500 mt-0.5">{textbook.level}</p>
          )}
          {!textbook.hasSchedule && (
            <p className="mt-1 text-[11px] text-slate-400">일정 미입력 — 예상 날짜 없음</p>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[11px] text-slate-500">완료</p>
          <p className="text-sm font-semibold text-emerald-700 tabular-nums">
            {completedCount} / {textbook.total_units}
          </p>
        </div>
      </header>

      {/* Grid */}
      <div className="p-2">
        {units.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">unit 정보가 없습니다.</p>
        ) : (
          <div className="grid gap-1 grid-cols-7 sm:grid-cols-10 md:grid-cols-[repeat(15,minmax(0,1fr))]">
            {units.map((u) => {
              const cls = statusClasses(u.status, u.expectedDate, today, editable);
              const dateLabel = u.expectedDate ? formatMonthDay(u.expectedDate) : "—";
              const isOverdue =
                u.status === "pending" &&
                u.expectedDate !== null &&
                u.expectedDate < today;
              const isDirty = dirtyNumbers?.has(u.unitNumber) ?? false;
              const ariaLabel = `Unit ${u.unitNumber}: ${u.status}${u.expectedDate ? ` (예상 ${dateLabel})` : ""}`;

              const inner = (
                <>
                  <span className="text-[11px] sm:text-xs font-semibold leading-none">
                    U{u.unitNumber}
                  </span>
                  <span className="mt-px text-[9px] sm:text-[10px] leading-none opacity-90 tabular-nums">
                    {dateLabel}
                  </span>
                  {u.status === "completed" && (
                    <svg
                      className="absolute top-0.5 right-0.5 h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={3}
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  )}
                  {u.status === "missed" && (
                    <span className="absolute top-0.5 right-1 text-xs font-bold leading-none">✕</span>
                  )}
                  {isOverdue && (
                    <span className="absolute -top-0.5 -right-0.5 inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                  )}
                  {isDirty && (
                    <span className="absolute -top-0.5 -left-0.5 inline-flex h-2 w-2 rounded-full bg-orange-400 ring-1 ring-white" />
                  )}
                </>
              );

              if (editable) {
                return (
                  <button
                    key={u.unitNumber}
                    type="button"
                    onClick={() => onUnitClick?.(u.unitNumber)}
                    className={cls}
                    aria-label={ariaLabel}
                    title={ariaLabel}
                  >
                    {inner}
                  </button>
                );
              }
              return (
                <div key={u.unitNumber} className={cls} aria-label={ariaLabel} title={ariaLabel}>
                  {inner}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
