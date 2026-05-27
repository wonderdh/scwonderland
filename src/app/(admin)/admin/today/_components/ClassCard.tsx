"use client";

import { useEffect } from "react";
import { KST_DAY_LABELS } from "@/lib/utils/date-kst";
import type { CLASS_COLOR_PALETTE } from "@/lib/constants/class";
import type { HomeworkClassPickerOption } from "@/app/(admin)/admin/actions";
import type { TodayClassEditor } from "../_hooks/useTodayClassEditor";
import { StudentRow } from "./StudentRow";

type BookColor = (typeof CLASS_COLOR_PALETTE)[number];

type Props = {
  cls: HomeworkClassPickerOption;
  editor: TodayClassEditor;
  /** textbook id → 태그 라벨. */
  bookLabels: Record<string, string>;
  /** textbook id → 태그 색 (시리즈 단위). */
  bookColors: Record<string, BookColor>;
  /** 부모(전체 펼치기/접기) 제어용. */
  expanded: boolean;
  onToggle: (next: boolean) => void;
};

export function ClassCard({
  cls,
  editor,
  bookLabels,
  bookColors,
  expanded,
  onToggle,
}: Props) {
  // 배정된 책 태그 — 시리즈별 색 + 책별 숙제 요일. 접힌 상태에서도 표시.
  const bookTags = cls.assignedBooks
    .map((b) => ({
      id: b.textbookId,
      label: bookLabels[b.textbookId],
      color: bookColors[b.textbookId],
      homeworkDays: b.homeworkDays,
    }))
    .filter((b) => b.label);
  const cache = editor.cache.get(cls.id);
  const loading = editor.isLoading(cls.id);
  const saving = editor.isSaving(cls.id);
  const pending = editor.pendingCount(cls.id);

  // 펼칠 때 lazy load. loadClass 가 진입 시 loading 을 동기 설정하므로
  // !cache && !loading 가드만으로 중복 호출이 방지된다.
  useEffect(() => {
    if (expanded && !cache && !loading) {
      void editor.loadClass(cls.id);
    }
  }, [expanded, cache, loading, editor, cls.id]);

  const students = cache?.students ?? [];
  const markedCount = students.filter(
    (s) => editor.getMergedAttendance(cls.id, s.studentId) !== null
  ).length;
  const studentCount = students.length;

  // 오늘 채점 예정인 미완료 unit 수 (펼친 반만 계산 가능).
  const dueCount = students.reduce((acc, s) => {
    return (
      acc +
      s.books.reduce((b, book) => {
        return (
          b +
          book.units.filter((u) => {
            const status = editor.getMergedUnitStatus(
              cls.id,
              s.studentId,
              book.id,
              u.unitNumber,
              u.status
            );
            return u.expectedDate === editor.date && status === "pending";
          }).length
        );
      }, 0)
    );
  }, 0);

  const days = [...cls.daysOfWeek].sort((a, b) => a - b);

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* 헤더 (접힘 기본) */}
      <button
        type="button"
        onClick={() => onToggle(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        <span
          className={`text-slate-400 shrink-0 transition-transform ${
            expanded ? "rotate-90" : ""
          }`}
        >
          ▶
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-900">{cls.name}</span>
            <span className="text-[11px] text-slate-400">
              {days.map((d) => KST_DAY_LABELS[d]).join("")}
              {cache ? ` · ${studentCount}명` : ""}
            </span>
          </div>
          {bookTags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {bookTags.map((b) => (
                <span
                  key={b.id}
                  className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${b.color.bg} ${b.color.text} ${b.color.border}`}
                >
                  {b.label}
                  <span className="opacity-40">·</span>
                  {b.homeworkDays.length > 0 ? (
                    b.homeworkDays.map((d) => (
                      <span key={d} className="font-bold">
                        {KST_DAY_LABELS[d]}
                      </span>
                    ))
                  ) : (
                    <span className="font-normal italic opacity-70">요일미정</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
        {cache && (
          <div className="flex items-center gap-1.5 shrink-0 text-[11px]">
            <span
              className={`rounded-full px-2 py-0.5 ${
                markedCount === studentCount && studentCount > 0
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              출결 {markedCount}/{studentCount}
            </span>
            {dueCount > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                오늘숙제 {dueCount}
              </span>
            )}
          </div>
        )}
      </button>

      {/* 본문 */}
      {expanded && (
        <div className="border-t border-slate-200 p-3 space-y-3">
          {loading && !cache ? (
            <p className="py-6 text-center text-sm text-slate-400">불러오는 중…</p>
          ) : students.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">
              이 반에 등록된 학생이 없습니다.
            </p>
          ) : (
            students.map((s) => (
              <StudentRow
                key={s.studentId}
                classId={cls.id}
                student={s}
                editor={editor}
              />
            ))
          )}

          {/* 반 단위 sticky 저장 바 */}
          {pending > 0 && (
            <div className="sticky bottom-3 flex items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 shadow-lg">
              <span className="text-sm font-medium text-orange-700">
                {pending}건 변경됨 (미저장)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => editor.cancelClass(cls.id)}
                  disabled={saving}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => void editor.saveClass(cls.id)}
                  disabled={saving}
                  className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  {saving ? "저장 중…" : "저장"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
