"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { StudentBusDefault, BusTimeSlot, BusStop } from "@/lib/types";
import {
  getStudentBusDefaults,
  upsertStudentBusDefault,
  deleteStudentBusDefaults,
  listBusTimeSlots,
  listBusStops,
} from "../../actions";
import { LoadingState } from "@/components/LoadingState";

const DAY_NAMES = ["", "월", "화", "수", "목", "금"];
const DIR_LABEL = { pickup: "등원", dropoff: "하원" } as const;

function formatTime(t: string | undefined | null) {
  if (!t) return "-";
  return t.slice(0, 5);
}

export function StudentBusTab({ studentProfileId }: { studentProfileId: string }) {
  const router = useRouter();
  const [defaults, setDefaults] = useState<StudentBusDefault[]>([]);
  const [busTimeSlots, setBusTimeSlots] = useState<BusTimeSlot[]>([]);
  const [busStops, setBusStops] = useState<BusStop[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // 삭제 대기 목록 (로컬에서 먼저 제거, 저장 시 일괄 삭제)
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());

  // 일괄 설정 모드
  const [batchMode, setBatchMode] = useState(false);
  const [batchDir, setBatchDir] = useState<"pickup" | "dropoff">("pickup");
  const [batchDays, setBatchDays] = useState<Set<number>>(new Set());
  const [batchSlotId, setBatchSlotId] = useState("");
  const [batchStopId, setBatchStopId] = useState("");
  const [batchNote, setBatchNote] = useState("");

  // 편집 모드
  const [editKey, setEditKey] = useState<string | null>(null); // "day-direction"
  const [editSlotId, setEditSlotId] = useState("");
  const [editStopId, setEditStopId] = useState("");
  const [editNote, setEditNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [d, ts, stops] = await Promise.all([
      getStudentBusDefaults(studentProfileId),
      listBusTimeSlots(),
      listBusStops(),
    ]);
    setDefaults(d);
    setBusTimeSlots(ts);
    setBusStops([...stops].sort((a, b) => a.name.localeCompare(b.name, "ko")));
    setPendingDeletes(new Set());
    setLoading(false);
  }, [studentProfileId]);

  useEffect(() => {
    load();
  }, [load]);

  function getDefault(day: number, dir: "pickup" | "dropoff") {
    return defaults.find(
      (d) => d.day_of_week === day && d.direction === dir && !pendingDeletes.has(d.id)
    );
  }

  const hasPendingChanges = pendingDeletes.size > 0;

  async function handleSave(day: number, dir: "pickup" | "dropoff") {
    if (!editSlotId) {
      setError("시간대를 선택해 주세요.");
      return;
    }
    setSaving(true);
    setError("");
    const result = await upsertStudentBusDefault(
      studentProfileId,
      day,
      dir,
      editSlotId,
      undefined,
      editNote || undefined,
      editStopId || undefined
    );
    if (result.error) {
      setError(result.error);
    } else {
      setEditKey(null);
      await load();
      router.refresh();
    }
    setSaving(false);
  }

  function toggleBatchDay(day: number) {
    setBatchDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  function openBatchMode() {
    setBatchMode(true);
    setBatchDir("pickup");
    setBatchDays(new Set());
    setBatchSlotId("");
    setBatchStopId("");
    setBatchNote("");
    setError("");
  }

  async function handleBatchSave() {
    if (batchDays.size === 0) {
      setError("요일을 하나 이상 선택해 주세요.");
      return;
    }
    if (!batchSlotId) {
      setError("시간대를 선택해 주세요.");
      return;
    }
    setSaving(true);
    setError("");
    for (const day of batchDays) {
      const result = await upsertStudentBusDefault(
        studentProfileId,
        day,
        batchDir,
        batchSlotId,
        undefined,
        batchNote || undefined,
        batchStopId || undefined
      );
      if (result.error) {
        setError(result.error);
        setSaving(false);
        return;
      }
    }
    setBatchMode(false);
    await load();
    router.refresh();
    setSaving(false);
  }

  function handleMarkDelete(id: string) {
    setPendingDeletes((prev) => new Set(prev).add(id));
  }

  function handleUndoDelete(id: string) {
    setPendingDeletes((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function handleCommitDeletes() {
    setSaving(true);
    setError("");
    const result = await deleteStudentBusDefaults(Array.from(pendingDeletes));
    if (result.error) {
      setError(result.error);
    } else {
      await load();
      router.refresh();
    }
    setSaving(false);
  }

  function handleCancelAllDeletes() {
    setPendingDeletes(new Set());
  }

  if (loading) return <LoadingState className="py-4" />;

  const pickupSlots = busTimeSlots.filter((s) => s.direction === "pickup");
  const dropoffSlots = busTimeSlots.filter((s) => s.direction === "dropoff");

  // 삭제 대기 중인 항목 정보
  const pendingDeleteItems = defaults.filter((d) => pendingDeletes.has(d.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">주간 승하차 스케줄</h3>
        {busTimeSlots.length > 0 && !batchMode && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={openBatchMode}>
            일괄 설정
          </Button>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded">{error}</p>
      )}

      {/* 삭제 대기 저장 바 */}
      {hasPendingChanges && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
          <div className="text-xs text-amber-800">
            <span className="font-medium">{pendingDeletes.size}건</span> 삭제 대기 중
            {pendingDeleteItems.length > 0 && (
              <span className="ml-1.5 text-amber-600">
                ({pendingDeleteItems.map((d) => `${DAY_NAMES[d.day_of_week]} ${DIR_LABEL[d.direction]}`).join(", ")})
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-slate-600"
              onClick={handleCancelAllDeletes}
              disabled={saving}
            >
              취소
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs bg-red-500 hover:bg-red-600 text-white"
              onClick={handleCommitDeletes}
              disabled={saving}
            >
              {saving ? "삭제 중..." : "삭제 저장"}
            </Button>
          </div>
        </div>
      )}

      {batchMode && (
        <div className="border rounded-lg p-4 bg-slate-50 space-y-3">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">방향</label>
              <select
                value={batchDir}
                onChange={(e) => {
                  setBatchDir(e.target.value as "pickup" | "dropoff");
                  setBatchSlotId("");
                }}
                className="h-8 px-2 border rounded text-xs"
              >
                <option value="pickup">등원</option>
                <option value="dropoff">하원</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">요일</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleBatchDay(day)}
                    className={`w-8 h-8 rounded text-xs font-medium border ${
                      batchDays.has(day)
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-white text-slate-600 border-slate-300 hover:border-blue-300"
                    }`}
                  >
                    {DAY_NAMES[day]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">시간대</label>
              <select
                value={batchSlotId}
                onChange={(e) => setBatchSlotId(e.target.value)}
                className="h-8 px-2 border rounded text-xs"
              >
                <option value="">선택</option>
                {(batchDir === "pickup" ? pickupSlots : dropoffSlots).map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatTime(s.time)} {s.label}
                  </option>
                ))}
              </select>
            </div>
            {busStops.length > 0 && (
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">정류장</label>
                <select
                  value={batchStopId}
                  onChange={(e) => setBatchStopId(e.target.value)}
                  className="h-8 px-2 border rounded text-xs"
                >
                  <option value="">선택 (선택사항)</option>
                  {busStops.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">메모</label>
              <Input
                value={batchNote}
                onChange={(e) => setBatchNote(e.target.value)}
                placeholder="추가 메모"
                className="h-8 text-xs w-40"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" className="h-7 text-xs" onClick={handleBatchSave} disabled={saving}>
              {saving ? "저장 중..." : "저장"}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setBatchMode(false)}>
              취소
            </Button>
          </div>
        </div>
      )}

      {busTimeSlots.length === 0 ? (
        <p className="text-sm text-slate-400 py-4">
          시간대가 등록되지 않았습니다. 먼저{" "}
          <a href="/admin/bus?tab=numbers" className="text-blue-500 underline">승하차 관리</a>
          에서 설정해 주세요.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-2 w-12">요일</th>
                <th className="text-left py-2 px-2">방향</th>
                <th className="text-left py-2 px-2">시간대</th>
                <th className="text-left py-2 px-2">호차</th>
                <th className="text-left py-2 px-2">정류장</th>
                <th className="text-left py-2 px-2">메모</th>
                <th className="text-right py-2 px-2 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((day) =>
                (["pickup", "dropoff"] as const).map((dir) => {
                  const def = getDefault(day, dir);
                  // 삭제 대기 중인 원본 항목 (되돌리기 표시용)
                  const deletedDef = defaults.find(
                    (d) => d.day_of_week === day && d.direction === dir && pendingDeletes.has(d.id)
                  );
                  const key = `${day}-${dir}`;
                  const isEditing = editKey === key;
                  const relevantSlots = dir === "pickup" ? pickupSlots : dropoffSlots;

                  return (
                    <tr key={key} className={`border-b ${deletedDef ? "bg-red-50/50" : "hover:bg-slate-50"}`}>
                      {dir === "pickup" && (
                        <td rowSpan={2} className="py-2 px-2 font-medium text-center align-middle border-r">
                          {DAY_NAMES[day]}
                        </td>
                      )}
                      <td className="py-2 px-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          dir === "pickup" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                        }`}>
                          {DIR_LABEL[dir]}
                        </span>
                      </td>
                      {deletedDef ? (
                        <>
                          <td colSpan={4} className="py-2 px-2">
                            <span className="text-xs text-red-400 line-through">
                              {formatTime(deletedDef.time_slot_time)} {deletedDef.bus_label} {deletedDef.bus_stop_name ?? ""}
                            </span>
                            <span className="text-xs text-red-500 ml-2">삭제 대기</span>
                          </td>
                          <td className="py-2 px-2 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-xs text-blue-500"
                              onClick={() => handleUndoDelete(deletedDef.id)}
                            >
                              되돌리기
                            </Button>
                          </td>
                        </>
                      ) : isEditing ? (
                        <>
                          <td className="py-2 px-2">
                            <select
                              value={editSlotId}
                              onChange={(e) => setEditSlotId(e.target.value)}
                              className="h-8 px-2 border rounded text-xs w-full"
                            >
                              <option value="">선택</option>
                              {relevantSlots.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {formatTime(s.time)} {s.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-2 text-slate-400 text-xs">
                            —
                          </td>
                          <td className="py-2 px-2">
                            {busStops.length > 0 ? (
                              <select
                                value={editStopId}
                                onChange={(e) => setEditStopId(e.target.value)}
                                className="h-8 px-2 border rounded text-xs w-full"
                              >
                                <option value="">선택</option>
                                {busStops.map((s) => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs text-slate-400">정류장 없음</span>
                            )}
                          </td>
                          <td className="py-2 px-2">
                            <Input
                              value={editNote}
                              onChange={(e) => setEditNote(e.target.value)}
                              placeholder="추가 메모"
                              className="h-8 text-xs w-full"
                            />
                          </td>
                          <td className="py-2 px-2 text-right space-x-1">
                            <Button size="sm" className="h-6 text-xs" onClick={() => handleSave(day, dir)} disabled={saving}>
                              저장
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditKey(null)}>
                              취소
                            </Button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-2 px-2 text-slate-600">
                            {def ? (
                              <>
                                {formatTime(def.time_slot_time)}
                                {def.time_slot_label && <span className="text-xs text-slate-400 ml-1">{def.time_slot_label}</span>}
                              </>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-slate-600">
                            {def ? def.bus_label : <span className="text-slate-300">-</span>}
                          </td>
                          <td className="py-2 px-2 text-slate-600">
                            {def?.bus_stop_name ? (
                              <span className="text-xs">{def.bus_stop_name}</span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-slate-600">
                            {def?.note ? <span className="text-xs">{def.note}</span> : <span className="text-slate-300">-</span>}
                          </td>
                          <td className="py-2 px-2 text-right space-x-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-xs"
                              onClick={() => {
                                setEditKey(key);
                                setEditSlotId(def?.bus_time_slot_id ?? "");
                                setEditStopId(def?.bus_stop_id ?? "");
                                setEditNote(def?.note ?? "");
                              }}
                            >
                              {def ? "수정" : "설정"}
                            </Button>
                            {def && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-xs text-red-500"
                                onClick={() => handleMarkDelete(def.id)}
                                disabled={saving}
                              >
                                삭제
                              </Button>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
