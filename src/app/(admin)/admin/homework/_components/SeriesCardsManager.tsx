"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/overlays/ConfirmDialog";
import { PublishersDialog } from "./PublishersDialog";
import { SeriesCard } from "./SeriesCard";
import { SeriesEditorModal } from "./SeriesEditorModal";
import {
  deleteSeries,
  listSeriesLevels,
} from "@/app/(admin)/admin/actions";
import type {
  SeriesWithPublisher,
  SeriesLevelRow,
} from "@/app/(admin)/admin/actions";

type PublisherOption = { id: string; name: string };

type EditorState =
  | { kind: "closed" }
  | { kind: "create" }
  | {
      kind: "edit";
      series: SeriesWithPublisher;
      levels: SeriesLevelRow[];
    };

type Props = {
  initialSeries: SeriesWithPublisher[];
  initialLevelsBySeries: Record<string, SeriesLevelRow[]>;
  initialPublishers?: PublisherOption[];
};

export function SeriesCardsManager({
  initialSeries,
  initialLevelsBySeries,
  initialPublishers,
}: Props) {
  const [seriesList, setSeriesList] =
    useState<SeriesWithPublisher[]>(initialSeries);
  const [levelsBySeries, setLevelsBySeries] = useState<
    Record<string, SeriesLevelRow[]>
  >(initialLevelsBySeries);

  const [editor, setEditor] = useState<EditorState>({ kind: "closed" });
  const [deleteTarget, setDeleteTarget] =
    useState<SeriesWithPublisher | null>(null);
  const [publishersOpen, setPublishersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [publisherFilter, setPublisherFilter] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const publisherOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of seriesList) {
      if (s.publisher) map.set(s.publisher.id, s.publisher.name);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [seriesList]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return seriesList.filter((s) => {
      const matchSearch = q ? s.name.toLowerCase().includes(q) : true;
      const matchPublisher = publisherFilter
        ? s.publisher?.id === publisherFilter
        : true;
      return matchSearch && matchPublisher;
    });
  }, [seriesList, search, publisherFilter]);

  async function openEditModal(series: SeriesWithPublisher) {
    const levels = levelsBySeries[series.id] ?? (await listSeriesLevels(series.id));
    setLevelsBySeries((prev) => ({ ...prev, [series.id]: levels }));
    setEditor({ kind: "edit", series, levels });
  }

  function handleSaved(
    series: SeriesWithPublisher,
    levels: SeriesLevelRow[]
  ) {
    setSeriesList((prev) => {
      const idx = prev.findIndex((s) => s.id === series.id);
      if (idx === -1) return [...prev, series].sort((a, b) =>
        a.name.localeCompare(b.name, "ko")
      );
      const next = [...prev];
      next[idx] = series;
      return next;
    });
    setLevelsBySeries((prev) => ({ ...prev, [series.id]: levels }));
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    startTransition(async () => {
      const res = await deleteSeries(id);
      if (res.error) {
        toast.error(res.error);
        setDeleteTarget(null);
        return;
      }
      toast.success("시리즈가 삭제됐습니다.");
      setSeriesList((prev) => prev.filter((s) => s.id !== id));
      setLevelsBySeries((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setDeleteTarget(null);
    });
  }

  return (
    <>
      {/* 상단 바 */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {publisherOptions.length > 0 && (
          <select
            value={publisherFilter}
            onChange={(e) => setPublisherFilter(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">출판사 전체</option>
            {publisherOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <Input
          placeholder="시리즈명 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-56 h-9"
        />
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" onClick={() => setPublishersOpen(true)}>
            + 출판사
          </Button>
          <Button onClick={() => setEditor({ kind: "create" })}>
            + 시리즈 추가
          </Button>
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-slate-50/50 p-10 text-center text-sm text-slate-400">
          {search || publisherFilter
            ? "검색 결과가 없습니다."
            : "등록된 시리즈가 없습니다. 시리즈를 추가하세요."}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map((series) => (
            <SeriesCard
              key={series.id}
              series={series}
              levels={levelsBySeries[series.id] ?? []}
              onEdit={() => openEditModal(series)}
              onDelete={() => setDeleteTarget(series)}
            />
          ))}
        </div>
      )}

      {/* Editor modal */}
      {editor.kind !== "closed" && (
        <SeriesEditorModal
          mode={
            editor.kind === "create"
              ? { kind: "create" }
              : {
                  kind: "edit",
                  initial: editor.series,
                  initialLevels: editor.levels,
                }
          }
          initialPublishers={initialPublishers}
          onClose={() => setEditor({ kind: "closed" })}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="시리즈 삭제"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" 시리즈와 모든 레벨을 삭제합니다. 반에 부여돼 사용 중이면 차단됩니다. 진행할까요?`
            : ""
        }
        confirmLabel={isPending ? "삭제 중..." : "삭제"}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Publishers dialog */}
      <PublishersDialog
        open={publishersOpen}
        onOpenChange={setPublishersOpen}
      />
    </>
  );
}
