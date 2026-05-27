"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/overlays/Modal";
import { updateClassTextbookDays } from "@/app/(admin)/admin/actions";
import type { ClassTextbookWithDetails } from "@/app/(admin)/admin/actions";
import { KST_DAY_LABELS, todayKst } from "@/lib/utils/date-kst";
import { ymdToKstWeekday } from "@/lib/utils/homework-schedule";
import { SkipDatesEditor } from "./SkipDatesEditor";
import { HomeworkSchedulePreview } from "./HomeworkSchedulePreview";

const WEEKDAYS: { idx: number; label: string }[] = [
  { idx: 1, label: KST_DAY_LABELS[1] },
  { idx: 2, label: KST_DAY_LABELS[2] },
  { idx: 3, label: KST_DAY_LABELS[3] },
  { idx: 4, label: KST_DAY_LABELS[4] },
  { idx: 5, label: KST_DAY_LABELS[5] },
];

type Props = {
  assignment: ClassTextbookWithDetails;
  /** 반 수업(=등원) 요일 (0=일~6=토). 채점일 계산 기준. */
  meetDays: number[];
  /** 학원 공통 쉬는날 (YYYY-MM-DD) — 미리보기 채점일 계산에서 제외. */
  closedDates: string[];
  onClose: () => void;
  onSaved: () => void;
};

export function EditClassHomeworkModal({
  assignment,
  meetDays,
  closedDates,
  onClose,
  onSaved,
}: Props) {
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
  const startUnitNum = Number.parseInt(startUnit, 10);
  const previewSkipDates = Array.from(new Set([...skipDates, ...closedDates]));

  function toggleDay(day: number) {
    setHomeworkDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort((a, b) => a - b)
    );
  }

  function applyToday() {
    const today = todayKst();
    const wd = ymdToKstWeekday(today);
    if (wd === 0 || wd === 6) {
      setFormError("오늘은 주말이라 검사일로 지정할 수 없습니다.");
      return;
    }
    setFormError(null);
    setStartDate(today);
  }

  function handleSubmit() {
    setFormError(null);
    if (!Number.isFinite(startUnitNum) || startUnitNum < 1) {
      setFormError("unit 은 1 이상의 정수여야 합니다.");
      return;
    }
    if (maxUnit > 0 && startUnitNum > maxUnit) {
      setFormError(`unit 은 ${maxUnit} 이하여야 합니다.`);
      return;
    }
    if (startDate) {
      const wd = ymdToKstWeekday(startDate);
      if (wd === 0 || wd === 6) {
        setFormError("검사일은 평일만 가능합니다 (토/일 불가).");
        return;
      }
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
    <Modal open onClose={onClose}>
      <div className="max-h-[90vh] overflow-y-auto p-6">
        <h2 className="mb-1 text-lg font-semibold text-slate-900">숙제 수정</h2>
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {assignment.series && (
            <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
              {assignment.series}
            </span>
          )}
          {assignment.level && (
            <span className="inline-block rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
              {assignment.level}
            </span>
          )}
        </div>

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
              />
              <button
                type="button"
                onClick={applyToday}
                disabled={isPending}
                className="mt-1 text-[11px] text-primary underline-offset-2 hover:underline disabled:opacity-50"
              >
                오늘로 맞추기
              </button>
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
              {maxUnit > 0 && (
                <p className="mt-1 text-xs text-slate-400">/ 총 {maxUnit} unit</p>
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
                요일 미지정 — 진도 스케줄이 비활성됩니다.
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
              startUnit={Number.isFinite(startUnitNum) ? startUnitNum : 1}
              totalUnits={maxUnit}
              homeworkDays={homeworkDays}
              meetDays={meetDays}
              skipDates={previewSkipDates}
            />
          </div>

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
              {isPending ? "저장 중..." : "저장"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
