"use client";

import { useState, useTransition, useCallback } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileUpload } from "@/components/forms/FileUpload";
import { FormGroup } from "@/components/forms/FormGroup";
import { SeriesPicker } from "@/components/forms/SeriesPicker";
import {
  createTextbook,
  updateTextbook,
} from "../../actions";
import { convertImageToWebP } from "@/lib/supabase/storage";
import type { Database } from "@/lib/types/database.generated";
import type { TextbookWithSeries } from "../../actions";

type SeriesRow = Database["public"]["Tables"]["series"]["Row"];

// ── Modal ──────────────────────────────────────────────────────────────────

type ModalMode = "create" | "edit";

function TextbookModal({
  mode,
  initial,
  seriesList,
  onClose,
  onSaved,
}: {
  mode: ModalMode;
  initial?: TextbookWithSeries;
  seriesList: SeriesRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [coverFiles, setCoverFiles] = useState<File[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(
    initial?.series_id ?? null
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    if (!selectedSeriesId) {
      setFormError("시리즈를 선택해 주세요.");
      return;
    }
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("series_id", selectedSeriesId);
    const rawCover = coverFiles[0];

    startTransition(async () => {
      if (rawCover) {
        try {
          const webp = await convertImageToWebP(rawCover);
          fd.set("cover", webp);
        } catch (err) {
          setFormError(
            err instanceof Error ? err.message : "이미지 변환에 실패했습니다."
          );
          return;
        }
      }
      let result: { error?: string };
      if (mode === "edit" && initial) {
        result = await updateTextbook(initial.id, fd);
      } else {
        result = await createTextbook(fd);
      }
      if (result.error) {
        setFormError(result.error);
        return;
      }
      toast.success(mode === "edit" ? "숙제가 수정됐습니다." : "숙제가 추가됐습니다.");
      onSaved();
      onClose();
    });
  }

  const seriesOptions = seriesList.map((s) => ({ id: s.id, name: s.name }));

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
          {mode === "edit" ? "숙제 수정" : "숙제 추가"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Cover image */}
          <FormGroup label="표지 이미지">
            {mode === "edit" && initial?.cover_image_url && coverFiles.length === 0 && (
              <div className="mb-2 flex items-center gap-3">
                <Image
                  src={initial.cover_image_url}
                  alt="현재 표지"
                  width={48}
                  height={64}
                  className="rounded border object-cover"
                />
                <span className="text-xs text-slate-500">현재 표지. 새 파일 선택 시 교체됩니다.</span>
              </div>
            )}
            <FileUpload
              accept="image/*"
              label="표지 이미지 선택 (최대 10MB)"
              files={coverFiles}
              onFilesChange={setCoverFiles}
              disabled={isPending}
            />
          </FormGroup>

          {/* Series — required (제목으로 자동 사용됨) */}
          <FormGroup label="시리즈" required>
            <SeriesPicker
              value={selectedSeriesId}
              onChange={setSelectedSeriesId}
              initialSeries={seriesOptions}
              disabled={isPending}
            />
            <p className="mt-1 text-xs text-slate-500">시리즈 이름이 숙제 제목으로 사용됩니다.</p>
          </FormGroup>

          {/* Level */}
          <FormGroup label="레벨">
            <Input
              name="level"
              defaultValue={initial?.level ?? ""}
              placeholder="예: Beginner (선택)"
              disabled={isPending}
              className="h-10"
            />
          </FormGroup>

          <div className="grid grid-cols-2 gap-3">
            {/* Total units */}
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

            {/* Sort order */}
            <FormGroup label="정렬 순서">
              <Input
                name="sort_order"
                type="number"
                defaultValue={initial?.sort_order ?? 0}
                disabled={isPending}
                className="h-10"
              />
            </FormGroup>
          </div>

          {/* is_active (edit only) */}
          {mode === "edit" && (
            <div className="flex items-center gap-2">
              <input
                type="hidden"
                name="is_active"
                value={initial?.is_active ? "true" : "false"}
              />
            </div>
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

// ── Card ───────────────────────────────────────────────────────────────────

function TextbookCard({
  textbook,
  onEdit,
  onToggleActive,
}: {
  textbook: TextbookWithSeries;
  onEdit: () => void;
  onToggleActive: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  // Prefer joined series_name, fall back to legacy text column
  const seriesDisplay = textbook.series_name ?? textbook.series ?? null;

  return (
    <div
      className={`relative rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md ${
        !textbook.is_active ? "opacity-60" : ""
      }`}
    >
      {/* 비활성 배지 */}
      {!textbook.is_active && (
        <div className="absolute top-1.5 left-1.5 z-10 rounded-full bg-slate-400 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          비활성
        </div>
      )}

      {/* 우상단 메뉴 */}
      <div className="absolute top-1.5 right-1.5 z-10">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="flex h-6 w-6 items-center justify-center rounded-md bg-white/85 text-slate-500 hover:bg-slate-100 shadow-sm"
          aria-label="메뉴"
        >
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="5" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="12" cy="19" r="1.5" />
          </svg>
        </button>
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-20"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 top-8 z-30 w-32 rounded-lg border bg-white py-1 shadow-lg text-sm">
              <button
                type="button"
                onClick={() => { setMenuOpen(false); onEdit(); }}
                className="w-full px-3 py-2 text-left hover:bg-slate-50"
              >
                수정
              </button>
              <button
                type="button"
                onClick={() => { setMenuOpen(false); onToggleActive(); }}
                className="w-full px-3 py-2 text-left hover:bg-slate-50"
              >
                {textbook.is_active ? "비활성화" : "활성화"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Cover — 책 비율 (3:4) */}
      <div className="relative flex aspect-[3/4] items-center justify-center rounded-t-xl bg-slate-100 overflow-hidden">
        {textbook.cover_image_url ? (
          <Image
            src={textbook.cover_image_url}
            alt={textbook.title}
            fill
            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 14vw"
            className="object-cover"
          />
        ) : (
          <svg
            className="h-10 w-10 text-slate-300"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
            />
          </svg>
        )}
      </div>

      {/* Info — level 우선, 시리즈는 작게 보조 */}
      <div className="px-2 py-1.5">
        <div className="flex items-baseline justify-between gap-1">
          {textbook.level && (
            <span className="truncate text-xs font-semibold text-emerald-600">
              {textbook.level}
            </span>
          )}
          <span className="shrink-0 text-[10px] text-slate-400">
            {textbook.total_units}u
          </span>
        </div>
        <p className="truncate text-[11px] text-slate-500 leading-tight">
          {seriesDisplay ?? textbook.title}
        </p>
      </div>
    </div>
  );
}

// ── Manager ────────────────────────────────────────────────────────────────

export function TextbooksManager({
  initialTextbooks,
  seriesList,
}: {
  initialTextbooks: TextbookWithSeries[];
  seriesList: SeriesRow[];
}) {
  const [textbooks, setTextbooks] = useState<TextbookWithSeries[]>(initialTextbooks);
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [editTarget, setEditTarget] = useState<TextbookWithSeries | null>(null);
  const [, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [seriesFilter, setSeriesFilter] = useState("");

  const handleSaved = useCallback(() => {
    window.location.reload();
  }, []);

  const handleToggleActive = useCallback(
    (textbook: TextbookWithSeries) => {
      startTransition(async () => {
        const fd = new FormData();
        fd.set("title", textbook.title);
        fd.set("total_units", String(textbook.total_units));
        fd.set("sort_order", String(textbook.sort_order));
        fd.set("is_active", textbook.is_active ? "false" : "true");
        if (textbook.series_id) fd.set("series_id", textbook.series_id);
        if (textbook.series) fd.set("series", textbook.series);
        if (textbook.level) fd.set("level", textbook.level);
        const result = await updateTextbook(textbook.id, fd);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success(textbook.is_active ? "비활성화됐습니다." : "활성화됐습니다.");
        setTextbooks((prev) =>
          prev.map((t) => (t.id === textbook.id ? { ...t, is_active: !t.is_active } : t))
        );
      });
    },
    [startTransition]
  );

  // Filter by series_id (preferred) or legacy series text
  const filtered = textbooks.filter((t) => {
    const matchSeries = seriesFilter
      ? t.series_id === seriesFilter || t.series === seriesFilter
      : true;
    const matchSearch = searchQuery
      ? t.title.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    return matchSeries && matchSearch;
  });

  return (
    <>
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select
          value={seriesFilter}
          onChange={(e) => setSeriesFilter(e.target.value)}
          className="rounded-lg border border-input px-3 py-2 text-sm bg-background"
        >
          <option value="">시리즈 전체</option>
          {seriesList.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <Input
          placeholder="제목 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-56 h-9"
        />
        <div className="ml-auto">
          <Button
            onClick={() => {
              setEditTarget(null);
              setModalMode("create");
            }}
          >
            + 숙제 추가
          </Button>
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-slate-50/50 p-10 text-center text-sm text-slate-400">
          {searchQuery || seriesFilter ? "검색 결과가 없습니다." : "등록된 숙제가 없습니다. 숙제를 추가하세요."}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
          {filtered.map((textbook) => (
            <TextbookCard
              key={textbook.id}
              textbook={textbook}
              onEdit={() => {
                setEditTarget(textbook);
                setModalMode("edit");
              }}
              onToggleActive={() => handleToggleActive(textbook)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {modalMode && (
        <TextbookModal
          mode={modalMode}
          initial={editTarget ?? undefined}
          seriesList={seriesList}
          onClose={() => { setModalMode(null); setEditTarget(null); }}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
