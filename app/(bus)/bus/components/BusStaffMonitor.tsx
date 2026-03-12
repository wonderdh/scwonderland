"use client";

import { useState, useEffect, useCallback, useTransition, useMemo } from "react";
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

type PendingChange = {
  action: "board" | "unboard" | "check" | "uncheck";
  student: BusManifestEntry;
  busTimeSlotId: string;
  busNumberId: string;
  direction: "pickup" | "dropoff";
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
  isBoarded,
  isChecked,
  pendingAction,
  onToggle,
  onToggleCheck,
  onToggleUncheck,
}: {
  student: BusManifestEntry;
  isBoarded: boolean;
  isChecked: boolean;
  pendingAction: "board" | "unboard" | "check" | "uncheck" | null;
  onToggle: () => void;
  onToggleCheck: () => void;
  onToggleUncheck: () => void;
}) {
  // 선택된 상태 시각화
  const isSelected = pendingAction !== null;

  // 배경색 결정
  let bgClass = "bg-white";
  if (pendingAction === "board") bgClass = "bg-blue-50 ring-2 ring-blue-400 ring-inset";
  else if (pendingAction === "unboard") bgClass = "bg-slate-50 ring-2 ring-slate-300 ring-inset";
  else if (pendingAction === "check") bgClass = "bg-green-50 ring-2 ring-green-400 ring-inset";
  else if (pendingAction === "uncheck") bgClass = "bg-yellow-50 ring-2 ring-yellow-400 ring-inset";
  else if (isChecked) bgClass = "bg-green-50/60";
  else if (isBoarded) bgClass = "bg-blue-50/50";

  return (
    <div className={`flex items-center gap-3 px-4 py-3 transition-all ${bgClass}`}>
      {/* 탑승 토글 */}
      <button
        type="button"
        disabled={isChecked && pendingAction !== "uncheck"}
        onClick={onToggle}
        className={`flex items-center gap-2.5 flex-1 min-w-0 text-left ${
          isChecked && pendingAction !== "uncheck" ? "cursor-default" : "cursor-pointer active:scale-[0.98]"
        }`}
      >
        <span
          className={`size-8 rounded-full flex items-center justify-center text-sm shrink-0 transition-all ${
            pendingAction === "board"
              ? "bg-blue-500 text-white scale-110"
              : pendingAction === "unboard"
                ? "bg-slate-200 text-slate-500 scale-110"
                : pendingAction === "check"
                  ? "bg-green-500 text-white scale-110"
                  : pendingAction === "uncheck"
                    ? "bg-yellow-400 text-white scale-110"
                    : isChecked
                      ? "bg-green-100 text-green-600"
                      : isBoarded
                        ? "bg-blue-100 text-blue-600"
                        : "bg-slate-100 text-slate-400"
          }`}
        >
          {pendingAction === "board" ? "●" :
           pendingAction === "unboard" ? "○" :
           pendingAction === "check" ? "✓" :
           pendingAction === "uncheck" ? "↩" :
           isChecked ? "✓" : isBoarded ? "●" : "○"}
        </span>
        <span
          className={`flex-1 truncate text-[15px] ${
            isSelected
              ? "font-semibold text-slate-900"
              : isChecked
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
      {isBoarded && student.boarded_at && !isChecked && !isSelected && (
        <span className="text-xs tabular-nums text-blue-500">
          {fmtISO(student.boarded_at)}
        </span>
      )}
      {isChecked && student.checked_at && !isSelected && (
        <span className="text-xs tabular-nums text-green-500">
          {fmtISO(student.checked_at)}
        </span>
      )}

      {/* 하차 버튼 */}
      {isBoarded && !isChecked && pendingAction !== "unboard" && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleCheck(); }}
          className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full active:scale-95 transition-colors ${
            pendingAction === "check"
              ? "bg-green-600 text-white"
              : "bg-green-500 text-white hover:bg-green-600"
          }`}
        >
          {pendingAction === "check" ? "하차 취소" : "하차"}
        </button>
      )}

      {/* 하차 취소 */}
      {isChecked && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleUncheck(); }}
          className={`shrink-0 text-xs px-2 py-1 active:scale-95 transition-colors ${
            pendingAction === "uncheck"
              ? "font-semibold text-yellow-600"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          {pendingAction === "uncheck" ? "되돌리기" : "취소"}
        </button>
      )}
    </div>
  );
}

/* ── 호차 카드 ── */
function StaffBusCard({
  card,
  direction,
  pendingChanges,
  onToggleBoard,
  onToggleCheck,
  onToggleUncheck,
}: {
  card: BusManifestGroup;
  direction: "pickup" | "dropoff";
  pendingChanges: Map<string, PendingChange>;
  onToggleBoard: (student: BusManifestEntry, busTimeSlotId: string, busNumberId: string, direction: "pickup" | "dropoff") => void;
  onToggleCheck: (student: BusManifestEntry, busTimeSlotId: string, busNumberId: string, direction: "pickup" | "dropoff") => void;
  onToggleUncheck: (student: BusManifestEntry, busTimeSlotId: string, busNumberId: string, direction: "pickup" | "dropoff") => void;
}) {
  const total = card.students.length;
  const boarded = card.students.filter((s) => s.boarded_at || s.checked_at).length;
  const checked = card.students.filter((s) => s.checked_at).length;
  const allDone = checked === total && total > 0;
  const stopGroups = groupStudentsByStop(card.students);

  const boardPct = total > 0 ? Math.round((boarded / total) * 100) : 0;
  const checkPct = total > 0 ? Math.round((checked / total) * 100) : 0;

  // 이 카드에 pending change가 있는지
  const hasPending = card.students.some((s) => pendingChanges.has(s.student_profile_id));

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-colors ${
        hasPending ? "border-blue-300 shadow-sm" : allDone ? "border-green-200 bg-green-50/30" : "border-slate-200 bg-white"
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
                isBoarded={!!student.boarded_at}
                isChecked={!!student.checked_at}
                pendingAction={pendingChanges.get(student.student_profile_id)?.action ?? null}
                onToggle={() =>
                  onToggleBoard(student, card.bus_time_slot_id, card.bus_number_id, direction)
                }
                onToggleCheck={() =>
                  onToggleCheck(student, card.bus_time_slot_id, card.bus_number_id, direction)
                }
                onToggleUncheck={() =>
                  onToggleUncheck(student, card.bus_time_slot_id, card.bus_number_id, direction)
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
  const [saving, startSaving] = useTransition();
  const [slotFilter, setSlotFilter] = useState<string | null>(null);

  // 일괄 저장용 pending changes
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingChange>>(new Map());

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
  }, [direction, busNumberId]);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(), REFRESH_INTERVAL * 1000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 0 ? REFRESH_INTERVAL : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 고유 시간대 목록
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
    const now = getNowHHMM();
    return groups.filter((g) => g.slot_time >= now);
  }, [groups, slotFilter]);

  // 탑승 토글
  const toggleBoard = useCallback(
    (student: BusManifestEntry, busTimeSlotId: string, busNumberId: string, dir: "pickup" | "dropoff") => {
      const sid = student.student_profile_id;
      setPendingChanges((prev) => {
        const next = new Map(prev);
        const existing = next.get(sid);

        if (student.boarded_at) {
          // 이미 탑승 → unboard 토글
          if (existing?.action === "unboard") {
            next.delete(sid);
          } else {
            next.set(sid, { action: "unboard", student, busTimeSlotId, busNumberId, direction: dir });
          }
        } else {
          // 미탑승 → board 토글
          if (existing?.action === "board") {
            next.delete(sid);
          } else {
            next.set(sid, { action: "board", student, busTimeSlotId, busNumberId, direction: dir });
          }
        }
        return next;
      });
    },
    []
  );

  // 하차 토글
  const toggleCheck = useCallback(
    (student: BusManifestEntry, busTimeSlotId: string, busNumberId: string, dir: "pickup" | "dropoff") => {
      const sid = student.student_profile_id;
      setPendingChanges((prev) => {
        const next = new Map(prev);
        const existing = next.get(sid);

        if (existing?.action === "check") {
          next.delete(sid);
        } else {
          next.set(sid, { action: "check", student, busTimeSlotId, busNumberId, direction: dir });
        }
        return next;
      });
    },
    []
  );

  // 하차 취소 토글
  const toggleUncheck = useCallback(
    (student: BusManifestEntry, busTimeSlotId: string, busNumberId: string, dir: "pickup" | "dropoff") => {
      const sid = student.student_profile_id;
      setPendingChanges((prev) => {
        const next = new Map(prev);
        const existing = next.get(sid);

        if (existing?.action === "uncheck") {
          next.delete(sid);
        } else {
          next.set(sid, { action: "uncheck", student, busTimeSlotId, busNumberId, direction: dir });
        }
        return next;
      });
    },
    []
  );

  // 일괄 저장
  const saveAll = useCallback(() => {
    if (pendingChanges.size === 0) return;

    const changes = [...pendingChanges.values()];
    setPendingChanges(new Map());

    // 낙관적 UI 업데이트
    const now = new Date().toISOString();
    setGroups((prev) =>
      prev.map((c) => ({
        ...c,
        students: c.students.map((s) => {
          const change = changes.find((ch) => ch.student.student_profile_id === s.student_profile_id);
          if (!change) return s;
          switch (change.action) {
            case "board": return { ...s, boarded_at: now };
            case "unboard": return { ...s, boarded_at: null };
            case "check": return { ...s, checked_at: now, check_record_id: "optimistic" };
            case "uncheck": return { ...s, checked_at: null, check_record_id: null };
            default: return s;
          }
        }),
      }))
    );

    startSaving(async () => {
      const results = await Promise.allSettled(
        changes.map((ch) => {
          const sid = ch.student.student_profile_id;
          switch (ch.action) {
            case "board":
              return boardBusStudent(sid, date, ch.direction, ch.busTimeSlotId, ch.busNumberId);
            case "unboard":
              return unboardBusStudent(sid, date, ch.direction);
            case "check":
              return checkBusStudent(sid, date, ch.direction, ch.busTimeSlotId, ch.busNumberId, staffProfileId);
            case "uncheck":
              return uncheckBusStudent(sid, date, ch.direction);
          }
        })
      );

      const errors: string[] = [];
      for (const r of results) {
        if (r.status === "rejected") {
          errors.push("서버 오류");
        } else if (r.value.error) {
          errors.push(r.value.error);
        }
      }

      if (errors.length > 0) {
        toast.error(`${errors.length}건 오류 발생: ${errors[0]}`);
        // 에러 시 전체 새로고침
        await load();
      } else {
        toast.success(`${changes.length}건 저장 완료`);
      }
    });
  }, [pendingChanges, date, staffProfileId, load]);

  // 전체 취소
  const clearAll = useCallback(() => {
    setPendingChanges(new Map());
  }, []);

  const d = new Date(date);
  const dayName = DAY_NAMES[d.getDay()];

  const totalStudents = filteredGroups.reduce((sum, g) => sum + g.students.length, 0);
  const totalBoarded = filteredGroups.reduce(
    (sum, g) => sum + g.students.filter((s) => s.boarded_at || s.checked_at).length, 0
  );
  const totalChecked = filteredGroups.reduce(
    (sum, g) => sum + g.students.filter((s) => s.checked_at).length, 0
  );

  const pendingCount = pendingChanges.size;

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-24">
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
            onClick={() => { setDirection(dir); setPendingChanges(new Map()); }}
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
            pendingChanges={pendingChanges}
            onToggleBoard={toggleBoard}
            onToggleCheck={toggleCheck}
            onToggleUncheck={toggleUncheck}
          />
        ))}
      </div>

      {/* 하단 고정 저장 바 */}
      {pendingCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
          <div className="max-w-lg mx-auto px-4 pb-4 pt-2">
            <div className="bg-slate-800 rounded-2xl shadow-2xl shadow-slate-900/30 px-4 py-3 flex items-center gap-3">
              <button
                type="button"
                onClick={clearAll}
                className="shrink-0 text-sm text-slate-400 hover:text-slate-200 px-2 py-1 active:scale-95 transition-colors"
              >
                취소
              </button>
              <div className="flex-1 text-center">
                <span className="text-sm text-slate-300">
                  <span className="font-bold text-white">{pendingCount}</span>명 선택됨
                </span>
              </div>
              <button
                type="button"
                onClick={saveAll}
                disabled={saving}
                className="shrink-0 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white text-sm font-bold px-5 py-2.5 rounded-xl active:scale-95 transition-all"
              >
                {saving ? "저장 중..." : "확인"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
