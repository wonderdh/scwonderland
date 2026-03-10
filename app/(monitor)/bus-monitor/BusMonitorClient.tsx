"use client";

import { useState, useEffect, useCallback, useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { BusManifestGroup, BusManifestEntry, BusTimeSlot } from "@/lib/types";
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

function getCurrentHHMM() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
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

function ProgressBar({ boarded, total }: { boarded: number; total: number }) {
  const pct = total > 0 ? Math.round((boarded / total) * 100) : 0;
  const color =
    pct >= 90 ? "bg-blue-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** 이 수 초과 시 카드가 넓어지고 내부 2열 그리드 사용 */
const WIDE_THRESHOLD = 8;

function MonitorBusCard({
  card,
  onAction,
  pendingIds,
  wide,
}: {
  card: BusManifestGroup;
  onAction: (
    student: BusManifestEntry,
    busTimeSlotId: string,
    busNumberId: string,
    action: "board" | "unboard" | "check" | "uncheck"
  ) => void;
  pendingIds: Set<string>;
  wide: boolean;
}) {
  const boardedCount = card.students.filter(
    (s) => s.boarded_at || s.checked_at
  ).length;
  const checkedCount = card.students.filter((s) => s.checked_at).length;
  const totalCount = card.students.length;
  const allDone = checkedCount === totalCount && totalCount > 0;
  const stopGroups = groupStudentsByStop(card.students);

  const renderStudent = (student: BusManifestEntry) => {
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
        className={`px-3 py-1 flex items-center gap-2 ${rowBg} ${
          isPending ? "opacity-60" : ""
        }`}
      >
        <button
          type="button"
          disabled={isPending || isChecked}
          onClick={() =>
            onAction(
              student,
              card.bus_time_slot_id,
              card.bus_number_id,
              isBoarded ? "unboard" : "board"
            )
          }
          className={`flex items-center gap-2 flex-1 min-w-0 text-left ${
            isChecked ? "cursor-default" : "cursor-pointer active:scale-[0.98]"
          }`}
        >
          <span className="text-lg shrink-0">
            {isChecked ? "✅" : isBoarded ? "🚌" : "⬜"}
          </span>
          <span
            className={`flex-1 truncate text-xl ${
              isChecked
                ? "text-slate-400 line-through"
                : isBoarded
                  ? "font-bold text-blue-700"
                  : "font-bold text-slate-800"
            }`}
          >
            {student.korean_name || student.english_name}
          </span>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          {isBoarded && student.boarded_at && !isChecked && (
            <span className="text-sm text-blue-600 font-medium">
              {formatCheckedTime(student.boarded_at)}
            </span>
          )}
          {isChecked && student.checked_at && (
            <span className="text-sm text-green-600 font-medium">
              {formatCheckedTime(student.checked_at)}
            </span>
          )}
        </div>

        {isBoarded && !isChecked && (
          <button
            type="button"
            disabled={isPending}
            onClick={(e) => {
              e.stopPropagation();
              onAction(student, card.bus_time_slot_id, card.bus_number_id, "check");
            }}
            className="shrink-0 text-sm bg-green-100 text-green-700 px-3 py-1 rounded-md font-semibold hover:bg-green-200 active:scale-95"
          >
            하차
          </button>
        )}

        {isChecked && (
          <button
            type="button"
            disabled={isPending}
            onClick={(e) => {
              e.stopPropagation();
              onAction(student, card.bus_time_slot_id, card.bus_number_id, "uncheck");
            }}
            className="shrink-0 text-sm text-slate-400 hover:text-slate-600 p-1 active:scale-95"
            title="하차 취소"
          >
            ↩
          </button>
        )}
      </div>
    );
  };

  const renderStopGroup = (group: StopGroup, gi: number) => (
    <div key={gi}>
      {(group.note || group.estimatedTime) && (
        <div className="px-4 py-1 bg-slate-50/60 flex items-center gap-2">
          <span className="text-sm text-slate-500">▸</span>
          {group.estimatedTime && (
            <span className="text-sm font-semibold text-slate-600">
              {formatTime(group.estimatedTime)}
            </span>
          )}
          {group.note && (
            <span className="text-sm text-slate-500 truncate">
              {group.note}
            </span>
          )}
        </div>
      )}
      {group.students.map(renderStudent)}
    </div>
  );

  // wide 모드: stopGroups를 학생 수 기준으로 좌/우 컬럼에 분배
  const splitStopGroups = () => {
    const total = stopGroups.reduce((sum, g) => sum + g.students.length, 0);
    const half = Math.ceil(total / 2);
    const left: StopGroup[] = [];
    const right: StopGroup[] = [];
    let count = 0;
    for (const g of stopGroups) {
      if (count < half) {
        // 이 그룹이 half를 넘으면 분할
        const remaining = half - count;
        if (remaining >= g.students.length) {
          left.push(g);
          count += g.students.length;
        } else {
          // 그룹을 나눠서 왼쪽/오른쪽에 분배
          left.push({ ...g, students: g.students.slice(0, remaining) });
          right.push({ ...g, students: g.students.slice(remaining) });
          count += g.students.length;
        }
      } else {
        right.push(g);
        count += g.students.length;
      }
    }
    return { left, right };
  };

  return (
    <div className={`rounded-xl border bg-white shadow-sm overflow-hidden ${wide ? "col-span-2" : ""}`}>
      <div
        className={`px-4 py-2 ${allDone ? "bg-green-50" : "bg-slate-50"}`}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-lg font-bold text-slate-800">
            {card.bus_label}
          </span>
          <span className="text-base font-medium text-slate-500">
            탑승 {boardedCount}/{totalCount} · 하차 {checkedCount}/{totalCount}
          </span>
        </div>
        <ProgressBar boarded={boardedCount} total={totalCount} />
      </div>

      {wide ? (() => {
        const { left, right } = splitStopGroups();
        return (
          <div className="grid grid-cols-2 divide-x divide-slate-200">
            <div className="divide-y divide-slate-100">
              {left.map((g, i) => renderStopGroup(g, i))}
            </div>
            <div className="divide-y divide-slate-100">
              {right.map((g, i) => renderStopGroup(g, i + left.length))}
            </div>
          </div>
        );
      })() : (
        <div className="divide-y divide-slate-100">
          {stopGroups.map((g, i) => renderStopGroup(g, i))}
        </div>
      )}
    </div>
  );
}

// 시간대별 그룹 (방향 포함)
type TimeGroup = {
  slotTime: string;
  slotLabel: string;
  direction: "pickup" | "dropoff";
  cards: BusManifestGroup[];
};

export function BusMonitorClient({
  busTimeSlots,
}: {
  busTimeSlots: BusTimeSlot[];
}) {
  const [date, setDate] = useState(getToday);
  const [allGroups, setAllGroups] = useState<TimeGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [showAll, setShowAll] = useState(false);
  const [currentTime, setCurrentTime] = useState(getCurrentHHMM);
  const countdownRef = useRef(REFRESH_INTERVAL);
  const [, startTransition] = useTransition();
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const currentDate = getToday();
    setDate(currentDate);

    const [pickupResult, dropoffResult] = await Promise.all([
      getDailyBusManifest(currentDate, "pickup"),
      getDailyBusManifest(currentDate, "dropoff"),
    ]);

    const merged: TimeGroup[] = [];

    const addGroups = (
      groups: BusManifestGroup[],
      direction: "pickup" | "dropoff"
    ) => {
      const timeMap = new Map<string, TimeGroup>();
      for (const g of groups) {
        const key = g.slot_time;
        if (!timeMap.has(key)) {
          timeMap.set(key, {
            slotTime: g.slot_time,
            slotLabel: g.slot_label,
            direction,
            cards: [],
          });
        }
        timeMap.get(key)!.cards.push(g);
      }
      merged.push(...timeMap.values());
    };

    addGroups(pickupResult.groups, "pickup");
    addGroups(dropoffResult.groups, "dropoff");

    merged.sort((a, b) => {
      const cmp = a.slotTime.localeCompare(b.slotTime);
      if (cmp !== 0) return cmp;
      return a.direction === "pickup" ? -1 : 1;
    });

    setAllGroups(merged);
    setLoading(false);
    setCountdown(REFRESH_INTERVAL);
    countdownRef.current = REFRESH_INTERVAL;
    setCurrentTime(getCurrentHHMM());
  }, []);

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
      action: "board" | "unboard" | "check" | "uncheck"
    ) => {
      const sid = student.student_profile_id;
      const now = new Date().toISOString();

      // Optimistic update
      setAllGroups((prev) =>
        prev.map((tg) => ({
          ...tg,
          cards: tg.cards.map((c) => ({
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
                  // 하차 취소 → 탑승 상태로 복귀
                  return { ...s, checked_at: null, check_record_id: null };
                default:
                  return s;
              }
            }),
          })),
        }))
      );

      setPendingIds((prev) => new Set(prev).add(sid));

      // Determine direction from the TimeGroup containing this card
      const direction = allGroups.find((tg) =>
        tg.cards.some(
          (c) =>
            c.bus_time_slot_id === busTimeSlotId &&
            c.bus_number_id === busNumberId
        )
      )?.direction ?? "pickup";

      startTransition(async () => {
        let result: { error?: string };

        switch (action) {
          case "board":
            result = await boardBusStudent(sid, date, direction, busTimeSlotId, busNumberId);
            break;
          case "unboard":
            result = await unboardBusStudent(sid, date, direction);
            break;
          case "check":
            result = await checkBusStudent(sid, date, direction, busTimeSlotId, busNumberId, "");
            break;
          case "uncheck":
            result = await uncheckBusStudent(sid, date, direction);
            break;
        }

        if (result.error) {
          // Rollback
          setAllGroups((prev) =>
            prev.map((tg) => ({
              ...tg,
              cards: tg.cards.map((c) => ({
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
              })),
            }))
          );
          toast.error(`오류: ${result.error}`);
        }

        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(sid);
          return next;
        });
      });
    },
    [date, allGroups]
  );

  const filteredGroups = showAll
    ? allGroups
    : allGroups.filter((tg) => tg.slotTime >= currentTime);

  const d = new Date(date);
  const dayName = DAY_NAMES[d.getDay()];

  return (
    <div className="w-full space-y-4">
      {/* 상단 바 */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-slate-800">
          {date} ({dayName})
        </h1>

        <div className="flex gap-1">
          <Button
            size="sm"
            variant={showAll ? "default" : "outline"}
            onClick={() => setShowAll(true)}
          >
            전체 보기
          </Button>
          <Button
            size="sm"
            variant={!showAll ? "default" : "outline"}
            onClick={() => {
              setShowAll(false);
              setCurrentTime(getCurrentHHMM());
            }}
          >
            현재 시간
          </Button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-slate-400">
            {countdown}초 후 갱신
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={load}
            disabled={loading}
          >
            {loading ? "갱신 중..." : "새로고침"}
          </Button>
        </div>
      </div>

      {/* 데이터 없음 */}
      {filteredGroups.length === 0 && !loading && (
        <p className="text-sm text-slate-400 py-8 text-center">
          {allGroups.length === 0
            ? "배정된 학생이 없습니다."
            : "현재 시간 이후 예정된 승하차가 없습니다."}
        </p>
      )}

      {/* 시간대별 → 호차별 카드 */}
      <div className="space-y-4">
        {filteredGroups.map((tg) => (
          <div key={`${tg.slotTime}-${tg.direction}`}>
            {/* 시간대 헤더 */}
            <div className="flex items-center gap-3 mb-2">
              <span className="text-lg font-bold text-slate-700">
                {formatTime(tg.slotTime)}
              </span>
              <span
                className={`text-base font-bold px-3 py-0.5 rounded-full ${
                  tg.direction === "pickup"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-orange-100 text-orange-700"
                }`}
              >
                {DIR_LABEL[tg.direction]}
              </span>
              {tg.slotLabel && (
                <span className="text-base text-slate-500">{tg.slotLabel}</span>
              )}
              <div className="flex-1 border-t border-slate-200" />
            </div>

            {/* 호차별 모니터링 카드 — 인원 많으면 wide(col-span-2) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {tg.cards.map((card) => (
                <MonitorBusCard
                  key={`${card.bus_time_slot_id}-${card.bus_number_id}`}
                  card={card}
                  onAction={handleAction}
                  pendingIds={pendingIds}
                  wide={card.students.length > WIDE_THRESHOLD}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
