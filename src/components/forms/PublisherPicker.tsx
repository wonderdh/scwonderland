"use client";

import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormGroup } from "@/components/forms/FormGroup";
import { listPublishers, createPublisher } from "@/app/(admin)/admin/actions";

type PublisherOption = { id: string; name: string };

type Props = {
  value: string | null;
  onChange: (publisherId: string | null) => void;
  initialPublishers?: PublisherOption[];
  disabled?: boolean;
};

function NewPublisherModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (publisher: PublisherOption) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createPublisher(fd);
      if (result.error) {
        setFormError(result.error);
        return;
      }
      if (result.data) {
        toast.success("출판사가 추가됐습니다.");
        onCreated({ id: result.data.id, name: result.data.name });
        onClose();
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900 mb-4">새 출판사 추가</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormGroup label="출판사 이름" required>
            <Input
              name="name"
              placeholder="예: 능률, YBM, 시사"
              required
              disabled={isPending}
              autoFocus
              className="h-10"
            />
          </FormGroup>
          <FormGroup label="홈페이지 URL">
            <Input
              name="homepage_url"
              type="text"
              placeholder="예: https://www.neungyule.com"
              disabled={isPending}
              className="h-10"
            />
          </FormGroup>
          {formError && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
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
    </div>
  );
}

export function PublisherPicker({ value, onChange, initialPublishers, disabled }: Props) {
  const [options, setOptions] = useState<PublisherOption[]>(initialPublishers ?? []);
  const [showModal, setShowModal] = useState(false);
  // If initialPublishers is not provided we'll fetch on mount; start in loading state.
  const [loading, setLoading] = useState(!initialPublishers);

  useEffect(() => {
    if (initialPublishers) return;
    let cancelled = false;
    listPublishers({ activeOnly: true }).then((rows) => {
      if (!cancelled) {
        setOptions(rows.map((r) => ({ id: r.id, name: r.name })));
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreated = (publisher: PublisherOption) => {
    setOptions((prev) => [...prev, publisher]);
    onChange(publisher.id);
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={disabled || loading}
        className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">(출판사 없음)</option>
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
        + 새 출판사
      </Button>
      {showModal && (
        <NewPublisherModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
