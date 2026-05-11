"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/overlays/ConfirmDialog";
import { SeriesLevelPicker } from "@/components/forms/SeriesLevelPicker";
import {
  assignClassTextbook,
  unassignClassTextbook,
} from "../../actions";
import type { ClassTextbookWithDetails } from "../../actions";
import type { Database } from "@/lib/types/database.generated";

type TextbookRow = Database["public"]["Tables"]["textbooks"]["Row"] & {
  series_name?: string | null;
};

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function DayBadges({ days }: { days: number[] }) {
  if (!days || days.length === 0) {
    return <span className="text-xs text-slate-400">요일 미지정</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {[...days]
        .sort((a, b) => a - b)
        .map((d) => (
          <span
            key={d}
            className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700"
          >
            {DAY_LABELS[d]}
          </span>
        ))}
    </div>
  );
}

// ── Assign Modal ────────────────────────────────────────────────────────────
// 부여 시 요일은 설정하지 않음. 한국 교사가 academy/teacher 에서 나중에 설정.

function AssignModal({
  classId,
  textbooks,
  assignedTextbookIds,
  onClose,
  onSaved,
}: {
  classId: string;
  textbooks: TextbookRow[];
  assignedTextbookIds: Set<string>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedTextbookId, setSelectedTextbookId] = useState("");

  function handleSubmit() {
    setFormError(null);
    if (!selectedTextbookId) {
      setFormError("숙제를 선택해 주세요.");
      return;
    }
    const fd = new FormData();
    fd.set("classId", classId);
    fd.set("textbookId", selectedTextbookId);
    // 요일은 빈 값으로 전달 — 한국 교사가 academy/teacher 에서 설정
    fd.set("homeworkDays", "");
    fd.set("note", note);

    startTransition(async () => {
      const result = await assignClassTextbook(fd);
      if (result.error) {
        setFormError(result.error);
        return;
      }
      toast.success("숙제가 반에 부여됐습니다.");
      onSaved();
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900 mb-4">숙제 부여</h2>

        <div className="space-y-4">
          {/* Textbook select */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              숙제 선택 <span className="text-red-500">*</span>
            </label>
            <SeriesLevelPicker
              textbooks={textbooks}
              assignedTextbookIds={assignedTextbookIds}
              value={selectedTextbookId}
              onChange={setSelectedTextbookId}
              disabled={isPending}
            />
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">메모</label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="메모 (선택)"
              disabled={isPending}
              className="h-10"
            />
          </div>

          <p className="text-xs text-slate-400">
            숙제 요일은 한국 교사가 숙제 진도 페이지에서 설정합니다.
          </p>

          {formError && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{formError}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
              취소
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={isPending}>
              {isPending ? "저장 중..." : "부여"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function ClassTextbookTab({
  classId,
  initialAssignments,
  allTextbooks,
  onSaved,
}: {
  classId: string;
  initialAssignments: ClassTextbookWithDetails[];
  allTextbooks: TextbookRow[];
  onSaved?: () => void;
}) {
  const [assignments, setAssignments] = useState<ClassTextbookWithDetails[]>(initialAssignments);
  const [assignOpen, setAssignOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ClassTextbookWithDetails | null>(null);
  const [, startTransition] = useTransition();

  // Sync local state when parent reloads data
  useEffect(() => {
    setAssignments(initialAssignments);
  }, [initialAssignments]);

  const assignedTextbookIds = new Set(assignments.map((a) => a.textbook_id));

  function handleSaved() {
    onSaved?.();
  }

  function handleRemove() {
    if (!removeTarget) return;
    startTransition(async () => {
      const result = await unassignClassTextbook(removeTarget.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("숙제가 제거됐습니다.");
        setAssignments((prev) => prev.filter((a) => a.id !== removeTarget.id));
      }
      setRemoveTarget(null);
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          이 반에 부여된 숙제 <span className="font-semibold text-slate-700">{assignments.length}권</span>
        </p>
        <Button size="sm" onClick={() => setAssignOpen(true)}>
          + 숙제 부여
        </Button>
      </div>

      {/* Assignment list */}
      {assignments.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-slate-50/50 p-8 text-center text-sm text-slate-400">
          부여된 숙제가 없습니다. 숙제를 부여해 주세요.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {assignments.map((a) => (
            <div
              key={a.id}
              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
            >
              {/* Cover thumbnail */}
              <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                {a.cover_image_url ? (
                  <Image
                    src={a.cover_image_url}
                    alt={a.title}
                    width={48}
                    height={64}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <svg className="h-6 w-6 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-semibold text-slate-900 truncate">{a.title}</p>
                {a.series && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                    {a.series}
                  </span>
                )}
                <div className="flex flex-wrap items-center gap-1">
                  <DayBadges days={a.homework_days} />
                  {a.skip_dates && a.skip_dates.length > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      예외 {a.skip_dates.length}일
                    </span>
                  )}
                </div>
                {a.note && (
                  <p className="text-xs text-slate-400 truncate">{a.note}</p>
                )}
              </div>

              {/* Actions — 요일 수정은 한국 교사가 academy/teacher 에서 수행 */}
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  onClick={() => setRemoveTarget(a)}
                  className="rounded-lg px-2 py-1 text-xs text-red-500 hover:bg-red-50 transition-colors"
                >
                  제거
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assign modal */}
      {assignOpen && (
        <AssignModal
          classId={classId}
          textbooks={allTextbooks}
          assignedTextbookIds={assignedTextbookIds}
          onClose={() => setAssignOpen(false)}
          onSaved={handleSaved}
        />
      )}

      {/* Remove confirm */}
      <ConfirmDialog
        open={!!removeTarget}
        title="숙제 제거"
        description={`"${removeTarget?.title}" 을(를) 이 반에서 제거하시겠습니까?`}
        confirmLabel="제거"
        variant="danger"
        onConfirm={handleRemove}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}
