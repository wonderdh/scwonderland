"use client";

import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormGroup } from "@/components/forms/FormGroup";
import { Modal } from "@/components/overlays/Modal";
import { listSeries, createSeries } from "@/app/(admin)/admin/actions/series-actions";

type SeriesOption = { id: string; name: string };

type Props = {
  value: string | null;
  onChange: (seriesId: string | null) => void;
  initialSeries?: SeriesOption[];
  disabled?: boolean;
};

function NewSeriesModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (series: SeriesOption) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createSeries(fd);
      if (result.error) {
        setFormError(result.error);
        return;
      }
      if (result.data) {
        toast.success("시리즈가 추가됐습니다.");
        onCreated({ id: result.data.id, name: result.data.name });
        onClose();
      }
    });
  }

  return (
    <Modal open onClose={onClose} size="sm">
      <div className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">새 시리즈 추가</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormGroup label="시리즈 이름" required>
            <Input
              name="name"
              placeholder="예: Let's Go, 나기창"
              required
              disabled={isPending}
              autoFocus
              className="h-10"
            />
          </FormGroup>
          {formError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
              취소
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "추가 중..." : "추가"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

export function SeriesPicker({ value, onChange, initialSeries, disabled }: Props) {
  const [options, setOptions] = useState<SeriesOption[]>(initialSeries ?? []);
  const [showModal, setShowModal] = useState(false);
  // If initialSeries is not provided we'll fetch on mount; start in loading state.
  const [loading, setLoading] = useState(!initialSeries);

  useEffect(() => {
    if (initialSeries) return;
    let cancelled = false;
    listSeries({ activeOnly: true }).then((rows) => {
      if (!cancelled) {
        setOptions(rows.map((r) => ({ id: r.id, name: r.name })));
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreated = (series: SeriesOption) => {
    setOptions((prev) => [...prev, series]);
    onChange(series.id);
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={disabled || loading}
        className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">(시리즈 없음)</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.name}
          </option>
        ))}
      </select>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || loading}
        onClick={() => setShowModal(true)}
        className="shrink-0 h-10 px-3 text-xs"
      >
        + 새 시리즈
      </Button>
      {showModal && (
        <NewSeriesModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
