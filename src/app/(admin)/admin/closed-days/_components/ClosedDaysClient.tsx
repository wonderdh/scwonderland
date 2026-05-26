"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listAcademyClosedDays,
  addAcademyClosedDays,
  removeAcademyClosedDay,
  type AcademyClosedDay,
} from "@/app/(admin)/admin/actions";
import { ymdToKstWeekday } from "@/lib/utils/homework-schedule";
import { KST_DAY_LABELS } from "@/lib/utils/date-kst";

function formatClosedDate(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일 (${KST_DAY_LABELS[ymdToKstWeekday(ymd)]})`;
}

export function ClosedDaysClient({
  initialDays,
}: {
  initialDays: AcademyClosedDay[];
}) {
  const [days, setDays] = useState<AcademyClosedDay[]>(initialDays);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [label, setLabel] = useState("");
  const [isPending, startTransition] = useTransition();

  async function refresh() {
    const res = await listAcademyClosedDays();
    if (!res.error) setDays(res.days);
  }

  function handleAdd() {
    if (!start) {
      toast.error("날짜를 선택하세요.");
      return;
    }
    if (end && end < start) {
      toast.error("종료 날짜는 시작 날짜 이후여야 합니다.");
      return;
    }
    startTransition(async () => {
      const res = await addAcademyClosedDays({
        startDate: start,
        endDate: end || null,
        label: label || null,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`쉬는날 ${res.added}일이 추가됐습니다.`);
      setStart("");
      setEnd("");
      setLabel("");
      await refresh();
    });
  }

  function handleRemove(closedDate: string) {
    startTransition(async () => {
      const res = await removeAcademyClosedDay(closedDate);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("삭제됐습니다.");
      await refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* 추가 폼 */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <h2 className="text-sm font-semibold text-slate-800">쉬는날 추가</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              시작 날짜
            </label>
            <Input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              disabled={isPending}
              className="h-10"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              종료 날짜 <span className="text-slate-400">(선택 — 연속 휴일)</span>
            </label>
            <Input
              type="date"
              value={end}
              min={start || undefined}
              onChange={(e) => setEnd(e.target.value)}
              disabled={isPending}
              className="h-10"
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            사유 <span className="text-slate-400">(선택)</span>
          </label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="예: 설날, 개교기념일"
            disabled={isPending}
            className="h-10"
          />
        </div>
        <div className="flex justify-end">
          <Button type="button" onClick={handleAdd} disabled={isPending}>
            {isPending ? "처리 중..." : "추가"}
          </Button>
        </div>
        <p className="text-xs text-slate-400">
          종료 날짜를 지정하면 시작~종료 사이 모든 날짜가 한 번에 등록됩니다. 이미
          등록된 날짜는 건너뜁니다.
        </p>
      </section>

      {/* 목록 */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-800">
          지정된 쉬는날 <span className="text-slate-400">({days.length})</span>
        </h2>
        {days.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
            지정된 쉬는날이 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {days.map((d) => (
              <li
                key={d.closed_date}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {formatClosedDate(d.closed_date)}
                  </p>
                  {d.label && (
                    <p className="truncate text-xs text-slate-500">{d.label}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(d.closed_date)}
                  disabled={isPending}
                  className="shrink-0 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
