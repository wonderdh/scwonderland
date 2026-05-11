"use client";

import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormGroup } from "@/components/forms/FormGroup";
import {
  listAllPublishers,
  createPublisher,
  updatePublisher,
  deletePublisher,
} from "../../actions";
import type { Database } from "@/lib/types/database.generated";

type PublisherRow = Database["public"]["Tables"]["publishers"]["Row"];

// ── Inline form ────────────────────────────────────────────────────────────

function PublisherForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: PublisherRow;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      let result: { error?: string };
      if (initial) {
        if (!fd.has("is_active")) {
          fd.set("is_active", String(initial.is_active));
        }
        result = await updatePublisher(initial.id, fd);
      } else {
        result = await createPublisher(fd);
      }
      if (result.error) {
        setFormError(result.error);
        return;
      }
      toast.success(initial ? "출판사가 수정됐습니다." : "출판사가 추가됐습니다.");
      onSaved();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border bg-slate-50 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormGroup label="출판사 이름" required>
          <Input
            name="name"
            defaultValue={initial?.name ?? ""}
            placeholder="예: 능률, YBM, 시사"
            required
            disabled={isPending}
            autoFocus={!initial}
            className="h-9"
          />
        </FormGroup>
        <FormGroup label="홈페이지 URL">
          <Input
            name="homepage_url"
            defaultValue={initial?.homepage_url ?? ""}
            placeholder="https://example.com"
            disabled={isPending}
            className="h-9"
          />
        </FormGroup>
      </div>
      {initial && (
        <FormGroup label="상태">
          <select
            name="is_active"
            defaultValue={initial.is_active ? "true" : "false"}
            disabled={isPending}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="true">활성</option>
            <option value="false">비활성</option>
          </select>
        </FormGroup>
      )}
      {formError && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{formError}</p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
          취소
        </Button>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "저장 중..." : "저장"}
        </Button>
      </div>
    </form>
  );
}

// ── Row ────────────────────────────────────────────────────────────────────

function PublisherRowItem({
  publisher,
  onEdit,
  onDeactivate,
  onActivate,
}: {
  publisher: PublisherRow;
  onEdit: () => void;
  onDeactivate: () => void;
  onActivate: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-xl border bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md ${
        !publisher.is_active ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <span className="font-semibold text-slate-900 text-sm">{publisher.name}</span>
          {publisher.homepage_url && (
            <a
              href={publisher.homepage_url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 inline-flex items-center gap-0.5 text-xs text-blue-500 hover:text-blue-700"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3 w-3" />
              <span className="sr-only">홈페이지</span>
            </a>
          )}
        </div>
        {!publisher.is_active && (
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-500 shrink-0">
            비활성
          </span>
        )}
        {publisher.is_active && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 shrink-0">
            활성
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-4">
        <Button size="sm" variant="outline" onClick={onEdit}>
          수정
        </Button>
        {publisher.is_active ? (
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

// ── Dialog ─────────────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPublishers?: PublisherRow[];
};

export function PublishersDialog({ open, onOpenChange }: Props) {
  const [publishers, setPublishers] = useState<PublisherRow[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editTarget, setEditTarget] = useState<PublisherRow | null>(null);
  const [, startTransition] = useTransition();

  const refetch = () => {
    listAllPublishers().then((rows) => setPublishers(rows));
  };

  // Fetch list when dialog opens
  useEffect(() => {
    if (open) refetch();
  }, [open]);

  // Reset transient UI state when closing — done in handler, not in effect.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setShowAddForm(false);
      setEditTarget(null);
    }
    onOpenChange(next);
  };

  if (!open) return null;

  const handleDeactivate = (publisher: PublisherRow) => {
    startTransition(async () => {
      const result = await deletePublisher(publisher.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("비활성화됐습니다.");
      setPublishers((prev) =>
        prev.map((p) => (p.id === publisher.id ? { ...p, is_active: false } : p))
      );
    });
  };

  const handleActivate = (publisher: PublisherRow) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", publisher.name);
      if (publisher.homepage_url) fd.set("homepage_url", publisher.homepage_url);
      fd.set("is_active", "true");
      const result = await updatePublisher(publisher.id, fd);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("활성화됐습니다.");
      setPublishers((prev) =>
        prev.map((p) => (p.id === publisher.id ? { ...p, is_active: true } : p))
      );
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => handleOpenChange(false)}
    >
      <div
        className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <h2 className="text-xl font-semibold text-slate-900">출판사 관리</h2>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => handleOpenChange(false)}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">닫기</span>
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Add button / form */}
          {showAddForm ? (
            <PublisherForm
              onSaved={() => {
                setShowAddForm(false);
                refetch();
              }}
              onCancel={() => setShowAddForm(false)}
            />
          ) : (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setShowAddForm(true)}>
                + 출판사 추가
              </Button>
            </div>
          )}

          {/* Stats */}
          <p className="text-sm text-slate-500">
            총 {publishers.length}개 출판사 (활성{" "}
            {publishers.filter((p) => p.is_active).length}개)
          </p>

          {/* List */}
          {publishers.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-slate-50/50 p-10 text-center text-sm text-slate-400">
              등록된 출판사가 없습니다. 출판사를 추가하세요.
            </div>
          ) : (
            <div className="space-y-2">
              {publishers.map((publisher) =>
                editTarget?.id === publisher.id ? (
                  <PublisherForm
                    key={publisher.id}
                    initial={publisher}
                    onSaved={() => {
                      setEditTarget(null);
                      refetch();
                    }}
                    onCancel={() => setEditTarget(null)}
                  />
                ) : (
                  <PublisherRowItem
                    key={publisher.id}
                    publisher={publisher}
                    onEdit={() => {
                      setShowAddForm(false);
                      setEditTarget(publisher);
                    }}
                    onDeactivate={() => handleDeactivate(publisher)}
                    onActivate={() => handleActivate(publisher)}
                  />
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
