"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BusNumber, BusStop, BusStopSchedule } from "@/lib/types";
import {
  createBusNumber,
  updateBusNumber,
  deleteBusNumber,
  listBusStops,
  createBusStop,
  updateBusStop,
  deleteBusStop,
  listBusStopSchedules,
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

export function BusNumbersManager({ busNumbers }: { busNumbers: BusNumber[] }) {
  const router = useRouter();
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 정류장
  const [stops, setStops] = useState<BusStop[]>([]);
  const [expandedBus, setExpandedBus] = useState<string | null>(null);
  const [newStopName, setNewStopName] = useState("");
  const [editingStopId, setEditingStopId] = useState<string | null>(null);
  const [editStopName, setEditStopName] = useState("");

  // 정류장 시간 설정
  const [scheduleStopId, setScheduleStopId] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<BusStopSchedule[]>([]);
  const [scheduleDay, setScheduleDay] = useState(1);
  const [pickupTime, setPickupTime] = useState("");
  const [dropoffTime, setDropoffTime] = useState("");
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const refreshStops = useCallback(async () => {
    const data = await listBusStops();
    setStops(data);
  }, []);

  useEffect(() => {
    refreshStops();
  }, [refreshStops]);

  async function handleCreate() {
    setLoading(true);
    setError("");
    const result = await createBusNumber(newLabel);
    if (result.error) {
      setError(result.error);
    } else {
      setNewLabel("");
      router.refresh();
    }
    setLoading(false);
  }

  async function handleUpdate(id: string) {
    setLoading(true);
    setError("");
    const result = await updateBusNumber(id, editLabel);
    if (result.error) {
      setError(result.error);
    } else {
      setEditingId(null);
      router.refresh();
    }
    setLoading(false);
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`"${label}" 호차를 삭제하시겠습니까?`)) return;
    setLoading(true);
    const result = await deleteBusNumber(id);
    if (result.error) setError(result.error);
    else router.refresh();
    setLoading(false);
  }

  // 정류장 CRUD
  async function handleAddStop(busNumberId: string) {
    if (!newStopName.trim()) return;
    setLoading(true);
    const result = await createBusStop(busNumberId, newStopName.trim());
    if (result.error) {
      setError(result.error);
    } else {
      setNewStopName("");
      await refreshStops();
    }
    setLoading(false);
  }

  async function handleUpdateStop(stopId: string) {
    if (!editStopName.trim()) return;
    setLoading(true);
    const result = await updateBusStop(stopId, editStopName.trim());
    if (result.error) {
      setError(result.error);
    } else {
      setEditingStopId(null);
      await refreshStops();
    }
    setLoading(false);
  }

  async function handleDeleteStop(stopId: string) {
    if (!confirm("정류장을 삭제하시겠습니까?")) return;
    setLoading(true);
    const result = await deleteBusStop(stopId);
    if (result.error) setError(result.error);
    else await refreshStops();
    setLoading(false);
  }

  // 정류장 시간표
  async function openSchedule(stopId: string) {
    if (scheduleStopId === stopId) {
      setScheduleStopId(null);
      return;
    }
    setScheduleStopId(stopId);
    setScheduleLoading(true);
    const data = await listBusStopSchedules(stopId);
    setSchedules(data);
    const currentDay = scheduleDay;
    const pu = data.find((s) => s.day_of_week === currentDay && s.direction === "pickup");
    const dr = data.find((s) => s.day_of_week === currentDay && s.direction === "dropoff");
    setPickupTime(pu?.estimated_time?.slice(0, 5) ?? "");
    setDropoffTime(dr?.estimated_time?.slice(0, 5) ?? "");
    setScheduleLoading(false);
  }

  function handleDayChange(day: number) {
    setScheduleDay(day);
    const pu = schedules.find((s) => s.day_of_week === day && s.direction === "pickup");
    const dr = schedules.find((s) => s.day_of_week === day && s.direction === "dropoff");
    setPickupTime(pu?.estimated_time?.slice(0, 5) ?? "");
    setDropoffTime(dr?.estimated_time?.slice(0, 5) ?? "");
  }

  async function handleSaveSchedule(direction: "pickup" | "dropoff") {
    if (!scheduleStopId) return;
    const time = direction === "pickup" ? pickupTime : dropoffTime;
    setScheduleLoading(true);

    if (!time) {
      const result = await deleteBusStopSchedule(scheduleStopId, scheduleDay, direction);
      if (result.error) {
        toast.error(result.error);
      } else {
        setSchedules((prev) => prev.filter((s) => !(s.bus_stop_id === scheduleStopId && s.day_of_week === scheduleDay && s.direction === direction)));
        toast.success("시간이 삭제되었습니다.");
      }
    } else {
      const result = await upsertBusStopSchedule(scheduleStopId, scheduleDay, direction, time);
      if (result.error) {
        toast.error(result.error);
      } else {
        setSchedules((prev) => {
          const filtered = prev.filter((s) => !(s.bus_stop_id === scheduleStopId && s.day_of_week === scheduleDay && s.direction === direction));
          return [...filtered, { id: "", bus_stop_id: scheduleStopId!, day_of_week: scheduleDay, direction, estimated_time: time, created_at: "", updated_at: "" }];
        });
        toast.success("시간이 저장되었습니다.");
      }
    }
    setScheduleLoading(false);
  }

  const dayLabel = DAYS.find((d) => d.value === scheduleDay)?.label ?? "";

  async function handleCopyToAllDays() {
    if (!scheduleStopId) return;
    if (!pickupTime && !dropoffTime) {
      toast.error("복사할 시간을 먼저 입력해 주세요.");
      return;
    }
    if (!confirm(`${dayLabel}요일 시간을 전체 요일에 복사하시겠습니까?`)) return;
    setScheduleLoading(true);
    const errors: string[] = [];
    for (const d of DAYS) {
      if (d.value === scheduleDay) continue;
      if (pickupTime) {
        const r = await upsertBusStopSchedule(scheduleStopId, d.value, "pickup", pickupTime);
        if (r.error) errors.push(`${d.label} 등원: ${r.error}`);
      }
      if (dropoffTime) {
        const r = await upsertBusStopSchedule(scheduleStopId, d.value, "dropoff", dropoffTime);
        if (r.error) errors.push(`${d.label} 하원: ${r.error}`);
      }
    }
    if (errors.length) {
      toast.error(errors.join(", "));
    } else {
      toast.success("전체 요일에 복사되었습니다.");
      const data = await listBusStopSchedules(scheduleStopId);
      setSchedules(data);
    }
    setScheduleLoading(false);
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-700">호차 목록</h3>

      {error && (
        <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded">{error}</p>
      )}

      {/* 추가 폼 */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="호차 이름 (예: 1호차)"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          className="max-w-48"
          onKeyDown={(e) => { if (e.key === "Enter" && newLabel.trim()) handleCreate(); }}
        />
        <Button size="sm" onClick={handleCreate} disabled={loading || !newLabel.trim()}>
          추가
        </Button>
      </div>

      {/* 목록 */}
      <div className="space-y-2">
        {busNumbers.length === 0 && (
          <p className="text-xs text-slate-400 py-4">등록된 호차가 없습니다.</p>
        )}
        {busNumbers.map((bus) => {
          const busStops = stops.filter((s) => s.bus_number_id === bus.id);
          const isExpanded = expandedBus === bus.id;

          return (
            <div key={bus.id} className="rounded-lg border border-slate-200 overflow-hidden">
              {/* 호차 행 */}
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors">
                {editingId === bus.id ? (
                  <>
                    <Input
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      className="max-w-36 h-8 text-sm"
                      onKeyDown={(e) => { if (e.key === "Enter") handleUpdate(bus.id); if (e.key === "Escape") setEditingId(null); }}
                    />
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleUpdate(bus.id)} disabled={loading}>
                      저장
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>
                      취소
                    </Button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setExpandedBus(isExpanded ? null : bus.id)}
                      className="text-xs text-slate-400 hover:text-slate-600 w-5 shrink-0"
                    >
                      {isExpanded ? "▾" : "▸"}
                    </button>
                    <span className="text-sm font-medium flex-1">{bus.label}</span>
                    <span className="text-xs text-slate-400">{busStops.length}개 정류장</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => {
                        setEditingId(bus.id);
                        setEditLabel(bus.label);
                      }}
                    >
                      수정
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-red-500 hover:text-red-700"
                      onClick={() => handleDelete(bus.id, bus.label)}
                      disabled={loading}
                    >
                      삭제
                    </Button>
                  </>
                )}
              </div>

              {/* 정류장 목록 (확장 시) */}
              {isExpanded && (
                <div className="px-3 py-2 space-y-1 border-t border-slate-200 bg-white">
                  {busStops.length === 0 && (
                    <p className="text-xs text-slate-400 py-1 pl-6">등록된 정류장이 없습니다.</p>
                  )}
                  {busStops.map((stop) => (
                    <div key={stop.id}>
                      <div className="flex items-center gap-2 pl-6 py-1">
                        {editingStopId === stop.id ? (
                          <>
                            <Input
                              value={editStopName}
                              onChange={(e) => setEditStopName(e.target.value)}
                              className="h-7 text-xs flex-1 max-w-48"
                              onKeyDown={(e) => { if (e.key === "Enter") handleUpdateStop(stop.id); if (e.key === "Escape") setEditingStopId(null); }}
                              autoFocus
                            />
                            <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => handleUpdateStop(stop.id)} disabled={loading}>
                              저장
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingStopId(null)}>
                              취소
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="text-xs text-slate-500">📍</span>
                            <span className="text-sm text-slate-700 flex-1">{stop.name}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className={`h-6 text-xs ${scheduleStopId === stop.id ? "bg-blue-50 text-blue-600" : ""}`}
                              onClick={() => openSchedule(stop.id)}
                            >
                              시간
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-xs"
                              onClick={() => { setEditingStopId(stop.id); setEditStopName(stop.name); }}
                            >
                              수정
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-xs text-red-500 hover:text-red-700"
                              onClick={() => handleDeleteStop(stop.id)}
                              disabled={loading}
                            >
                              삭제
                            </Button>
                          </>
                        )}
                      </div>

                      {/* 시간 설정 패널 */}
                      {scheduleStopId === stop.id && (
                        <div className="ml-6 mt-1 mb-2 p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-3">
                          {/* 요일 선택 */}
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-500 mr-1">요일:</span>
                            {DAYS.map((d) => {
                              const hasSchedule = schedules.some((s) => s.day_of_week === d.value && s.bus_stop_id === stop.id);
                              return (
                                <button
                                  key={d.value}
                                  onClick={() => handleDayChange(d.value)}
                                  className={`w-8 h-7 text-xs rounded transition-colors ${
                                    scheduleDay === d.value
                                      ? "bg-slate-800 text-white"
                                      : hasSchedule
                                        ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                        : "bg-white text-slate-500 hover:bg-slate-100 border border-slate-200"
                                  }`}
                                >
                                  {d.label}
                                </button>
                              );
                            })}
                          </div>

                          {/* 시간 입력 */}
                          <div className="flex items-center gap-4 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-blue-600 font-medium w-8">등원</span>
                              <input
                                type="time"
                                value={pickupTime}
                                onChange={(e) => setPickupTime(e.target.value)}
                                className="h-7 text-xs border border-slate-200 rounded px-2 bg-white"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-xs"
                                onClick={() => handleSaveSchedule("pickup")}
                                disabled={scheduleLoading}
                              >
                                {pickupTime ? "저장" : "삭제"}
                              </Button>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-orange-600 font-medium w-8">하원</span>
                              <input
                                type="time"
                                value={dropoffTime}
                                onChange={(e) => setDropoffTime(e.target.value)}
                                className="h-7 text-xs border border-slate-200 rounded px-2 bg-white"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-xs"
                                onClick={() => handleSaveSchedule("dropoff")}
                                disabled={scheduleLoading}
                              >
                                {dropoffTime ? "저장" : "삭제"}
                              </Button>
                            </div>
                          </div>

                          {/* 전체 요일 복사 */}
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-xs"
                              onClick={handleCopyToAllDays}
                              disabled={scheduleLoading || (!pickupTime && !dropoffTime)}
                            >
                              {dayLabel} → 전체 요일 복사
                            </Button>
                            {scheduleLoading && <span className="text-xs text-slate-400">저장 중...</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* 정류장 추가 */}
                  <div className="flex items-center gap-2 pl-6 pt-1">
                    <Input
                      placeholder="정류장 이름"
                      value={expandedBus === bus.id ? newStopName : ""}
                      onChange={(e) => setNewStopName(e.target.value)}
                      className="h-7 text-xs flex-1 max-w-48"
                      onKeyDown={(e) => { if (e.key === "Enter" && newStopName.trim()) handleAddStop(bus.id); }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs"
                      onClick={() => handleAddStop(bus.id)}
                      disabled={loading || !newStopName.trim()}
                    >
                      추가
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
