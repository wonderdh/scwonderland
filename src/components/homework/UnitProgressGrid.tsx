"use client";

/**
 * UnitProgressGrid — 한 책의 unit 진도 grid.
 *
 * - editable=false: read-only (교사/학생 페이지).
 * - editable=true: 셀 클릭으로 로컬 상태만 변경, "저장" 버튼 클릭 시 onSave 배치 호출.
 *
 * 색상 규칙:
 * - completed:                       emerald 배경 (✓)
 * - missed:                          red 배경 (✗)
 * - pending + 예정일 < today:        red 테두리 점선 (overdue)
 * - pending + 예정일 == today:       amber 배경
 * - pending + 예정일 미래/없음:      slate 배경 (보통)
 */

import { useEffect, useState } from "react";
import Image from "next/image";
import { todayKst } from "@/lib/utils/date-kst";
import type { UnitStatus } from "@/app/(admin)/admin/actions/homework-unit-actions";

export type UnitGridUnit = {
  unitNumber: number;
  status: UnitStatus;
  /** YYYY-MM-DD or null (schedule 미입력 시) */
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
  onSave?: (changes: { unitNumber: number; status: UnitStatus }[]) => Promise<void>;
};

const NEXT_STATUS: Record<UnitStatus, UnitStatus> = {
  pending: "completed",
  completed: "missed",
  missed: "pending",
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
  const interactive = editable
    ? "cursor-pointer active:scale-95"
    : "cursor-default";

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

export function UnitProgressGrid({ textbook, units, editable = false, onSave }: Props) {
  const [localUnits, setLocalUnits] = useState<UnitGridUnit[]>(units);
  const [pendingChanges, setPendingChanges] = useState<Map<number, UnitStatus>>(new Map());
  const [isSaving, setIsSaving] = useState(false);

  // 부모가 units 를 갱신하면 (저장 후 또는 반 전환) 로컬 상태 동기화
  useEffect(() => {
    setLocalUnits(units);
    setPendingChanges(new Map());
  }, [units]);

  const today = todayKst();
  const completedCount = localUnits.filter((u) => u.status === "completed").length;

  function handleClick(unitNumber: number) {
    if (!editable || isSaving) return;
    const current = localUnits.find((u) => u.unitNumber === unitNumber);
    if (!current) return;
    const nextStatus = NEXT_STATUS[current.status];

    setLocalUnits((prev) =>
      prev.map((u) => (u.unitNumber === unitNumber ? { ...u, status: nextStatus } : u))
    );
    setPendingChanges((prev) => {
      const next = new Map(prev);
      const original = units.find((u) => u.unitNumber === unitNumber);
      if (original && original.status === nextStatus) {
        next.delete(unitNumber);
      } else {
        next.set(unitNumber, nextStatus);
      }
      return next;
    });
  }

  function handleCancel() {
    setLocalUnits(units);
    setPendingChanges(new Map());
  }

  async function handleSave() {
    if (!onSave || pendingChanges.size === 0 || isSaving) return;
    const changes = [...pendingChanges.entries()].map(([unitNumber, status]) => ({
      unitNumber,
      status,
    }));
    setIsSaving(true);
    try {
      await onSave(changes);
      // 성공 시 부모가 units prop 갱신 → useEffect 가 pendingChanges 초기화
    } catch {
      // 에러는 onSave 에서 toast 처리, pendingChanges 유지 (재시도 가능)
    } finally {
      setIsSaving(false);
    }
  }

  const displayTitle = textbook.series_name ?? textbook.title;

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <header className="flex items-start gap-3 border-b border-slate-200 bg-slate-50/50 px-4 py-3">
        {/* Cover */}
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

        {/* Title + level */}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-slate-900">
            {displayTitle}
          </h3>
          {textbook.level && (
            <p className="truncate text-xs text-slate-500 mt-0.5">{textbook.level}</p>
          )}
          {!textbook.hasSchedule && (
            <p className="mt-1 text-[11px] text-slate-400">일정 미입력 — 예상 날짜 없음</p>
          )}
        </div>

        {/* Stats */}
        <div className="shrink-0 text-right">
          <p className="text-[11px] text-slate-500">완료</p>
          <p className="text-sm font-semibold text-emerald-700 tabular-nums">
            {completedCount} / {textbook.total_units}
          </p>
        </div>
      </header>

      {/* Grid */}
      <div className="p-2">
        {localUnits.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">unit 정보가 없습니다.</p>
        ) : (
          <div className="grid gap-1 grid-cols-7 sm:grid-cols-10 md:grid-cols-[repeat(15,minmax(0,1fr))]">
            {localUnits.map((u) => {
              const cls = statusClasses(u.status, u.expectedDate, today, editable);
              const dateLabel = u.expectedDate ? formatMonthDay(u.expectedDate) : "—";
              const isOverdue =
                u.status === "pending" &&
                u.expectedDate !== null &&
                u.expectedDate < today;
              const isDirty = pendingChanges.has(u.unitNumber);
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
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m4.5 12.75 6 6 9-13.5"
                      />
                    </svg>
                  )}
                  {u.status === "missed" && (
                    <span className="absolute top-0.5 right-1 text-xs font-bold leading-none">
                      ✕
                    </span>
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
                    onClick={() => handleClick(u.unitNumber)}
                    disabled={isSaving}
                    className={`${cls} disabled:opacity-70`}
                    aria-label={ariaLabel}
                    title={ariaLabel}
                  >
                    {inner}
                  </button>
                );
              }
              return (
                <div
                  key={u.unitNumber}
                  className={cls}
                  aria-label={ariaLabel}
                  title={ariaLabel}
                >
                  {inner}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 저장 바 — 변경사항 있을 때만 노출 */}
      {editable && pendingChanges.size > 0 && (
        <div className="flex items-center justify-between gap-3 border-t border-orange-200 bg-orange-50 px-4 py-2">
          <span className="text-xs text-orange-700">
            {pendingChanges.size}건 변경됨 (미저장)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className="px-3 py-1 rounded-md text-xs text-slate-600 hover:bg-slate-100 border border-slate-200 bg-white transition-colors disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-3 py-1 rounded-md text-xs font-medium text-white bg-primary hover:bg-primary/90 border border-primary transition-colors disabled:opacity-50"
            >
              {isSaving ? "저장 중…" : "저장"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
