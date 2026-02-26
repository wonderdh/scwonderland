"use client";

import {
  createTextbook,
  updateTextbook,
  deleteTextbook,
  type Textbook,
} from "../../actions/textbook-actions";
import { TEXTBOOK_CATEGORIES } from "../../actions/textbook-constants";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useMemo, useRef, useState } from "react";

export function TextbooksManager({
  initialTextbooks,
}: {
  initialTextbooks: Textbook[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Textbook | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Textbook | null>(null);

  const filtered = useMemo(() => {
    let list = initialTextbooks;
    if (categoryFilter) {
      list = list.filter((t) => t.category === categoryFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.series && t.series.toLowerCase().includes(q)) ||
          (t.level && t.level.toLowerCase().includes(q))
      );
    }
    return list;
  }, [initialTextbooks, categoryFilter, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-800">교재 관리</h1>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
        >
          + 교재 추가
        </button>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <label htmlFor="tb-category" className="text-sm font-medium text-slate-600">
            카테고리
          </label>
          <select
            id="tb-category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
          >
            <option value="">전체</option>
            {TEXTBOOK_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <label htmlFor="tb-search" className="text-sm font-medium text-slate-600">
            검색
          </label>
          <input
            id="tb-search"
            type="search"
            placeholder="교재명, 시리즈, 레벨"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400"
          />
        </div>
      </div>

      {/* 교재 목록 */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-12 text-center">
          <p className="text-sm text-slate-500">
            {initialTextbooks.length === 0
              ? "등록된 교재가 없습니다. '교재 추가' 버튼으로 시작하세요."
              : "검색 결과가 없습니다."}
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {filtered.map((t) => (
            <TextbookCard
              key={t.id}
              textbook={t}
              onEdit={() => setEditTarget(t)}
              onDelete={() => setDeleteTarget(t)}
            />
          ))}
        </div>
      )}

      {/* 모달 */}
      {createOpen && (
        <TextbookFormModal
          title="교재 추가"
          onClose={() => setCreateOpen(false)}
          onSubmit={async (fd) => {
            const result = await createTextbook(fd);
            if (result?.error) return result.error;
            setCreateOpen(false);
            router.refresh();
            return null;
          }}
        />
      )}
      {editTarget && (
        <TextbookFormModal
          title="교재 수정"
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSubmit={async (fd) => {
            fd.set("id", editTarget.id);
            const result = await updateTextbook(fd);
            if (result?.error) return result.error;
            setEditTarget(null);
            router.refresh();
            return null;
          }}
        />
      )}
      {deleteTarget && (
        <ConfirmDeleteModal
          textbook={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await deleteTextbook(deleteTarget.id);
            setDeleteTarget(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function TextbookCard({
  textbook,
  onEdit,
  onDelete,
}: {
  textbook: Textbook;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const categoryLabel =
    TEXTBOOK_CATEGORIES.find((c) => c.value === textbook.category)?.label ?? textbook.category;

  return (
    <div className="group rounded-lg border border-slate-200 bg-white flex flex-col hover:shadow-sm transition-shadow overflow-hidden" style={{ width: 150 }}>
      {/* 커버 이미지 (150×170 고정) */}
      {textbook.cover_image ? (
        <div className="flex items-center justify-center bg-slate-50">
          <Image
            src={textbook.cover_image}
            alt={textbook.title}
            width={150}
            height={170}
            className="object-cover"
            style={{ width: 150, height: 170 }}
            sizes="150px"
          />
        </div>
      ) : (
        <div className="flex items-center justify-center bg-slate-50" style={{ width: 150, height: 170, margin: "0 auto" }}>
          <svg className="h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
        <h3 className="text-sm font-semibold text-slate-800 truncate leading-tight">{textbook.title}</h3>
        {textbook.series && (
          <p className="text-[11px] text-slate-500 truncate">{textbook.series}</p>
        )}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700 font-medium">{categoryLabel}</span>
          {textbook.level && (
            <span className="rounded bg-slate-100 px-1 py-0.5">Lv.{textbook.level}</span>
          )}
          <span>{textbook.total_units}단원</span>
        </div>

        <div className="flex justify-end gap-1.5 mt-auto pt-1.5 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onEdit}
            className="rounded bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200 transition-colors"
          >
            수정
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded bg-red-50 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-100 transition-colors"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

function TextbookFormModal({
  title,
  initial,
  onClose,
  onSubmit,
}: {
  title: string;
  initial?: Textbook;
  onClose: () => void;
  onSubmit: (fd: FormData) => Promise<string | null>;
}) {
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    series: initial?.series ?? "",
    level: initial?.level ?? "",
    category: initial?.category ?? "general",
    total_units: initial?.total_units ?? 1,
    description: initial?.description ?? "",
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(initial?.cover_image ?? null);
  const [removeCover, setRemoveCover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setError("JPG, PNG, WebP 이미지만 업로드할 수 있습니다.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("이미지 크기가 10MB를 초과합니다.");
      return;
    }

    setCoverFile(file);
    setRemoveCover(false);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleRemoveCover = () => {
    setCoverFile(null);
    setCoverPreview(null);
    setRemoveCover(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.set("title", form.title);
    fd.set("series", form.series);
    fd.set("level", form.level);
    fd.set("category", form.category);
    fd.set("total_units", String(form.total_units));
    fd.set("description", form.description);
    if (coverFile) fd.set("cover_image", coverFile);
    if (removeCover) fd.set("remove_cover", "true");
    const err = await onSubmit(fd);
    setPending(false);
    if (err) setError(err);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="닫기"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          <div>
            <label htmlFor="tf-title" className="mb-1 block text-sm font-medium text-slate-700">
              교재명 *
            </label>
            <input
              id="tf-title"
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
              placeholder="예: Let's Go 1"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="tf-series" className="mb-1 block text-sm font-medium text-slate-700">
                시리즈
              </label>
              <input
                id="tf-series"
                type="text"
                value={form.series}
                onChange={(e) => setForm({ ...form, series: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
                placeholder="예: Let's Go"
              />
            </div>
            <div>
              <label htmlFor="tf-level" className="mb-1 block text-sm font-medium text-slate-700">
                레벨
              </label>
              <input
                id="tf-level"
                type="text"
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
                placeholder="예: 1, Beginner"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="tf-category" className="mb-1 block text-sm font-medium text-slate-700">
                카테고리
              </label>
              <select
                id="tf-category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
              >
                {TEXTBOOK_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="tf-units" className="mb-1 block text-sm font-medium text-slate-700">
                총 단원 수
              </label>
              <input
                id="tf-units"
                type="number"
                min={1}
                value={form.total_units}
                onChange={(e) => setForm({ ...form, total_units: Number(e.target.value) || 1 })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
              />
            </div>
          </div>
          <div>
            <label htmlFor="tf-desc" className="mb-1 block text-sm font-medium text-slate-700">
              설명
            </label>
            <textarea
              id="tf-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
              rows={2}
              placeholder="교재에 대한 간단한 설명"
            />
          </div>

          {/* 커버 이미지 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              커버 이미지
            </label>
            {coverPreview ? (
              <div className="relative rounded-lg border border-slate-200 overflow-hidden">
                <div className="relative h-40 w-full bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={coverPreview}
                    alt="커버 미리보기"
                    className="h-full w-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleRemoveCover}
                  className="absolute top-2 right-2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70 transition-colors"
                  aria-label="이미지 제거"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 py-6 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                </svg>
                이미지 선택 (JPG, PNG, WebP / 10MB 이하)
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {pending ? "저장 중…" : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({
  textbook,
  onClose,
  onConfirm,
}: {
  textbook: Textbook;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-800">교재 삭제</h3>
        <p className="mt-2 text-sm text-slate-600">
          &quot;{textbook.title}&quot; 교재를 삭제할까요?
          <br />
          <span className="text-xs text-slate-400">배정된 진도 기록은 유지됩니다.</span>
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            취소
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              await onConfirm();
              setPending(false);
            }}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
          >
            {pending ? "삭제 중…" : "삭제"}
          </button>
        </div>
      </div>
    </div>
  );
}
