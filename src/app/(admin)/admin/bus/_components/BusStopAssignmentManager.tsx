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
  saveBusStopSchedules,
} from "@/app/(admin)/admin/actions/bus-actions";
import { BUS_WEEKDAYS } from "@/lib/constants/bus";
import { useBusDirtyFilter, type StopAssignment } from "../_hooks/useBusDirtyFilter";

const DAY_GROUPS = [
  { key: "mwf", label: "월수금", days: [1, 3, 5] },
  { key: "tt", label: "화목", days: [2, 4] },
] as const;

const dayLabel = (d: number) => BUS_WEEKDAYS.find((x) => x.value === d)?.label ?? "";

// 배정·시간 Map 의 키 = `요일|정류장|호차`. 한 정류장이 여러 호차에 들어갈 수 있다.
const ck = (day: number, stopId: string, busId: string) => `${day}|${stopId}|${busId}`;
const parseKey = (key: string) => {
  const [d, stopId, busId] = key.split("|");
  return { day: Number(d), stopId, busId };
};

// 드래그 payload — from 이 없으면 사이드바에서 끌어온 것 (추가)
type DragData = { stopId: string; from?: { day: number; busId: string } };

export function BusStopAssignmentManager({
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
  const [groupIdx, setGroupIdx] = useState(0);
  const [timeSlotId, setTimeSlotId] = useState(() => busTimeSlots[0]?.id ?? "");
  const days: readonly number[] = DAY_GROUPS[groupIdx].days;

  // Master stop list (정류장 CRUD 는 즉시 반영)
  const [stops, setStops] = useState<BusStop[]>(initialStops);

  // 배정(요일|정류장|호차 → 순서) + 시간 + dirty/필터 가드
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
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  // 호차·정류장 CRUD
  const [loading, setLoading] = useState(false);
  const [newBusLabel, setNewBusLabel] = useState("");
  const [newStopName, setNewStopName] = useState("");
  const [editingBusId, setEditingBusId] = useState<string | null>(null);
  const [editBusLabel, setEditBusLabel] = useState("");
  const [editingStopId, setEditingStopId] = useState<string | null>(null);
  const [editStopName, setEditStopName] = useState("");
  const [deleteBusConfirm, setDeleteBusConfirm] = useState<{ open: boolean; id?: string; label?: string }>({ open: false });
  const [deleteStopConfirm, setDeleteStopConfirm] = useState<{ open: boolean; id?: string; name?: string }>({ open: false });

  // ── Fetch ──

  const fetchData = useCallback(async () => {
    const dayList = [...days];
    const [rows, schedules] = await Promise.all([
      listBusStopDayAssignments(dayList, timeSlotId),
      listBusStopSchedulesBulk(dayList, timeSlotId),
    ]);

    const local = new Map<string, StopAssignment>();
    const server = new Map<string, StopAssignment>();
    for (const a of rows) {
      const v = { busNumberId: a.bus_number_id, sortOrder: a.sort_order };
      local.set(ck(a.day_of_week, a.bus_stop_id, a.bus_number_id), v);
      server.set(ck(a.day_of_week, a.bus_stop_id, a.bus_number_id), { ...v });
    }
    setDayAssignments(local);
    setServerAssignments(server);

    const times = new Map<string, string>();
    for (const s of schedules) {
      if (s.bus_number_id) times.set(ck(s.day_of_week, s.bus_stop_id, s.bus_number_id), s.estimated_time?.slice(0, 5) ?? "");
    }
    setScheduleMap(times);
    setServerSchedules(new Map(times));
  }, [days, timeSlotId, setDayAssignments, setServerAssignments, setScheduleMap, setServerSchedules]);

  // async fetch → setState. setter 는 useBusDirtyFilter 가 useState 로 만든 stable ref.
  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Derived ──

  // sort_order 가 같으면 정류장 목록 순서(sort_order, name)로 — 예전 편집기와 동일
  const stopIndex = new Map(stops.map((s, i) => [s.id, i]));
  function cellStops(map: Map<string, StopAssignment>, day: number, busId: string): string[] {
    return [...map.entries()]
      .filter(([k]) => { const p = parseKey(k); return p.day === day && p.busId === busId; })
      .map(([k, v]) => ({ stopId: parseKey(k).stopId, sortOrder: v.sortOrder }))
      .sort((a, b) => a.sortOrder - b.sortOrder || (stopIndex.get(a.stopId) ?? 0) - (stopIndex.get(b.stopId) ?? 0))
      .map((x) => x.stopId);
  }

  function isCellDirty(day: number, busId: string): boolean {
    const local = cellStops(dayAssignments, day, busId);
    const server = cellStops(serverAssignments, day, busId);
    if (local.join(",") !== server.join(",")) return true;
    const ids = new Set([...local, ...server]);
    for (const id of ids) {
      const k = ck(day, id, busId);
      if ((scheduleMap.get(k) ?? "") !== (serverSchedules.get(k) ?? "")) return true;
    }
    return false;
  }

  // 정류장 → 보이는 요일들에서 이 정류장을 쓰는 호차 id 집합
  const busesByStop = new Map<string, Set<string>>();
  for (const k of dayAssignments.keys()) {
    const { day, stopId, busId } = parseKey(k);
    if (!days.includes(day)) continue;
    if (!busesByStop.has(stopId)) busesByStop.set(stopId, new Set());
    busesByStop.get(stopId)!.add(busId);
  }

  const stopNameMap = new Map(stops.map((s) => [s.id, s.name]));
  const sidebarStops = stops
    .filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()))
    .filter((s) => !onlyUnassigned || !busesByStop.has(s.id))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  function busTag(stopId: string): string {
    const used = busesByStop.get(stopId);
    if (!used) return "-";
    return busNumbers
      .filter((b) => used.has(b.id))
      .map((b) => b.label.replace(/호차$/, ""))
      .join("·");
  }

  // ── Mutations (local) ──

  // (요일, 호차) 셀을 주어진 정류장 순서로 교체
  function writeCell(next: Map<string, StopAssignment>, day: number, busId: string, stopIds: string[]) {
    for (const k of [...next.keys()]) {
      const p = parseKey(k);
      if (p.day === day && p.busId === busId) next.delete(k);
    }
    stopIds.forEach((id, i) => next.set(ck(day, id, busId), { busNumberId: busId, sortOrder: i }));
  }

  function setTime(key: string, time: string | undefined) {
    setScheduleMap((prev) => {
      const next = new Map(prev);
      if (time) next.set(key, time);
      else next.delete(key);
      return next;
    });
  }

  function handleDrop(e: React.DragEvent, day: number, busId: string, beforeStopId?: string) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(null);
    let data: DragData;
    try { data = JSON.parse(e.dataTransfer.getData("text/plain")); } catch { return; }
    const { stopId, from } = data;
    if (!stopId) return;
    const sameCell = from?.day === day && from?.busId === busId;
    const target = cellStops(dayAssignments, day, busId);
    // 사이드바 → 이미 있는 셀: 무시
    if (!from && target.includes(stopId)) return;

    const next = new Map(dayAssignments);
    if (from && !sameCell) {
      // 이동: 출발 셀에서 제거. 시간은 대상에 없을 때만 따라감
      writeCell(next, from.day, from.busId, cellStops(dayAssignments, from.day, from.busId).filter((id) => id !== stopId));
      const fromKey = ck(from.day, stopId, from.busId);
      const toKey = ck(day, stopId, busId);
      const time = scheduleMap.get(fromKey);
      setTime(fromKey, undefined);
      if (time && !target.includes(stopId)) setTime(toKey, time);
      if (target.includes(stopId)) { setDayAssignments(next); return; }
    }
    const list = target.filter((id) => id !== stopId);
    const idx = beforeStopId ? list.indexOf(beforeStopId) : -1;
    if (idx === -1) list.push(stopId);
    else list.splice(idx, 0, stopId);
    writeCell(next, day, busId, list);
    setDayAssignments(next);
  }

  function removeFromCell(day: number, busId: string, stopId: string) {
    const next = new Map(dayAssignments);
    writeCell(next, day, busId, cellStops(dayAssignments, day, busId).filter((id) => id !== stopId));
    setDayAssignments(next);
    setTime(ck(day, stopId, busId), undefined);
  }

  // 이 셀(정류장·순서·시간)을 같은 호차의 다른 보이는 요일에 덮어쓰기
  function applyToOtherDays(day: number, busId: string) {
    const list = cellStops(dayAssignments, day, busId);
    const others = days.filter((d) => d !== day);
    const next = new Map(dayAssignments);
    for (const d of others) writeCell(next, d, busId, list);
    setDayAssignments(next);
    setScheduleMap((prev) => {
      const times = new Map(prev);
      for (const d of others) {
        for (const k of [...times.keys()]) {
          const p = parseKey(k);
          if (p.day === d && p.busId === busId) times.delete(k);
        }
        for (const id of list) {
          const t = prev.get(ck(day, id, busId));
          if (t) times.set(ck(d, id, busId), t);
        }
      }
      return times;
    });
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

  async function confirmDeleteStop() {
    const stopId = deleteStopConfirm.id;
    setDeleteStopConfirm({ open: false });
    if (!stopId) return;
    setLoading(true);
    const result = await deleteBusStop(stopId);
    if (result.error) toast.error(result.error);
    else {
      setStops((prev) => prev.filter((s) => s.id !== stopId));
      // 이 정류장의 모든 (요일, 호차) 키 제거
      const drop = <V,>(prev: Map<string, V>) => new Map([...prev].filter(([k]) => parseKey(k).stopId !== stopId));
      setDayAssignments(drop);
      setServerAssignments(drop);
      setScheduleMap(drop);
      setServerSchedules(drop);
    }
    setLoading(false);
  }

  // ── Bulk Save ──

  async function handleSaveAll() {
    setSaving(true);
    const errors: string[] = [];
    const slotId = timeSlotId;

    // 1. 배정 — 바뀐 요일만 통째로 교체
    const dirtyDays = days.filter((d) => {
      const local = [...dayAssignments].filter(([k]) => parseKey(k).day === d);
      const server = [...serverAssignments].filter(([k]) => parseKey(k).day === d);
      return local.length !== server.length
        || local.some(([k, v]) => serverAssignments.get(k)?.sortOrder !== v.sortOrder);
    });
    if (dirtyDays.length) {
      const rows = [...dayAssignments.entries()]
        .map(([k, a]) => ({ ...parseKey(k), a }))
        .filter((r) => dirtyDays.includes(r.day))
        .map((r) => ({ day_of_week: r.day, bus_stop_id: r.stopId, bus_number_id: r.busId, sort_order: r.a.sortOrder }));
      const r = await saveBusStopDayAssignments([...dirtyDays], rows, slotId);
      if (r.error) errors.push(`배정 저장: ${r.error}`);
    }

    // 2. 도착 예정 시간 — 바뀐 (요일, 정류장, 호차) 만
    const allKeys = new Set([...scheduleMap.keys(), ...serverSchedules.keys()]);
    const changes = [...allKeys]
      .filter((k) => (scheduleMap.get(k) ?? "") !== (serverSchedules.get(k) ?? ""))
      .map((k) => {
        const p = parseKey(k);
        return { day_of_week: p.day, bus_stop_id: p.stopId, bus_number_id: p.busId, estimated_time: scheduleMap.get(k) || null };
      });
    if (changes.length) {
      const r = await saveBusStopSchedules(changes, slotId);
      if (r.error) errors.push(`시간 저장: ${r.error}`);
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

  // ── Render ──

  return (
    <div className="space-y-4">
      {/* 툴바: 시간대 · 요일 묶음 · 저장 */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={timeSlotId}
          onChange={(e) => { const id = e.target.value; guardFilterChange(() => setTimeSlotId(id)); }}
          className="h-8 text-xs border border-slate-200 rounded px-2 bg-white"
        >
          {busTimeSlots.map((slot) => (
            <option key={slot.id} value={slot.id}>
              {slot.label} ({slot.time.slice(0, 5)})
            </option>
          ))}
        </select>

        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          {DAY_GROUPS.map((g, i) => (
            <button
              key={g.key}
              type="button"
              onClick={() => { if (i !== groupIdx) guardFilterChange(() => setGroupIdx(i)); }}
              className={`px-3.5 py-1.5 text-sm font-medium transition-colors ${
                groupIdx === i
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

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

      {/* 새 호차 */}
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

      <div className="flex gap-4 items-start">
        {/* 왼쪽: 전체 정류장 (sticky) */}
        <div className="w-56 shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2 sticky top-4">
          <h4 className="text-xs font-semibold text-slate-600">정류장</h4>
          <Input
            placeholder="검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 text-xs"
          />
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyUnassigned}
              onChange={(e) => setOnlyUnassigned(e.target.checked)}
            />
            미배정만 보기
          </label>
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
          <div className="space-y-1 max-h-[65vh] overflow-y-auto">
            {sidebarStops.length === 0 && (
              <p className="text-xs text-slate-400 py-4 text-center">
                {search ? "검색 결과 없음" : "정류장 없음"}
              </p>
            )}
            {sidebarStops.map((stop) => {
              const tag = busTag(stop.id);
              return (
                <div
                  key={stop.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", JSON.stringify({ stopId: stop.id } satisfies DragData));
                    e.dataTransfer.effectAllowed = "copyMove";
                  }}
                  className="flex items-center gap-2 px-2 py-1.5 rounded border cursor-grab active:cursor-grabbing hover:border-slate-300 bg-white border-slate-200 transition-colors"
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
                      <Button size="sm" variant="outline" className="h-5 text-xs px-1.5" onClick={() => handleUpdateStop(stop.id)} disabled={loading}>저장</Button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-slate-700 flex-1 truncate">{stop.name}</span>
                      <span className={`text-[11px] ${tag === "-" ? "text-orange-400" : "text-slate-400"}`}>{tag}</span>
                      <button type="button" className="text-[11px] text-slate-400 hover:text-slate-600" onClick={() => { setEditingStopId(stop.id); setEditStopName(stop.name); }}>수정</button>
                      <button type="button" className="text-xs text-red-400 hover:text-red-600" onClick={() => setDeleteStopConfirm({ open: true, id: stop.id, name: stop.name })} aria-label={`${stop.name} 삭제`}>×</button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 오른쪽: 호차 × 요일 표 */}
        <div className="flex-1 min-w-0 overflow-x-auto">
          {busNumbers.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">등록된 호차가 없습니다.</p>
          ) : (
            <table className="w-full border-collapse text-xs" style={{ minWidth: 80 + days.length * 280 }}>
              <thead>
                <tr className="border-b-2 border-slate-300">
                  <th className="w-20 py-2 px-2 text-left bg-slate-100 text-sm font-bold">호차</th>
                  {days.map((d) => (
                    <th key={d} className="py-2 px-2 text-center bg-slate-100 text-sm font-bold border-l border-slate-200">
                      {dayLabel(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {busNumbers.map((bus) => (
                  <tr key={bus.id} className="border-b border-slate-200 align-top">
                    <td className="py-2 px-2 bg-slate-50 whitespace-nowrap">
                      {editingBusId === bus.id ? (
                        <div className="space-y-1">
                          <Input
                            value={editBusLabel}
                            onChange={(e) => setEditBusLabel(e.target.value)}
                            className="w-20 h-7 text-sm"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleUpdateBus(bus.id);
                              if (e.key === "Escape") setEditingBusId(null);
                            }}
                            autoFocus
                          />
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="h-6 text-xs px-1.5" onClick={() => handleUpdateBus(bus.id)} disabled={loading}>저장</Button>
                            <Button size="sm" variant="ghost" className="h-6 text-xs px-1.5" onClick={() => setEditingBusId(null)}>취소</Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="font-semibold text-slate-700">{bus.label}</div>
                          <div className="flex gap-1.5 mt-1">
                            <button type="button" className="text-[11px] text-slate-400 hover:text-slate-600" onClick={() => { setEditingBusId(bus.id); setEditBusLabel(bus.label); }}>수정</button>
                            <button type="button" className="text-[11px] text-red-400 hover:text-red-600" onClick={() => setDeleteBusConfirm({ open: true, id: bus.id, label: bus.label })} disabled={loading}>삭제</button>
                          </div>
                        </>
                      )}
                    </td>
                    {days.map((d) => {
                      const list = cellStops(dayAssignments, d, bus.id);
                      const cellId = `${d}|${bus.id}`;
                      const dirty = isCellDirty(d, bus.id);
                      const others = days.filter((x) => x !== d);
                      return (
                        <td
                          key={d}
                          className={`p-1.5 border-l border-slate-200 transition-colors ${
                            dragOverTarget === cellId
                              ? "bg-emerald-50"
                              : dirty
                                ? "bg-amber-50/60"
                                : "bg-white"
                          }`}
                          onDragOver={(e) => { e.preventDefault(); setDragOverTarget(cellId); }}
                          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverTarget(null); }}
                          onDrop={(e) => handleDrop(e, d, bus.id)}
                        >
                          <div className="space-y-1 min-h-[40px]">
                            {list.map((stopId, i) => {
                              const key = ck(d, stopId, bus.id);
                              const chipTarget = `chip-${key}`;
                              return (
                                <div
                                  key={stopId}
                                  draggable
                                  onDragStart={(e) => {
                                    e.dataTransfer.setData("text/plain", JSON.stringify({ stopId, from: { day: d, busId: bus.id } } satisfies DragData));
                                    e.dataTransfer.effectAllowed = "copyMove";
                                  }}
                                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverTarget(chipTarget); }}
                                  onDrop={(e) => handleDrop(e, d, bus.id, stopId)}
                                  className={`flex items-center gap-1.5 px-1.5 py-1 rounded border cursor-grab active:cursor-grabbing transition-colors ${
                                    dragOverTarget === chipTarget
                                      ? "border-blue-400 bg-blue-50 border-dashed"
                                      : "bg-slate-50 border-slate-200 hover:border-slate-300"
                                  }`}
                                >
                                  <span className="w-4 h-4 shrink-0 rounded-full bg-slate-700 text-white text-[10px] flex items-center justify-center">
                                    {i + 1}
                                  </span>
                                  <span className="flex-1 truncate text-slate-700">{stopNameMap.get(stopId) ?? "(삭제됨)"}</span>
                                  <input
                                    type="time"
                                    value={scheduleMap.get(key) ?? ""}
                                    onChange={(e) => setTime(key, e.target.value)}
                                    className="h-6 text-xs border border-slate-200 rounded px-1 bg-white w-[108px]"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeFromCell(d, bus.id, stopId)}
                                    className="text-slate-400 hover:text-red-500 px-0.5"
                                    aria-label={`${stopNameMap.get(stopId) ?? ""} 제거`}
                                  >
                                    ×
                                  </button>
                                </div>
                              );
                            })}
                            {list.length === 0 && (
                              <p className="text-[11px] text-slate-300 text-center py-2">여기에 정류장을 드래그하세요</p>
                            )}
                          </div>
                          {others.length > 0 && (
                            <button
                              type="button"
                              onClick={() => applyToOtherDays(d, bus.id)}
                              title={`이 칸의 정류장·순서·시간을 ${others.map(dayLabel).join("·")}요일 ${bus.label}에 덮어씁니다 (저장 전까지 반영 안 됨)`}
                              className="mt-1 text-[11px] text-slate-400 hover:text-blue-600"
                            >
                              → {others.map(dayLabel).join("·")}에 적용
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
