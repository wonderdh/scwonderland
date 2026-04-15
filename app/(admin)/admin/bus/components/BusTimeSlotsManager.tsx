"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BusTimeSlot } from "@/lib/types";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FormGroup } from "@/components/FormGroup";
import {
  createBusTimeSlot,
  updateBusTimeSlot,
  deleteBusTimeSlot,
} from "../../actions";

function formatTime(t: string) {
  return t.slice(0, 5);
}

export function BusTimeSlotsManager({ busTimeSlots }: { busTimeSlots: BusTimeSlot[] }) {
  const router = useRouter();
  const [newLabel, setNewLabel] = useState("");
  const [newTime, setNewTime] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editTime, setEditTime] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id?: string; label?: string }>({ open: false });

  async function handleCreate() {
    setLoading(true);
    setError("");
    const result = await createBusTimeSlot(newLabel, newTime);
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

    return (
      <div
        key={slot.id}
        className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        {isEditing ? (
          <>
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
          </>
        ) : (
          <>
            <span className="text-base font-semibold w-20">{formatTime(slot.time)}</span>
            <span className="text-base text-slate-700 flex-1">{slot.label}</span>
            <Button
              size="default"
              variant="ghost"
              className="h-11 text-base"
              onClick={() => {
                setEditingId(slot.id);
                setEditLabel(slot.label);
                setEditTime(formatTime(slot.time));
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
          </>
        )}
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
      <div className="rounded-xl border border-slate-200 bg-white p-4">
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
