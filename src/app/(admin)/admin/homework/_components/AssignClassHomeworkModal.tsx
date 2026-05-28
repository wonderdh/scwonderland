"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/overlays/Modal";
import { SeriesLevelPicker } from "@/components/forms/SeriesLevelPicker";
import { assignClassTextbook } from "@/app/(admin)/admin/actions";
import type { TextbookWithSeries } from "@/app/(admin)/admin/actions";
import { KST_DAY_LABELS } from "@/lib/utils/date-kst";
import {
  GRADING_DATE_ERROR_MESSAGES,
  isValidGradingDate,
} from "@/lib/utils/homework-schedule";
import { SkipDatesEditor } from "./SkipDatesEditor";
import { HomeworkSchedulePreview } from "./HomeworkSchedulePreview";

type Props = {
  classId: string;
  textbooks: TextbookWithSeries[];
  assignedTextbookIds: Set<string>;
  /** 반 수업(=등원) 요일 (0=일~6=토). 채점일 계산 기준. */
  meetDays: number[];
  /** 학원 공통 쉬는날 (YYYY-MM-DD) — 미리보기 채점일 계산에서 제외. */
  closedDates: string[];
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
  meetDays,
  closedDates,
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
  // F9 의 자매 fix: textbook 미선택 / total_units null 시 0 으로 폴백하고 `> 0` 분기.
  const maxUnit = selectedTextbook?.total_units ?? 0;
  const startUnitNum = Number.parseInt(startUnit, 10);
  const startUnitInvalid =
    !Number.isInteger(startUnitNum) || startUnitNum < 1;
  const previewSkipDates = useMemo(
    () => Array.from(new Set([...skipDates, ...closedDates])),
    [skipDates, closedDates]
  );

  // Strict 검사일 검증 — 실시간으로 inline 에러 표시 + submit 비활성에 사용.
  const startDateValidation = useMemo(() => {
    if (!startDate) return null;
    return isValidGradingDate(startDate, meetDays, closedDates, skipDates);
  }, [startDate, meetDays, closedDates, skipDates]);
  const startDateError =
    startDateValidation && !startDateValidation.ok
      ? GRADING_DATE_ERROR_MESSAGES[startDateValidation.reason]
      : null;

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
    if (startUnitInvalid) {
      setFormError("unit 은 1 이상의 정수여야 합니다.");
      return;
    }
    if (selectedTextbook && selectedTextbook.total_units > 0 && startUnitNum > selectedTextbook.total_units) {
      setFormError(
        `unit 은 ${selectedTextbook.total_units} 이하여야 합니다.`
      );
      return;
    }
    if (startDate) {
      const gv = isValidGradingDate(startDate, meetDays, closedDates, skipDates);
      if (!gv.ok) {
        setFormError(GRADING_DATE_ERROR_MESSAGES[gv.reason]);
        return;
      }
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
      <div className="max-h-[90vh] overflow-y-auto p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">숙제 부여</h2>

        {/* 반 수업 요일 안내 */}
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs text-slate-600">
          <span className="font-semibold text-slate-700">이 반 수업</span>{" "}
          {meetDays.length > 0 ? (
            <span className="inline-flex flex-wrap gap-1 align-middle">
              {[...meetDays].sort((a, b) => a - b).map((d) => (
                <span
                  key={d}
                  className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-sky-100 px-1.5 text-[11px] font-semibold text-sky-700"
                >
                  {KST_DAY_LABELS[d]}
                </span>
              ))}
            </span>
          ) : (
            <span className="text-amber-600">정보 없음</span>
          )}
          <p className="mt-1 text-[11px] text-slate-400">
            숙제는 부여 요일에 나가고, <b>검사는 부여 요일의 다음 수업일</b>에 합니다.
          </p>
        </div>

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
                검사일
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={isPending}
                className="h-10"
                aria-invalid={startDateError ? true : undefined}
              />
              {startDateError && (
                <p className="mt-1 text-xs text-red-600">{startDateError}</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                이 검사일의 unit
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
              {selectedTextbook && selectedTextbook.total_units > 0 && (
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

          <p className="-mt-1 text-[11px] text-slate-500">
            “이 날짜(검사일)까지 이 unit 을 해 와라” 기준입니다. 나머지 unit 은
            요일에 맞춰 자동 계산됩니다.
          </p>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              숙제 부여 요일
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

          {/* 미리보기 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              채점 일정 미리보기
            </label>
            <HomeworkSchedulePreview
              startDate={startDate}
              startUnit={startUnitNum}
              totalUnits={maxUnit}
              homeworkDays={homeworkDays}
              meetDays={meetDays}
              skipDates={previewSkipDates}
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
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || !!startDateError}
            >
              {isPending ? "저장 중..." : "부여"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
