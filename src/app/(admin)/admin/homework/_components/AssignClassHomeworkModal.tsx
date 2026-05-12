"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SeriesLevelPicker } from "@/components/forms/SeriesLevelPicker";
import { assignClassTextbook } from "@/app/(admin)/admin/actions";
import { KST_DAY_LABELS } from "@/lib/utils/date-kst";
import { SkipDatesEditor } from "./SkipDatesEditor";
import type { Database } from "@/lib/types/database.generated";

type TextbookRow = Database["public"]["Tables"]["homework_books"]["Row"] & {
  series_name?: string | null;
};

type Props = {
  classId: string;
  textbooks: TextbookRow[];
  assignedTextbookIds: Set<string>;
  onClose: () => void;
  onSaved: () => void;
};

const WEEKDAYS: { idx: number; label: string }[] = [
  { idx: 1, label: KST_DAY_LABELS[1] },
  { idx: 2, label: KST_DAY_LABELS[2] },
  { idx: 3, label: KST_DAY_LABELS[3] },
  { idx: 4, label: KST_DAY_LABELS[4] },
  { idx: 5, label: KST_DAY_LABELS[5] },
];

export function AssignClassHomeworkModal({
  classId,
  textbooks,
  assignedTextbookIds,
  onClose,
  onSaved,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [selectedTextbookId, setSelectedTextbookId] = useState("");
  const [note, setNote] = useState("");
  const [startDate, setStartDate] = useState("");
  const [homeworkDays, setHomeworkDays] = useState<number[]>([]);
  const [skipDates, setSkipDates] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  function toggleDay(day: number) {
    setHomeworkDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort((a, b) => a - b)
    );
  }

  function handleSubmit() {
    setFormError(null);
    if (!selectedTextbookId) {
      setFormError("숙제를 선택해 주세요.");
      return;
    }

    const fd = new FormData();
    fd.set("classId", classId);
    fd.set("textbookId", selectedTextbookId);
    fd.set("note", note);
    if (startDate) fd.set("startDate", startDate);
    fd.set("homeworkDays", JSON.stringify(homeworkDays));
    fd.set("skipDates", JSON.stringify(skipDates));

    startTransition(async () => {
      const result = await assignClassTextbook(fd);
      if (result.error) {
        setFormError(result.error);
        return;
      }
      toast.success("숙제가 부여됐습니다.");
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

          <div className="grid grid-cols-2 gap-3">
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
                메모
              </label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="메모 (선택)"
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
                요일 미지정 시 진도 스케줄이 비활성됩니다.
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

          <p className="text-xs text-slate-500">
            부여 시 이 반의 모든 활성 학생에게 자동 적용됩니다.
          </p>

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
              {isPending ? "저장 중..." : "부여"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
