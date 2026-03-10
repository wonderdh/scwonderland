"use client";

import { useState, useEffect, useCallback, useRef, useTransition, useMemo } from "react";
import { toast } from "sonner";
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

function fmt(t: string) {
  return t.slice(0, 5);
}

function fmtISO(iso: string) {
  const d = new Date(iso);
  return `${d.getHours()}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function getToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function getNowHHMM() {
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
      current = { note: s.note ?? "", estimatedTime: s.estimated_time ?? null, students: [] };
      groups.push(current);
    }
    current.students.push(s);
  }

  // 그룹 내 학생: 나이순 → 이름순
  for (const g of groups) {
    g.students.sort((a, b) => {
      const ageA = a.age ?? 99;
      const ageB = b.age ?? 99;
      if (ageA !== ageB) return ageA - ageB;
      return (a.korean_name ?? a.english_name ?? "").localeCompare(b.korean_name ?? b.english_name ?? "");
    });
  }

  return groups;
}

/* ── 학생 행 ── */
function StudentRow({
  student,
  isPending,
  isBoarded,
  isChecked,
  onBoard,
  onCheck,
  onUncheck,
}: {
  student: BusManifestEntry;
  isPending: boolean;
  isBoarded: boolean;
  isChecked: boolean;
  onBoard: () => void;
  onCheck: () => void;
  onUncheck: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 transition-colors ${
        isChecked ? "bg-green-50/60" : isBoarded ? "bg-blue-50/50" : "bg-white"
      } ${isPending ? "opacity-50 pointer-events-none" : ""}`}
    >
      {/* 탑승 토글 */}
      <button
        type="button"
        disabled={isPending || isChecked}
        onClick={onBoard}
        className={`flex items-center gap-2.5 flex-1 min-w-0 text-left ${
          isChecked ? "cursor-default" : "cursor-pointer active:scale-[0.98]"
        }`}
      >
        <span
          className={`size-7 rounded-full flex items-center justify-center text-sm shrink-0 ${
            isChecked
              ? "bg-green-100 text-green-600"
              : isBoarded
                ? "bg-blue-100 text-blue-600"
                : "bg-slate-100 text-slate-400"
          }`}
        >
          {isChecked ? "✓" : isBoarded ? "●" : "○"}
        </span>
        <span
          className={`flex-1 truncate text-[15px] ${
            isChecked
              ? "text-slate-400 line-through"
              : isBoarded
                ? "font-semibold text-slate-800"
                : "text-slate-700"
          }`}
        >
          {student.korean_name || student.english_name}
        </span>
      </button>

      {/* 타임스탬프 */}
      {isBoarded && student.boarded_at && !isChecked && (
        <span className="text-xs tabular-nums text-blue-500">
          {fmtISO(student.boarded_at)}
        </span>
      )}
      {isChecked && student.checked_at && (
        <span className="text-xs tabular-nums text-green-500">
          {fmtISO(student.checked_at)}
        </span>
      )}

      {/* 하차 버튼 */}
      {isBoarded && !isChecked && (
        <button
          type="button"
          disabled={isPending}
          onClick={(e) => { e.stopPropagation(); onCheck(); }}
          className="shrink-0 text-xs font-semibold bg-green-500 text-white px-3 py-1.5 rounded-full active:scale-95 hover:bg-green-600 transition-colors"
        >
          하차
        </button>
      )}

      {/* 하차 취소 */}
      {isChecked && (
        <button
          type="button"
          disabled={isPending}
          onClick={(e) => { e.stopPropagation(); onUncheck(); }}
          className="shrink-0 text-xs text-slate-400 hover:text-slate-600 px-1 py-1 active:scale-95"
          title="하차 취소"
        >
          취소
        </button>
      )}
    </div>
  );
}

