"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/overlays/ConfirmDialog";
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
  copyBusDayDataToOtherDays,
  getBusDayDataCounts,
} from "@/app/(admin)/admin/actions/bus-actions";
import { BUS_WEEKDAYS as DAYS } from "@/lib/constants/bus";
import { useBusDirtyFilter, type StopAssignment } from "../_hooks/useBusDirtyFilter";
import { DayTimeFilterBar } from "./DayTimeFilterBar";

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
  const [timeSlotId, setTimeSlotId] = useState("");

  // Master stop list
  const [stops, setStops] = useState<BusStop[]>(initialStops);

  // Per-day assignment + schedule + dirty/필터 가드 — BusStopAssignmentManager 와 공유.
  const {
    dayAssignments, setDayAssignments,
    serverAssignments, setServerAssignments,
    scheduleMap, setScheduleMap,
    serverSchedules, setServerSchedules,
    hasChanges,
    filterChangeConfirm,
    guardFilterChange,
    confirmFilterChange,
    closeFilterConfirm,
  } = useBusDirtyFilter();

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
  const [deleteBusConfirm, setDeleteBusConfirm] = useState<{ open: boolean; id?: string; label?: string }>({ open: false });
  const [deleteStopConfirm, setDeleteStopConfirm] = useState<{ open: boolean; id?: string; name?: string }>({ open: false });
  // 다른 요일에 복사 모달
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copyTargets, setCopyTargets] = useState<Set<number>>(new Set());
  const [copyCounts, setCopyCounts] = useState<Record<number, { assignments: number; schedules: number }> | null>(null);
  const [copyLoading, setCopyLoading] = useState(false);
  const [copyExecuting, setCopyExecuting] = useState(false);

  const filteredSlots = busTimeSlots;

  // ── Fetch ──

  const fetchDayAssignments = useCallback(async () => {
    let data = await listBusStopDayAssignments(day, timeSlotId || undefined);
    // 특정 시간대 선택 시 데이터가 없으면 기본(전체) 배정을 복사해서 표시
    const isSlotFallback = timeSlotId && data.length === 0;
    if (isSlotFallback) {
      data = await listBusStopDayAssignments(day, undefined);
    }
    const map = new Map<string, StopAssignment>();
    for (const a of data) map.set(a.bus_stop_id, { busNumberId: a.bus_number_id, sortOrder: a.sort_order });
    setDayAssignments(map);
    // fallback 데이터는 서버에 없으므로 serverAssignments를 비워서 dirty 상태로 표시
    setServerAssignments(
      isSlotFallback
        ? new Map()
        : new Map([...map].map(([k, v]) => [k, { ...v }]))
    );
  }, [day, timeSlotId, setDayAssignments, setServerAssignments]);

  const fetchSchedules = useCallback(async () => {
    const data = await listBusStopSchedulesBulk(day, timeSlotId || undefined);
    const map = new Map<string, string>();
    for (const s of data) map.set(s.bus_stop_id, s.estimated_time?.slice(0, 5) ?? "");
    setScheduleMap(map);
    setServerSchedules(new Map(map));
  }, [day, timeSlotId, setScheduleMap, setServerSchedules]);

  // async fetch → setState. setter 는 useBusDirtyFilter 가 useState 로 만든 stable ref.
  useEffect(() => { fetchDayAssignments(); }, [fetchDayAssignments]);
  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

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

        // 대상 호차의 현재 정렬된 정류장 id 목록
        const busStopIds = stops
          .filter((s) => next.get(s.id)?.busNumberId === targetBusId)
          .sort((a, b) => (next.get(a.id)?.sortOrder ?? 0) - (next.get(b.id)?.sortOrder ?? 0))
          .map((s) => s.id);

        // 같은 호차 내 이동이면 dragged 를 목록에서 제거 후 target 앞에 재삽입
        const filtered = busStopIds.filter((id) => id !== stopId);
        const targetIdx = filtered.indexOf(targetStopId);
        if (targetIdx === -1) filtered.push(stopId);
        else filtered.splice(targetIdx, 0, stopId);

        // sort_order 재할당 (다른 호차에서 온 경우 자동으로 호차 이동)
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
    const aResult = await saveBusStopDayAssignments(day, assignmentArr, timeSlotId || undefined);
    if (aResult.error) errors.push(`배정 저장: ${aResult.error}`);

    // 2. Save schedule changes
    const slotId = timeSlotId || undefined;
    const allSchedIds = new Set([...scheduleMap.keys(), ...serverSchedules.keys()]);
    for (const stopId of allSchedIds) {
      const local = scheduleMap.get(stopId) ?? "";
      const server = serverSchedules.get(stopId) ?? "";
      if (local === server) continue;
      if (local) {
        const r = await upsertBusStopSchedule(stopId, day, local, slotId);
        if (r.error) errors.push(`시간 저장: ${r.error}`);
      } else {
        const r = await deleteBusStopSchedule(stopId, day, slotId);
        if (r.error) errors.push(`시간 삭제: ${r.error}`);
      }
    }

    if (errors.length) {
      toast.error(`일부 저장 실패: ${errors.join(", ")}`);
    } else {
      toast.success("저장되었습니다.");
    }

    setServerAssignments(new Map([...dayAssignments].map(([k, v]) => [k, { ...v }])));
    setServerSchedules(new Map(scheduleMap));
    setSaving(false);
  }

  // ── 다른 요일에 복사 (요일×시간대 단위 일괄) ──

  async function openCopyModal() {
    if (hasChanges) {
      toast.error("저장하지 않은 변경사항이 있습니다. 먼저 저장해 주세요.");
      return;
    }
    setCopyTargets(new Set());
    setCopyCounts(null);
    setCopyModalOpen(true);
    setCopyLoading(true);
    const counts = await getBusDayDataCounts(timeSlotId || undefined);
    setCopyCounts(counts);
    setCopyLoading(false);
  }

  function toggleCopyTarget(d: number) {
    setCopyTargets((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }

  async function executeCopy() {
    if (copyTargets.size === 0) {
      toast.error("복사할 요일을 선택해 주세요.");
      return;
    }
    setCopyExecuting(true);
    const result = await copyBusDayDataToOtherDays(
      day,
      [...copyTargets],
      timeSlotId || undefined
    );
    setCopyExecuting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    const labels = [...copyTargets]
      .sort()
      .map((d) => DAYS.find((x) => x.value === d)?.label)
      .join(", ");
    toast.success(`${labels}요일에 복사되었습니다.`);
    setCopyModalOpen(false);
    // 데이터 재조회
    await fetchDayAssignments();
    await fetchSchedules();
    router.refresh();
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

  function handleDeleteBus(id: string, label: string) {
    setDeleteBusConfirm({ open: true, id, label });
  }

  async function confirmDeleteBus() {
    const id = deleteBusConfirm.id;
    setDeleteBusConfirm({ open: false });
    if (!id) return;
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

  function handleDeleteStop(stopId: string) {
    const stop = stops.find((s) => s.id === stopId);
    setDeleteStopConfirm({ open: true, id: stopId, name: stop?.name });
  }

  async function confirmDeleteStop() {
    const stopId = deleteStopConfirm.id;
    setDeleteStopConfirm({ open: false });
    if (!stopId) return;
    setLoading(true);
    const result = await deleteBusStop(stopId);
    if (result.error) toast.error(result.error);
    else {
      setStops((prev) => prev.filter((s) => s.id !== stopId));
      setDayAssignments((prev) => { const n = new Map(prev); n.delete(stopId); return n; });
      setServerAssignments((prev) => { const n = new Map(prev); n.delete(stopId); return n; });
      setScheduleMap((prev) => { const n = new Map(prev); n.delete(stopId); return n; });
      setServerSchedules((prev) => { const n = new Map(prev); n.delete(stopId); return n; });
    }
    setLoading(false);
  }

  // ── Dirty helper ──

  function isStopDirty(stopId: string): boolean {
    const local = dayAssignments.get(stopId);
    const server = serverAssignments.get(stopId);
    if (!local && !server) return false;
    if (!local || !server) return true;
    if (local.busNumberId !== server.busNumberId || local.sortOrder !== server.sortOrder) return true;
    return (scheduleMap.get(stopId) ?? "") !== (serverSchedules.get(stopId) ?? "");
  }

  // ── Render ──

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <DayTimeFilterBar
          day={day}
          onDayChange={(d) => guardFilterChange(() => setDay(d))}
          timeSlotId={timeSlotId}
          onTimeSlotChange={(id) => guardFilterChange(() => setTimeSlotId(id))}
          timeSlots={filteredSlots}
          includeAllSlotsOption
        />

        <Button
          size="sm"
          variant="outline"
          className="h-8 ml-auto"
          onClick={openCopyModal}
          disabled={loading || saving || hasChanges}
          title={hasChanges ? "저장하지 않은 변경사항이 있습니다" : "이 요일·시간대의 호차별 정류장 배정과 시간을 다른 요일에 복사"}
        >
          다른 요일에 복사
        </Button>

        <Button
          size="sm"
          className={`h-8 ${hasChanges ? "bg-blue-600 hover:bg-blue-700" : ""}`}
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
                    <Button size="sm" variant="outline" className="h-5 text-xs px-1.5" onClick={() => handleUpdateStop(stop.id)}>저장</Button>
                  </>
                ) : (
                  <>
                    <span className="text-xs text-slate-400">📍</span>
                    <span className="text-xs text-slate-700 flex-1">{stop.name}</span>
                    <button className="text-xs text-slate-400 hover:text-slate-600" onClick={() => { setEditingStopId(stop.id); setEditStopName(stop.name); }}>수정</button>
                    <button className="text-xs text-red-400 hover:text-red-600" onClick={() => handleDeleteStop(stop.id)}>×</button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteBusConfirm.open}
        title={`"${deleteBusConfirm.label ?? ""}" 호차를 삭제하시겠습니까?`}
        description="이 호차에 배정된 학생/정류장이 있으면 함께 영향을 받습니다."
        impactList={[
          "이 호차에 배정된 정류장이 미배정 상태가 됩니다.",
          "이 호차를 참조하는 학생 배정·변경 요청에 영향이 갈 수 있습니다.",
        ]}
        danger
        confirmLabel="삭제"
        onConfirm={confirmDeleteBus}
        onCancel={() => setDeleteBusConfirm({ open: false })}
      />

      <ConfirmDialog
        open={deleteStopConfirm.open}
        title={`${deleteStopConfirm.name ? `"${deleteStopConfirm.name}" ` : ""}정류장을 삭제하시겠습니까?`}
        description="이 정류장에 의존하는 데이터에 영향을 줄 수 있습니다."
        impactList={[
          "이 정류장을 기본 배정으로 사용하는 학생이 미배정 상태가 됩니다.",
          "이 정류장이 포함된 스케줄·변경 요청에 영향이 갈 수 있습니다.",
        ]}
        danger
        confirmLabel="삭제"
        onConfirm={confirmDeleteStop}
        onCancel={() => setDeleteStopConfirm({ open: false })}
      />

      {/* 다른 요일에 복사 모달 */}
      {copyModalOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => !copyExecuting && setCopyModalOpen(false)}
          />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200">
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-800">다른 요일에 복사</h3>
              <p className="text-xs text-slate-500 mt-1">
                <span className="font-medium text-slate-700">{DAYS.find((d) => d.value === day)?.label}요일</span>
                {timeSlotId
                  ? ` · ${busTimeSlots.find((s) => s.id === timeSlotId)?.label ?? ""}`
                  : " · 전체 시간대 (기본)"}
                의 호차별 정류장 배정과 시간을 선택한 요일에 <span className="font-semibold text-red-600">덮어쓰기</span>합니다.
              </p>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs font-medium text-slate-600">복사할 요일 선택</p>
              <div className="space-y-2">
                {DAYS.filter((d) => d.value !== day).map((d) => {
                  const cnt = copyCounts?.[d.value];
                  const willOverwrite = (cnt?.assignments ?? 0) + (cnt?.schedules ?? 0) > 0;
                  const checked = copyTargets.has(d.value);
                  return (
                    <label
                      key={d.value}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                        checked
                          ? "border-blue-400 bg-blue-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCopyTarget(d.value)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium text-slate-800 w-12">{d.label}요일</span>
                      <span className="text-xs text-slate-500 flex-1">
                        {copyLoading
                          ? "확인 중..."
                          : willOverwrite
                            ? `기존 ${cnt?.assignments ?? 0}개 배정·${cnt?.schedules ?? 0}개 시간 → 덮어쓰기`
                            : "기존 데이터 없음"}
                      </span>
                      {willOverwrite && checked && (
                        <span className="text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                          덮어쓰기
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50 rounded-b-xl">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCopyModalOpen(false)}
                disabled={copyExecuting}
              >
                취소
              </Button>
              <Button
                size="sm"
                onClick={executeCopy}
                disabled={copyExecuting || copyLoading || copyTargets.size === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {copyExecuting ? "복사 중..." : `복사 (${copyTargets.size}개 요일)`}
              </Button>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={filterChangeConfirm.open}
        variant="primary"
        title="저장하지 않은 변경사항이 있습니다"
        description="계속하면 지금까지의 변경이 사라집니다. 계속하시겠습니까?"
        confirmLabel="계속"
        onConfirm={confirmFilterChange}
        onCancel={closeFilterConfirm}
      />
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
}: {
  stop: BusStop;
  time: string;
  isDirty: boolean;
  isDropTarget: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onTimeChange: (time: string) => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`flex items-center gap-2 px-2 py-1.5 rounded border cursor-grab active:cursor-grabbing transition-colors ${
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
    </div>
  );
}
