"use client";

import { useEffect, useMemo, useState, useTransition, startTransition as reactStartTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  updateClassTextbookDays,
  getUnitSchedule,
  listClassUnitProgressDetailed,
} from "@/app/(admin)/admin/actions";
import type {
  ClassTextbookWithDetails,
  ClassUnitProgressDetailed,
} from "@/app/(admin)/admin/actions";
import { todayKst, KST_DAY_LABELS } from "@/lib/utils/date-kst";
import { ymdToKstWeekday } from "@/lib/utils/homework-schedule";
import { ClassUnitProgressList } from "@/components/homework/ClassUnitProgressList";

// 월~금 only (DB weekday: 1=월 … 5=금)
const WEEKDAY_LABELS = ["월", "화", "수", "목", "금"];
const DB_WEEKDAYS = [1, 2, 3, 4, 5];

// ── Schedule Modal ───────────────────────────────────────────────────────────
// 한국 교사가 반 숙제의 숙제 일정을 설정하는 모달

function EditDaysModal({
  assignment,
  onClose,
  onSaved,
}: {
  assignment: ClassTextbookWithDetails;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  const initialDays = new Set(
    (assignment.homework_days ?? []).filter((d) => d >= 1 && d <= 5)
  );
  const [selectedDays, setSelectedDays] = useState<Set<number>>(initialDays);
  const [note, setNote] = useState(assignment.note ?? "");
  const [skipDates, setSkipDates] = useState<string[]>(
    assignment.skip_dates ?? []
  );
  const [dateDraft, setDateDraft] = useState("");
  const [startDate, setStartDate] = useState(assignment.start_date ?? "");
  const [startUnit, setStartUnit] = useState(assignment.start_unit ?? 1);
  const [formError, setFormError] = useState<string | null>(null);

  const today = todayKst();
  const totalUnits = assignment.total_units ?? 0;

  const startDateWeekend =
    startDate
      ? (() => {
          const wd = ymdToKstWeekday(startDate);
          return wd === 0 || wd === 6;
        })()
      : false;

  function toggleDay(d: number) {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }

  const preview = useMemo(() => {
    if (!startDate || startDateWeekend || selectedDays.size === 0) return [];
    return getUnitSchedule({
      startDate,
      startUnit,
      totalUnits,
      homeworkDays: [...selectedDays],
      skipDates,
    }).slice(0, 7);
  }, [startDate, startDateWeekend, startUnit, totalUnits, selectedDays, skipDates]);

  const MONTH_LABELS = [
    "1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월",
  ];
  function formatPreviewDate(ymd: string) {
    const [, m, d] = ymd.split("-").map(Number);
    const wd = ymdToKstWeekday(ymd);
    const wdLabel = ["일", "월", "화", "수", "목", "금", "토"][wd];
    return `${MONTH_LABELS[m - 1]} ${d}일 (${wdLabel})`;
  }

  function handleSubmit() {
    if (startDateWeekend) {
      setFormError("시작 날짜는 평일만 가능합니다.");
      return;
    }
    setFormError(null);
    startTransition(async () => {
      const result = await updateClassTextbookDays(assignment.id, {
        homeworkDays: [...selectedDays],
        skipDates,
        note: note || null,
        startDate: startDate || null,
        startUnit,
      });
      if (result.error) {
        setFormError(result.error);
        return;
      }
      toast.success("숙제 일정이 저장됐습니다.");
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
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-lg font-semibold text-slate-900">
            {assignment.title} — 숙제 제출
          </h2>
        </div>
        <p className="text-sm text-slate-500 mb-4">숙제 일정 설정</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              시작 날짜
            </label>
            <input
              type="date"
              value={startDate}
              min={today}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={isPending}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
            {startDateWeekend && (
              <p className="mt-1 text-xs text-red-600">
                평일만 가능합니다 (토/일 불가).
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              시작 Unit
            </label>
            <input
              type="number"
              value={startUnit}
              min={1}
              max={totalUnits > 0 ? totalUnits : undefined}
              onChange={(e) => setStartUnit(Math.max(1, Number(e.target.value)))}
              disabled={isPending}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              숙제 요일 (월~금)
            </label>
            <div className="flex gap-2">
              {WEEKDAY_LABELS.map((label, idx) => {
                const dbDay = DB_WEEKDAYS[idx];
                return (
                  <button
                    key={dbDay}
                    type="button"
                    onClick={() => toggleDay(dbDay)}
                    disabled={isPending}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium border transition-colors ${
                      selectedDays.has(dbDay)
                        ? "bg-orange-500 text-white border-orange-500"
                        : "bg-white text-slate-600 border-slate-300 hover:border-orange-300"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              쉬는 날 (예외)
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={dateDraft}
                onChange={(e) => setDateDraft(e.target.value)}
                disabled={isPending}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  if (dateDraft && !skipDates.includes(dateDraft)) {
                    setSkipDates([...skipDates, dateDraft].sort());
                  }
                  setDateDraft("");
                }}
                disabled={isPending || !dateDraft}
                className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium hover:bg-slate-200 disabled:opacity-50"
              >
                추가
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {skipDates.map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
                >
                  {d}
                  <button
                    type="button"
                    onClick={() =>
                      setSkipDates(skipDates.filter((x) => x !== d))
                    }
                    disabled={isPending}
                    className="hover:text-amber-900"
                    aria-label={`${d} 제거`}
                  >
                    ×
                  </button>
                </span>
              ))}
              {skipDates.length === 0 && (
                <span className="text-xs text-slate-400">쉬는 날 없음</span>
              )}
            </div>
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

          {preview.length > 0 && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
              <p className="text-xs font-medium text-slate-600 mb-1.5">
                다음 {preview.length}개:
              </p>
              <ul className="space-y-0.5">
                {preview.map((p) => (
                  <li key={p.date} className="text-xs text-slate-700">
                    {formatPreviewDate(p.date)} →{" "}
                    <span className="font-semibold text-blue-700">
                      U{p.unit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {formError && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-2">
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

// ── Main Client Component ────────────────────────────────────────────────────

type Props = {
  classes: { id: string; name: string }[];
  selectedClassId: string;
  classTextbooks: ClassTextbookWithDetails[];
  /** 한국 교사만 schedule 수정 가능. false 면 ✎ 일정 섹션 자체 숨김. */
  canEditSchedule: boolean;
  initialData: ClassUnitProgressDetailed;
};

export function TeacherTextbooksClient({
  classes,
  selectedClassId,
  classTextbooks,
  canEditSchedule,
  initialData,
}: Props) {
  const router = useRouter();
  const [editTarget, setEditTarget] = useState<ClassTextbookWithDetails | null>(
    null
  );

  // 반별 학생 진도 (read-only). 반 변경 시 client-side fetch 로 갱신.
  const [data, setData] = useState<ClassUnitProgressDetailed>(initialData);
  const [isLoading, startLoading] = useTransition();
  const [currentClassId, setCurrentClassId] = useState(selectedClassId);

  // selectedClassId 가 외부(URL) 에서 바뀌면 동기화
  useEffect(() => {
    if (selectedClassId === currentClassId) return;
    reactStartTransition(() => {
      setCurrentClassId(selectedClassId);
      setData(initialData);
    });
  }, [selectedClassId, currentClassId, initialData]);

  function handleClassChange(classId: string) {
    setCurrentClassId(classId);
    router.replace(`/academy/teacher/homework?class=${classId}`, {
      scroll: false,
    });
    startLoading(async () => {
      const next = await listClassUnitProgressDetailed(classId);
      setData(next);
    });
  }

  return (
    <div className="space-y-6">
      {/* Class selector */}
      <div className="flex flex-wrap gap-2">
        {classes.map((cls) => (
          <button
            key={cls.id}
            onClick={() => handleClassChange(cls.id)}
            disabled={isLoading}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              cls.id === currentClassId
                ? "bg-green-600 text-white border-green-600 shadow-sm"
                : "bg-white text-slate-700 border-slate-200 hover:border-green-400 hover:text-green-700"
            } disabled:opacity-50`}
          >
            {cls.name}
          </button>
        ))}
      </div>

      {/* Schedule 설정 섹션 — 책별 ✎ 버튼 (한국 교사 전용) */}
      {canEditSchedule && classTextbooks.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">
              숙제 일정 설정
            </h2>
            <span className="text-xs text-slate-400">
              한국 교사 — 시작 날짜 / Unit / 요일 / 쉬는 날 설정
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {classTextbooks.map((ct) => {
              const dayBadges = (ct.homework_days ?? [])
                .map((d) => KST_DAY_LABELS[d])
                .join(",");
              return (
                <button
                  key={ct.id}
                  type="button"
                  onClick={() => setEditTarget(ct)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-800 hover:bg-orange-100 transition-colors"
                >
                  <span className="font-semibold">{ct.title}</span>
                  {ct.start_date && (
                    <span className="text-orange-600">
                      {ct.start_date} U{ct.start_unit ?? 1}+
                    </span>
                  )}
                  {dayBadges && (
                    <span className="rounded bg-white/70 px-1 py-0 text-[10px]">
                      {dayBadges}
                    </span>
                  )}
                  {ct.skip_dates && ct.skip_dates.length > 0 && (
                    <span className="rounded bg-amber-100 text-amber-800 px-1 py-0 text-[10px]">
                      예외 {ct.skip_dates.length}
                    </span>
                  )}
                  <span className="text-orange-500">✎</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 학생 진도 — 모든 학생 한 화면, read-only */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-800">
          학생 진도 (전체, 읽기 전용)
        </h2>
        <ClassUnitProgressList
          students={data.students}
          byStudent={data.byStudent}
          editable={false}
          loading={isLoading}
          emptyMessage="이 반에 등록된 학생이 없습니다."
        />
      </section>

      {/* Schedule modal */}
      {editTarget && (
        <EditDaysModal
          assignment={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}
