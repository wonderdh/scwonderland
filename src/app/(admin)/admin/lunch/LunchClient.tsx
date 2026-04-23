"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/feedback/Spinner";
import { toastError, toastSuccess } from "@/lib/ui/toast";
import {
  setLunchLeaderAnchor,
  clearLunchLeaderAnchor,
  setLunchClassOrderAnchor,
  clearLunchClassOrderAnchor,
} from "@/app/(admin)/admin/actions";
import type {
  LunchDaySchedule,
  LunchClassSchedule,
  LunchStudent,
  LunchGroup,
} from "@/lib/lunch/rotation";
import { formatDateKst } from "@/lib/utils/date-kst";

export function LunchClient({ schedule }: { schedule: LunchDaySchedule }) {
  const router = useRouter();
  const [navPending, startNav] = useTransition();

  const shift = (days: number) => {
    const [y, m, d] = schedule.date.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    const next = dt.toISOString().slice(0, 10);
    startNav(() => {
      router.push(`/admin/lunch?date=${next}`);
    });
  };

  const goToday = () => {
    startNav(() => {
      router.push("/admin/lunch");
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-16 relative">
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-800">점심지도</h1>
          <Link href="/admin/lunch/settings">
            <Button variant="ghost" size="sm" className="text-slate-500">
              설정
            </Button>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => shift(-1)}
            disabled={navPending}
          >
            ← 전날
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={goToday}
            disabled={navPending}
          >
            오늘로
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => shift(1)}
            disabled={navPending}
          >
            다음날 →
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>
            {formatDateKst(schedule.date)} ({schedule.weekdayLabel}요일)
          </span>
          {navPending && (
            <span className="inline-flex items-center gap-1 text-blue-500">
              <Spinner size="sm" /> 불러오는 중...
            </span>
          )}
        </div>
      </header>

      <div
        className={`space-y-5 transition-opacity ${
          navPending ? "opacity-40 pointer-events-none" : ""
        }`}
      >
        <TimeSection
          timeLabel="12:20"
          title="7세반 (먼저 올라가는 반 → 나중 반)"
          lunchGroup="7세"
          groups={schedule.age7Groups}
          orderAnchor={schedule.class_order_anchors.age7}
          date={schedule.date}
        />

        <TimeSection
          timeLabel="12:40"
          title="6세반 (먼저 올라가는 반 → 나중 반)"
          lunchGroup="6세"
          groups={schedule.age6Groups}
          orderAnchor={schedule.class_order_anchors.age6}
          date={schedule.date}
        />
      </div>

      {navPending && (
        <div className="fixed inset-x-0 top-0 z-40">
          <div className="h-1 w-full overflow-hidden bg-blue-100">
            <div className="h-full w-1/2 animate-[slide_1.2s_ease-in-out_infinite] bg-blue-500" />
          </div>
        </div>
      )}
      <style jsx>{`
        @keyframes slide {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(200%);
          }
        }
      `}</style>
    </div>
  );
}

function TimeSection({
  timeLabel,
  title,
  lunchGroup,
  groups,
  orderAnchor,
  date,
}: {
  timeLabel: string;
  title: string;
  lunchGroup: LunchGroup;
  groups: LunchClassSchedule[];
  orderAnchor: { id: string; effective_from: string; first_class_id: string } | null;
  date: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const swapOrder = (makeFirstClassId: string) => {
    startTransition(async () => {
      const r = await setLunchClassOrderAnchor(date, lunchGroup, makeFirstClassId);
      if (r.error) toastError(r.error);
      else {
        toastSuccess("반 순서가 바뀌었습니다. 오늘부터 영구 적용됩니다.");
        router.refresh();
      }
    });
  };

  const clearOrder = () => {
    startTransition(async () => {
      const r = await clearLunchClassOrderAnchor(date, lunchGroup);
      if (r.error) toastError(r.error);
      else {
        toastSuccess("초기 로테이션으로 복귀했습니다.");
        router.refresh();
      }
    });
  };

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <span className="rounded-full bg-orange-100 px-3 py-1 text-base font-bold text-orange-700">
            {timeLabel}
          </span>
          <span className="text-sm font-medium text-slate-600">{title}</span>
        </div>
        {orderAnchor && (
          <button
            type="button"
            onClick={clearOrder}
            disabled={pending}
            className="text-xs text-slate-400 hover:text-red-500 disabled:opacity-50"
          >
            {pending && <Spinner size="sm" />} 순서 초기화
          </button>
        )}
      </div>
      <div className="space-y-3">
        {groups.map((group, idx) => (
          <ClassCard
            key={group.class_id}
            order={idx + 1}
            group={group}
            date={date}
            canSwap={idx === 1 && !pending}
            onSwap={() => swapOrder(group.class_id)}
          />
        ))}
      </div>
    </section>
  );
}

