"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormGroup } from "@/components/forms/FormGroup";
import { PublisherPicker } from "@/components/forms/PublisherPicker";
import { PublishersDialog } from "./PublishersDialog";
import { createSeries, updateSeries, deleteSeries } from "../../actions";
import type { SeriesWithPublisher } from "../../actions";

type PublisherOption = { id: string; name: string };

// ── Modal ──────────────────────────────────────────────────────────────────

type ModalMode = "create" | "edit";

function SeriesModal({
  mode,
  initial,
  initialPublishers,
  onClose,
  onSaved,
}: {
  mode: ModalMode;
  initial?: SeriesWithPublisher;
  initialPublishers?: PublisherOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [publisherId, setPublisherId] = useState<string | null>(
    initial?.publisher_id ?? null
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const fd = new FormData(e.currentTarget);
    // Inject publisher_id from state (not a native form field)
    fd.set("publisher_id", publisherId ?? "");

    startTransition(async () => {
      let result: { error?: string };
      if (mode === "edit" && initial) {
        // Preserve is_active in edit mode
        if (!fd.has("is_active")) {
          fd.set("is_active", String(initial.is_active));
        }
        result = await updateSeries(initial.id, fd);
      } else {
        result = await createSeries(fd);
      }
      if (result.error) {
        setFormError(result.error);
        return;
      }
      toast.success(mode === "edit" ? "시리즈가 수정됐습니다." : "시리즈가 추가됐습니다.");
      onSaved();
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold text-slate-900 mb-5">
          {mode === "edit" ? "시리즈 수정" : "시리즈 추가"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormGroup label="시리즈 이름" required>
            <Input
              name="name"
              defaultValue={initial?.name ?? ""}
              placeholder="예: Let's Go, 나기창"
              required
              disabled={isPending}
              className="h-10"
            />
          </FormGroup>

          <FormGroup label="출판사">
            <PublisherPicker
              value={publisherId}
              onChange={setPublisherId}
              initialPublishers={initialPublishers}
              disabled={isPending}
            />
          </FormGroup>

          {mode === "edit" && (
            <FormGroup label="상태">
              <select
                name="is_active"
                defaultValue={initial?.is_active ? "true" : "false"}
                disabled={isPending}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="true">활성</option>
                <option value="false">비활성</option>
              </select>
            </FormGroup>
          )}

          {formError && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
              취소
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "저장 중..." : "저장"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Row ────────────────────────────────────────────────────────────────────

function SeriesRowItem({
  series,
  onEdit,
  onDeactivate,
  onActivate,
}: {
  series: SeriesWithPublisher;
  onEdit: () => void;
  onDeactivate: () => void;
  onActivate: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-xl border bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md ${
        !series.is_active ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <span className="font-semibold text-slate-900 text-sm">{series.name}</span>
          {series.publisher && (
            <span className="ml-2 text-xs text-slate-500">
              {series.publisher.name}
              {series.publisher.homepage_url && (
                <a
                  href={series.publisher.homepage_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 inline-flex items-center text-blue-500 hover:text-blue-700"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-3 w-3" />
                  <span className="sr-only">홈페이지</span>
                </a>
              )}
            </span>
          )}
        </div>
        {!series.is_active && (
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-500 shrink-0">
            비활성
          </span>
        )}
        {series.is_active && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 shrink-0">
            활성
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-4">
        <Button size="sm" variant="outline" onClick={onEdit}>
          수정
        </Button>
        {series.is_active ? (
          <Button size="sm" variant="ghost" onClick={onDeactivate} className="text-slate-500">
            비활성화
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={onActivate} className="text-green-600">
            활성화
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Manager ────────────────────────────────────────────────────────────────

export function SeriesManager({
  initialSeries,
  initialPublishers,
}: {
  initialSeries: SeriesWithPublisher[];
  initialPublishers?: PublisherOption[];
}) {
  const [seriesList, setSeriesList] = useState<SeriesWithPublisher[]>(initialSeries);
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [editTarget, setEditTarget] = useState<SeriesWithPublisher | null>(null);
  const [publishersOpen, setPublishersOpen] = useState(false);
  const [, startTransition] = useTransition();

  const handleSaved = () => {
    window.location.reload();
  };

  const handleDeactivate = (series: SeriesWithPublisher) => {
    startTransition(async () => {
      const result = await deleteSeries(series.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("비활성화됐습니다.");
      setSeriesList((prev) =>
        prev.map((s) => (s.id === series.id ? { ...s, is_active: false } : s))
      );
    });
  };

  const handleActivate = (series: SeriesWithPublisher) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", series.name);
      fd.set("publisher_id", series.publisher_id ?? "");
      fd.set("is_active", "true");
      const result = await updateSeries(series.id, fd);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("활성화됐습니다.");
      setSeriesList((prev) =>
        prev.map((s) => (s.id === series.id ? { ...s, is_active: true } : s))
      );
    });
  };

  return (
    <>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-slate-500">
          총 {seriesList.length}개 시리즈 (활성{" "}
          {seriesList.filter((s) => s.is_active).length}개)
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPublishersOpen(true)}
          >
            + 출판사
          </Button>
          <Button
            onClick={() => {
              setEditTarget(null);
              setModalMode("create");
            }}
          >
            + 시리즈 추가
          </Button>
        </div>
      </div>

      {/* List */}
      {seriesList.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-slate-50/50 p-10 text-center text-sm text-slate-400">
          등록된 시리즈가 없습니다. 시리즈를 추가하세요.
        </div>
      ) : (
        <div className="space-y-2">
          {seriesList.map((series) => (
            <SeriesRowItem
              key={series.id}
              series={series}
              onEdit={() => {
                setEditTarget(series);
                setModalMode("edit");
              }}
              onDeactivate={() => handleDeactivate(series)}
              onActivate={() => handleActivate(series)}
            />
          ))}
        </div>
      )}

      {/* Series Modal */}
      {modalMode && (
        <SeriesModal
          mode={modalMode}
          initial={editTarget ?? undefined}
          initialPublishers={initialPublishers}
          onClose={() => {
            setModalMode(null);
            setEditTarget(null);
          }}
          onSaved={handleSaved}
        />
      )}

      {/* Publishers Dialog */}
      <PublishersDialog
        open={publishersOpen}
        onOpenChange={setPublishersOpen}
      />
    </>
  );
}
