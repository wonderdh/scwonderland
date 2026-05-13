"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateClassTextbookDays } from "@/app/(admin)/admin/actions";
import type { ClassTextbookWithDetails } from "@/app/(admin)/admin/actions";
import { KST_DAY_LABELS } from "@/lib/utils/date-kst";
import { SkipDatesEditor } from "./SkipDatesEditor";

const WEEKDAYS: { idx: number; label: string }[] = [
  { idx: 1, label: KST_DAY_LABELS[1] },
  { idx: 2, label: KST_DAY_LABELS[2] },
  { idx: 3, label: KST_DAY_LABELS[3] },
  { idx: 4, label: KST_DAY_LABELS[4] },
  { idx: 5, label: KST_DAY_LABELS[5] },
];

type Props = {
  assignment: ClassTextbookWithDetails;
  onClose: () => void;
  onSaved: () => void;
};

export function EditClassHomeworkModal({ assignment, onClose, onSaved }: Props) {
  const [isPending, startTransition] = useTransition();
  const [startDate, setStartDate] = useState(assignment.start_date ?? "");
  const [note, setNote] = useState(assignment.note ?? "");
  const [startUnit, setStartUnit] = useState(String(assignment.start_unit ?? 1));
  const [homeworkDays, setHomeworkDays] = useState<number[]>(
    (assignment.homework_days ?? []).slice().sort((a, b) => a - b)
  );
  const [skipDates, setSkipDates] = useState<string[]>(
    (assignment.skip_dates ?? []).slice().sort()
  );
  const [formError, setFormError] = useState<string | null>(null);

  const maxUnit = assignment.total_units ?? 1;

  function toggleDay(day: number) {
    setHomeworkDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort((a, b) => a - b)
    );
  }

  function handleSubmit() {
    setFormError(null);
    const startUnitNum = Number.parseInt(startUnit, 10);
    if (!Number.isFinite(startUnitNum) || startUnitNum < 1) {
      setFormError("시작 unit 은 1 이상의 정수여야 합니다.");
      return;
    }
    if (maxUnit > 0 && startUnitNum > maxUnit) {
      setFormError(`시작 unit 은 ${maxUnit} 이하여야 합니다.`);
      return;
    }
    startTransition(async () => {
      const result = await updateClassTextbookDays(assignment.id, {
        note: note.trim() === "" ? null : note.trim(),
        startDate: startDate === "" ? null : startDate,
        startUnit: startUnitNum,
        homeworkDays,
        skipDates,
      });
      if (result.error) {
        setFormError(result.error);
        return;
      }
      toast.success("수정됐습니다.");
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
        <h2 className="text-lg font-semibold text-slate-900 mb-1">
          숙제 수정
        </h2>
        <p className="text-xs text-slate-500 mb-4 truncate">{assignment.title}</p>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                시작일
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={isPending}
                className="h-10"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                시작 unit
              </label>
              <Input
                type="number"
                min={1}
                max={maxUnit > 0 ? maxUnit : undefined}
                value={startUnit}
                onChange={(e) => setStartUnit(e.target.value)}
                disabled={isPending}
                className="h-10"
              />
              {maxUnit > 0 && (
                <p className="text-xs text-slate-400 mt-1">/ 총 {maxUnit} unit</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                메모
              </label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="선택"
                disabled={isPending}
                className="h-10"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              숙제 요일
            </label>
            <div className="flex items-center gap-2">
              {WEEKDAYS.map((d) => {
                const on = homeworkDays.includes(d.idx);
                return (
                  <button
                    key={d.idx}
                    type="button"
                    onClick={() => toggleDay(d.idx)}
                    disabled={isPending}
                    className={`h-9 w-9 rounded-full text-sm font-medium transition-colors border ${
                      on
                        ? "bg-orange-500 text-white border-orange-500"
                        : "bg-white text-slate-500 border-slate-200 hover:border-orange-300"
                    } disabled:opacity-50`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
            {homeworkDays.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                요일 미지정 — 진도 스케줄이 비활성됩니다.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              예외일 (휴일/스킵)
            </label>
            <SkipDatesEditor
              value={skipDates}
              onChange={setSkipDates}
              disabled={isPending}
            />
          </div>

          {formError && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isPending}
            >
              취소
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={isPending}>
              {isPending ? "저장 중..." : "저장"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