function ClassCard({
  order,
  group,
  date,
  canSwap,
  onSwap,
}: {
  order: number;
  group: LunchClassSchedule;
  date: string;
  canSwap: boolean;
  onSwap: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  const leader = group.students[0];
  const hasLeaderAnchor = group.leader_anchor_id !== null;

  const changeLeader = (studentId: string) => {
    startTransition(async () => {
      const r = await setLunchLeaderAnchor(date, group.class_id, studentId);
      if (r.error) toastError(r.error);
      else {
        toastSuccess("리더가 변경되었습니다. 오늘부터 영구 적용됩니다.");
        setEditing(false);
        router.refresh();
      }
    });
  };

  const clearLeader = () => {
    startTransition(async () => {
      const r = await clearLunchLeaderAnchor(date, group.class_id);
      if (r.error) toastError(r.error);
      else {
        toastSuccess("자동 로테이션으로 복귀했습니다.");
        router.refresh();
      }
    });
  };

  return (
    <div
      className={`rounded-xl border bg-white p-4 shadow-sm ${
        order === 1 ? "border-orange-300 ring-1 ring-orange-200" : "border-slate-200"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
              order === 1 ? "bg-orange-500 text-white" : "bg-slate-200 text-slate-700"
            }`}
          >
            {order}
          </span>
          <h3 className="text-lg font-bold text-slate-800">{group.class_name}</h3>
        </div>
        <div className="flex items-center gap-2">
          {canSwap && (
            <Button
              size="sm"
              variant="outline"
              onClick={onSwap}
              disabled={pending}
              className="text-xs"
            >
              ↑ 먼저 올리기
            </Button>
          )}
          {hasLeaderAnchor && (
            <button
              type="button"
              onClick={clearLeader}
              disabled={pending}
              className="text-xs text-slate-400 hover:text-red-500 disabled:opacity-50"
            >
              {pending && <Spinner size="sm" />} 리더 초기화
            </button>
          )}
        </div>
      </div>

      {leader && (
        <div className="mt-3 rounded-lg bg-blue-50 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-blue-600">오늘 리더</p>
              <p className="text-lg font-bold text-blue-800">
                {leader.english_name ?? "?"}
                {leader.korean_name && (
                  <span className="ml-2 text-sm font-normal text-blue-600">
                    ({leader.korean_name})
                  </span>
                )}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(!editing)}
              disabled={pending}
            >
              {editing ? "닫기" : "변경"}
            </Button>
          </div>
          {editing && (
            <div className="mt-3 max-h-48 overflow-y-auto rounded border border-blue-200 bg-white divide-y divide-blue-100">
              {group.students
                .filter((s) => s.profile_id !== leader.profile_id)
                .map((s) => (
                  <button
                    key={s.profile_id}
                    type="button"
                    onClick={() => changeLeader(s.profile_id)}
                    disabled={pending}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50 disabled:opacity-50"
                  >
                    {s.english_name ?? "?"}
                    {s.korean_name && (
                      <span className="ml-2 text-xs text-slate-500">
                        ({s.korean_name})
                      </span>
                    )}
                    {s.isAbsent && (
                      <span className="ml-2 text-xs text-red-500">결석</span>
                    )}
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      <ol className="mt-3 space-y-1.5">
        {group.students.map((s, i) => (
          <StudentRow key={s.profile_id} index={i + 1} student={s} />
        ))}
      </ol>
    </div>
  );
}

function StudentRow({ index, student }: { index: number; student: LunchStudent }) {
  return (
    <li
      className={`flex items-center gap-3 rounded-md px-2 py-1.5 ${
        student.isLeader ? "bg-blue-50" : ""
      } ${student.isAbsent ? "opacity-50" : ""}`}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          student.isLeader
            ? "bg-blue-500 text-white"
            : "bg-slate-100 text-slate-600"
        }`}
      >
        {index}
      </span>
      <div className={`flex-1 min-w-0 ${student.isAbsent ? "line-through" : ""}`}>
        <span className="text-base font-medium text-slate-800">
          {student.english_name ?? "?"}
        </span>
        {student.korean_name && (
          <span className="ml-2 text-sm text-slate-500">
            {student.korean_name}
          </span>
        )}
      </div>
      {student.isLeader && !student.isAbsent && (
        <span className="shrink-0 rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-bold text-white">
          리더
        </span>
      )}
      {student.isAbsent && (
        <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
          결석
        </span>
      )}
    </li>
  );
}
