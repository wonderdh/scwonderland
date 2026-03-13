"use client";

import { useState } from "react";
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
} from "../../actions";

export function BusManagePanel({
  busNumbers,
  busTimeSlots: _busTimeSlots,
  initialStops,
}: {
  busNumbers: BusNumber[];
  busTimeSlots: BusTimeSlot[];
  initialStops: BusStop[];
}) {
  const router = useRouter();

  // Local stop list (optimistic updates for create/update/delete)
  const [stops, setStops] = useState<BusStop[]>(initialStops);

  // Bus CRUD state
  const [newBusLabel, setNewBusLabel] = useState("");
  const [editingBusId, setEditingBusId] = useState<string | null>(null);
  const [editBusLabel, setEditBusLabel] = useState("");

  // Stop CRUD state
  const [newStopName, setNewStopName] = useState("");
  const [editingStopId, setEditingStopId] = useState<string | null>(null);
  const [editStopName, setEditStopName] = useState("");
  const [stopSearch, setStopSearch] = useState("");

  const [loading, setLoading] = useState(false);

  // ── Bus CRUD ──

  async function handleCreateBus() {
    if (!newBusLabel.trim()) return;
    setLoading(true);
    const result = await createBusNumber(newBusLabel.trim());
    if (result.error) {
      toast.error(result.error);
    } else {
      setNewBusLabel("");
      router.refresh();
    }
    setLoading(false);
  }

  async function handleUpdateBus(id: string) {
    if (!editBusLabel.trim()) return;
    setLoading(true);
    const result = await updateBusNumber(id, editBusLabel.trim());
    if (result.error) {
      toast.error(result.error);
    } else {
      setEditingBusId(null);
      router.refresh();
    }
    setLoading(false);
  }

  async function handleDeleteBus(id: string, label: string) {
    if (!confirm(`"${label}" 호차를 삭제하시겠습니까?`)) return;
    setLoading(true);
    const result = await deleteBusNumber(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      router.refresh();
    }
    setLoading(false);
  }

  // ── Stop CRUD ──

  async function handleCreateStop() {
    if (!newStopName.trim()) return;
    setLoading(true);
    const result = await createBusStop(newStopName.trim());
    if (result.error) {
      toast.error(result.error);
    } else {
      const name = newStopName.trim();
      setNewStopName("");
      setStops((prev) => [
        ...prev,
        {
          id: result.id!,
          name,
          sort_order: prev.length,
          is_active: true,
          created_at: "",
          updated_at: "",
        },
      ]);
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
      setStops((prev) =>
        prev.map((s) => (s.id === stopId ? { ...s, name: editStopName.trim() } : s))
      );
    }
    setLoading(false);
  }

  async function handleDeleteStop(stopId: string, name: string) {
    if (!confirm(`"${name}" 정류장을 삭제하시겠습니까?`)) return;
    setLoading(true);
    const result = await deleteBusStop(stopId);
    if (result.error) {
      toast.error(result.error);
    } else {
      setStops((prev) => prev.filter((s) => s.id !== stopId));
    }
    setLoading(false);
  }

  // ── Render ──

  return (
    <div className="space-y-8">
      {/* ── 호차 관리 ── */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">호차 관리</h3>

        {/* Bus list */}
        <div className="space-y-2">
          {busNumbers.length === 0 && (
            <p className="text-xs text-slate-400 py-6 text-center">등록된 호차가 없습니다.</p>
          )}
          {busNumbers.map((bus) => (
            <div
              key={bus.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white"
            >
              {editingBusId === bus.id ? (
                <>
                  <Input
                    value={editBusLabel}
                    onChange={(e) => setEditBusLabel(e.target.value)}
                    className="max-w-40 h-7 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleUpdateBus(bus.id);
                      if (e.key === "Escape") setEditingBusId(null);
                    }}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => handleUpdateBus(bus.id)}
                    disabled={loading || !editBusLabel.trim()}
                  >
                    저장
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setEditingBusId(null)}
                  >
                    취소
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-sm">🚌</span>
                  <span className="text-sm font-medium text-slate-700 flex-1">{bus.label}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => {
                      setEditingBusId(bus.id);
                      setEditBusLabel(bus.label);
                    }}
                    disabled={loading}
                  >
                    수정
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-red-500 hover:text-red-700"
                    onClick={() => handleDeleteBus(bus.id, bus.label)}
                    disabled={loading}
                  >
                    삭제
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Add bus */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 whitespace-nowrap">새 호차:</span>
          <Input
            placeholder="호차 이름 (예: 1호차)"
            value={newBusLabel}
            onChange={(e) => setNewBusLabel(e.target.value)}
            className="max-w-48 h-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newBusLabel.trim()) handleCreateBus();
            }}
          />
          <Button
            size="sm"
            className="h-8"
            onClick={handleCreateBus}
            disabled={loading || !newBusLabel.trim()}
          >
            추가
          </Button>
        </div>
      </section>

      <div className="border-t border-slate-100" />

      {/* ── 정류장 관리 ── */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">정류장 관리</h3>

        <div className="flex items-center gap-2 flex-wrap">
          <Input
            placeholder="정류장 검색..."
            value={stopSearch}
            onChange={(e) => setStopSearch(e.target.value)}
            className="h-8 text-sm w-40"
          />
          <Input
            placeholder="새 정류장 이름"
            value={newStopName}
            onChange={(e) => setNewStopName(e.target.value)}
            className="h-8 text-sm w-44"
            onKeyDown={(e) => { if (e.key === "Enter" && newStopName.trim()) handleCreateStop(); }}
          />
          <Button
            size="sm"
            className="h-8"
            onClick={handleCreateStop}
            disabled={loading || !newStopName.trim()}
          >
            추가
          </Button>
        </div>

        {/* Stop list */}
        <div className="space-y-2">
          {stops.length === 0 && (
            <p className="text-xs text-slate-400 py-6 text-center">등록된 정류장이 없습니다.</p>
          )}
          {[...stops]
            .sort((a, b) => a.name.localeCompare(b.name))
            .filter((s) => !stopSearch || s.name.toLowerCase().includes(stopSearch.toLowerCase()))
            .map((stop) => (
            <div
              key={stop.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white"
            >
              {editingStopId === stop.id ? (
                <>
                  <Input
                    value={editStopName}
                    onChange={(e) => setEditStopName(e.target.value)}
                    className="max-w-48 h-7 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleUpdateStop(stop.id);
                      if (e.key === "Escape") setEditingStopId(null);
                    }}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => handleUpdateStop(stop.id)}
                    disabled={loading || !editStopName.trim()}
                  >
                    저장
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setEditingStopId(null)}
                  >
                    취소
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-xs text-slate-400">📍</span>
                  <span className="text-sm text-slate-700 flex-1">{stop.name}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => {
                      setEditingStopId(stop.id);
                      setEditStopName(stop.name);
                    }}
                    disabled={loading}
                  >
                    수정
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-red-500 hover:text-red-700"
                    onClick={() => handleDeleteStop(stop.id, stop.name)}
                    disabled={loading}
                  >
                    삭제
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>

      </section>
    </div>
  );
}
