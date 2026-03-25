"use client";

import {
  createNotice,
  updateNotice,
  deleteNotice,
  getNoticeWithAttachments,
} from "../../actions/notice-actions";
import type { Notice, NoticeAttachment } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type NoticeWithCounts = Notice & {
  image_count: number;
  attachment_count: number;
};

export function NoticesManager({
  initialNotices,
}: {
  initialNotices: NoticeWithCounts[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "published" | "draft">(
    ""
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<{
    notice: Notice;
    images: NoticeAttachment[];
    attachments: NoticeAttachment[];
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NoticeWithCounts | null>(
    null
  );

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

  const handleEdit = async (notice: NoticeWithCounts) => {
    const data = await getNoticeWithAttachments(notice.id);
    if (!data) return;
    setEditTarget(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-800">공지사항 관리</h1>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
        >
          + 공지 추가
        </button>
      </div>

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
                {/* 고정 아이콘 */}
                <div className="w-5 shrink-0">
                  {n.is_pinned && (
                    <svg
                      className="w-4 h-4 text-amber-500"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                    </svg>
                  )}
                </div>

                {/* 내용 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-800 truncate">
                      {n.title}
                    </h3>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        n.is_published
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {n.is_published ? "게시" : "미게시"}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                    <time>{n.published_at?.slice(0, 10)}</time>
                    {n.image_count > 0 && <span>이미지 {n.image_count}</span>}
                    {n.attachment_count > 0 && (
                      <span>첨부 {n.attachment_count}</span>
                    )}
                  </div>
                </div>

                {/* 액션 */}
                <div className="flex gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleEdit(n)}
                    className="rounded bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 transition-colors"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(n)}
                    className="rounded bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 모달 */}
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
          initial={editTarget.notice}
          initialImages={editTarget.images}
          initialAttachments={editTarget.attachments}
          onClose={() => setEditTarget(null)}
          onSubmit={async (fd) => {
            fd.set("id", editTarget.notice.id);
            const result = await updateNotice(fd);
            if (result?.error) return result.error;
            setEditTarget(null);
            toast.success("공지사항이 수정되었습니다.");
            router.refresh();
            return null;
          }}
        />
      )}
      {deleteTarget && (
        <ConfirmDeleteModal
          notice={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            const result = await deleteNotice(deleteTarget.id);
            if (result?.error) {
              toast.error(result.error);
              return;
            }
            setDeleteTarget(null);
            toast.success("공지사항이 삭제되었습니다.");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// NoticeFormModal
// ──────────────────────────────────────────────

function NoticeFormModal({
  title,
  initial,
  initialImages,
  initialAttachments,
  onClose,
  onSubmit,
}: {
  title: string;
  initial?: Notice;
  initialImages?: NoticeAttachment[];
  initialAttachments?: NoticeAttachment[];
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

  // 기존 첨부파일 (수정 모드)
  const [existingImages, setExistingImages] = useState<NoticeAttachment[]>(
    initialImages ?? []
  );
  const [existingAttachments, setExistingAttachments] = useState<
    NoticeAttachment[]
  >(initialAttachments ?? []);
  const [removeIds, setRemoveIds] = useState<string[]>([]);

  // 새 파일
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [newImagePreviewUrls, setNewImagePreviewUrls] = useState<string[]>([]);
  const [newAttachmentFiles, setNewAttachmentFiles] = useState<File[]>([]);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cleanup all preview URLs on unmount
  useEffect(() => {
    return () => {
      newImagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRemoveExisting = (att: NoticeAttachment) => {
    setRemoveIds((prev) => [...prev, att.id]);
    if (att.file_type === "image") {
      setExistingImages((prev) => prev.filter((a) => a.id !== att.id));
    } else {
      setExistingAttachments((prev) => prev.filter((a) => a.id !== att.id));
    }
  };

  const handleRemoveNewImage = (idx: number) => {
    URL.revokeObjectURL(newImagePreviewUrls[idx]);
    setNewImageFiles((prev) => prev.filter((_, i) => i !== idx));
    setNewImagePreviewUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const valid = files.filter((f) => {
      if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) return false;
      if (f.size > 10 * 1024 * 1024) return false;
      return true;
    });
    if (valid.length < files.length) {
      toast.error("일부 이미지가 형식 또는 크기 제한으로 제외되었습니다.");
    }
    const urls = valid.map((f) => URL.createObjectURL(f));
    setNewImageFiles((prev) => [...prev, ...valid]);
    setNewImagePreviewUrls((prev) => [...prev, ...urls]);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const allowedTypes = [
      "application/pdf",
      "application/zip",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    const valid = files.filter((f) => {
      if (!allowedTypes.includes(f.type)) return false;
      if (f.size > 20 * 1024 * 1024) return false;
      return true;
    });
    if (valid.length < files.length) {
      toast.error("일부 파일이 형식 또는 크기 제한으로 제외되었습니다.");
    }
    setNewAttachmentFiles((prev) => [...prev, ...valid]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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

    if (initial) {
      // 수정 모드
      fd.set("remove_attachment_ids", JSON.stringify(removeIds));
      for (const file of newImageFiles) fd.append("new_images", file);
      for (const file of newAttachmentFiles) fd.append("new_attachments", file);
    } else {
      // 생성 모드
      for (const file of newImageFiles) fd.append("images", file);
      for (const file of newAttachmentFiles) fd.append("attachments", file);
    }

    const err = await onSubmit(fd);
    setPending(false);
    if (err) setError(err);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="닫기"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          {/* 제목 */}
          <div>
            <label
              htmlFor="nf-title"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              제목 *
            </label>
            <input
              id="nf-title"
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
              placeholder="공지사항 제목"
              required
            />
          </div>

          {/* 내용 */}
          <div>
            <label
              htmlFor="nf-content"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              내용
            </label>
            <textarea
              id="nf-content"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
              rows={8}
              placeholder="공지사항 내용을 입력하세요"
            />
          </div>

          {/* 요약 */}
          <div>
            <label
              htmlFor="nf-excerpt"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              요약
            </label>
            <input
              id="nf-excerpt"
              type="text"
              value={form.excerpt}
              onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
              placeholder="비워두면 내용 첫 100자가 사용됩니다"
            />
          </div>

          {/* 옵션 */}
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

          {/* 이미지 */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              이미지
            </label>

            {/* 기존 이미지 */}
            {existingImages.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {existingImages.map((img) => (
                  <div
                    key={img.id}
                    className="relative rounded-lg border border-slate-200 overflow-hidden"
                    style={{ width: 100, height: 80 }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.public_url}
                      alt={img.original_filename}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveExisting(img)}
                      className="absolute top-1 right-1 rounded-full bg-black/50 p-0.5 text-white hover:bg-black/70"
                      aria-label="이미지 제거"
                    >
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 새 이미지 미리보기 */}
            {newImageFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {newImageFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="relative rounded-lg border border-emerald-200 overflow-hidden"
                    style={{ width: 100, height: 80 }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={newImagePreviewUrls[idx]}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveNewImage(idx)}
                      className="absolute top-1 right-1 rounded-full bg-black/50 p-0.5 text-white hover:bg-black/70"
                      aria-label="이미지 제거"
                    >
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="flex items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-2 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-600 transition-colors"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                />
              </svg>
              이미지 추가 (JPG, PNG, WebP / 10MB)
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleImageSelect}
              className="hidden"
            />
          </div>

          {/* 첨부파일 */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              첨부파일
            </label>

            {/* 기존 첨부파일 */}
            {existingAttachments.length > 0 && (
              <ul className="space-y-1 mb-2">
                {existingAttachments.map((att) => (
                  <li
                    key={att.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <span className="text-sm text-slate-700 truncate">
                      {att.original_filename}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveExisting(att)}
                      className="ml-2 text-xs text-red-500 hover:text-red-700"
                    >
                      제거
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* 새 첨부파일 */}
            {newAttachmentFiles.length > 0 && (
              <ul className="space-y-1 mb-2">
                {newAttachmentFiles.map((file, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between rounded-lg border border-emerald-200 px-3 py-2"
                  >
                    <span className="text-sm text-slate-700 truncate">
                      {file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setNewAttachmentFiles((prev) =>
                          prev.filter((_, i) => i !== idx)
                        )
                      }
                      className="ml-2 text-xs text-red-500 hover:text-red-700"
                    >
                      제거
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-2 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-600 transition-colors"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"
                />
              </svg>
              파일 추가 (PDF, ZIP, DOCX, XLSX / 20MB)
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.zip,.doc,.docx,.xls,.xlsx"
              multiple
              onChange={handleFileSelect}
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
              {pending ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// ConfirmDeleteModal
// ──────────────────────────────────────────────

function ConfirmDeleteModal({
  notice,
  onClose,
  onConfirm,
}: {
  notice: NoticeWithCounts;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-800">공지 삭제</h3>
        <p className="mt-2 text-sm text-slate-600">
          &quot;{notice.title}&quot; 공지를 삭제할까요?
          <br />
          <span className="text-xs text-slate-400">
            첨부된 이미지와 파일도 함께 삭제됩니다.
          </span>
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
            {pending ? "삭제 중..." : "삭제"}
          </button>
        </div>
      </div>
    </div>
  );
}
