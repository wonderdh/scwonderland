"use client";

import { useState, useEffect, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/LoadingState";
import { getWeeklyDropoffExportData } from "../../actions";
import { getAgeColor } from "@/lib/student-age-colors";
import { formatTime } from "@/lib/bus/utils";
import type { DropoffExportRow, BusTimeSlot, BusNumber } from "@/lib/types";

const DAY_NAMES = ["", "월", "화", "수", "목", "금"];

// 요일별 배경 (연한 톤, 글씨 잘 보이게)
const DAY_COLORS: Record<number, string> = {
  1: "bg-red-50/70 text-red-900",
  2: "bg-orange-50/70 text-orange-900",
  3: "bg-yellow-50/70 text-yellow-900",
  4: "bg-green-50/70 text-green-900",
  5: "bg-blue-50/70 text-blue-900",
};

// 호차별 열 배경 (순환, 매우 연한 톤)
const BUS_COL_COLORS = [
  "bg-sky-50/60",
  "bg-amber-50/60",
  "bg-rose-50/60",
  "bg-teal-50/60",
  "bg-purple-50/60",
  "bg-lime-50/60",
  "bg-fuchsia-50/60",
  "bg-cyan-50/60",
];

type StopGroup = {
  stopName: string;
  stopSortOrder: number;
  students: { name: string; age: number | null; profileId: string; note: string | null }[];
};

type DayCellData = {
  stops: StopGroup[];
};

export function DropoffOverviewPanel() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<DropoffExportRow[]>([]);
  const [slots, setSlots] = useState<BusTimeSlot[]>([]);
  const [busNumbers, setBusNumbers] = useState<BusNumber[]>([]);
  const [unassigned, setUnassigned] = useState<{ day: number; profile_id: string; korean_name: string | null; english_name: string | null; age: number | null }[]>([]);
  const [afterschoolSet, setAfterschoolSet] = useState<Set<string>>(new Set());
  const [activeSlot, setActiveSlot] = useState<string>("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const result = await getWeeklyDropoffExportData();
      if ("error" in result) {
        setLoading(false);
        return;
      }
      setRows(result.rows);
      setSlots(result.slots);
      setBusNumbers(result.busNumbers);
      setUnassigned(result.unassigned);

      const asSet = new Set<string>();
      for (const e of result.afterschoolEnrollments) {
        asSet.add(`${e.profile_id}-${e.day}`);
      }
      setAfterschoolSet(asSet);

      const dropoffSlots = result.slots.filter((s) => s.direction === "dropoff");
      if (dropoffSlots.length > 0) {
        setActiveSlot(dropoffSlots[0].id);
      }
      setLoading(false);
    }
    load();
  }, []);

  // 검색어로 매칭되는 profileId Set
  const highlightIds = useMemo(() => {
    const q = search.trim();
    if (!q) return new Set<string>();
    const ids = new Set<string>();
    for (const r of rows) {
      const name = r.korean_name || r.english_name || "";
      if (name.includes(q)) ids.add(r.profile_id);
    }
    for (const u of unassigned) {
      const name = u.korean_name || u.english_name || "";
      if (name.includes(q)) ids.add(u.profile_id);
    }
    return ids;
  }, [search, rows, unassigned]);

  if (loading) return <LoadingState className="py-8" />;

  const dropoffSlots = slots.filter((s) => s.direction === "dropoff");

  if (dropoffSlots.length === 0) {
    return <p className="text-sm text-slate-400 py-4">하원 시간대가 등록되지 않았습니다.</p>;
  }

  const selectedSlot = dropoffSlots.find((s) => s.id === activeSlot);
  const selectedSlotLabel = selectedSlot?.label ?? "";
  const selectedSlotTime = selectedSlot ? formatTime(selectedSlot.time) : "";

  const filteredRows = rows.filter(
    (r) => r.slotTime === selectedSlot?.time && r.slotLabel === selectedSlotLabel
  );

  const busLabelsInData = new Set(filteredRows.map((r) => r.busLabel));
  const activeBuses = busNumbers
    .filter((b) => busLabelsInData.has(b.label))
    .sort((a, b) => a.label.localeCompare(b.label, "ko"));

  const knownLabels = new Set(busNumbers.map((b) => b.label));
  const extraLabels = [...busLabelsInData].filter((l) => !knownLabels.has(l)).sort();
  const allBusLabels = [...activeBuses.map((b) => b.label), ...extraLabels];

  function buildCell(day: number, busLabel: string): DayCellData {
    const cellRows = filteredRows.filter((r) => r.day === day && r.busLabel === busLabel);
    const stopMap = new Map<string, StopGroup>();

    for (const r of cellRows) {
      const key = r.stopName || "미배정";
      let group = stopMap.get(key);
      if (!group) {
        group = { stopName: key, stopSortOrder: r.stopSortOrder, students: [] };
        stopMap.set(key, group);
      }
      group.students.push({
        name: r.korean_name || r.english_name || "이름 없음",
        age: r.age,
        profileId: r.profile_id,
        note: r.note,
      });
    }

    const stops = [...stopMap.values()].sort((a, b) => a.stopSortOrder - b.stopSortOrder);
    for (const stop of stops) {
      stop.students.sort((a, b) => {
        const ageDiff = (a.age ?? 99) - (b.age ?? 99);
        if (ageDiff !== 0) return ageDiff;
        return a.name.localeCompare(b.name, "ko");
      });
    }

    return { stops };
  }

  const hasSearch = highlightIds.size > 0;

  return (
    <div className="space-y-4">
      {/* 검색 + 시간대 탭 */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="학생 이름 검색..."
          className="h-9 text-sm w-48"
        />
        {hasSearch && (
          <span className="text-xs text-blue-600 font-medium">
            {highlightIds.size}명 매칭
          </span>
        )}
      </div>

      <Tabs value={activeSlot} onValueChange={setActiveSlot}>
        <TabsList variant="line">
          {dropoffSlots.map((s) => (
            <TabsTrigger key={s.id} value={s.id}>
              {formatTime(s.time)} {s.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {dropoffSlots.map((slot) => (
          <TabsContent key={slot.id} value={slot.id}>
            {allBusLabels.length === 0 ? (
              <p className="text-sm text-slate-400 py-4">
                {selectedSlotTime} {selectedSlotLabel} 시간대에 배정된 학생이 없습니다.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-base border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-300">
                      <th className="text-left py-3 px-3 w-14 bg-slate-100 sticky left-0 z-10 text-sm font-bold">요일</th>
                      {allBusLabels.map((label, i) => (
                        <th key={label} className={`text-center py-3 px-3 min-w-[180px] text-sm font-bold border-l border-slate-200 ${BUS_COL_COLORS[i % BUS_COL_COLORS.length]}`}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4, 5].map((day) => (
                      <tr key={day} className="border-b border-slate-200 align-top">
                        <td className={`py-3 px-3 font-bold text-sm sticky left-0 z-10 border-r border-slate-200 ${DAY_COLORS[day]}`}>
                          {DAY_NAMES[day]}
                        </td>
                        {allBusLabels.map((busLabel, busIdx) => {
                          const cell = buildCell(day, busLabel);
                          const colBg = BUS_COL_COLORS[busIdx % BUS_COL_COLORS.length];
                          return (
                            <td key={busLabel} className={`py-2 px-3 border-l border-slate-200 ${colBg}`}>
                              {cell.stops.length === 0 ? (
                                <span className="text-slate-300">-</span>
                              ) : (
                                <div className="space-y-2">
                                  {cell.stops.map((stop) => (
                                    <div key={stop.stopName}>
                                      <div className="text-sm font-bold text-slate-700 mb-1">
                                        {stop.stopName}
                                        <span className="text-slate-400 font-medium ml-1">({stop.students.length})</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1">
                                        {stop.students.map((s) => {
                                          const color = getAgeColor(s.age);
                                          const isAfterschool = afterschoolSet.has(`${s.profileId}-${day}`);
                                          const isHighlighted = hasSearch && highlightIds.has(s.profileId);
                                          const dimmed = hasSearch && !isHighlighted;
                                          return (
                                            <span
                                              key={s.profileId}
                                              className={`inline-flex items-center text-sm font-semibold px-2 py-0.5 rounded ${color.bg} ${color.text} ${isAfterschool ? "ring-1 ring-violet-400" : ""} ${isHighlighted ? "ring-2 ring-yellow-400 shadow-md scale-110 z-10 relative" : ""} ${dimmed ? "opacity-30" : ""}`}
                                              title={[s.age ? `${s.age}세` : "", isAfterschool ? "방과후" : "", s.note ?? ""].filter(Boolean).join(" · ")}
                                            >
                                              {s.name}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* 미배정 학생 */}
      {unassigned.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="text-sm font-bold text-amber-800 mb-2">
            하원 미배정 학생 ({unassigned.length}건)
          </h3>
          <div className="grid grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map((day) => {
              const dayStudents = unassigned
                .filter((u) => u.day === day)
                .sort((a, b) => {
                  const ageDiff = (a.age ?? 99) - (b.age ?? 99);
                  if (ageDiff !== 0) return ageDiff;
                  return (a.korean_name ?? "").localeCompare(b.korean_name ?? "", "ko");
                });
              return (
                <div key={day}>
                  <div className={`text-sm font-bold mb-1 px-2 py-0.5 rounded ${DAY_COLORS[day]}`}>{DAY_NAMES[day]}</div>
                  {dayStudents.length === 0 ? (
                    <span className="text-sm text-slate-300 px-2">-</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {dayStudents.map((s) => {
                        const color = getAgeColor(s.age);
                        const isHighlighted = hasSearch && highlightIds.has(s.profile_id);
                        const dimmed = hasSearch && !isHighlighted;
                        return (
                          <span
                            key={`${s.profile_id}-${day}`}
                            className={`text-sm font-semibold px-2 py-0.5 rounded ${color.bg} ${color.text} ${isHighlighted ? "ring-2 ring-yellow-400 shadow-md" : ""} ${dimmed ? "opacity-30" : ""}`}
                          >
                            {s.korean_name || s.english_name || "이름 없음"}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 범례 */}
      <div className="flex flex-wrap gap-3 text-xs text-slate-500 pt-2 border-t border-slate-100">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-pink-100 border border-pink-200" /> 5세
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-sky-100 border border-sky-200" /> 6세
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200" /> 7세
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded ring-1 ring-violet-400 bg-slate-100" /> 방과후
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded ring-2 ring-yellow-400 bg-white" /> 검색 매칭
        </span>
      </div>
    </div>
  );
}
