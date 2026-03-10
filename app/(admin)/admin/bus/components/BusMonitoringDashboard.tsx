"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BusManifestGroup, BusManifestEntry, BusTimeSlot } from "@/lib/types";
import { getAgeColor } from "@/lib/student-age-colors";
import { getDailyBusManifest } from "../../actions";

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

type StopGroup = {
  stopName: string;
  estimatedTime: string | null;
  students: BusManifestEntry[];
};

function groupStudentsByStop(students: BusManifestEntry[]): StopGroup[] {
  const sorted = [...students].sort((a, b) => {
    const ta = a.estimated_time ?? "99:99";
    const tb = b.estimated_time ?? "99:99";
    if (ta !== tb) return ta.localeCompare(tb);
    return (a.bus_stop_name ?? "").localeCompare(b.bus_stop_name ?? "");
  });

  const groups: StopGroup[] = [];
  let current: StopGroup | null = null;

  for (const s of sorted) {
    const key = `${s.bus_stop_name ?? ""}|${s.estimated_time ?? ""}`;
    if (!current || `${current.stopName}|${current.estimatedTime ?? ""}` !== key) {
      current = {
        stopName: s.bus_stop_name ?? "",
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
  boarded,
  checked,
  total,
}: {
  boarded: number;
  checked: number;
  total: number;
}) {
  const boardedPct = total > 0 ? Math.round((boarded / total) * 100) : 0;
  const checkedPct = total > 0 ? Math.round((checked / total) * 100) : 0;

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden relative">
        {/* 탑승 바 (파란색, 전체 너비) */}
        <div
          className="absolute inset-y-0 left-0 bg-blue-400 rounded-full transition-all duration-300"
          style={{ width: `${boardedPct}%` }}
        />
        {/* 하차 바 (초록색, 겹침) */}
        <div
          className="absolute inset-y-0 left-0 bg-green-500 rounded-full transition-all duration-300"
          style={{ width: `${checkedPct}%` }}
        />
      </div>
      <span className="text-xs font-medium text-slate-600 whitespace-nowrap">
        {boarded}/{total}명
      </span>
    </div>
  );
}

// 호차별 카드 (정류장 그룹) — 읽기 전용
function MonitorBusCard({ card }: { card: BusManifestGroup }) {
  const boardedCount = card.students.filter(
    (s) => s.boarded_at || s.checked_at
  ).length;
  const checkedCount = card.students.filter((s) => s.checked_at).length;
  const totalCount = card.students.length;
  const allDone = checkedCount === totalCount && totalCount > 0;
  const stopGroups = groupStudentsByStop(card.students);

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* 카드 헤더 */}
      <div
        className={`px-4 py-3 ${allDone ? "bg-green-50" : "bg-slate-50"}`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-semibold text-slate-700">
            {card.bus_label}
          </span>
          <span className="text-xs font-medium text-slate-500">
            {allDone
              ? "완료"
              : `탑승 ${boardedCount}/${totalCount} · 하차 ${checkedCount}/${totalCount}`}
          </span>
        </div>
        <ProgressBar
          boarded={boardedCount}
          checked={checkedCount}
          total={totalCount}
        />
      </div>

      {/* 정류장별 학생 타임라인 */}
      <div className="divide-y divide-slate-100">
        {stopGroups.map((group, gi) => (
          <div key={gi}>
            {/* 정류장 헤더 */}
            {(group.stopName || group.estimatedTime) && (
              <div className="px-4 py-1.5 bg-slate-50/60 flex items-center gap-2">
                <span className="text-xs text-slate-500">▸</span>
                {group.estimatedTime && (
                  <span className="text-xs font-medium text-slate-600">
                    {formatTime(group.estimatedTime)}
                  </span>
                )}
                {group.stopName && (
                  <span className="text-xs text-slate-500 truncate">
                    📍 {group.stopName}
                  </span>
                )}
              </div>
            )}

            {/* 학생 목록 */}
            {group.students.map((student) => {
              const isBoarded = !!student.boarded_at;
              const isChecked = !!student.checked_at;

              const rowBg = isChecked
                ? "bg-green-50/40"
                : isBoarded
                  ? "bg-blue-50/30"
                  : "";

              return (
                <div
                  key={student.student_profile_id}
                  className={`px-4 py-1.5 pl-8 flex items-center gap-2 text-sm ${rowBg}`}
                >
                  <span className="text-xs shrink-0">
                    {isChecked ? "✅" : isBoarded ? "🚌" : "⬜"}
                  </span>
                  <span
                    className={`flex-1 truncate ${
                      isChecked
                        ? "text-slate-400 line-through"
                        : isBoarded
                          ? `font-medium ${getAgeColor(student.age).text}`
                          : `font-medium ${getAgeColor(student.age).text}`
                    }`}
                  >
                    {student.korean_name || student.english_name}
                  </span>
                  {isBoarded && student.boarded_at && !isChecked && (
                    <span className="text-xs text-blue-600 shrink-0">
                      탑승 {formatCheckedTime(student.boarded_at)}
                    </span>
                  )}
                  {isChecked && student.checked_at && (
                    <span className="text-xs text-green-600 shrink-0">
                      하차 {formatCheckedTime(student.checked_at)}
                    </span>
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

export function BusMonitoringDashboard({
  busTimeSlots,
}: {
  busTimeSlots: BusTimeSlot[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [direction, setDirection] = useState<"pickup" | "dropoff">("dropoff");
  const [groups, setGroups] = useState<BusManifestGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const countdownRef = useRef(REFRESH_INTERVAL);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getDailyBusManifest(date, direction);
    setGroups(result.groups);
    setLoading(false);
    setCountdown(REFRESH_INTERVAL);
    countdownRef.current = REFRESH_INTERVAL;
  }, [date, direction]);

  // 데이터 로드 + 30초 자동 갱신
  useEffect(() => {
    load();
    const interval = setInterval(() => load(), REFRESH_INTERVAL * 1000);
    return () => clearInterval(interval);
  }, [load]);

  // 카운트다운 표시
  useEffect(() => {
    const timer = setInterval(() => {
      countdownRef.current -= 1;
      if (countdownRef.current < 0) countdownRef.current = REFRESH_INTERVAL;
      setCountdown(countdownRef.current);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const d = new Date(date);
  const dayName = DAY_NAMES[d.getDay()];

  // 시간대별 그룹핑 → 호차별 카드
  const timeGroupMap = new Map<
    string,
    { slotTime: string; slotLabel: string; cards: BusManifestGroup[] }
  >();
  for (const g of groups) {
    const key = g.slot_time;
    if (!timeGroupMap.has(key)) {
      timeGroupMap.set(key, {
        slotTime: g.slot_time,
        slotLabel: g.slot_label,
        cards: [],
      });
    }
    timeGroupMap.get(key)!.cards.push(g);
  }
  const timeGroups = [...timeGroupMap.values()].sort((a, b) =>
    a.slotTime.localeCompare(b.slotTime)
  );

  // 현재 방향의 시간대 필터
  const directionSlots = busTimeSlots.filter((s) => s.direction === direction);
  const [selectedSlotId, setSelectedSlotId] = useState("");

  const filteredTimeGroups = selectedSlotId
    ? timeGroups.filter((tg) =>
        tg.cards.some((c) => c.bus_time_slot_id === selectedSlotId)
      )
    : timeGroups;

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
            onClick={() => {
              setDirection("pickup");
              setSelectedSlotId("");
            }}
          >
            등원
          </Button>
          <Button
            size="sm"
            variant={direction === "dropoff" ? "default" : "outline"}
            onClick={() => {
              setDirection("dropoff");
              setSelectedSlotId("");
            }}
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
      {groups.length === 0 && !loading && (
        <p className="text-sm text-slate-400 py-8 text-center">
          배정된 학생이 없습니다.
        </p>
      )}

      {/* 시간대별 → 호차별 카드 */}
      <div className="space-y-6">
        {filteredTimeGroups.map((tg) => (
          <div key={tg.slotTime}>
            {/* 시간대 헤더 */}
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm font-semibold text-slate-700">
                {formatTime(tg.slotTime)}
              </span>
              {tg.slotLabel && (
                <span className="text-sm text-slate-500">{tg.slotLabel}</span>
              )}
              <div className="flex-1 border-t border-slate-200" />
            </div>

            {/* 호차별 모니터링 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {tg.cards
                .filter(
                  (c) => !selectedSlotId || c.bus_time_slot_id === selectedSlotId
                )
                .map((card) => (
                  <MonitorBusCard
                    key={`${card.bus_time_slot_id}-${card.bus_number_id}`}
                    card={card}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
