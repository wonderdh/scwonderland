"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/overlays/Modal";
import { SeriesLevelPicker } from "@/components/forms/SeriesLevelPicker";
import { assignClassTextbook } from "@/app/(admin)/admin/actions";
import type { TextbookWithSeries } from "@/app/(admin)/admin/actions";
import { KST_DAY_LABELS } from "@/lib/utils/date-kst";
import { SkipDatesEditor } from "./SkipDatesEditor";

type Props = {
  classId: string;
  textbooks: TextbookWithSeries[];
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
  const [startUnit, setStartUnit] = useState("1");
  const [homeworkDays, setHomeworkDays] = useState<number[]>([]);
  const [skipDates, setSkipDates] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedTextbook = textbooks.find((t) => t.id === selectedTextbookId);
  const maxUnit = selectedTextbook?.total_units ?? 1;

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
    const startUnitNum = Number.parseInt(startUnit, 10);
    if (!Number.isFinite(startUnitNum) || startUnitNum < 1) {
      setFormError("시작 unit 은 1 이상의 정수여야 합니다.");
      return;
    }
    if (selectedTextbook && startUnitNum > selectedTextbook.total_units) {
      setFormError(
        `시작 unit 은 ${selectedTextbook.total_units} 이하여야 합니다.`
      );
      return;
    }

    const fd = new FormData();
    fd.set("classId", classId);
    fd.set("textbookId", selectedTextbookId);
    fd.set("note", note);
    if (startDate) fd.set("startDate", startDate);
    fd.set("startUnit", String(startUnitNum));
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
    <Modal open onClose={onClose}>
      <div className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">숙제 부여</h2>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
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

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
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
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                시작 unit
              </label>
              <Input
                type="number"
                min={1}
                max={maxUnit}
                value={startUnit}
                onChange={(e) => setStartUnit(e.target.value)}
                disabled={isPending}
                className="h-10"
              />
              {selectedTextbook && (
                <p className="mt-1 text-xs text-slate-400">
                  / 총 {selectedTextbook.total_units} unit
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
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
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
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
                    className={`h-9 w-9 rounded-full border text-sm font-medium transition-colors ${
                      on
                        ? "border-orange-500 bg-orange-500 text-white"
                        : "border-slate-200 bg-white text-slate-500 hover:border-orange-300"
                    } disabled:opacity-50`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
            {homeworkDays.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                요일 미지정 시 진도 스케줄이 비활성됩니다.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
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
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
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
    </Modal>
  );
}
