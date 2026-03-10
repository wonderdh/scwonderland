"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  TeacherClassWithStudents,
  TeacherClassTextbook,
  ClassTextbookProgressRow,
} from "@/lib/types";
import { getClassTextbooks } from "../../actions";
import {
  getClassTextbookProgress,
  batchUpdateProgress,
} from "@/app/(admin)/admin/actions";
import { textbookLabels, batchUpdateLabels } from "@/lib/teacher-labels";
import { LoadingState } from "@/components/LoadingState";

export function TeacherTextbookClient({
  classes,
  initialClassId,
  initialTextbooks,
  teacherType,
}: {
  classes: TeacherClassWithStudents[];
  initialClassId: string | null;
  initialTextbooks: TeacherClassTextbook[];
  teacherType: "korean" | "native";
}) {
  const router = useRouter();
  const L = textbookLabels[teacherType];
  const BL = batchUpdateLabels[teacherType];
  const isNative = teacherType === "native";

  const [selectedClassId, setSelectedClassId] = useState(
    initialClassId ?? classes[0]?.id ?? ""
  );
  const [textbooks, setTextbooks] = useState<TeacherClassTextbook[]>(initialTextbooks);
  const [loading, setLoading] = useState(false);

  // Batch update state
  const [batchTextbook, setBatchTextbook] = useState<TeacherClassTextbook | null>(null);
  const [progressRows, setProgressRows] = useState<ClassTextbookProgressRow[]>([]);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [batchUnits, setBatchUnits] = useState(0);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchApplying, setBatchApplying] = useState(false);
  const [batchMessage, setBatchMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  const loadTextbooks = useCallback(async () => {
    if (!selectedClassId) return;
    setLoading(true);
    const data = await getClassTextbooks(selectedClassId);
    setTextbooks(data);
    setLoading(false);
  }, [selectedClassId]);

  useEffect(() => {
    if (selectedClassId !== initialClassId) {
      loadTextbooks();
    }
  }, [selectedClassId, initialClassId, loadTextbooks]);

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  // Open batch update modal for a textbook
  const openBatchUpdate = useCallback(
    async (textbook: TeacherClassTextbook) => {
      setBatchTextbook(textbook);
      setBatchLoading(true);
      setBatchMessage(null);
      setExcludedIds(new Set());
      setBatchUnits(0);

      const rows = await getClassTextbookProgress(selectedClassId, textbook.id);
      setProgressRows(rows);
      setBatchLoading(false);
    },
    [selectedClassId]
  );

  const closeBatchUpdate = () => {
    setBatchTextbook(null);
    setProgressRows([]);
    setExcludedIds(new Set());
    setBatchUnits(0);
    setBatchMessage(null);
  };

  const toggleExclude = (studentProfileId: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentProfileId)) {
        next.delete(studentProfileId);
      } else {
        next.add(studentProfileId);
      }
      return next;
    });
  };

  const selectAll = () => setExcludedIds(new Set());
  const deselectAll = () =>
    setExcludedIds(new Set(progressRows.map((r) => r.student_profile_id)));

  const handleBatchApply = async () => {
    if (!batchTextbook) return;
    setBatchApplying(true);
    setBatchMessage(null);

    const result = await batchUpdateProgress(
      selectedClassId,
      batchTextbook.id,
      batchUnits,
      Array.from(excludedIds)
    );

    setBatchApplying(false);

    if (result.error) {
      setBatchMessage({ type: "error", text: result.error });
      return;
    }

    setBatchMessage({
      type: "success",
      text: `${result.updatedCount}${BL.success}`,
    });

    // Reload progress to show updated values
    const rows = await getClassTextbookProgress(selectedClassId, batchTextbook.id);
    setProgressRows(rows);
    router.refresh();
  };

  if (classes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center">
        <p className="text-sm text-slate-500">{L.noClasses}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold text-slate-800">{L.title}</h1>
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="min-h-[44px] rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.students.length}{isNative ? ` ${L.students}` : L.students})
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingState label={L.loading} />
      ) : textbooks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center">
          <p className="text-sm text-slate-500">
            {isNative
              ? `${selectedClass?.name ?? "This class"}${L.noTextbooks}`
              : `${selectedClass?.name ?? "이 반"}${L.noTextbooks}`}
          </p>
          <p className="mt-1 text-xs text-slate-400">{L.contactAdmin}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {textbooks.map((t) => (
            <div
              key={t.id}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-slate-800">{t.textbook_title}</h3>
                  {t.textbook_series && (
                    <p className="text-sm text-slate-500">{t.textbook_series}</p>
                  )}
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  {L.categories[t.textbook_category] ?? t.textbook_category}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 text-sm text-slate-500">
                  {t.textbook_level && (
                    <span>{L.level}: {t.textbook_level}</span>
                  )}
                  <span>
                    {isNative
                      ? `${t.total_units} ${L.totalUnits}`
                      : `총 ${t.total_units}${L.totalUnits}`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => openBatchUpdate(t)}
                  className="shrink-0 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 transition-colors"
                >
                  {BL.title}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Batch Update Modal */}
      {batchTextbook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-800">
                  {BL.title}
                </h2>
                <p className="text-sm text-slate-500">
                  {batchTextbook.textbook_title}
                </p>
              </div>
              <button
                type="button"
                onClick={closeBatchUpdate}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <svg
                  className="size-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18 18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {batchLoading ? (
                <LoadingState label={BL.loading} />
              ) : progressRows.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  {BL.noProgress}
                </p>
              ) : (
                <>
                  {/* Units input */}
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-slate-700">
                      {BL.units}:
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={batchTextbook.total_units}
                      value={batchUnits}
                      onChange={(e) =>
                        setBatchUnits(
                          Math.max(
                            0,
                            Math.min(Number(e.target.value), batchTextbook.total_units)
                          )
                        )
                      }
                      className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
                    />
                    <span className="text-sm text-slate-400">
                      / {batchTextbook.total_units}
                    </span>
                  </div>

                  {/* Select/Deselect all */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAll}
                      className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
                    >
                      {BL.selectAll}
                    </button>
                    <button
                      type="button"
                      onClick={deselectAll}
                      className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
                    >
                      {BL.deselectAll}
                    </button>
                    <span className="ml-auto text-xs text-slate-400">
                      {progressRows.length - excludedIds.size}/{progressRows.length}
                    </span>
                  </div>

                  {/* Student list */}
                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                    {progressRows.map((row) => {
                      const isExcluded = excludedIds.has(row.student_profile_id);
                      return (
                        <li
                          key={row.student_profile_id}
                          className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                            isExcluded ? "bg-slate-50 opacity-60" : "bg-white"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={!isExcluded}
                            onChange={() => toggleExclude(row.student_profile_id)}
                            className="size-4 rounded border-slate-300 text-slate-800 focus:ring-slate-500"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">
                              {row.korean_name ?? "—"}
                              {row.english_name && (
                                <span className="text-slate-400 font-normal ml-1">
                                  ({row.english_name})
                                </span>
                              )}
                            </p>
                            {row.student_number && (
                              <p className="text-xs text-slate-400 font-mono">
                                {row.student_number}
                              </p>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs text-slate-400">
                              {BL.currentProgress}
                            </p>
                            <p className="text-sm font-medium text-slate-700">
                              {row.completed_units}/{batchTextbook.total_units}
                            </p>
                          </div>
                          {isExcluded && (
                            <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                              {BL.exclude}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}

              {/* Message */}
              {batchMessage && (
                <p
                  className={`text-sm px-3 py-2 rounded-lg ${
                    batchMessage.type === "error"
                      ? "text-red-600 bg-red-50"
                      : "text-emerald-600 bg-emerald-50"
                  }`}
                >
                  {batchMessage.text}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={closeBatchUpdate}
                className="min-h-[44px] rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors sm:min-h-[40px]"
              >
                {BL.close}
              </button>
              <button
                type="button"
                onClick={handleBatchApply}
                disabled={
                  batchApplying ||
                  batchLoading ||
                  progressRows.length === 0 ||
                  progressRows.length - excludedIds.size === 0
                }
                className="min-h-[44px] rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors sm:min-h-[40px]"
              >
                {batchApplying ? BL.applying : BL.apply}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
