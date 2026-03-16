"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BusManifestGroup, BusManifestEntry, BusTimeSlot, AfterSchoolBusEntry } from "@/lib/types";
import { getAgeColor } from "@/lib/student-age-colors";
import { getDailyBusManifest } from "../../actions";
import { groupStudentsByStop, formatTime, formatCheckedTime } from "@/lib/bus/utils";

const DIR_LABEL = { pickup: "등원", dropoff: "하원" } as const;
const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

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
                : student.is_changed
                  ? "bg-amber-50"
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
                  <div className="flex-1 min-w-0">
                    {isChecked ? (
                      <span className="block truncate text-slate-400 line-through">
                        {student.korean_name || student.english_name}
                      </span>
                    ) : (
                      <span className={`inline-block truncate px-1.5 py-0.5 rounded text-xs font-medium ${getAgeColor(student.age).bg} ${getAgeColor(student.age).text}`}>
                        {student.korean_name || student.english_name}
                      </span>
                    )}
                    {student.is_changed && student.original_bus_label && (
                      <span className="block text-[10px] text-amber-500">
                        {student.original_bus_label} → {card.bus_label}
                      </span>
                    )}
                    {student.note && (
                      <span className="block text-[10px] text-slate-400">
                        {student.note}
                      </span>
                    )}
                  </div>
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
  const [afterschoolStudents, setAfterSchoolStudents] = useState<AfterSchoolBusEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getDailyBusManifest(date, direction);
    setGroups(result.groups);
    setAfterSchoolStudents(result.afterschoolStudents);
    setLoading(false);
  }, [date, direction]);

  useEffect(() => {
    load();
  }, [load]);

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
  const [selectedSlotId, setSelectedSlotId] = useState(() => {
    const slots = busTimeSlots.filter((s) => s.direction === "dropoff");
    return slots[0]?.id ?? "";
  });

  const filteredTimeGroups = timeGroups.filter((tg) =>
    tg.cards.some((c) => c.bus_time_slot_id === selectedSlotId)
  );

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
              setSelectedSlotId(busTimeSlots.find(s => s.direction === "pickup")?.id ?? "");
            }}
          >
            등원
          </Button>
          <Button
            size="sm"
            variant={direction === "dropoff" ? "default" : "outline"}
            onClick={() => {
              setDirection("dropoff");
              setSelectedSlotId(busTimeSlots.find(s => s.direction === "dropoff")?.id ?? "");
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
            {directionSlots.map((s) => (
              <option key={s.id} value={s.id}>
                {formatTime(s.time)} {s.label}
              </option>
            ))}
          </select>
        )}
        <div className="flex items-center gap-2 ml-auto">
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
                  (c) => c.bus_time_slot_id === selectedSlotId
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

      {/* 방과후 학생 (하원 시만) */}
      {afterschoolStudents.length > 0 && direction === "dropoff" && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm font-semibold text-violet-700">
              방과후 ({afterschoolStudents.length}명)
            </span>
            <div className="flex-1 border-t border-violet-200" />
          </div>
          <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3">
            <div className="flex flex-wrap gap-2">
              {afterschoolStudents.map((student) => {
                const ageColor = getAgeColor(student.age);
                return (
                  <span
                    key={student.student_profile_id}
                    className={`inline-block px-2 py-1 rounded text-xs font-medium ${ageColor.bg} ${ageColor.text}`}
                  >
                    {student.korean_name || student.english_name}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
