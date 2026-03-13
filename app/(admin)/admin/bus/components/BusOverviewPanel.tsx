"use client";

import { useState, useEffect, useCallback } from "react";
import { getBulkBusDefaults } from "../../actions";
import { getAgeColor } from "@/lib/student-age-colors";
import type { BusNumber, BusTimeSlot, BusDefaultAssignment } from "@/lib/types";

const DAYS = [
  { value: 1, label: "월" },
  { value: 2, label: "화" },
  { value: 3, label: "수" },
  { value: 4, label: "목" },
  { value: 5, label: "금" },
];

const DIRECTIONS: { value: "pickup" | "dropoff"; label: string }[] = [
  { value: "pickup", label: "등원" },
  { value: "dropoff", label: "하원" },
];

export function BusOverviewPanel({
  busNumbers,
  busTimeSlots,
}: {
  busNumbers: BusNumber[];
  busTimeSlots: BusTimeSlot[];
}) {
  const today = new Date();
  const jsDay = today.getDay();
  const defaultDay = jsDay >= 1 && jsDay <= 5 ? jsDay : 1;

  const [day, setDay] = useState(defaultDay);
  const [direction, setDirection] = useState<"pickup" | "dropoff">("pickup");
  const [data, setData] = useState<BusDefaultAssignment[]>([]);
  const [loading, setLoading] = useState(false);

  const filteredSlots = busTimeSlots.filter((s) => s.direction === direction && s.is_active);

  // 초기 시간대: 해당 방향의 첫 번째 활성 슬롯
  const getDefaultSlotId = useCallback(
    (dir: "pickup" | "dropoff") => {
      const slots = busTimeSlots.filter((s) => s.direction === dir && s.is_active);
      return slots.length > 0 ? slots[0].id : "";
    },
    [busTimeSlots]
  );

  const [slotId, setSlotId] = useState<string>(() => getDefaultSlotId("pickup"));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getBulkBusDefaults(day, direction, slotId || undefined);
      setData(result);
    } finally {
      setLoading(false);
    }
  }, [day, direction, slotId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // direction 변경 시 해당 방향의 첫 번째 슬롯으로 자동 선택
  useEffect(() => {
    setSlotId(getDefaultSlotId(direction));
  }, [direction, getDefaultSlotId]);

  // 호차 → 정류장 → 학생 그룹핑
  const grouped = groupByBusAndStop(data, busNumbers);

  return (
    <div className="space-y-4">
      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-3">
        {/* 요일 */}
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          {DAYS.map((d) => (
            <button
              key={d.value}
              onClick={() => setDay(d.value)}
              className={`px-3.5 py-1.5 text-sm font-medium transition-colors ${
                day === d.value
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* 등/하원 */}
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          {DIRECTIONS.map((dir) => (
            <button
              key={dir.value}
              onClick={() => setDirection(dir.value)}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                direction === dir.value
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {dir.label}
            </button>
          ))}
        </div>

        {/* 시간대 */}
        <select
          value={slotId}
          onChange={(e) => setSlotId(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm bg-white text-slate-700"
        >
          {filteredSlots.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label} ({s.time?.slice(0, 5)})
            </option>
          ))}
        </select>

        {loading && (
          <span className="text-xs text-slate-400 animate-pulse">로딩 중...</span>
        )}

        <span className="ml-auto text-xs text-slate-400">
          총 {data.length}명
        </span>
      </div>

      {/* 결과 */}
      {!loading && data.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          배정된 학생이 없습니다.
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((bus) => (
            <div key={bus.busId} className="border border-slate-200 rounded-xl overflow-hidden">
              {/* 호차 헤더 */}
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center gap-2">
                <span className="font-semibold text-slate-800 text-sm">{bus.busLabel}</span>
                <span className="text-xs text-slate-400">{bus.totalCount}명</span>
              </div>

              <div className="divide-y divide-slate-100">
                {bus.stops.map((stop) => (
                  <div key={stop.stopId} className="px-4 py-2.5 flex items-start gap-3">
                    {/* 정류장 이름 + 인원 */}
                    <span className="shrink-0 text-xs font-medium text-slate-500 bg-slate-50 rounded px-2 py-1 min-w-[80px] text-center border border-slate-100">
                      {stop.stopName}
                      <span className="ml-1 text-slate-400">({stop.students.length})</span>
                    </span>
                    {/* 학생 이름 가로 나열 */}
                    <div className="flex flex-wrap gap-1.5">
                      {stop.students.map((s) => {
                        const color = getAgeColor(s.age);
                        return (
                          <span
                            key={s.student_profile_id}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${color.bg} ${color.text} ${color.border}`}
                          >
                            {s.korean_name}
                            {s.note && (
                              <span className="text-[10px] opacity-60">({s.note})</span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 그룹핑 헬퍼 ──

type StopGroup = {
  stopId: string;
  stopName: string;
  students: BusDefaultAssignment[];
};

type BusGroup = {
  busId: string;
  busLabel: string;
  totalCount: number;
  stops: StopGroup[];
};

function groupByBusAndStop(
  data: BusDefaultAssignment[],
  busNumbers: BusNumber[]
): BusGroup[] {
  const busLabelMap = new Map(busNumbers.map((b) => [b.id, b.label]));
  const busOrder = new Map(busNumbers.map((b, i) => [b.id, i]));
  const NO_STOP = "__no_stop__";

  // busId → stopId → students
  const map = new Map<string, Map<string, BusDefaultAssignment[]>>();

  for (const item of data) {
    const busId = item.bus_number_id ?? "__unassigned__";
    if (!map.has(busId)) map.set(busId, new Map());
    const stopKey = item.bus_stop_id ?? NO_STOP;
    const stopMap = map.get(busId)!;
    if (!stopMap.has(stopKey)) stopMap.set(stopKey, []);
    stopMap.get(stopKey)!.push(item);
  }

  const result: BusGroup[] = [];

  for (const [busId, stopMap] of map) {
    const stops: StopGroup[] = [];
    let totalCount = 0;

    for (const [stopKey, students] of stopMap) {
      // 이름순 정렬
      students.sort((a, b) => (a.korean_name ?? "").localeCompare(b.korean_name ?? ""));
      totalCount += students.length;
      stops.push({
        stopId: stopKey,
        stopName: stopKey === NO_STOP ? "(정류장 미지정)" : (students[0]?.bus_stop_name ?? "알 수 없음"),
        students,
      });
    }

    // 정류장: 미지정을 마지막으로, 나머지는 이름순
    stops.sort((a, b) => {
      if (a.stopId === NO_STOP) return 1;
      if (b.stopId === NO_STOP) return -1;
      return a.stopName.localeCompare(b.stopName);
    });

    result.push({
      busId,
      busLabel: busLabelMap.get(busId) ?? busId,
      totalCount,
      stops,
    });
  }

  // 호차 순서 정렬
  result.sort((a, b) => (busOrder.get(a.busId) ?? 99) - (busOrder.get(b.busId) ?? 99));

  return result;
}
