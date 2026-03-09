"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BusTimeSlot } from "@/lib/types";
import {
  createBusTimeSlot,
  updateBusTimeSlot,
  deleteBusTimeSlot,
} from "../../actions";

const DIR_LABEL = { pickup: "등원", dropoff: "하원" } as const;

function formatTime(t: string) {
  return t.slice(0, 5);
}

export function BusTimeSlotsManager({ busTimeSlots }: { busTimeSlots: BusTimeSlot[] }) {
  const router = useRouter();
  const [newDirection, setNewDirection] = useState<"pickup" | "dropoff">("pickup");
  const [newLabel, setNewLabel] = useState("");
  const [newTime, setNewTime] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editTime, setEditTime] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    setLoading(true);
    setError("");
    const result = await createBusTimeSlot(newDirection, newLabel, newTime);
    if (result.error) {
      setError(result.error);
    } else {
      setNewLabel("");
      setNewTime("");
      router.refresh();
    }
    setLoading(false);
  }

  async function handleUpdate(id: string) {
    setLoading(true);
    setError("");
    const result = await updateBusTimeSlot(id, editLabel, editTime);
    if (result.error) {
      setError(result.error);
    } else {
      setEditingId(null);
      router.refresh();
    }
    setLoading(false);
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`"${label}" 시간대를 삭제하시겠습니까?`)) return;
    setLoading(true);
    const result = await deleteBusTimeSlot(id);
    if (result.error) setError(result.error);
    else router.refresh();
    setLoading(false);
  }

  const pickupSlots = busTimeSlots.filter((s) => s.direction === "pickup");
  const dropoffSlots = busTimeSlots.filter((s) => s.direction === "dropoff");

  function renderSlotRow(slot: BusTimeSlot) {
    const isEditing = editingId === slot.id;

    return (
      <div
        key={slot.id}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        {isEditing ? (
          <>
            <Input
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              className="max-w-36 h-8 text-sm"
            />
            <Input
              type="time"
              value={editTime}
              onChange={(e) => setEditTime(e.target.value)}
              className="w-28 h-8 text-sm"
            />
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleUpdate(slot.id)} disabled={loading}>
              저장
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>
              취소
            </Button>
          </>
        ) : (
          <>
            <span className="text-sm font-medium w-16">{formatTime(slot.time)}</span>
            <span className="text-sm text-slate-600 flex-1">{slot.label}</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => {
                setEditingId(slot.id);
                setEditLabel(slot.label);
                setEditTime(formatTime(slot.time));
              }}
            >
              수정
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-red-500 hover:text-red-700"
              onClick={() => handleDelete(slot.id, slot.label)}
              disabled={loading}
            >
              삭제
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-700">승하차 시간대</h3>

      {error && (
        <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded">{error}</p>
      )}

      {/* 추가 폼 */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={newDirection}
          onChange={(e) => setNewDirection(e.target.value as "pickup" | "dropoff")}
          className="h-9 px-2 border rounded text-sm w-24"
        >
          <option value="pickup">등원</option>
          <option value="dropoff">하원</option>
        </select>
        <Input
          placeholder="이름 (예: 1차)"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          className="max-w-36"
        />
        <Input
          type="time"
          value={newTime}
          onChange={(e) => setNewTime(e.target.value)}
          className="w-28"
        />
        <Button size="sm" onClick={handleCreate} disabled={loading || !newLabel.trim() || !newTime}>
          추가
        </Button>
      </div>

      {/* 등원 목록 */}
      {pickupSlots.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wide px-1 pt-2 border-b pb-1">
            {DIR_LABEL.pickup}
          </h4>
          {pickupSlots.map(renderSlotRow)}
        </div>
      )}

      {/* 하원 목록 */}
      {dropoffSlots.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold text-orange-700 uppercase tracking-wide px-1 pt-2 border-b pb-1">
            {DIR_LABEL.dropoff}
          </h4>
          {dropoffSlots.map(renderSlotRow)}
        </div>
      )}

      {busTimeSlots.length === 0 && (
        <p className="text-xs text-slate-400 py-4">등록된 시간대가 없습니다.</p>
      )}
    </div>
  );
}
