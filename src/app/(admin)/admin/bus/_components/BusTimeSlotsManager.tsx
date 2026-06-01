"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BusTimeSlot } from "@/lib/types";
import { ConfirmDialog } from "@/components/overlays/ConfirmDialog";
import { FormGroup } from "@/components/forms/FormGroup";
import {
  createBusTimeSlot,
  updateBusTimeSlot,
  deleteBusTimeSlot,
} from "@/app/(admin)/admin/actions/bus-actions";

function formatTime(t: string) {
  return t.slice(0, 5);
}

export function BusTimeSlotsManager({ busTimeSlots }: { busTimeSlots: BusTimeSlot[] }) {
  const router = useRouter();
  const [newLabel, setNewLabel] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newShowEmpty, setNewShowEmpty] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editShowEmpty, setEditShowEmpty] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id?: string; label?: string }>({ open: false });

  async function handleCreate() {
    setLoading(true);
    setError("");
    const result = await createBusTimeSlot(newLabel, newTime, newShowEmpty);
    if (result.error) {
      setError(result.error);
    } else {
      setNewLabel("");
      setNewTime("");
      setNewShowEmpty(false);
      router.refresh();
    }
    setLoading(false);
  }

  async function handleUpdate(id: string) {
    setLoading(true);
    setError("");
    const result = await updateBusTimeSlot(id, editLabel, editTime, editShowEmpty);
    if (result.error) {
      setError(result.error);
    } else {
      setEditingId(null);
      router.refresh();
    }
    setLoading(false);
  }

  async function handleDeleteConfirm() {
    if (!deleteConfirm.id) return;
    setDeleteConfirm({ open: false });
    setLoading(true);
    const result = await deleteBusTimeSlot(deleteConfirm.id);
    if (result.error) setError(result.error);
    else router.refresh();
    setLoading(false);
  }

  function renderSlotRow(slot: BusTimeSlot) {
    const isEditing = editingId === slot.id;

    if (isEditing) {
      return (
        <div
          key={slot.id}
          className="flex flex-col gap-3 px-4 py-3 rounded-lg bg-slate-50"
        >
          <div className="flex items-center gap-3 flex-wrap">
            <Input
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              className="max-w-40 text-base"
              aria-label="시간대 이름"
            />
            <Input
              type="time"
              value={editTime}
              onChange={(e) => setEditTime(e.target.value)}
              className="w-32 text-base"
              aria-label="시간"
            />
            <Button size="default" variant="outline" className="h-11 text-base" onClick={() => handleUpdate(slot.id)} disabled={loading}>
              저장
            </Button>
            <Button size="default" variant="ghost" className="h-11 text-base" onClick={() => setEditingId(null)}>
              취소
            </Button>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              className="h-4 w-4 accent-emerald-600"
              checked={editShowEmpty}
              onChange={(e) => setEditShowEmpty(e.target.checked)}
            />
            <span className="font-medium">학생 없어도 정류장 표시</span>
            <span className="text-slate-500">— 모니터에서 배정 학생이 없는 정류장·호차 카드도 이름을 노출합니다 (오후반 등).</span>
          </label>
        </div>
      );
    }

    return (
      <div
        key={slot.id}
        className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <span className="text-base font-semibold w-20">{formatTime(slot.time)}</span>
        <span className="text-base text-slate-700 flex-1 flex items-center gap-2 flex-wrap">
          <span>{slot.label}</span>
          {slot.show_empty_stops && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
              빈 정류장 표시
            </span>
          )}
        </span>
        <Button
          size="default"
          variant="ghost"
          className="h-11 text-base"
          onClick={() => {
            setEditingId(slot.id);
            setEditLabel(slot.label);
            setEditTime(formatTime(slot.time));
            setEditShowEmpty(slot.show_empty_stops);
          }}
        >
          수정
        </Button>
        <Button
          size="default"
          variant="ghost"
          className="h-11 text-base text-red-600 hover:text-red-700"
          onClick={() => setDeleteConfirm({ open: true, id: slot.id, label: slot.label })}
          disabled={loading}
        >
          삭제
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-slate-800">하원 시간대</h3>

      {error && (
        <p role="alert" className="text-base text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-lg">{error}</p>
      )}

      {/* 추가 폼 */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px_auto] gap-3 items-end">
          <FormGroup label="이름" required htmlFor="new-slot-label" help="예: 1차, 2차, 방과후1차">
            <Input
              id="new-slot-label"
              placeholder="예: 1차"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="text-base"
            />
          </FormGroup>
          <FormGroup label="시간" required htmlFor="new-slot-time">
            <Input
              id="new-slot-time"
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className="text-base"
            />
          </FormGroup>
          <Button
            size="default"
            className="h-11 px-6 text-base"
            onClick={handleCreate}
            disabled={loading || !newLabel.trim() || !newTime}
          >
            추가
          </Button>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            className="h-4 w-4 accent-emerald-600"
            checked={newShowEmpty}
            onChange={(e) => setNewShowEmpty(e.target.checked)}
          />
          <span className="font-medium">학생 없어도 정류장 표시</span>
          <span className="text-slate-500">— 모니터에서 배정 학생이 없는 정류장·호차 카드도 이름을 노출합니다 (오후반 등).</span>
        </label>
      </div>

      {/* 하원 목록 */}
      {busTimeSlots.length > 0 ? (
        <div className="space-y-2">
          {busTimeSlots.map(renderSlotRow)}
        </div>
      ) : (
        <p className="text-base text-slate-500 py-6 text-center">등록된 시간대가 없습니다.</p>
      )}

      <ConfirmDialog
        open={deleteConfirm.open}
        title={`"${deleteConfirm.label ?? ""}" 시간대를 삭제하시겠습니까?`}
        description="삭제하면 이 시간대에 의존하는 데이터에 영향을 줄 수 있습니다."
        impactList={[
          "이 시간대를 사용하는 정류장 스케줄이 함께 제거됩니다.",
          "이 시간대를 참조하는 변경 요청·당일 변경에 영향이 갈 수 있습니다.",
        ]}
        danger
        confirmLabel="삭제"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm({ open: false })}
      />
    </div>
  );
}
