"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { BusNumber, BusStop, BusTimeSlot } from "@/lib/types";
import {
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

// 복사 모달용 충돌 정보
type CopyConflict = {
  stopId: string;
  stopName: string;
  existingBusLabel: string;
  newBusLabel: string;
};

type CopyDayPreview = {
  day: number;
  conflicts: CopyConflict[];
};

export function BusStopAssignmentManager({
  busNumbers,
  busTimeSlots,
  initialStops,
}: {
  busNumbers: BusNumber[];
  busTimeSlots: BusTimeSlot[];
  initialStops: BusStop[];
}) {
  // Filters
  const [day, setDay] = useState(1);
  const [timeSlotId, setTimeSlotId] = useState(() => {
    return busTimeSlots[0]?.id ?? "";
  });

  // Master stop list (read-only — CRUD is handled in BusManagePanel)
  const [stops] = useState<BusStop[]>(initialStops);

  // Per-day assignment: stopId → { busNumberId, sortOrder }
  const [dayAssignments, setDayAssignments] = useState<Map<string, StopAssignment>>(new Map());
  const serverAssignments = useRef<Map<string, StopAssignment>>(new Map());

  // Schedule times: stopId → time
  const [scheduleMap, setScheduleMap] = useState<Map<string, string>>(new Map());
  const serverSchedules = useRef<Map<string, string>>(new Map());

  // UI
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [filterChangeConfirm, setFilterChangeConfirm] = useState<{ open: boolean; setter?: () => void }>({ open: false });
  const [copyTimeConfirm, setCopyTimeConfirm] = useState<{
    open: boolean;
    stopId?: string;
    day?: number;
    time?: string;
    slotId?: string;
    dayLabel?: string;
  }>({ open: false });
  const [saving, setSaving] = useState(false);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  // 복사 모달
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copySelectedDays, setCopySelectedDays] = useState<Set<number>>(new Set());
  const [copyPreviews, setCopyPreviews] = useState<CopyDayPreview[]>([]);
  const [copyPreviewLoading, setCopyPreviewLoading] = useState(false);
  const [copying, setCopying] = useState(false);

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
    serverAssignments.current = isSlotFallback
      ? new Map()
      : new Map(map.entries().map(([k, v]) => [k, { ...v }]));
  }, [day, timeSlotId]);

  const fetchSchedules = useCallback(async () => {
    const data = await listBusStopSchedulesBulk(day, timeSlotId || undefined);
    const map = new Map<string, string>();
    for (const s of data) map.set(s.bus_stop_id, s.estimated_time?.slice(0, 5) ?? "");
    setScheduleMap(map);
    serverSchedules.current = new Map(map);
  }, [day, timeSlotId]);

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
      setFilterChangeConfirm({ open: true, setter });
      return;
    }
    setter();
  }

  function confirmFilterChange() {
    const setter = filterChangeConfirm.setter;
    setFilterChangeConfirm({ open: false });
    setDayAssignments(new Map(serverAssignments.current.entries().map(([k, v]) => [k, { ...v }])));
    setScheduleMap(new Map(serverSchedules.current));
    setter?.();
  }

  // ── Derived: get ordered stops for a bus ──

  function getAssignedStops(busId: string): BusStop[] {
    return stops
      .filter((s) => dayAssignments.get(s.id)?.busNumberId === busId)
      .sort((a, b) => (dayAssignments.get(a.id)?.sortOrder ?? 0) - (dayAssignments.get(b.id)?.sortOrder ?? 0));
  }

  const unassignedStops = stops
    .filter((s) => !dayAssignments.has(s.id))
    .sort((a, b) => a.name.localeCompare(b.name));
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
        // 해당 호차의 마지막 순서 뒤에 추가
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

        // 대상 호차의 현재 정렬된 정류장 목록
        const busStopIds = stops
          .filter((s) => next.get(s.id)?.busNumberId === targetBusId)
          .sort((a, b) => (next.get(a.id)?.sortOrder ?? 0) - (next.get(b.id)?.sortOrder ?? 0))
          .map((s) => s.id);

        // 같은 호차 내 이동이면 드래그 대상을 목록에서 제거
        const filtered = busStopIds.filter((id) => id !== stopId);

        // 타겟 앞에 삽입
        const targetIdx = filtered.indexOf(targetStopId);
        if (targetIdx === -1) {
          filtered.push(stopId);
        } else {
          filtered.splice(targetIdx, 0, stopId);
        }

        // 다른 호차에서 온 경우 sourceBusId는 이미 filtered에 포함되지 않음
        void sourceBusId;

        // sort_order 재할당
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

  // ── Dirty helper ──

  function isStopDirty(stopId: string): boolean {
    const local = dayAssignments.get(stopId);
    const server = serverAssignments.current.get(stopId);
    if (!local && !server) return false;
    if (!local || !server) return true;
    if (local.busNumberId !== server.busNumberId || local.sortOrder !== server.sortOrder) return true;
    return (scheduleMap.get(stopId) ?? "") !== (serverSchedules.current.get(stopId) ?? "");
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

    // 1. 배정(호차 + 순서) 저장
    const assignmentArr = [...dayAssignments.entries()].map(([bus_stop_id, a]) => ({
      bus_stop_id,
      bus_number_id: a.busNumberId,
      sort_order: a.sortOrder,
    }));
    const aResult = await saveBusStopDayAssignments(day, assignmentArr, timeSlotId || undefined);
    if (aResult.error) errors.push(`배정 저장: ${aResult.error}`);

    // 2. 도착 예정 시간 저장
    const slotId = timeSlotId || undefined;
    const allSchedIds = new Set([...scheduleMap.keys(), ...serverSchedules.current.keys()]);
    for (const stopId of allSchedIds) {
      const local = scheduleMap.get(stopId) ?? "";
      const server = serverSchedules.current.get(stopId) ?? "";
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

    serverAssignments.current = new Map(dayAssignments.entries().map(([k, v]) => [k, { ...v }]));
    serverSchedules.current = new Map(scheduleMap);
    setSaving(false);
  }

  // ── 전체 요일 시간 복사 (정류장 행 버튼) ──

  async function handleCopyToAllDays(stopId: string) {
    const time = scheduleMap.get(stopId);
    if (!time) {
      toast.error("복사할 시간을 먼저 입력해 주세요.");
      return;
    }
    const dayLabel = DAYS.find((d) => d.value === day)?.label ?? "";
    setCopyTimeConfirm({ open: true, stopId, day, time, slotId: timeSlotId || undefined, dayLabel });
  }

  async function confirmCopyTime() {
    const { stopId, day, time, slotId } = copyTimeConfirm;
    setCopyTimeConfirm({ open: false });
    if (!stopId || !day || !time) return;
    setLoading(true);
    const errors: string[] = [];
    for (const d of DAYS) {
      if (d.value === day) continue;
      const r = await upsertBusStopSchedule(stopId, d.value, time, slotId);
      if (r.error) errors.push(`${d.label}: ${r.error}`);
    }
    if (errors.length) toast.error(errors.join(", "));
    else toast.success("전체 요일에 적용되었습니다.");
    setLoading(false);
  }

  // ── 다른 요일에 복사 모달 ──

  const busLabelMap = new Map(busNumbers.map((b) => [b.id, b.label]));
  const stopNameMap = new Map(stops.map((s) => [s.id, s.name]));

  async function openCopyModal() {
    if (dayAssignments.size === 0) {
      toast.error("복사할 배정 데이터가 없습니다.");
      return;
    }
    setCopyModalOpen(true);
    setCopySelectedDays(new Set());
    setCopyPreviews([]);
    setCopyPreviewLoading(true);

    const otherDays = DAYS.filter((d) => d.value !== day);
    const previews: CopyDayPreview[] = [];

    for (const d of otherDays) {
      const existing = await listBusStopDayAssignments(d.value, timeSlotId || undefined);
      const conflicts: CopyConflict[] = [];
      for (const ex of existing) {
        const newAssignment = dayAssignments.get(ex.bus_stop_id);
        if (!newAssignment) continue;
        if (newAssignment.busNumberId !== ex.bus_number_id) {
          conflicts.push({
            stopId: ex.bus_stop_id,
            stopName: stopNameMap.get(ex.bus_stop_id) ?? ex.bus_stop_id,
            existingBusLabel: busLabelMap.get(ex.bus_number_id) ?? ex.bus_number_id,
            newBusLabel: busLabelMap.get(newAssignment.busNumberId) ?? newAssignment.busNumberId,
          });
        }
      }
      previews.push({ day: d.value, conflicts });
    }

    setCopyPreviews(previews);
    setCopyPreviewLoading(false);
  }

  function toggleCopyDay(d: number) {
    setCopySelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }

  async function handleConfirmCopy() {
    if (copySelectedDays.size === 0) {
      toast.error("복사할 요일을 선택해 주세요.");
      return;
    }
    setCopying(true);
    const errors: string[] = [];
    const assignmentArr = [...dayAssignments.entries()].map(([bus_stop_id, a]) => ({
      bus_stop_id,
      bus_number_id: a.busNumberId,
      sort_order: a.sortOrder,
    }));
    for (const targetDay of copySelectedDays) {
      const r = await saveBusStopDayAssignments(targetDay, assignmentArr, timeSlotId || undefined);
      if (r.error) {
        const label = DAYS.find((d) => d.value === targetDay)?.label ?? targetDay;
        errors.push(`${label}요일: ${r.error}`);
      }
    }
    if (errors.length) {
      toast.error(`일부 실패: ${errors.join(", ")}`);
    } else {
      const labels = [...copySelectedDays].sort().map((d) => DAYS.find((x) => x.value === d)?.label).join(", ");
      toast.success(`${labels}요일에 복사되었습니다.`);
    }
    setCopying(false);
    setCopyModalOpen(false);
  }

  // ── Render ──

  const currentDayLabel = DAYS.find((d) => d.value === day)?.label ?? "";
  const currentSlotLabel = filteredSlots.find((s) => s.id === timeSlotId)?.label ?? "";

  return (
    <div className="space-y-4">
      {/* 툴바: 요일·방향·시간대 필터 + 저장 버튼 */}
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

        <select
          value={timeSlotId}
          onChange={(e) => guardFilterChange(() => setTimeSlotId(e.target.value))}
          className="h-8 text-xs border border-slate-200 rounded px-2 bg-white"
        >
          {filteredSlots.map((slot) => (
            <option key={slot.id} value={slot.id}>
              {slot.label} ({slot.time.slice(0, 5)})
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2 ml-auto">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={openCopyModal}
            disabled={saving || loading}
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
      </div>

      {hasChanges && (
        <p className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded border border-amber-200">
          저장하지 않은 변경사항이 있습니다.
        </p>
      )}

      {/* 2-패널 레이아웃 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 왼쪽: 호차별 배정된 정류장 카드 */}
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
                {/* 호차 헤더 */}
                <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50 rounded-t-lg">
                  <span className="text-sm">🚌</span>
                  <span className="text-sm font-semibold text-slate-700 flex-1">{bus.label}</span>
                  <span className="text-xs text-slate-400">{busStops.length}개 정류장</span>
                </div>

                {/* 배정된 정류장 — 각 행이 재정렬용 드롭 타겟 */}
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

        {/* 오른쪽: 미배정 정류장 패널 (sticky) */}
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

          <Input
            placeholder="검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 text-xs"
          />

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
                className="flex items-center gap-2 px-2 py-1.5 rounded border cursor-grab active:cursor-grabbing hover:border-slate-300 bg-white border-slate-200 transition-colors"
              >
                <span className="text-xs text-slate-400">📍</span>
                <span className="text-xs text-slate-700 flex-1">{stop.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 다른 요일에 복사 모달 */}
      {copyModalOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-50"
            onClick={() => !copying && setCopyModalOpen(false)}
          />
          <div className="fixed inset-0 z-[51] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
              {/* 헤더 */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">다른 요일에 복사</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {currentDayLabel}요일 · 하원 · {currentSlotLabel}
                  </p>
                </div>
                <button
                  onClick={() => setCopyModalOpen(false)}
                  disabled={copying}
                  className="text-slate-400 hover:text-slate-600 text-lg leading-none disabled:opacity-40"
                >
                  ×
                </button>
              </div>

              {/* 본문 */}
              <div className="px-5 py-4 space-y-4">
                {/* 요일 선택 */}
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">복사할 요일 선택</p>
                  <div className="flex gap-2">
                    {DAYS.filter((d) => d.value !== day).map((d) => {
                      const selected = copySelectedDays.has(d.value);
                      const preview = copyPreviews.find((p) => p.day === d.value);
                      const hasConflict = (preview?.conflicts.length ?? 0) > 0;
                      return (
                        <button
                          key={d.value}
                          onClick={() => toggleCopyDay(d.value)}
                          className={`relative flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                            selected
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          {d.label}
                          {hasConflict && (
                            <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${selected ? "bg-yellow-300" : "bg-amber-400"}`} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 충돌 안내 */}
                {copyPreviewLoading ? (
                  <p className="text-xs text-slate-400 text-center py-2 animate-pulse">충돌 확인 중...</p>
                ) : (
                  <>
                    {/* 선택된 요일의 충돌 목록 */}
                    {copySelectedDays.size > 0 && (() => {
                      const allConflicts: { day: number; conflicts: CopyConflict[] }[] = [];
                      for (const d of copySelectedDays) {
                        const preview = copyPreviews.find((p) => p.day === d);
                        if (preview && preview.conflicts.length > 0) {
                          allConflicts.push({ day: d, conflicts: preview.conflicts });
                        }
                      }
                      if (allConflicts.length === 0) {
                        return (
                          <p className="text-xs text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100">
                            충돌 없음 — 선택한 요일에 바로 복사됩니다.
                          </p>
                        );
                      }
                      return (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 space-y-2">
                          <p className="text-xs font-semibold text-amber-700">⚠ 충돌 발생 — 아래 정류장이 다른 호차로 이동됩니다</p>
                          {allConflicts.map(({ day: d, conflicts }) => (
                            <div key={d}>
                              <p className="text-xs font-medium text-amber-600 mb-1">
                                {DAYS.find((x) => x.value === d)?.label}요일
                              </p>
                              <div className="space-y-0.5">
                                {conflicts.map((c) => (
                                  <div key={c.stopId} className="flex items-center gap-1.5 text-xs text-amber-700">
                                    <span className="text-amber-400">📍</span>
                                    <span className="font-medium">{c.stopName}</span>
                                    <span className="text-amber-400">:</span>
                                    <span className="line-through text-amber-400">{c.existingBusLabel}</span>
                                    <span className="text-amber-400">→</span>
                                    <span className="font-semibold">{c.newBusLabel}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* 선택 전 전체 충돌 개요 */}
                    {copySelectedDays.size === 0 && copyPreviews.some((p) => p.conflicts.length > 0) && (
                      <div className="text-xs text-slate-500 space-y-1">
                        {copyPreviews.filter((p) => p.conflicts.length > 0).map((p) => (
                          <p key={p.day}>
                            <span className="text-amber-500">⚠</span>{" "}
                            {DAYS.find((d) => d.value === p.day)?.label}요일: {p.conflicts.length}개 정류장 충돌
                          </p>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* 푸터 */}
              <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCopyModalOpen(false)}
                  disabled={copying}
                >
                  취소
                </Button>
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleConfirmCopy}
                  disabled={copying || copySelectedDays.size === 0 || copyPreviewLoading}
                >
                  {copying ? "복사 중..." : `복사 (${copySelectedDays.size}개 요일)`}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={copyTimeConfirm.open}
        variant="primary"
        title={`${copyTimeConfirm.dayLabel ?? ""}요일 시간(${copyTimeConfirm.time ?? ""})을 전체 요일에 적용할까요?`}
        description="현재 요일 시간이 미저장이면 먼저 저장해 주세요."
        confirmLabel="적용"
        onConfirm={confirmCopyTime}
        onCancel={() => setCopyTimeConfirm({ open: false })}
      />

      <ConfirmDialog
        open={filterChangeConfirm.open}
        variant="primary"
        title="저장하지 않은 변경사항이 있습니다"
        description="계속하면 지금까지의 변경이 사라집니다. 계속하시겠습니까?"
        confirmLabel="계속"
        onConfirm={confirmFilterChange}
        onCancel={() => setFilterChangeConfirm({ open: false })}
      />
    </div>
  );
}

// ── StopRow (배정된 정류장 행, 왼쪽 패널) ──

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
        className="text-xs text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
      >
        전체 요일 적용
      </button>
    </div>
  );
}
