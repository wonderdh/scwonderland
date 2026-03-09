"use client";

import { useState, useEffect, useCallback, useRef, useTransition } from "react";
import type { BusManifestGroup, BusManifestEntry } from "@/lib/types";
import {
  getDailyBusManifest,
  boardBusStudent,
  unboardBusStudent,
  checkBusStudent,
  uncheckBusStudent,
} from "@/app/(admin)/admin/actions";

const DIR_LABEL = { pickup: "등원", dropoff: "하원" } as const;
const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
const REFRESH_INTERVAL = 30;

function formatTime(t: string) {
  return t.slice(0, 5);
}

function formatCheckedTime(iso: string) {
  const d = new Date(iso);
  return `${d.getHours()}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function getToday() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type StopGroup = {
  note: string;
  estimatedTime: string | null;
  students: BusManifestEntry[];
};

function groupStudentsByStop(students: BusManifestEntry[]): StopGroup[] {
  const sorted = [...students].sort((a, b) => {
    const ta = a.estimated_time ?? "99:99";
    const tb = b.estimated_time ?? "99:99";
    if (ta !== tb) return ta.localeCompare(tb);
    return (a.note ?? "").localeCompare(b.note ?? "");
  });

  const groups: StopGroup[] = [];
  let current: StopGroup | null = null;

  for (const s of sorted) {
    const key = `${s.estimated_time ?? ""}|${s.note ?? ""}`;
    if (!current || `${current.estimatedTime ?? ""}|${current.note}` !== key) {
      current = {
        note: s.note ?? "",
        estimatedTime: s.estimated_time ?? null,
        students: [],
      };
      groups.push(current);
    }
    current.students.push(s);
  }

  return groups;
}

function ProgressBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500 w-8 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-slate-500 w-8 text-right">
        {count}/{total}
      </span>
    </div>
  );
}

function StaffBusCard({
  card,
  direction,
  onAction,
  pendingIds,
}: {
  card: BusManifestGroup;
  direction: "pickup" | "dropoff";
  onAction: (
    student: BusManifestEntry,
    busTimeSlotId: string,
    busNumberId: string,
    direction: "pickup" | "dropoff",
    action: "board" | "unboard" | "check" | "uncheck"
  ) => void;
  pendingIds: Set<string>;
}) {
  const boardedCount = card.students.filter(
    (s) => s.boarded_at || s.checked_at
  ).length;
  const checkedCount = card.students.filter((s) => s.checked_at).length;
  const totalCount = card.students.length;
  const allDone = checkedCount === totalCount && totalCount > 0;
  const stopGroups = groupStudentsByStop(card.students);

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <div className={`px-4 py-3 ${allDone ? "bg-green-50" : "bg-slate-50"}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-700">
              {card.bus_label}
            </span>
            {card.slot_label && (
              <span className="text-xs text-slate-500">
                {formatTime(card.slot_time)} {card.slot_label}
              </span>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <ProgressBar
            label="탑승"
            count={boardedCount}
            total={totalCount}
            color={boardedCount >= totalCount ? "bg-blue-500" : boardedCount > 0 ? "bg-amber-500" : "bg-red-500"}
          />
          <ProgressBar
            label="하차"
            count={checkedCount}
            total={totalCount}
            color={checkedCount >= totalCount ? "bg-green-500" : checkedCount > 0 ? "bg-amber-500" : "bg-slate-300"}
          />
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {stopGroups.map((group, gi) => (
          <div key={gi}>
            {(group.note || group.estimatedTime) && (
              <div className="px-4 py-2 bg-slate-50/60 flex items-center gap-2">
                <span className="text-xs text-slate-500">▸</span>
                {group.estimatedTime && (
                  <span className="text-xs font-medium text-slate-600">
                    {formatTime(group.estimatedTime)}
                  </span>
                )}
                {group.note && (
                  <span className="text-xs text-slate-500 truncate">
                    {group.note}
                  </span>
                )}
              </div>
            )}

            {group.students.map((student) => {
              const isBoarded = !!student.boarded_at;
              const isChecked = !!student.checked_at;
              const isPending = pendingIds.has(student.student_profile_id);

              const rowBg = isChecked
                ? "bg-green-50/50"
                : isBoarded
                  ? "bg-blue-50/40"
                  : "";

              return (
                <div
                  key={student.student_profile_id}
                  className={`px-4 py-3 pl-8 flex items-center gap-2 text-sm ${rowBg} ${
                    isPending ? "opacity-60" : ""
                  }`}
                >
                  {/* 행 탭 — 탑승 토글 */}
                  <button
                    type="button"
                    disabled={isPending || isChecked}
                    onClick={() =>
                      onAction(
                        student,
                        card.bus_time_slot_id,
                        card.bus_number_id,
                        direction,
                        isBoarded ? "unboard" : "board"
                      )
                    }
                    className={`flex items-center gap-2 flex-1 min-w-0 text-left ${
                      isChecked
                        ? "cursor-default"
                        : "cursor-pointer active:scale-[0.98]"
                    }`}
                  >
                    <span className="text-base shrink-0">
                      {isChecked ? "✅" : isBoarded ? "🚌" : "⬜"}
                    </span>
                    <span
                      className={`flex-1 truncate ${
                        isChecked
                          ? "text-slate-400 line-through"
                          : isBoarded
                            ? "font-medium text-blue-700"
                            : "font-medium text-slate-700"
                      }`}
                    >
                      {student.korean_name || student.english_name}
                    </span>
                  </button>

                  {/* 시각 표시 */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isBoarded && student.boarded_at && !isChecked && (
                      <span className="text-xs text-blue-600">
                        {formatCheckedTime(student.boarded_at)}
                      </span>
                    )}
                    {isChecked && student.checked_at && (
                      <span className="text-xs text-green-600">
                        {formatCheckedTime(student.checked_at)}
                      </span>
                    )}
                  </div>

                  {/* 하차 버튼 */}
                  {isBoarded && !isChecked && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAction(
                          student,
                          card.bus_time_slot_id,
                          card.bus_number_id,
                          direction,
                          "check"
                        );
                      }}
                      className="shrink-0 text-sm bg-green-100 text-green-700 px-3 py-1.5 rounded-lg font-medium hover:bg-green-200 active:scale-95"
                    >
                      하차
                    </button>
                  )}

                  {/* 하차 취소 */}
                  {isChecked && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAction(
                          student,
                          card.bus_time_slot_id,
                          card.bus_number_id,
                          direction,
                          "uncheck"
                        );
                      }}
                      className="shrink-0 text-sm text-slate-400 hover:text-slate-600 p-1.5 active:scale-95"
                      title="하차 취소"
                    >
                      ↩
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function BusStaffMonitor({
  busNumberId,
  staffProfileId,
}: {
  busNumberId: string | null;
  staffProfileId: string;
}) {
  const [date, setDate] = useState(getToday);
  const [direction, setDirection] = useState<"pickup" | "dropoff">("pickup");
  const [groups, setGroups] = useState<BusManifestGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const countdownRef = useRef(REFRESH_INTERVAL);
  const [, startTransition] = useTransition();
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const currentDate = getToday();
    setDate(currentDate);

    const result = await getDailyBusManifest(currentDate, direction);

    const filtered = busNumberId
      ? result.groups.filter((g) => g.bus_number_id === busNumberId)
      : result.groups;

    setGroups(filtered);
    setLoading(false);
    setCountdown(REFRESH_INTERVAL);
    countdownRef.current = REFRESH_INTERVAL;
  }, [direction, busNumberId]);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(), REFRESH_INTERVAL * 1000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => {
      countdownRef.current -= 1;
      if (countdownRef.current < 0) countdownRef.current = REFRESH_INTERVAL;
      setCountdown(countdownRef.current);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleAction = useCallback(
    (
      student: BusManifestEntry,
      busTimeSlotId: string,
      busNumberId: string,
      dir: "pickup" | "dropoff",
      action: "board" | "unboard" | "check" | "uncheck"
    ) => {
      const sid = student.student_profile_id;
      const now = new Date().toISOString();

      // Optimistic update
      setGroups((prev) =>
        prev.map((c) => ({
          ...c,
          students: c.students.map((s) => {
            if (s.student_profile_id !== sid) return s;
            switch (action) {
              case "board":
                return { ...s, boarded_at: now };
              case "unboard":
                return { ...s, boarded_at: null };
              case "check":
                return { ...s, checked_at: now, check_record_id: "optimistic" };
              case "uncheck":
                return { ...s, checked_at: null, check_record_id: null };
              default:
                return s;
            }
          }),
        }))
      );

      setPendingIds((prev) => new Set(prev).add(sid));

      startTransition(async () => {
        let result: { error?: string };

        switch (action) {
          case "board":
            result = await boardBusStudent(
              sid,
              date,
              dir,
              busTimeSlotId,
              busNumberId
            );
            break;
          case "unboard":
            result = await unboardBusStudent(sid, date, dir);
            break;
          case "check":
            result = await checkBusStudent(
              sid,
              date,
              dir,
              busTimeSlotId,
              busNumberId,
              staffProfileId
            );
            break;
          case "uncheck":
            result = await uncheckBusStudent(sid, date, dir);
            break;
        }

        if (result.error) {
          // Rollback
          setGroups((prev) =>
            prev.map((c) => ({
              ...c,
              students: c.students.map((s) => {
                if (s.student_profile_id !== sid) return s;
                return {
                  ...s,
                  boarded_at: student.boarded_at,
                  checked_at: student.checked_at,
                  check_record_id: student.check_record_id,
                };
              }),
            }))
          );
          alert(`오류: ${result.error}`);
        }

        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(sid);
          return next;
        });
      });
    },
    [date, staffProfileId]
  );

  const d = new Date(date);
  const dayName = DAY_NAMES[d.getDay()];

  const totalStudents = groups.reduce((sum, g) => sum + g.students.length, 0);
  const totalBoarded = groups.reduce(
    (sum, g) =>
      sum + g.students.filter((s) => s.boarded_at || s.checked_at).length,
    0
  );
  const totalChecked = groups.reduce(
    (sum, g) => sum + g.students.filter((s) => s.checked_at).length,
    0
  );

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* 날짜 + 방향 토글 + 갱신 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-bold text-slate-800">
            {date} ({dayName})
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{countdown}초 후</span>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="text-xs text-slate-500 hover:text-slate-700 active:scale-95"
            >
              {loading ? "..." : "↻"}
            </button>
          </div>
        </div>

        {/* 등원/하원 탭 */}
        <div className="flex rounded-lg bg-slate-200 p-0.5">
          {(["pickup", "dropoff"] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              onClick={() => setDirection(dir)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                direction === dir
                  ? dir === "pickup"
                    ? "bg-white text-blue-700 shadow-sm"
                    : "bg-white text-orange-700 shadow-sm"
                  : "text-slate-500"
              }`}
            >
              {DIR_LABEL[dir]}
            </button>
          ))}
        </div>

        {/* 전체 통계 */}
        {totalStudents > 0 && (
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>
              전체 탑승{" "}
              <strong className="text-slate-700">
                {totalBoarded}/{totalStudents}
              </strong>
            </span>
            <span>
              하차{" "}
              <strong className="text-slate-700">
                {totalChecked}/{totalStudents}
              </strong>
            </span>
          </div>
        )}
      </div>

      {/* 데이터 없음 */}
      {groups.length === 0 && !loading && (
        <p className="text-sm text-slate-400 py-12 text-center">
          배정된 학생이 없습니다.
        </p>
      )}

      {/* 호차별 카드 */}
      <div className="space-y-4">
        {groups.map((card) => (
          <StaffBusCard
            key={`${card.bus_time_slot_id}-${card.bus_number_id}`}
            card={card}
            direction={direction}
            onAction={handleAction}
            pendingIds={pendingIds}
          />
        ))}
      </div>
    </div>
  );
}
