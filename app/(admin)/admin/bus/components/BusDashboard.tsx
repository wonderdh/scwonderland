"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/Spinner";
import { Input } from "@/components/ui/input";
import type { BusManifestGroup, BusManifestEntry, BusTimeSlot, NoRideEntry } from "@/lib/types";
import { getAgeColor } from "@/lib/student-age-colors";
import {
  getDailyBusManifest,
  boardBusStudent,
  unboardBusStudent,
  checkBusStudent,
  uncheckBusStudent,
} from "../../actions";

const DIR_LABEL = { pickup: "등원", dropoff: "하원" } as const;
const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

function formatTime(t: string) {
  return t.slice(0, 5);
}

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

export function BusDashboard({ busTimeSlots }: { busTimeSlots: BusTimeSlot[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [direction, setDirection] = useState<"pickup" | "dropoff">("pickup");
  const [groups, setGroups] = useState<BusManifestGroup[]>([]);
  const [noRides, setNoRides] = useState<NoRideEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [adminId, setAdminId] = useState("");
  const [isPending, startTransition] = useTransition();
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");

  useEffect(() => {
    getAdminId().then(setAdminId);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getDailyBusManifest(date, direction);
    setGroups(result.groups);
    setNoRides(result.noRides);
    setLoading(false);
  }, [date, direction]);

  useEffect(() => {
    load();
  }, [load]);

  const handleBoard = useCallback(
    (
      student: BusManifestEntry,
      busTimeSlotId: string,
      busNumberId: string,
      shouldBoard: boolean
    ) => {
      // Optimistic update
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          students: g.students.map((s) =>
            s.student_profile_id === student.student_profile_id
              ? {
                  ...s,
                  boarded_at: shouldBoard ? new Date().toISOString() : null,
                }
              : s
          ),
        }))
      );

      startTransition(async () => {
        const result = shouldBoard
          ? await boardBusStudent(
              student.student_profile_id,
              date,
              direction,
              busTimeSlotId,
              busNumberId
            )
          : await unboardBusStudent(student.student_profile_id, date, direction);

        if (result.error) {
          setGroups((prev) =>
            prev.map((g) => ({
              ...g,
              students: g.students.map((s) =>
                s.student_profile_id === student.student_profile_id
                  ? { ...s, boarded_at: student.boarded_at }
                  : s
              ),
            }))
          );
          toast.error(`오류: ${result.error}`);
        }
      });
    },
    [date, direction]
  );

  const handleCheck = useCallback(
    (
      student: BusManifestEntry,
      busTimeSlotId: string,
      busNumberId: string,
      shouldCheck: boolean
    ) => {
      // Optimistic update
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          students: g.students.map((s) =>
            s.student_profile_id === student.student_profile_id
              ? {
                  ...s,
                  checked_at: shouldCheck ? new Date().toISOString() : null,
                  check_record_id: shouldCheck ? "optimistic" : null,
                }
              : s
          ),
        }))
      );

      startTransition(async () => {
        const result = shouldCheck
          ? await checkBusStudent(
              student.student_profile_id,
              date,
              direction,
              busTimeSlotId,
              busNumberId,
              adminId
            )
          : await uncheckBusStudent(student.student_profile_id, date, direction);

        if (result.error) {
          setGroups((prev) =>
            prev.map((g) => ({
              ...g,
              students: g.students.map((s) =>
                s.student_profile_id === student.student_profile_id
                  ? {
                      ...s,
                      checked_at: student.checked_at,
                      check_record_id: student.check_record_id,
                    }
                  : s
              ),
            }))
          );
          toast.error(`오류: ${result.error}`);
        }
      });
    },
    [date, direction, adminId]
  );

  const d = new Date(date);
  const dayName = DAY_NAMES[d.getDay()];
  const filteredGroups = selectedSlotId
    ? groups.filter((g) => g.bus_time_slot_id === selectedSlotId)
    : groups;
  const timeGroups = groupByTime(filteredGroups);

  const directionSlots = busTimeSlots.filter((s) => s.direction === direction);

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
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={direction === "pickup" ? "default" : "outline"}
            onClick={() => { setDirection("pickup"); setSelectedSlotId(""); }}
          >
            등원
          </Button>
          <Button
            size="sm"
            variant={direction === "dropoff" ? "default" : "outline"}
            onClick={() => { setDirection("dropoff"); setSelectedSlotId(""); }}
          >
            하원
          </Button>
        </div>
        {directionSlots.length > 0 && (
          <select
            value={selectedSlotId}
            onChange={(e) => setSelectedSlotId(e.target.value)}
            className="h-9 px-2 border rounded text-sm"
          >
            <option value="">전체 시간대</option>
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
        {date} ({dayName}) — {DIR_LABEL[direction]}
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
                const boardedCount = card.students.filter(
                  (s) => s.boarded_at || s.checked_at
                ).length;
                const checkedCount = card.students.filter(
                  (s) => s.checked_at
                ).length;
                const totalCount = card.students.length;

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
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 미탑승 학생 */}
      {noRides.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm font-semibold text-red-700">
              미탑승 ({noRides.length}명)
            </span>
            <div className="flex-1 border-t border-red-200" />
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50/50 divide-y divide-red-100">
            {noRides.map((student) => (
              <div
                key={student.student_profile_id}
                className="px-4 py-2.5 flex items-center gap-3 text-sm"
              >
                <span className="font-medium text-slate-700">
                  {student.korean_name || student.english_name}
                </span>
                {student.original_bus_label && (
                  <span className="text-xs text-slate-400">
                    (원래: {formatTime(student.original_slot_time ?? "")}{" "}
                    {student.original_bus_label})
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 호차 카드 ──

function BusCard({
  card,
  boardedCount,
  checkedCount,
  totalCount,
  onBoard,
  onCheck,
  isPending,
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
}) {
  const allDone = checkedCount === totalCount && totalCount > 0;

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

      {/* 학생 리스트 */}
      <div className="divide-y divide-slate-100">
        {card.students.map((student) => {
          const isBoarded = !!student.boarded_at;
          const isChecked = !!student.checked_at;

          // 배경색: 미탑승(기본) → 탑승(파란) → 하차(초록)
          const rowBg = isChecked
            ? "bg-green-50/60"
            : isBoarded
              ? "bg-blue-50/50"
              : "hover:bg-slate-50";

          return (
            <div
              key={student.student_profile_id}
              className={`flex items-center gap-3 px-4 py-2.5 ${rowBg}`}
            >
              {/* 탑승 체크박스 */}
              <input
                type="checkbox"
                checked={isBoarded || isChecked}
                disabled={isPending || isChecked}
                onChange={() =>
                  onBoard(
                    student,
                    card.bus_time_slot_id,
                    card.bus_number_id,
                    !isBoarded
                  )
                }
                title="탑승"
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 accent-blue-600"
              />

              {/* 하차 체크박스 */}
              <input
                type="checkbox"
                checked={isChecked}
                disabled={isPending || !isBoarded}
                onChange={() =>
                  onCheck(
                    student,
                    card.bus_time_slot_id,
                    card.bus_number_id,
                    !isChecked
                  )
                }
                title="하차"
                className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500 accent-green-600"
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium truncate ${getAgeColor(student.age).text}`}>
                    {student.korean_name || student.english_name}
                  </span>
                  {student.is_changed && (
                    <span className="shrink-0 text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded font-medium">
                      변경
                    </span>
                  )}
                </div>
                {(student.bus_stop_name || student.note) && (
                  <span className="text-xs text-slate-400 truncate block">
                    {student.bus_stop_name ? `📍 ${student.bus_stop_name}` : ""}{student.bus_stop_name && student.note ? " · " : ""}{student.note ?? ""}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {student.estimated_time && (
                  <span className="text-xs text-slate-400">
                    {formatTime(student.estimated_time)}
                  </span>
                )}
                {isBoarded && student.boarded_at && (
                  <>
                    {student.estimated_time && (
                      <span className="text-xs text-slate-300">→</span>
                    )}
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
        })}
      </div>
    </div>
  );
}
