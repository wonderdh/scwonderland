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

// ── Schedule Modal ───────────────────────────────────────────────────────────
// 한국 교사가 반 숙제의 시작일을 설정. 숙제 요일은 관리자가 부여 단위로 지정한
// class_homework_books.homework_days 를 그대로 표시.

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

  const [note, setNote] = useState(assignment.note ?? "");
  const [startDate, setStartDate] = useState(assignment.start_date ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  const today = todayKst();
  const totalUnits = assignment.total_units ?? 0;
  const homeworkDays = useMemo(
    () => (assignment.homework_days ?? []).slice().sort((a, b) => a - b),
    [assignment.homework_days]
  );

  const startDateWeekend =
    startDate
      ? (() => {
          const wd = ymdToKstWeekday(startDate);
          return wd === 0 || wd === 6;
        })()
      : false;

  const preview = useMemo(() => {
    if (!startDate || startDateWeekend || homeworkDays.length === 0) return [];
    return getUnitSchedule({
      startDate,
      startUnit: 1,
      totalUnits,
      homeworkDays,
      skipDates: [],
    }).slice(0, 7);
  }, [startDate, startDateWeekend, totalUnits, homeworkDays]);

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
        note: note || null,
        startDate: startDate || null,
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
              숙제 요일 (관리자 지정)
            </label>
            {homeworkDays.length === 0 ? (
              <p className="text-xs text-amber-600">
                요일이 지정되지 않았습니다. 관리자에게 요청하세요.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {homeworkDays.map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center justify-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-700"
                  >
                    {KST_DAY_LABELS[d]}
                  </span>
                ))}
              </div>
            )}
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
              한국 교사 — 시작 날짜 설정 (요일은 관리자 지정)
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {classTextbooks.map((ct) => {
              const days = (ct.homework_days ?? []).slice().sort((a, b) => a - b);
              return (
                <button
                  key={ct.id}
                  type="button"
                  onClick={() => setEditTarget(ct)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-800 hover:bg-orange-100 transition-colors"
                >
                  <span className="font-semibold">{ct.title}</span>
                  {ct.start_date && (
                    <span className="text-orange-600">시작 {ct.start_date}</span>
                  )}
                  {days.length > 0 && (
                    <span className="rounded bg-white/70 px-1 py-0 text-[10px]">
                      {days.map((d) => KST_DAY_LABELS[d]).join(",")}
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
