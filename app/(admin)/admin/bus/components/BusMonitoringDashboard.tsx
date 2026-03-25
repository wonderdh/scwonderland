"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BusManifestGroup, BusTimeSlot, AfterSchoolBusEntry } from "@/lib/types";
import { getAgeColor } from "@/lib/student-age-colors";
import { getDailyBusManifest } from "../../actions";
import { formatTime } from "@/lib/bus/utils";
import { MonitorBusCard } from "@/components/bus/MonitorBusCard";
import { useBusRealtime } from "@/lib/hooks/use-bus-realtime";
import { applyCheckRecord, applyChangeRequest } from "@/lib/bus/realtime-utils";

const DIR_LABEL = { pickup: "등원", dropoff: "하원" } as const;
const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

export function BusMonitoringDashboard({
  busTimeSlots,
}: {
  busTimeSlots: BusTimeSlot[];
}) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const [date, setDate] = useState(today);
  const [direction, setDirection] = useState<"pickup" | "dropoff">("dropoff");
  const [groups, setGroups] = useState<BusManifestGroup[]>([]);
  const [afterschoolStudents, setAfterSchoolStudents] = useState<AfterSchoolBusEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const loadVersionRef = useRef(0);

  const load = useCallback(async () => {
    const version = ++loadVersionRef.current;
    setLoading(true);
    try {
      const result = await getDailyBusManifest(date, direction);
      if (loadVersionRef.current !== version) return;
      setGroups(result.groups);
      setAfterSchoolStudents(result.afterschoolStudents);
    } finally {
      if (loadVersionRef.current === version) setLoading(false);
    }
  }, [date, direction]);

  useEffect(() => {
    load();
  }, [load]);

  useBusRealtime(date, {
    onCheckRecord: (event, row) => {
      if (!row.student_profile_id) { load(); return; }
      setGroups((prev) => applyCheckRecord(prev, event, row));
    },
    onChangeRequest: (event, row) => {
      if (!row.student_profile_id || event === "DELETE" || row.change_type === "change") { load(); return; }
      setGroups((prev) => applyChangeRequest(prev, [], event, row).groups);
    },
  }, { enabled: date === today });

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
                    variant="admin"
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
