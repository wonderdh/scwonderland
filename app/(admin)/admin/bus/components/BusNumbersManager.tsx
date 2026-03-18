"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BusNumber, BusStop, BusTimeSlot } from "@/lib/types";
import {
  createBusNumber,
  updateBusNumber,
  deleteBusNumber,
  createBusStop,
  updateBusStop,
  deleteBusStop,
  listBusStopDayAssignments,
  saveBusStopDayAssignments,
  listBusStopSchedulesBulk,
  upsertBusStopSchedule,
  deleteBusStopSchedule,
} from "../../actions";

const DAYS = [
  { value: 1, label: "월" },
  { value: 2, label: "화" },
  { value: 3, label: "수" },
  { value: 4, label: "목" },
  { value: 5, label: "금" },
];

// Per-day assignment entry: which bus + sort order
type StopAssignment = { busNumberId: string; sortOrder: number };

export function BusNumbersManager({
  busNumbers,
  busTimeSlots,
  initialStops,
}: {
  busNumbers: BusNumber[];
  busTimeSlots: BusTimeSlot[];
  initialStops: BusStop[];
}) {
  const router = useRouter();

  // Filters
  const [day, setDay] = useState(1);
  const [direction, setDirection] = useState<"pickup" | "dropoff">("dropoff");
  const [timeSlotId, setTimeSlotId] = useState("");

  // Master stop list
  const [stops, setStops] = useState<BusStop[]>(initialStops);

  // Per-day assignment: stopId → { busNumberId, sortOrder }
  const [dayAssignments, setDayAssignments] = useState<Map<string, StopAssignment>>(new Map());
  const serverAssignments = useRef<Map<string, StopAssignment>>(new Map());

  // Schedule times: stopId → time
  const [scheduleMap, setScheduleMap] = useState<Map<string, string>>(new Map());
  const serverSchedules = useRef<Map<string, string>>(new Map());

  // UI
  const [search, setSearch] = useState("");
  const [newStopName, setNewStopName] = useState("");
  const [newBusLabel, setNewBusLabel] = useState("");
  const [editingBusId, setEditingBusId] = useState<string | null>(null);
  const [editBusLabel, setEditBusLabel] = useState("");
  const [editingStopId, setEditingStopId] = useState<string | null>(null);
  const [editStopName, setEditStopName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  const filteredSlots = busTimeSlots.filter((s) => s.direction === direction);

  // ── Fetch ──

  const fetchDayAssignments = useCallback(async () => {
    let data = await listBusStopDayAssignments(day, direction, timeSlotId || undefined);
    // 특정 시간대 선택 시 데이터가 없으면 기본(전체) 배정을 복사해서 표시
    const isSlotFallback = timeSlotId && data.length === 0;
    if (isSlotFallback) {
      data = await listBusStopDayAssignments(day, direction, undefined);
    }
    const map = new Map<string, StopAssignment>();
    for (const a of data) map.set(a.bus_stop_id, { busNumberId: a.bus_number_id, sortOrder: a.sort_order });
    setDayAssignments(map);
    // fallback 데이터는 서버에 없으므로 serverAssignments를 비워서 dirty 상태로 표시
    serverAssignments.current = isSlotFallback
      ? new Map()
      : new Map(map.entries().map(([k, v]) => [k, { ...v }]));
  }, [day, direction, timeSlotId]);

  const fetchSchedules = useCallback(async () => {
    const data = await listBusStopSchedulesBulk(day, direction, timeSlotId || undefined);
    const map = new Map<string, string>();
    for (const s of data) map.set(s.bus_stop_id, s.estimated_time?.slice(0, 5) ?? "");
    setScheduleMap(map);
    serverSchedules.current = new Map(map);
  }, [day, direction, timeSlotId]);

  useEffect(() => { fetchDayAssignments(); }, [fetchDayAssignments]);
  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  // ── Dirty detection ──

  function computeHasChanges(): boolean {
    const allIds = new Set([...dayAssignments.keys(), ...serverAssignments.current.keys()]);
    for (const id of allIds) {
      const local = dayAssignments.get(id);
      const server = serverAssignments.current.get(id);
      if (!local && server) return true;
      if (local && !server) return true;
      if (local && server && (local.busNumberId !== server.busNumberId || local.sortOrder !== server.sortOrder)) return true;
    }
    const allSchedIds = new Set([...scheduleMap.keys(), ...serverSchedules.current.keys()]);
    for (const id of allSchedIds) {
      if ((scheduleMap.get(id) ?? "") !== (serverSchedules.current.get(id) ?? "")) return true;
    }
    return false;
  }

  const hasChanges = computeHasChanges();

  // ── Filter guard ──

  function guardFilterChange(setter: () => void) {
    if (hasChanges) {
      if (!confirm("저장하지 않은 변경사항이 있습니다. 계속하시겠습니까?")) return;
      setDayAssignments(new Map(serverAssignments.current.entries().map(([k, v]) => [k, { ...v }])));
      setScheduleMap(new Map(serverSchedules.current));
    }
    setter();
  }

  // ── Derived: get ordered stops for a bus ──

  function getAssignedStops(busId: string): BusStop[] {
    return stops
      .filter((s) => dayAssignments.get(s.id)?.busNumberId === busId)
      .sort((a, b) => (dayAssignments.get(a.id)?.sortOrder ?? 0) - (dayAssignments.get(b.id)?.sortOrder ?? 0));
  }

  const unassignedStops = stops.filter((s) => !dayAssignments.has(s.id));
  const filteredUnassigned = search
    ? unassignedStops.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    : unassignedStops;

  // ── Drag & Drop ──

  function handleDragStart(e: React.DragEvent, stopId: string) {
    e.dataTransfer.setData("text/plain", JSON.stringify({ stopId }));
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDropOnBus(e: React.DragEvent, busNumberId: string) {
    e.preventDefault();
    setDragOverTarget(null);
    try {
      const { stopId } = JSON.parse(e.dataTransfer.getData("text/plain"));
      if (dayAssignments.get(stopId)?.busNumberId === busNumberId) return;
      setDayAssignments((prev) => {
        const next = new Map(prev);
        // Append at end: find max sortOrder in this bus
        let maxOrder = -1;
        for (const [, v] of next) {
          if (v.busNumberId === busNumberId && v.sortOrder > maxOrder) maxOrder = v.sortOrder;
        }
        next.set(stopId, { busNumberId, sortOrder: maxOrder + 1 });
        return next;
      });
    } catch { /* ignore */ }
  }

  function handleDropOnStop(e: React.DragEvent, targetStopId: string, targetBusId: string) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(null);
    try {
      const { stopId } = JSON.parse(e.dataTransfer.getData("text/plain"));
      if (stopId === targetStopId) return;

      setDayAssignments((prev) => {
        const next = new Map(prev);
        const sourceBusId = prev.get(stopId)?.busNumberId;

        // Get current ordered list for target bus
        const busStopIds = stops
          .filter((s) => next.get(s.id)?.busNumberId === targetBusId)
          .sort((a, b) => (next.get(a.id)?.sortOrder ?? 0) - (next.get(b.id)?.sortOrder ?? 0))
          .map((s) => s.id);

        // Remove dragged stop from list if it's in the same bus
        const filtered = busStopIds.filter((id) => id !== stopId);

        // Insert before target
        const targetIdx = filtered.indexOf(targetStopId);
        if (targetIdx === -1) {
          // Target not found, just append
          filtered.push(stopId);
        } else {
          filtered.splice(targetIdx, 0, stopId);
        }

        // If coming from a different bus, remove from old bus (already not in filtered)
        if (sourceBusId && sourceBusId !== targetBusId) {
          // Will be re-assigned below
        }

        // Reassign sort orders
        for (let i = 0; i < filtered.length; i++) {
          next.set(filtered[i], { busNumberId: targetBusId, sortOrder: i });
        }

        return next;
      });
    } catch { /* ignore */ }
  }

  function handleDropOnUnassigned(e: React.DragEvent) {
    e.preventDefault();
    setDragOverTarget(null);
    try {
      const { stopId } = JSON.parse(e.dataTransfer.getData("text/plain"));
      if (!dayAssignments.has(stopId)) return;
      setDayAssignments((prev) => {
        const next = new Map(prev);
        next.delete(stopId);
        return next;
      });
    } catch { /* ignore */ }
  }

  function handleDragOver(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverTarget(targetId);
  }

  function handleDragLeave(e: React.DragEvent) {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragOverTarget(null);
  }

  // ── Time editing (local) ──

  function handleTimeChange(stopId: string, newTime: string) {
    setScheduleMap((prev) => {
      const next = new Map(prev);
      if (newTime) next.set(stopId, newTime);
      else next.delete(stopId);
      return next;
    });
  }

  // ── Bulk Save ──

  async function handleSaveAll() {
    setSaving(true);
    const errors: string[] = [];

    // 1. Save day assignments (with sort_order)
    const assignmentArr = [...dayAssignments.entries()].map(([bus_stop_id, a]) => ({
      bus_stop_id,
      bus_number_id: a.busNumberId,
      sort_order: a.sortOrder,
    }));
    const aResult = await saveBusStopDayAssignments(day, assignmentArr, direction, timeSlotId || undefined);
    if (aResult.error) errors.push(`배정 저장: ${aResult.error}`);

    // 2. Save schedule changes
    const slotId = timeSlotId || undefined;
    const allSchedIds = new Set([...scheduleMap.keys(), ...serverSchedules.current.keys()]);
    for (const stopId of allSchedIds) {
      const local = scheduleMap.get(stopId) ?? "";
      const server = serverSchedules.current.get(stopId) ?? "";
      if (local === server) continue;
      if (local) {
        const r = await upsertBusStopSchedule(stopId, day, direction, local, slotId);
        if (r.error) errors.push(`시간 저장: ${r.error}`);
      } else {
        const r = await deleteBusStopSchedule(stopId, day, direction, slotId);
        if (r.error) errors.push(`시간 삭제: ${r.error}`);
      }
    }

    if (errors.length) {
      toast.error(`일부 저장 실패: ${errors.join(", ")}`);
    } else {
      toast.success("저장되었습니다.");
    }

    serverAssignments.current = new Map(dayAssignments.entries().map(([k, v]) => [k, { ...v }]));
    serverSchedules.current = new Map(scheduleMap);
    setSaving(false);
  }

  // ── Copy to all days ──

  async function handleCopyToAllDays(stopId: string) {
    const time = scheduleMap.get(stopId);
    if (!time) {
      toast.error("복사할 시간을 먼저 입력해 주세요.");
      return;
    }
    const dayLabel = DAYS.find((d) => d.value === day)?.label ?? "";
    if (!confirm(`${dayLabel}요일 시간(${time})을 전체 요일에 동일하게 적용하시겠습니까?\n(현재 요일 시간이 미저장이면 먼저 저장해 주세요)`)) return;

    setLoading(true);
    const slotId = timeSlotId || undefined;
    const errors: string[] = [];
    for (const d of DAYS) {
      if (d.value === day) continue;
      const r = await upsertBusStopSchedule(stopId, d.value, direction, time, slotId);
      if (r.error) errors.push(`${d.label}: ${r.error}`);
    }
    if (errors.length) toast.error(errors.join(", "));
    else toast.success("전체 요일에 적용되었습니다.");
    setLoading(false);
  }

  // ── Bus CRUD (immediate) ──

  async function handleCreateBus() {
    if (!newBusLabel.trim()) return;
    setLoading(true);
    const result = await createBusNumber(newBusLabel.trim());
    if (result.error) toast.error(result.error);
    else { setNewBusLabel(""); router.refresh(); }
    setLoading(false);
  }

  async function handleUpdateBus(id: string) {
    if (!editBusLabel.trim()) return;
    setLoading(true);
    const result = await updateBusNumber(id, editBusLabel.trim());
    if (result.error) toast.error(result.error);
    else { setEditingBusId(null); router.refresh(); }
    setLoading(false);
  }

  async function handleDeleteBus(id: string, label: string) {
    if (!confirm(`"${label}" 호차를 삭제하시겠습니까?`)) return;
    setLoading(true);
    const result = await deleteBusNumber(id);
    if (result.error) toast.error(result.error);
    else router.refresh();
    setLoading(false);
  }

  // ── Stop CRUD (immediate) ──

  async function handleCreateStop() {
    if (!newStopName.trim()) return;
    setLoading(true);
    const result = await createBusStop(newStopName.trim());
    if (result.error) {
      toast.error(result.error);
    } else {
      const name = newStopName.trim();
      setNewStopName("");
      setStops((prev) => [...prev, {
        id: result.id!, bus_number_id: null, name,
        sort_order: prev.length, is_active: true, created_at: "", updated_at: "",
      }]);
    }
    setLoading(false);
  }

  async function handleUpdateStop(stopId: string) {
    if (!editStopName.trim()) return;
    setLoading(true);
    const result = await updateBusStop(stopId, editStopName.trim());
    if (result.error) {
      toast.error(result.error);
    } else {
      setEditingStopId(null);
      setStops((prev) => prev.map((s) => (s.id === stopId ? { ...s, name: editStopName.trim() } : s)));
    }
    setLoading(false);
  }

  async function handleDeleteStop(stopId: string) {
    if (!confirm("정류장을 삭제하시겠습니까?")) return;
    setLoading(true);
    const result = await deleteBusStop(stopId);
    if (result.error) toast.error(result.error);
    else {
      setStops((prev) => prev.filter((s) => s.id !== stopId));
      setDayAssignments((prev) => { const n = new Map(prev); n.delete(stopId); return n; });
      serverAssignments.current.delete(stopId);
      setScheduleMap((prev) => { const n = new Map(prev); n.delete(stopId); return n; });
      serverSchedules.current.delete(stopId);
    }
    setLoading(false);
  }

  // ── Dirty helper ──

  function isStopDirty(stopId: string): boolean {
    const local = dayAssignments.get(stopId);
    const server = serverAssignments.current.get(stopId);
    if (!local && !server) return false;
    if (!local || !server) return true;
    if (local.busNumberId !== server.busNumberId || local.sortOrder !== server.sortOrder) return true;
    return (scheduleMap.get(stopId) ?? "") !== (serverSchedules.current.get(stopId) ?? "");
  }

  // ── Render ──

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          {DAYS.map((d) => (
            <button
              key={d.value}
              onClick={() => guardFilterChange(() => setDay(d.value))}
              className={`w-8 h-8 text-xs rounded font-medium transition-colors ${
                day === d.value
                  ? "bg-slate-800 text-white"
                  : "bg-white text-slate-500 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          <button
            onClick={() => guardFilterChange(() => { setDirection("pickup"); setTimeSlotId(""); })}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              direction === "pickup" ? "bg-blue-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            등원
          </button>
          <button
            onClick={() => guardFilterChange(() => { setDirection("dropoff"); setTimeSlotId(""); })}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              direction === "dropoff" ? "bg-orange-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            하원
          </button>
        </div>

        <select
          value={timeSlotId}
          onChange={(e) => guardFilterChange(() => setTimeSlotId(e.target.value))}
          className="h-8 text-xs border border-slate-200 rounded px-2 bg-white"
        >
          <option value="">전체 (기본)</option>
          {filteredSlots.map((slot) => (
            <option key={slot.id} value={slot.id}>
              {slot.label} ({slot.time.slice(0, 5)})
            </option>
          ))}
        </select>

        <Button
          size="sm"
          className={`h-8 ml-auto ${hasChanges ? "bg-blue-600 hover:bg-blue-700" : ""}`}
          onClick={handleSaveAll}
          disabled={saving || !hasChanges}
        >
          {saving ? "저장 중..." : hasChanges ? "저장" : "저장됨"}
        </Button>
      </div>

      {hasChanges && (
        <p className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded border border-amber-200">
          저장하지 않은 변경사항이 있습니다.
        </p>
      )}

      {/* New bus */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">새 호차:</span>
        <Input
          placeholder="호차 이름 (예: 1호차)"
          value={newBusLabel}
          onChange={(e) => setNewBusLabel(e.target.value)}
          className="max-w-48 h-8 text-sm"
          onKeyDown={(e) => { if (e.key === "Enter" && newBusLabel.trim()) handleCreateBus(); }}
        />
        <Button size="sm" className="h-8" onClick={handleCreateBus} disabled={loading || !newBusLabel.trim()}>
          추가
        </Button>
      </div>

      {/* 2-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT: Bus cards */}
        <div className="lg:col-span-2 space-y-3">
          {busNumbers.length === 0 && (
            <p className="text-xs text-slate-400 py-8 text-center">등록된 호차가 없습니다.</p>
          )}
          {busNumbers.map((bus) => {
            const busStops = getAssignedStops(bus.id);
            const isDropTarget = dragOverTarget === `bus-${bus.id}`;

            return (
              <div
                key={bus.id}
                className={`rounded-lg border transition-colors ${
                  isDropTarget ? "border-emerald-400 bg-emerald-50/50" : "border-slate-200 bg-white"
                }`}
                onDragOver={(e) => handleDragOver(e, `bus-${bus.id}`)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDropOnBus(e, bus.id)}
              >
                {/* Bus header */}
                <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50 rounded-t-lg">
                  {editingBusId === bus.id ? (
                    <>
                      <Input
                        value={editBusLabel}
                        onChange={(e) => setEditBusLabel(e.target.value)}
                        className="max-w-36 h-7 text-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleUpdateBus(bus.id);
                          if (e.key === "Escape") setEditingBusId(null);
                        }}
                        autoFocus
                      />
                      <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => handleUpdateBus(bus.id)} disabled={loading}>저장</Button>
                      <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingBusId(null)}>취소</Button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm">🚌</span>
                      <span className="text-sm font-semibold text-slate-700 flex-1">{bus.label}</span>
                      <span className="text-xs text-slate-400">{busStops.length}개 정류장</span>
                      <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { setEditingBusId(bus.id); setEditBusLabel(bus.label); }}>수정</Button>
                      <Button size="sm" variant="ghost" className="h-6 text-xs text-red-500 hover:text-red-700" onClick={() => handleDeleteBus(bus.id, bus.label)} disabled={loading}>삭제</Button>
                    </>
                  )}
                </div>

                {/* Assigned stops — each is a drop target for reordering */}
                <div className="p-2 space-y-1 min-h-[48px]">
                  {busStops.map((stop) => (
                    <div
                      key={stop.id}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverTarget(`stop-${stop.id}`); }}
                      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverTarget(null); }}
                      onDrop={(e) => handleDropOnStop(e, stop.id, bus.id)}
                    >
                      <StopRow
                        stop={stop}
                        time={scheduleMap.get(stop.id) ?? ""}
                        isDirty={isStopDirty(stop.id)}
                        isDropTarget={dragOverTarget === `stop-${stop.id}`}
                        onDragStart={(e) => handleDragStart(e, stop.id)}
                        onTimeChange={(time) => handleTimeChange(stop.id, time)}
                        onCopyAllDays={() => handleCopyToAllDays(stop.id)}
                      />
                    </div>
                  ))}
                  {busStops.length === 0 && (
                    <p className="text-xs text-slate-300 text-center py-3">여기에 정류장을 드래그하세요</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* RIGHT: Unassigned stops */}
        <div
          className={`lg:col-span-1 rounded-lg border p-3 space-y-3 lg:sticky lg:top-4 lg:self-start transition-colors ${
            dragOverTarget === "unassigned" ? "border-orange-400 bg-orange-50/50" : "border-slate-200 bg-slate-50"
          }`}
          onDragOver={(e) => handleDragOver(e, "unassigned")}
          onDragLeave={handleDragLeave}
          onDrop={handleDropOnUnassigned}
        >
          <h4 className="text-xs font-semibold text-slate-600">
            미배정 정류장
            <span className="ml-1 font-normal text-slate-400">({DAYS.find((d) => d.value === day)?.label}요일)</span>
          </h4>

          <Input placeholder="검색..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 text-xs" />

          <div className="flex items-center gap-1">
            <Input
              placeholder="새 정류장"
              value={newStopName}
              onChange={(e) => setNewStopName(e.target.value)}
              className="h-7 text-xs flex-1"
              onKeyDown={(e) => { if (e.key === "Enter" && newStopName.trim()) handleCreateStop(); }}
            />
            <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={handleCreateStop} disabled={loading || !newStopName.trim()}>+</Button>
          </div>

          <div className="space-y-1 max-h-[60vh] overflow-y-auto">
            {filteredUnassigned.length === 0 && (
              <p className="text-xs text-slate-400 py-4 text-center">
                {search ? "검색 결과 없음" : "미배정 정류장 없음"}
              </p>
            )}
            {filteredUnassigned.map((stop) => (
              <div
                key={stop.id}
                draggable
                onDragStart={(e) => handleDragStart(e, stop.id)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded border cursor-grab active:cursor-grabbing hover:border-slate-300 transition-colors ${
                  isStopDirty(stop.id) ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200"
                }`}
              >
                {editingStopId === stop.id ? (
                  <>
                    <Input
                      value={editStopName}
                      onChange={(e) => setEditStopName(e.target.value)}
                      className="h-6 text-xs flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleUpdateStop(stop.id);
                        if (e.key === "Escape") setEditingStopId(null);
                      }}
                      autoFocus
                    />
                    <Button size="sm" variant="outline" className="h-5 text-[10px] px-1.5" onClick={() => handleUpdateStop(stop.id)}>저장</Button>
                  </>
                ) : (
                  <>
                    <span className="text-xs text-slate-400">📍</span>
                    <span className="text-xs text-slate-700 flex-1">{stop.name}</span>
                    <button className="text-[10px] text-slate-400 hover:text-slate-600" onClick={() => { setEditingStopId(stop.id); setEditStopName(stop.name); }}>수정</button>
                    <button className="text-[10px] text-red-400 hover:text-red-600" onClick={() => handleDeleteStop(stop.id)}>×</button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── StopRow (assigned, left panel) ──

function StopRow({
  stop,
  time,
  isDirty,
  isDropTarget,
  onDragStart,
  onTimeChange,
  onCopyAllDays,
}: {
  stop: BusStop;
  time: string;
  isDirty: boolean;
  isDropTarget: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onTimeChange: (time: string) => void;
  onCopyAllDays: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`flex items-center gap-2 px-2 py-1.5 rounded border cursor-grab active:cursor-grabbing transition-colors group ${
        isDropTarget
          ? "border-blue-400 bg-blue-50 border-dashed"
          : isDirty
            ? "bg-amber-50 border-amber-200"
            : "bg-slate-50 border-slate-100 hover:border-slate-200"
      }`}
    >
      <span className="text-xs text-slate-400">📍</span>
      <span className="text-xs text-slate-700 min-w-[60px]">{stop.name}</span>
      <input
        type="time"
        value={time}
        onChange={(e) => onTimeChange(e.target.value)}
        className="h-6 text-xs border border-slate-200 rounded px-1.5 bg-white w-[90px]"
      />
      <button
        onClick={onCopyAllDays}
        title="이 시간을 월~금 전체 요일에 동일하게 적용합니다"
        className="text-[10px] text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
      >
        전체 요일 적용
      </button>
    </div>
  );
}
