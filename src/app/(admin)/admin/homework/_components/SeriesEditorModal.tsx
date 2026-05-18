"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormGroup } from "@/components/forms/FormGroup";
import { PublisherPicker } from "@/components/forms/PublisherPicker";
import { LevelDropdown } from "./LevelDropdown";
import {
  createSeries,
  updateSeries,
} from "@/app/(admin)/admin/actions";
import type {
  SeriesWithPublisher,
  SeriesLevelRow,
} from "@/app/(admin)/admin/actions";
import { convertImageToWebP } from "@/lib/supabase/storage";

type PublisherOption = { id: string; name: string };

type Mode =
  | { kind: "create" }
  | {
      kind: "edit";
      initial: SeriesWithPublisher;
      initialLevels: SeriesLevelRow[];
    };

type Props = {
  mode: Mode;
  initialPublishers?: PublisherOption[];
  onClose: () => void;
  onSaved: (
    series: SeriesWithPublisher,
    levels: SeriesLevelRow[]
  ) => void;
};

export function SeriesEditorModal({
  mode,
  initialPublishers,
  onClose,
  onSaved,
}: Props) {
  const isEdit = mode.kind === "edit";
  const initial = isEdit ? mode.initial : null;
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [publisherId, setPublisherId] = useState<string | null>(
    initial?.publisher_id ?? null
  );
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(
    initial?.cover_image_url ?? null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [levels, setLevels] = useState<SeriesLevelRow[]>(
    isEdit ? mode.initialLevels : []
  );

  function handleCoverDoubleClick() {
    if (isPending) return;
    fileInputRef.current?.click();
  }

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setCoverFile(f);
    setCoverPreview(URL.createObjectURL(f));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("publisher_id", publisherId ?? "");

    startTransition(async () => {
      if (coverFile) {
        try {
          const webp = await convertImageToWebP(coverFile);
          fd.set("cover", webp);
        } catch (err) {
          setFormError(
            err instanceof Error ? err.message : "이미지 변환에 실패했습니다."
          );
          return;
        }
      }
      if (isEdit && !fd.has("is_active")) {
        fd.set("is_active", String(initial?.is_active ?? true));
      }
      const res = isEdit
        ? await updateSeries(initial!.id, fd)
        : await createSeries(fd);
      if (res.error || !res.data) {
        setFormError(res.error ?? "저장 실패");
        return;
      }
      toast.success(isEdit ? "시리즈가 수정됐습니다." : "시리즈가 추가됐습니다.");
      // re-attach publisher join for parent sync (best-effort: use form publisher option)
      const pub =
        publisherId && initialPublishers
          ? initialPublishers.find((p) => p.id === publisherId)
          : null;
      const merged: SeriesWithPublisher = {
        ...(res.data as SeriesWithPublisher),
        publisher: pub
          ? { id: pub.id, name: pub.name, homepage_url: null }
          : initial?.publisher ?? null,
      };
      onSaved(merged, levels);
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold text-slate-900 mb-5">
          {isEdit ? "시리즈 수정" : "시리즈 추가"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-4">
            {/* 표지 — 더블클릭 시 file picker */}
            <FormGroup label="표지 이미지">
              <button
                type="button"
                onDoubleClick={handleCoverDoubleClick}
                title="더블클릭으로 표지 교체"
                className="relative flex aspect-[3/4] w-28 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100"
              >
                {coverPreview ? (
                  <Image
                    src={coverPreview}
                    alt="표지"
                    fill
                    sizes="120px"
                    className="object-cover"
                  />
                ) : (
                  <span className="text-[11px] text-slate-400">
                    더블클릭하여
                    <br />
                    이미지 선택
                  </span>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverChange}
                disabled={isPending}
              />
            </FormGroup>

            <div className="flex flex-1 flex-col gap-3">
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

              <FormGroup label="총 단원 수" required>
                <Input
                  name="total_units"
                  type="number"
                  min={1}
                  defaultValue={initial?.total_units ?? 1}
                  required
                  disabled={isPending}
                  className="h-10"
                />
              </FormGroup>
            </div>
          </div>

          <FormGroup label="출판사">
            <PublisherPicker
              value={publisherId}
              onChange={setPublisherId}
              initialPublishers={initialPublishers}
              disabled={isPending}
            />
          </FormGroup>

          {isEdit && (
            <FormGroup label="레벨">
              <LevelDropdown
                seriesId={initial!.id}
                initialLevels={levels}
                onChange={setLevels}
              />
            </FormGroup>
          )}

          {!isEdit && (
            <p className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700">
              레벨은 시리즈를 먼저 저장한 뒤 추가할 수 있습니다.
            </p>
          )}

          {isEdit && (
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
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isPending}
            >
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