/* ── 호차 카드 ── */
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
  const total = card.students.length;
  const boarded = card.students.filter((s) => s.boarded_at || s.checked_at).length;
  const checked = card.students.filter((s) => s.checked_at).length;
  const allDone = checked === total && total > 0;
  const stopGroups = groupStudentsByStop(card.students);

  const boardPct = total > 0 ? Math.round((boarded / total) * 100) : 0;
  const checkPct = total > 0 ? Math.round((checked / total) * 100) : 0;

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-colors ${
        allDone ? "border-green-200 bg-green-50/30" : "border-slate-200 bg-white"
      }`}
    >
      {/* 헤더 */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-baseline justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-bold text-slate-800">
              {card.bus_label}
            </span>
            {card.slot_label && (
              <span className="text-xs text-slate-400">
                {card.slot_label}
              </span>
            )}
          </div>
          <span className="text-xs font-medium text-slate-400">
            {fmt(card.slot_time)}
          </span>
        </div>

        {/* 프로그레스 */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 w-6">탑승</span>
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-400 rounded-full transition-all duration-300"
                style={{ width: `${boardPct}%` }}
              />
            </div>
            <span className="text-[11px] tabular-nums text-slate-400 w-7 text-right">
              {boarded}/{total}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 w-6">하차</span>
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-400 rounded-full transition-all duration-300"
                style={{ width: `${checkPct}%` }}
              />
            </div>
            <span className="text-[11px] tabular-nums text-slate-400 w-7 text-right">
              {checked}/{total}
            </span>
          </div>
        </div>
      </div>

      {/* 학생 목록 */}
      <div className="border-t border-slate-100 divide-y divide-slate-100">
        {stopGroups.map((group, gi) => (
          <div key={gi}>
            {(group.note || group.estimatedTime) && (
              <div className="px-4 py-1.5 bg-slate-50 flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400">▸</span>
                {group.estimatedTime && (
                  <span className="text-[11px] font-medium text-slate-500 tabular-nums">
                    {fmt(group.estimatedTime)}
                  </span>
                )}
                {group.note && (
                  <span className="text-[11px] text-slate-400 truncate">
                    {group.note}
                  </span>
                )}
              </div>
            )}
            {group.students.map((student) => (
              <StudentRow
                key={student.student_profile_id}
                student={student}
                isPending={pendingIds.has(student.student_profile_id)}
                isBoarded={!!student.boarded_at}
                isChecked={!!student.checked_at}
                onBoard={() =>
                  onAction(student, card.bus_time_slot_id, card.bus_number_id, direction,
                    student.boarded_at ? "unboard" : "board")
                }
                onCheck={() =>
                  onAction(student, card.bus_time_slot_id, card.bus_number_id, direction, "check")
                }
                onUncheck={() =>
                  onAction(student, card.bus_time_slot_id, card.bus_number_id, direction, "uncheck")
                }
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 메인 컴포넌트 ── */
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
  // 시간대 필터: null = 현재 시간 이후, "all" = 전체, string = 특정 시간대
  const [slotFilter, setSlotFilter] = useState<string | null>(null);

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

  // 고유 시간대 목록 추출
  const timeSlots = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of groups) {
      if (!map.has(g.slot_time)) {
        map.set(g.slot_time, g.slot_label);
      }
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, label]) => ({ time, label }));
  }, [groups]);

  // 필터 적용
  const filteredGroups = useMemo(() => {
    if (slotFilter === "all") return groups;
    if (slotFilter && slotFilter !== "all") {
      return groups.filter((g) => g.slot_time === slotFilter);
    }
    // null = 현재 시간 이후
    const now = getNowHHMM();
    return groups.filter((g) => g.slot_time >= now);
  }, [groups, slotFilter]);

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
            result = await boardBusStudent(sid, date, dir, busTimeSlotId, busNumberId);
            break;
          case "unboard":
            result = await unboardBusStudent(sid, date, dir);
            break;
          case "check":
            result = await checkBusStudent(sid, date, dir, busTimeSlotId, busNumberId, staffProfileId);
            break;
          case "uncheck":
            result = await uncheckBusStudent(sid, date, dir);
            break;
        }

        if (result.error) {
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
          toast.error(`오류: ${result.error}`);
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

  const totalStudents = filteredGroups.reduce((sum, g) => sum + g.students.length, 0);
  const totalBoarded = filteredGroups.reduce(
    (sum, g) => sum + g.students.filter((s) => s.boarded_at || s.checked_at).length, 0
  );
  const totalChecked = filteredGroups.reduce(
    (sum, g) => sum + g.students.filter((s) => s.checked_at).length, 0
  );

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* 날짜 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-800">
          {date.slice(5).replace("-", "/")}
          <span className="text-slate-400 font-normal ml-1">({dayName})</span>
        </h1>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 active:scale-95 transition-colors"
        >
          <span className="tabular-nums">{countdown}s</span>
          <svg className={`size-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
          </svg>
        </button>
      </div>

      {/* 등원/하원 토글 */}
      <div className="flex rounded-xl bg-slate-100 p-1">
        {(["pickup", "dropoff"] as const).map((dir) => (
          <button
            key={dir}
            type="button"
            onClick={() => setDirection(dir)}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
              direction === dir
                ? "bg-white shadow-sm " + (dir === "pickup" ? "text-blue-600" : "text-orange-600")
                : "text-slate-400 hover:text-slate-500"
            }`}
          >
            {DIR_LABEL[dir]}
          </button>
        ))}
      </div>

      {/* 시간대 필터 */}
      {timeSlots.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          <button
            type="button"
            onClick={() => { setSlotFilter(null); }}
            className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              slotFilter === null
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            현재 이후
          </button>
          <button
            type="button"
            onClick={() => setSlotFilter("all")}
            className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              slotFilter === "all"
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            전체
          </button>
          {timeSlots.map((slot) => (
            <button
              key={slot.time}
              type="button"
              onClick={() => setSlotFilter(slot.time)}
              className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                slotFilter === slot.time
                  ? "bg-slate-800 text-white"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {fmt(slot.time)}
              {slot.label && <span className="ml-1 opacity-70">{slot.label}</span>}
            </button>
          ))}
        </div>
      )}

      {/* 요약 통계 */}
      {totalStudents > 0 && (
        <div className="flex items-center gap-3 px-1">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-blue-400" />
            <span className="text-xs text-slate-500">
              탑승 <span className="font-semibold text-slate-700">{totalBoarded}/{totalStudents}</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-green-400" />
            <span className="text-xs text-slate-500">
              하차 <span className="font-semibold text-slate-700">{totalChecked}/{totalStudents}</span>
            </span>
          </div>
        </div>
      )}

      {/* 데이터 없음 */}
      {filteredGroups.length === 0 && !loading && (
        <div className="text-center py-16">
          <p className="text-sm text-slate-400">
            {groups.length === 0
              ? "배정된 학생이 없습니다."
              : "현재 시간 이후 예정된 승하차가 없습니다."}
          </p>
          {groups.length > 0 && slotFilter === null && (
            <button
              type="button"
              onClick={() => setSlotFilter("all")}
              className="mt-2 text-xs text-blue-500 hover:underline"
            >
              전체 보기
            </button>
          )}
        </div>
      )}

      {/* 호차별 카드 */}
      <div className="space-y-3">
        {filteredGroups.map((card) => (
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
