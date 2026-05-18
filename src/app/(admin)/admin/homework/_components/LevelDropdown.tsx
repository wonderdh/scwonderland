"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createSeriesLevel,
  updateSeriesLevel,
  deleteSeriesLevel,
} from "@/app/(admin)/admin/actions";
import type { SeriesLevelRow } from "@/app/(admin)/admin/actions";

type SubPanelState =
  | { mode: "closed" }
  | { mode: "create"; name: string }
  | { mode: "edit"; id: string; name: string; isActive: boolean };

type Props = {
  seriesId: string;
  initialLevels: SeriesLevelRow[];
  onChange: (next: SeriesLevelRow[]) => void;
};

export function LevelDropdown({ seriesId, initialLevels, onChange }: Props) {
  const [levels, setLevels] = useState<SeriesLevelRow[]>(initialLevels);
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState<SubPanelState>({ mode: "closed" });
  const [isPending, startTransition] = useTransition();

  const activeCount = levels.filter((l) => l.is_active).length;

  function sync(next: SeriesLevelRow[]) {
    setLevels(next);
    onChange(next);
  }

  function handleSave() {
    if (sub.mode === "closed") return;
    const name = sub.mode === "create" ? sub.name : sub.name;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("레벨 이름을 입력해 주세요.");
      return;
    }
    startTransition(async () => {
      if (sub.mode === "create") {
        const res = await createSeriesLevel({
          seriesId,
          level: trimmed,
          sortOrder: levels.length,
        });
        if (res.error || !res.id) {
          toast.error(res.error ?? "레벨 추가 실패");
          return;
        }
        toast.success("레벨이 추가됐습니다.");
        const next: SeriesLevelRow[] = [
          ...levels,
          { id: res.id, level: trimmed, sort_order: levels.length, is_active: true },
        ];
        sync(next);
        setSub({ mode: "closed" });
      } else {
        const res = await updateSeriesLevel(sub.id, { level: trimmed });
        if (res.error) {
          toast.error(res.error);
          return;
        }
        toast.success("레벨이 수정됐습니다.");
        sync(
          levels.map((l) => (l.id === sub.id ? { ...l, level: trimmed } : l))
        );
        setSub({ mode: "closed" });
      }
    });
  }

  function handleDelete() {
    if (sub.mode !== "edit") return;
    if (!confirm(`'${sub.name}' 레벨을 삭제할까요?`)) return;
    const id = sub.id;
    startTransition(async () => {
      const res = await deleteSeriesLevel(id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("레벨이 삭제됐습니다.");
      sync(levels.filter((l) => l.id !== id));
      setSub({ mode: "closed" });
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm hover:bg-slate-50"
      >
        <span className="text-slate-700">레벨 관리</span>
        <span className="text-xs text-slate-400">현재 {activeCount}개</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-md border bg-white shadow-lg">
          <ul className="max-h-64 overflow-y-auto py-1 text-sm">
            <li>
              <button
                type="button"
                onClick={() => setSub({ mode: "create", name: "" })}
                className="w-full px-3 py-2 text-left font-medium text-blue-600 hover:bg-slate-50"
              >
                + 레벨 추가
              </button>
            </li>
            {levels.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() =>
                    setSub({
                      mode: "edit",
                      id: l.id,
                      name: l.level ?? "",
                      isActive: l.is_active,
                    })
                  }
                  className={`w-full px-3 py-2 text-left hover:bg-slate-50 ${
                    !l.is_active ? "text-slate-400" : "text-slate-800"
                  }`}
                >
                  {l.level || <span className="italic text-slate-400">(이름 없음)</span>}
                  {!l.is_active && (
                    <span className="ml-2 text-[10px] text-slate-400">비활성</span>
                  )}
                </button>
              </li>
            ))}
            {levels.length === 0 && (
              <li className="px-3 py-2 text-slate-400">레벨이 없습니다.</li>
            )}
          </ul>

          {sub.mode !== "closed" && (
            <div className="border-t bg-slate-50 p-2.5 space-y-2">
              <Input
                value={sub.name}
                onChange={(e) =>
                  setSub((prev) =>
                    prev.mode === "closed"
                      ? prev
                      : { ...prev, name: e.target.value }
                  )
                }
                placeholder="레벨 이름 (예: Beginner)"
                disabled={isPending}
                className="h-9"
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setSub({ mode: "closed" })}
                  disabled={isPending}
                >
                  취소
                </Button>
                {sub.mode === "edit" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleDelete}
                    disabled={isPending}
                    className="text-red-600 hover:bg-red-50"
                  >
                    삭제
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSave}
                  disabled={isPending}
                >
                  저장
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
