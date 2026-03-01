"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BusNumber } from "@/lib/types";
import {
  createBusNumber,
  updateBusNumber,
  deleteBusNumber,
} from "../../actions";

export function BusNumbersManager({ busNumbers }: { busNumbers: BusNumber[] }) {
  const router = useRouter();
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
        />
        <Button size="sm" onClick={handleCreate} disabled={loading || !newLabel.trim()}>
          추가
        </Button>
      </div>

      {/* 목록 */}
      <div className="space-y-1">
        {busNumbers.length === 0 && (
          <p className="text-xs text-slate-400 py-4">등록된 호차가 없습니다.</p>
        )}
        {busNumbers.map((bus) => (
          <div
            key={bus.id}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
          >
            {editingId === bus.id ? (
              <>
                <Input
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="max-w-36 h-8 text-sm"
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
                <span className="text-sm font-medium flex-1">{bus.label}</span>
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
        ))}
      </div>
    </div>
  );
}
