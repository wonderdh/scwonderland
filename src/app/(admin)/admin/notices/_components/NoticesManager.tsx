"use client";

import {
  createNotice,
  updateNotice,
  deleteNotice,
} from "../../actions/notice-actions";
import type { Notice } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Clock, Pin, X } from "lucide-react";
import { PageHeader } from "@/components/navigation/PageHeader";
import { FormGroup } from "@/components/forms/FormGroup";
import { ConfirmDialog } from "@/components/overlays/ConfirmDialog";
import { Modal } from "@/components/overlays/Modal";

export function NoticesManager({
  initialNotices,
}: {
  initialNotices: Notice[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "published" | "draft">(
    ""
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Notice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Notice | null>(null);

  const filtered = useMemo(() => {
    let list = initialNotices;
    if (statusFilter === "published") {
      list = list.filter((n) => n.is_published);
    } else if (statusFilter === "draft") {
      list = list.filter((n) => !n.is_published);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((n) => n.title.toLowerCase().includes(q));
    }
    return list;
  }, [initialNotices, statusFilter, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="공지사항 관리"
        description="홈페이지에 노출되는 공지사항을 작성·수정합니다."
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="h-11 rounded-lg bg-emerald-600 px-5 text-base font-semibold text-white hover:bg-emerald-500 transition-colors"
          >
            + 공지 추가
          </button>
        }
      />

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <label
            htmlFor="n-status"
            className="text-sm font-medium text-slate-600"
          >
            상태
          </label>
          <select
            id="n-status"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "" | "published" | "draft")
            }
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
          >
            <option value="">전체</option>
            <option value="published">게시</option>
            <option value="draft">미게시</option>
          </select>
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <label
            htmlFor="n-search"
            className="text-sm font-medium text-slate-600"
          >
            검색
          </label>
          <input
            id="n-search"
            type="search"
            placeholder="제목 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400"
          />
        </div>
      </div>

      {/* 목록 */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-12 text-center">
          <p className="text-sm text-slate-500">
            {initialNotices.length === 0
              ? "등록된 공지사항이 없습니다. '공지 추가' 버튼으로 시작하세요."
              : "검색 결과가 없습니다."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {filtered.map((n) => (
              <li
                key={n.id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors"
              >
                <div className="w-5 shrink-0">
                  {n.is_pinned && (
                    <Pin className="w-5 h-5 text-amber-500" aria-hidden="true" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-800 truncate">
                      {n.title}
                    </h3>
                    <span
                      className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium ${
                        n.is_published
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {n.is_published ? (
                        <>
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          게시
                        </>
                      ) : (
                        <>
                          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                          미게시
                        </>
                      )}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-sm text-slate-500">
                    <time>{n.published_at?.slice(0, 10)}</time>
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditTarget(n)}
                    className="h-10 rounded-lg bg-slate-100 px-4 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(n)}
                    className="h-10 rounded-lg bg-red-50 px-4 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors"
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {createOpen && (
        <NoticeFormModal
          title="공지 추가"
          onClose={() => setCreateOpen(false)}
          onSubmit={async (fd) => {
            const result = await createNotice(fd);
            if (result?.error) return result.error;
            setCreateOpen(false);
            toast.success("공지사항이 등록되었습니다.");
            router.refresh();
            return null;
          }}
        />
      )}
      {editTarget && (
        <NoticeFormModal
          title="공지 수정"
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSubmit={async (fd) => {
            fd.set("id", editTarget.id);
            const result = await updateNotice(fd);
            if (result?.error) return result.error;
            setEditTarget(null);
            toast.success("공지사항이 수정되었습니다.");
            router.refresh();
            return null;
          }}
        />
      )}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="공지 삭제"
        description={
          deleteTarget ? `"${deleteTarget.title}" 공지를 삭제할까요?` : undefined
        }
        danger
        confirmLabel="삭제"
        impactList={["이 작업은 되돌릴 수 없습니다."]}
        onConfirm={async () => {
          if (!deleteTarget) return;
          const result = await deleteNotice(deleteTarget.id);
          if (result?.error) {
            toast.error(result.error);
            return;
          }
          setDeleteTarget(null);
          toast.success("공지사항이 삭제되었습니다.");
          router.refresh();
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function NoticeFormModal({
  title,
  initial,
  onClose,
  onSubmit,
}: {
  title: string;
  initial?: Notice;
  onClose: () => void;
  onSubmit: (fd: FormData) => Promise<string | null>;
}) {
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    content: initial?.content ?? "",
    excerpt: initial?.excerpt ?? "",
    is_published: initial?.is_published ?? true,
    is_pinned: initial?.is_pinned ?? false,
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);

    const fd = new FormData();
    fd.set("title", form.title);
    fd.set("content", form.content);
    fd.set("excerpt", form.excerpt);
    fd.set("is_published", String(form.is_published));
    fd.set("is_pinned", String(form.is_pinned));

    const err = await onSubmit(fd);
    setPending(false);
    if (err) setError(err);
  };

  return (
    <Modal open onClose={onClose}>
      <div className="max-h-[90vh] overflow-y-auto p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <FormGroup label="제목" required htmlFor="nf-title">
            <input
              id="nf-title"
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full h-11 rounded-lg border border-slate-200 px-3 text-base text-slate-800"
              placeholder="공지사항 제목"
              required
            />
          </FormGroup>

          <FormGroup label="내용" htmlFor="nf-content">
            <textarea
              id="nf-content"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base text-slate-800"
              rows={8}
              placeholder="공지사항 내용을 입력하세요"
            />
          </FormGroup>

          <FormGroup label="요약" htmlFor="nf-excerpt" help="비워두면 내용 첫 100자가 사용됩니다.">
            <input
              id="nf-excerpt"
              type="text"
              value={form.excerpt}
              onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
              className="w-full h-11 rounded-lg border border-slate-200 px-3 text-base text-slate-800"
              placeholder="예: 이번 주 중요 공지"
            />
          </FormGroup>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(e) =>
                  setForm({ ...form, is_published: e.target.checked })
                }
                className="rounded border-slate-300"
              />
              게시
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.is_pinned}
                onChange={(e) =>
                  setForm({ ...form, is_pinned: e.target.checked })
                }
                className="rounded border-slate-300"
              />
              고정
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-lg bg-slate-100 px-5 text-base font-medium text-slate-700 hover:bg-slate-200"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={pending}
              className="h-11 rounded-lg bg-emerald-600 px-5 text-base font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {pending ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
