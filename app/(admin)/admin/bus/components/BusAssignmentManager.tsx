"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BusNumber, BusTimeSlot, BusStop, BusDefaultAssignment } from "@/lib/types";
import {
  getBulkBusDefaults,
  saveBulkBusDefaults,
  listBusStops,
} from "../../actions";
import { getAgeColor } from "@/lib/student-age-colors";

const DAYS = [
  { value: 1, label: "월" },
  { value: 2, label: "화" },
  { value: 3, label: "수" },
  { value: 4, label: "목" },
  { value: 5, label: "금" },
];

type StudentItem = { profile_id: string; korean_name: string | null; english_name: string | null; age?: number | null };

export function BusAssignmentManager({
  busNumbers,
  busTimeSlots,
  initialStops,
  allStudents,
}: {
  busNumbers: BusNumber[];
  busTimeSlots: BusTimeSlot[];
  initialStops: BusStop[];
  allStudents: StudentItem[];
}) {
  const [day, setDay] = useState(1);
  const [direction, setDirection] = useState<"pickup" | "dropoff">("dropoff");
  const [timeSlotId, setTimeSlotId] = useState("");
  const [stops, setStops] = useState<BusStop[]>(initialStops);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  // 서버 원본 vs 로컬 작업 사본
  const [serverAssignments, setServerAssignments] = useState<BusDefaultAssignment[]>([]);
  const [localAssignments, setLocalAssignments] = useState<BusDefaultAssignment[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Filter time slots by direction
  const filteredSlots = busTimeSlots.filter((s) => s.direction === direction);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    const data = await getBulkBusDefaults(day, direction, timeSlotId || undefined);
    setServerAssignments(data);
    setLocalAssignments(data);
    setHasChanges(false);
    setLoading(false);
  }, [day, direction, timeSlotId]);

  const refreshStops = useCallback(async () => {
    const data = await listBusStops();
    setStops(data);
  }, []);

  // 필터 변경 시 미저장 경고
  const changingFilter = useRef(false);
  const guardedSetFilter = useCallback(
    (setter: () => void) => {
      if (hasChanges) {
        if (!confirm("저장하지 않은 변경사항이 있습니다. 계속하시겠습니까?")) return;
      }
      changingFilter.current = true;
      setter();
    },
    [hasChanges]
  );

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  // Compute unassigned students (from local state)
  const assignedIds = new Set(localAssignments.map((a) => a.student_profile_id));
  const unassigned = allStudents
    .filter((s) => !assignedIds.has(s.profile_id))
    .filter((s) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        (s.korean_name?.toLowerCase().includes(q)) ||
        (s.english_name?.toLowerCase().includes(q))
      );
    });

  // Group local assignments by bus_number_id -> bus_stop_id
  const groupedByBus = new Map<string, { withStop: Map<string, BusDefaultAssignment[]>; noStop: BusDefaultAssignment[] }>();
  for (const bus of busNumbers) {
    groupedByBus.set(bus.id, { withStop: new Map(), noStop: [] });
  }
  for (const a of localAssignments) {
    const busId = a.bus_number_id ?? "";
    let group = groupedByBus.get(busId);
    if (!group) {
      group = { withStop: new Map(), noStop: [] };
      groupedByBus.set(busId, group);
    }
    if (a.bus_stop_id) {
      if (!group.withStop.has(a.bus_stop_id)) group.withStop.set(a.bus_stop_id, []);
      group.withStop.get(a.bus_stop_id)!.push(a);
    } else {
      group.noStop.push(a);
    }
  }

  // D&D handlers — 로컬 상태만 수정
  const handleDragStart = (e: React.DragEvent, student: StudentItem, fromAssignment?: BusDefaultAssignment) => {
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ studentProfileId: student.profile_id })
    );
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDropOnStop = (
    e: React.DragEvent,
    busNumberId: string,
    busStopId: string | null
  ) => {
    e.preventDefault();
    e.currentTarget.classList.remove("border-emerald-400", "bg-emerald-50/30");
    try {
      const raw = e.dataTransfer.getData("application/json");
      const { studentProfileId } = JSON.parse(raw) as { studentProfileId: string };

      const slotId = timeSlotId || filteredSlots[0]?.id;
      if (!slotId) {
        toast.error("시간대를 먼저 설정해 주세요.");
        return;
      }

      const student = allStudents.find((s) => s.profile_id === studentProfileId);
      const existing = localAssignments.find((a) => a.student_profile_id === studentProfileId);

      // 같은 위치면 무시
      if (existing && existing.bus_number_id === busNumberId && existing.bus_stop_id === (busStopId ?? null)) {
        return;
      }

      const stopName = busStopId ? (stops.find((s) => s.id === busStopId)?.name ?? null) : null;

      const newAssignment: BusDefaultAssignment = {
        id: existing?.id ?? `new_${studentProfileId}`,
        student_profile_id: studentProfileId,
        korean_name: student?.korean_name ?? existing?.korean_name ?? null,
        english_name: student?.english_name ?? existing?.english_name ?? null,
        age: student?.age ?? existing?.age ?? null,
        bus_number_id: busNumberId,
        bus_stop_id: busStopId ?? null,
        bus_stop_name: stopName,
        bus_time_slot_id: existing?.bus_time_slot_id ?? slotId,
        estimated_time: existing?.estimated_time ?? null,
        note: existing?.note ?? null,
      };

      setLocalAssignments((prev) => [
        ...prev.filter((a) => a.student_profile_id !== studentProfileId),
        newAssignment,
      ]);
      setHasChanges(true);
    } catch { /* ignore */ }
  };

  const handleDropOnUnassigned = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove("border-emerald-400", "bg-emerald-50/30");
    try {
      const raw = e.dataTransfer.getData("application/json");
      const { studentProfileId } = JSON.parse(raw) as { studentProfileId: string };
      const exists = localAssignments.some((a) => a.student_profile_id === studentProfileId);
      if (!exists) return;

      setLocalAssignments((prev) => prev.filter((a) => a.student_profile_id !== studentProfileId));
      setHasChanges(true);
    } catch { /* ignore */ }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add("border-emerald-400", "bg-emerald-50/30");
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("border-emerald-400", "bg-emerald-50/30");
  };

  // 되돌리기
  const handleReset = () => {
    setLocalAssignments(serverAssignments);
    setHasChanges(false);
  };

  // 일괄 저장 (서버에서 한 트랜잭션으로 처리)
  const handleSaveAll = async () => {
    setSaving(true);
    const result = await saveBulkBusDefaults(
      day,
      direction,
      localAssignments.map((a) => ({
        student_profile_id: a.student_profile_id,
        bus_number_id: a.bus_number_id,
        bus_time_slot_id: a.bus_time_slot_id,
        bus_stop_id: a.bus_stop_id,
      }))
    );

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("저장되었습니다.");
      await refreshStops();
    }

    await fetchAssignments();
    setSaving(false);
  };

  const studentName = (s: { korean_name: string | null; english_name: string | null }) =>
    s.korean_name || s.english_name || "이름 없음";

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {DAYS.map((d) => (
            <button
              key={d.value}
              onClick={() => guardedSetFilter(() => setDay(d.value))}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                day === d.value
                  ? "bg-slate-800 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => guardedSetFilter(() => setDirection("pickup"))}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              direction === "pickup"
                ? "bg-blue-600 text-white"
                : "bg-blue-50 text-blue-600 hover:bg-blue-100"
            }`}
          >
            등원
          </button>
          <button
            onClick={() => guardedSetFilter(() => setDirection("dropoff"))}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              direction === "dropoff"
                ? "bg-orange-600 text-white"
                : "bg-orange-50 text-orange-600 hover:bg-orange-100"
            }`}
          >
            하원
          </button>
        </div>
        <select
          value={timeSlotId}
          onChange={(e) => guardedSetFilter(() => setTimeSlotId(e.target.value))}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
        >
          <option value="">전체 시간대</option>
          {filteredSlots.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label} ({s.time})
            </option>
          ))}
        </select>

        {/* 저장/되돌리기 버튼 */}
        {hasChanges && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-amber-600 font-medium">미저장 변경사항</span>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={handleReset}
              disabled={saving}
            >
              되돌리기
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleSaveAll}
              disabled={saving}
            >
              {saving ? "저장 중..." : "저장"}
            </Button>
          </div>
        )}
        {loading && <span className="text-sm text-muted-foreground">불러오는 중...</span>}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Bus cards */}
        <div className="lg:col-span-2 space-y-4">
          {busNumbers.map((bus) => {
            const group = groupedByBus.get(bus.id);
            const busStops = stops.filter(() => false); // legacy: bus_number_id removed from bus_stops
            const busAssignmentCount = (group?.noStop.length ?? 0) +
              [...(group?.withStop.values() ?? [])].reduce((sum, arr) => sum + arr.length, 0);

            return (
              <div key={bus.id} className="border border-slate-200 rounded-xl overflow-hidden">
                {/* Bus header */}
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🚌</span>
                    <span className="font-semibold text-slate-800">{bus.label}</span>
                    <span className="text-xs text-muted-foreground">({busAssignmentCount}명)</span>
                  </div>
                </div>

                <div className="p-3 space-y-2">
                  {/* Stops */}
                  {busStops.map((stop) => {
                    const stopStudents = group?.withStop.get(stop.id) ?? [];
                    return (
                      <div
                        key={stop.id}
                        className="border border-dashed border-slate-200 rounded-lg p-2 min-h-[48px] transition-colors"
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDropOnStop(e, bus.id, stop.id)}
                      >
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-xs font-medium text-slate-500">
                            📍 {stop.name}
                          </span>
                          <span className="text-xs text-muted-foreground">({stopStudents.length})</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {stopStudents.map((a) => {
                            const ac = getAgeColor(a.age);
                            return (
                              <span
                                key={a.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, { profile_id: a.student_profile_id, korean_name: a.korean_name, english_name: a.english_name, age: a.age })}
                                className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-md cursor-grab active:cursor-grabbing hover:shadow-sm select-none ${ac.bg} ${ac.text} border ${ac.border}`}
                              >
                                {studentName(a)}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* No-stop section */}
                  <div
                    className="border border-dashed border-slate-200 rounded-lg p-2 min-h-[48px] transition-colors"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDropOnStop(e, bus.id, null)}
                  >
                    <span className="text-xs font-medium text-slate-400 mb-1.5 block">미지정</span>
                    <div className="flex flex-wrap gap-1.5">
                      {(group?.noStop ?? []).map((a) => {
                        const ac = getAgeColor(a.age);
                        return (
                          <span
                            key={a.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, { profile_id: a.student_profile_id, korean_name: a.korean_name, english_name: a.english_name, age: a.age })}
                            className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-md cursor-grab active:cursor-grabbing hover:shadow-sm select-none ${ac.bg} ${ac.text} border ${ac.border}`}
                          >
                            {studentName(a)}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {busNumbers.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              호차가 없습니다. &quot;호차 관리&quot; 탭에서 호차를 추가해 주세요.
            </p>
          )}
        </div>

        {/* Right: Unassigned students */}
        <div className="lg:col-span-1">
          <div
            className="border border-slate-200 rounded-xl sticky top-4 transition-colors"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDropOnUnassigned}
          >
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 rounded-t-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-slate-800 text-sm">미배정 학생</span>
                <span className="text-xs text-muted-foreground">{unassigned.length}명</span>
              </div>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="이름 검색..."
                className="h-8 text-sm"
              />
            </div>
            <div className="p-3 max-h-[60vh] overflow-y-auto">
              <div className="flex flex-wrap gap-1.5">
                {unassigned.map((s) => {
                  const ac = getAgeColor(s.age);
                  return (
                    <span
                      key={s.profile_id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, s)}
                      className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-md cursor-grab active:cursor-grabbing hover:shadow-sm select-none ${ac.bg} ${ac.text} border ${ac.border}`}
                    >
                      {studentName(s)}
                    </span>
                  );
                })}
                {unassigned.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2 w-full text-center">
                    {search ? "검색 결과 없음" : "모든 학생이 배정되었습니다"}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
