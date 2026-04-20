"use client";

import { useState, useEffect, useCallback, useTransition, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/feedback/Spinner";
import { Input } from "@/components/ui/input";
import type { BusManifestGroup, BusManifestEntry, BusTimeSlot, BusNumber, NoRideEntry, AfterSchoolBusEntry } from "@/lib/types";
import { getAgeColor } from "@/lib/ui/student-age-colors";
import {
  getDailyBusManifest,
  batchBusCheckRecord,
  deleteAdminBusChange,
} from "../../actions";
import { useBusRealtime } from "@/lib/hooks/use-bus-realtime";
import { formatTime } from "@/lib/bus/utils";
import { formatStudentName } from "@/lib/utils/student-name";

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

function formatCheckedTime(iso: string) {
  const d = new Date(iso);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

async function getAdminId(): Promise<string> {
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? "";
}

type PendingChange = {
  action: "board" | "unboard" | "check" | "uncheck";
  student: BusManifestEntry;
  busTimeSlotId: string;
  busNumberId: string;
};

type TimeGroup = {
  slotTime: string;
  slotLabel: string;
  cards: BusManifestGroup[];
};

function groupByTime(groups: BusManifestGroup[]): TimeGroup[] {
  const map = new Map<string, TimeGroup>();
  for (const g of groups) {
    const key = g.slot_time;
    if (!map.has(key)) {
      map.set(key, { slotTime: g.slot_time, slotLabel: g.slot_label, cards: [] });
    }
    map.get(key)!.cards.push(g);
  }
  return [...map.values()].sort((a, b) => a.slotTime.localeCompare(b.slotTime));
}

export function BusDashboard({ busTimeSlots, busNumbers }: { busTimeSlots: BusTimeSlot[]; busNumbers: BusNumber[] }) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const [date, setDate] = useState(today);
  const [groups, setGroups] = useState<BusManifestGroup[]>([]);
  const [noRides, setNoRides] = useState<NoRideEntry[]>([]);
  const [afterschoolStudents, setAfterSchoolStudents] = useState<AfterSchoolBusEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [adminId, setAdminId] = useState("");
  const [isPending, startTransition] = useTransition();
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingChange>>(new Map());
  const [selectedSlotId, setSelectedSlotId] = useState<string>(() => {
    return busTimeSlots[0]?.id ?? "";
  });
  // showChangeModal removed — moved to BusChangeRequestsPanel

  useEffect(() => {
    getAdminId().then(setAdminId);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getDailyBusManifest(date);
    setGroups(result.groups);
    setNoRides(result.noRides);
    setAfterSchoolStudents(result.afterschoolStudents);
    setLoading(false);
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime 구독 — 다른 기기에서 승하차 처리 시 자동 갱신 (전체 refetch 방식 유지)
  const realtimeDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const debouncedLoad = useCallback(() => {
    clearTimeout(realtimeDebounceRef.current);
    realtimeDebounceRef.current = setTimeout(load, 500);
  }, [load]);

  useBusRealtime(date, {
    onCheckRecord: debouncedLoad,
    onChangeRequest: debouncedLoad,
  });

  const handleBoard = useCallback(
    (
      student: BusManifestEntry,
      busTimeSlotId: string,
      busNumberId: string,
      shouldBoard: boolean
    ) => {
      const sid = student.student_profile_id;
      const action = shouldBoard ? "board" : "unboard";
      setPendingChanges((prev) => {
        const next = new Map(prev);
        if (next.get(sid)?.action === action) {
          next.delete(sid); // 같은 액션 재클릭 → 취소
        } else {
          next.set(sid, { action, student, busTimeSlotId, busNumberId });
        }
        return next;
      });
    },
    []
  );

  const handleCheck = useCallback(
    (
      student: BusManifestEntry,
      busTimeSlotId: string,
      busNumberId: string,
      shouldCheck: boolean
    ) => {
      const sid = student.student_profile_id;
      const action = shouldCheck ? "check" : "uncheck";
      setPendingChanges((prev) => {
        const next = new Map(prev);
        if (next.get(sid)?.action === action) {
          next.delete(sid);
        } else {
          next.set(sid, { action, student, busTimeSlotId, busNumberId });
        }
        return next;
      });
    },
    []
  );

  const saveAll = useCallback(() => {
    if (pendingChanges.size === 0) return;
    const changes = [...pendingChanges.values()];
    // 낙관적 UI 업데이트
    const now = new Date().toISOString();
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        students: g.students.map((s) => {
          const ch = changes.find((c) => c.student.student_profile_id === s.student_profile_id);
          if (!ch) return s;
          switch (ch.action) {
            case "board": return { ...s, boarded_at: now };
            case "unboard": return { ...s, boarded_at: null };
            case "check": return { ...s, checked_at: now, check_record_id: "optimistic" };
            case "uncheck": return { ...s, checked_at: null, check_record_id: null };
            default: return s;
          }
        }),
      }))
    );
    setPendingChanges(new Map());

    startTransition(async () => {
      const result = await batchBusCheckRecord(
        changes.map((ch) => ({
          action: ch.action,
          studentProfileId: ch.student.student_profile_id,
          busTimeSlotId: ch.busTimeSlotId,
          busNumberId: ch.busNumberId,
        })),
        date,
        adminId
      );
      if (result.error) {
        toast.error(`오류: ${result.error}`);
      } else {
        toast.success(`${changes.length}건 저장 완료`);
      }
      // 성공/실패 무관하게 DB 최신 데이터로 동기화
      await load();
    });
  }, [pendingChanges, date, adminId, load]);

  const clearAll = useCallback(() => {
    setPendingChanges(new Map());
  }, []);

  const handleCancelNoRide = useCallback(
    (requestId: string) => {
      startTransition(async () => {
        const result = await deleteAdminBusChange(requestId);
        if (result.error) {
          toast.error(`오류: ${result.error}`);
        } else {
          toast.success("변경이 취소되었습니다.");
          load();
        }
      });
    },
    [load]
  );

  const d = new Date(date);
  const dayName = DAY_NAMES[d.getDay()];
  const filteredGroups = groups.filter((g) => g.bus_time_slot_id === selectedSlotId);
  const timeGroups = groupByTime(filteredGroups);

  const directionSlots = busTimeSlots;

  // 미탑승/결석 분리
  const noRideOnly = noRides.filter((n) => n.change_type !== "absent");
  const absentOnly = noRides.filter((n) => n.change_type === "absent");

  return (
    <div className="space-y-5">
      {/* 필터 바 */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-40"
        />
        <span className="text-sm text-slate-500">({dayName})</span>
        {directionSlots.length > 0 && (
          <select
            value={selectedSlotId}
            onChange={(e) => setSelectedSlotId(e.target.value)}
            className="h-9 px-2 border rounded text-sm"
          >
            {directionSlots.map((s) => (
              <option key={s.id} value={s.id}>
                {formatTime(s.time)} {s.label}
              </option>
            ))}
          </select>
        )}
        <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
          {loading ? <><Spinner size="sm" /> 불러오는 중...</> : "새로고침"}
        </Button>
      </div>

      <h3 className="text-sm font-semibold text-slate-700">
        {date} ({dayName}) — 하원
      </h3>

      {/* 매니페스트 */}
      {filteredGroups.length === 0 && !loading && (
        <p className="text-sm text-slate-400 py-8 text-center">
          배정된 학생이 없습니다.
        </p>
      )}

      <div className="space-y-6">
        {timeGroups.map((tg) => (
          <div key={tg.slotTime}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm font-semibold text-slate-700">
                {formatTime(tg.slotTime)}
              </span>
              {tg.slotLabel && (
                <span className="text-sm text-slate-500">{tg.slotLabel}</span>
              )}
              <div className="flex-1 border-t border-slate-200" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {tg.cards.map((card) => {
                const activeStudents = card.students.filter((s) => !s.is_absent);
                const boardedCount = activeStudents.filter(
                  (s) => s.boarded_at || s.checked_at
                ).length;
                const checkedCount = activeStudents.filter(
                  (s) => s.checked_at
                ).length;
                const totalCount = activeStudents.length;

                return (
                  <BusCard
                    key={`${card.bus_time_slot_id}-${card.bus_number_id}`}
                    card={card}
                    boardedCount={boardedCount}
                    checkedCount={checkedCount}
                    totalCount={totalCount}
                    onBoard={handleBoard}
                    onCheck={handleCheck}
                    isPending={isPending}
                    pendingChanges={pendingChanges}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 방과후 학생 */}
      {afterschoolStudents.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm font-semibold text-violet-700">
              방과후 ({afterschoolStudents.length}명)
            </span>
            <div className="flex-1 border-t border-violet-200" />
          </div>
          <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3">
            <div className="flex flex-wrap gap-1.5">
              {[...afterschoolStudents]
                .sort((a, b) => {
                  const ageA = a.age ?? 99;
                  const ageB = b.age ?? 99;
                  if (ageA !== ageB) return ageA - ageB;
                  return formatStudentName(a, { fallback: "" }).localeCompare(formatStudentName(b, { fallback: "" }));
                })
                .map((student) => {
                const ageColor = getAgeColor(student.age);
                return (
                  <span
                    key={student.student_profile_id}
                    className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${ageColor.bg} ${ageColor.text}`}
                  >
                    {formatStudentName(student, { fallback: "" })}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 미탑승 학생 */}
      {noRideOnly.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm font-semibold text-red-700">
              미탑승 ({noRideOnly.length}명)
            </span>
            <div className="flex-1 border-t border-red-200" />
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50/50 divide-y divide-red-100">
            {noRideOnly.map((student) => (
              <div
                key={student.student_profile_id}
                className="px-4 py-2.5 flex items-center gap-3 text-sm"
              >
                <span className="font-medium text-slate-700">
                  {formatStudentName(student, { fallback: "" })}
                </span>
                {student.original_bus_label && (
                  <span className="text-xs text-slate-400">
                    (원래: {formatTime(student.original_slot_time ?? "")}{" "}
                    {student.original_bus_label})
                  </span>
                )}
                {student.request_id && (
                  <button
                    onClick={() => handleCancelNoRide(student.request_id!)}
                    disabled={isPending}
                    className="ml-auto text-xs text-red-500 hover:text-red-700 font-medium"
                  >
                    ✕ 취소
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 결석 학생 */}
      {absentOnly.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm font-semibold text-red-700">
              결석 ({absentOnly.length}명)
            </span>
            <div className="flex-1 border-t border-red-200" />
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 divide-y divide-red-100">
            {absentOnly.map((student) => (
              <div
                key={student.student_profile_id}
                className="px-4 py-2.5 flex items-center gap-3 text-sm"
              >
                <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium shrink-0">
                  결석
                </span>
                <span className="font-medium text-red-700">
                  {formatStudentName(student, { fallback: "" })}
                </span>
                {student.original_bus_label && (
                  <span className="text-xs text-red-400">
                    (원래: {formatTime(student.original_slot_time ?? "")}{" "}
                    {student.original_bus_label})
                  </span>
                )}
                {student.request_id && (
                  <button
                    onClick={() => handleCancelNoRide(student.request_id!)}
                    disabled={isPending}
                    className="ml-auto text-xs text-red-500 hover:text-red-700 font-medium"
                  >
                    ✕ 취소
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 일괄 저장 바 */}
      {pendingChanges.size > 0 && (
        <div className="sticky bottom-4 z-10 flex justify-end">
          <div className="flex items-center gap-2 bg-slate-800 text-white rounded-xl px-4 py-2.5 shadow-lg">
            <span className="text-sm text-slate-300">
              <span className="font-bold text-white">{pendingChanges.size}</span>건 대기 중
            </span>
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1"
            >
              취소
            </button>
            <button
              type="button"
              onClick={saveAll}
              disabled={isPending}
              className="text-sm font-bold bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 px-4 py-1.5 rounded-lg"
            >
              {isPending ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      )}

      {/* 당일 변경 모달 */}
    </div>
  );
}

// ── 호차 카드 ──

type CardStopGroup = {
  stopName: string;
  students: BusManifestEntry[];
};

function groupCardStudentsByStop(students: BusManifestEntry[]): CardStopGroup[] {
  const map = new Map<string, BusManifestEntry[]>();
  const NO_STOP = "__no_stop__";
  for (const s of students) {
    const key = s.bus_stop_name ?? NO_STOP;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  const groups: CardStopGroup[] = [];
  for (const [key, list] of map) {
    groups.push({ stopName: key === NO_STOP ? "" : key, students: list });
  }
  // 정류장명순, 미지정은 마지막
  groups.sort((a, b) => {
    if (!a.stopName) return 1;
    if (!b.stopName) return -1;
    return a.stopName.localeCompare(b.stopName);
  });
  return groups;
}

function BusCard({
  card,
  boardedCount,
  checkedCount,
  totalCount,
  onBoard,
  onCheck,
  isPending,
  pendingChanges,
}: {
  card: BusManifestGroup;
  boardedCount: number;
  checkedCount: number;
  totalCount: number;
  onBoard: (
    student: BusManifestEntry,
    busTimeSlotId: string,
    busNumberId: string,
    shouldBoard: boolean
  ) => void;
  onCheck: (
    student: BusManifestEntry,
    busTimeSlotId: string,
    busNumberId: string,
    shouldCheck: boolean
  ) => void;
  isPending: boolean;
  pendingChanges: Map<string, PendingChange>;
}) {
  const allDone = checkedCount === totalCount && totalCount > 0;
  const stopGroups = groupCardStudentsByStop(card.students);

  const renderStudent = (student: BusManifestEntry) => {
    // 결석 학생 별도 렌더링
    if (student.is_absent) {
      return (
        <div
          key={student.student_profile_id}
          className="flex items-center gap-3 px-4 py-2"
          style={{ backgroundColor: "#fff7ed", borderLeft: "4px solid #f97316" }}
        >
          <input type="checkbox" checked={false} disabled className="h-4 w-4 rounded border-slate-300 opacity-30" />
          <input type="checkbox" checked={false} disabled className="h-4 w-4 rounded border-slate-300 opacity-30" />
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="text-sm font-medium truncate text-orange-600">
              {formatStudentName(student, { fallback: "" })}
            </span>
            <span className="shrink-0 text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-medium">
              결석
            </span>
          </div>
        </div>
      );
    }

    const pending = pendingChanges.get(student.student_profile_id);
    const isBoarded = pending?.action === "board" ? true : pending?.action === "unboard" ? false : !!student.boarded_at;
    const isChecked = pending?.action === "check" ? true : pending?.action === "uncheck" ? false : !!student.checked_at;
    const hasPending = !!pending;

    const rowBg = hasPending
      ? "bg-amber-50 ring-1 ring-amber-300 ring-inset"
      : isChecked
        ? "bg-green-50/60"
        : student.is_changed
          ? "bg-amber-50/60"
          : isBoarded
            ? "bg-blue-50/50"
            : "hover:bg-slate-50";

    return (
      <div
        key={student.student_profile_id}
        className={`flex items-center gap-3 px-4 py-2 ${rowBg}`}
      >
        <input
          type="checkbox"
          checked={isBoarded || isChecked}
          disabled={isPending}
          onChange={() =>
            onBoard(student, card.bus_time_slot_id, card.bus_number_id, !isBoarded)
          }
          title="탑승"
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 accent-blue-600"
        />
        <input
          type="checkbox"
          checked={isChecked}
          disabled={isPending || (!isBoarded && !pending)}
          onChange={() =>
            onCheck(student, card.bus_time_slot_id, card.bus_number_id, !isChecked)
          }
          title="하차"
          className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500 accent-green-600"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium truncate ${getAgeColor(student.age).text}`}>
              {formatStudentName(student, { fallback: "" })}
            </span>
            {student.is_changed && (
              <>
                <span className="shrink-0 text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded font-medium">
                  변경
                </span>
                {student.original_bus_label && (
                  <span className="shrink-0 text-xs text-amber-500">
                    ({student.original_bus_label} → {card.bus_label})
                  </span>
                )}
              </>
            )}
            {student.note && (
              <span className="text-xs text-slate-400 truncate">({student.note})</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {student.estimated_time && (
            <span className="text-xs text-slate-400">
              {formatTime(student.estimated_time)}
            </span>
          )}
          {isBoarded && student.boarded_at && (
            <>
              {student.estimated_time && <span className="text-xs text-slate-300">→</span>}
              <span className="text-xs text-blue-600">
                탑승 {formatCheckedTime(student.boarded_at)}
              </span>
            </>
          )}
          {isChecked && student.checked_at && (
            <span className="text-xs text-green-600">
              하차 {formatCheckedTime(student.checked_at)}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* 카드 헤더 */}
      <div className={`px-4 py-2.5 flex items-center justify-between ${allDone ? "bg-green-50" : "bg-slate-50"}`}>
        <span className="text-sm font-semibold text-slate-700">
          {card.bus_label}
        </span>
        <span className="text-xs font-medium text-slate-500">
          탑승 {boardedCount}/{totalCount} · 하차 {checkedCount}/{totalCount}
        </span>
      </div>

      {/* 정류장별 학생 리스트 */}
      <div className="divide-y divide-slate-200">
        {stopGroups.map((sg, i) => (
          <div key={sg.stopName || `__nostop_${i}`}>
            {sg.stopName && (
              <div className="px-4 py-1.5 bg-slate-50/60 flex items-center gap-1.5">
                <span className="text-xs font-medium text-slate-500">📍 {sg.stopName}</span>
                <span className="text-xs text-slate-400">({sg.students.length})</span>
              </div>
            )}
            <div className="divide-y divide-slate-100">
              {sg.students.map(renderStudent)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 당일 변경 모달 ──

