"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  listAcademyNotices,
  getAcademyNoticeWithAttachments,
  createAcademyNotice,
  updateAcademyNotice,
  deleteAcademyNotice,
} from "../../actions";
import { FileUpload } from "@/components/FileUpload";
import { FileList } from "@/components/FileList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AcademyNotice, AcademyNoticeAttachment } from "@/lib/types";
import { LoadingState } from "@/components/LoadingState";
import { toast } from "sonner";

export function AcademyNoticesManager() {
  const router = useRouter();
  const [notices, setNotices] = useState<AcademyNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "form">("list");
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formExcerpt, setFormExcerpt] = useState("");
  const [formPublished, setFormPublished] = useState(true);
  const [formPinned, setFormPinned] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<AcademyNoticeAttachment[]>([]);
  const [removeAttachmentIds, setRemoveAttachmentIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadNotices = useCallback(async () => {
    setLoading(true);
    const data = await listAcademyNotices(true);
    setNotices(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadNotices();
  }, [loadNotices]);

  const openCreateForm = () => {
    setEditingId(null);
    setFormTitle("");
    setFormContent("");
    setFormExcerpt("");
    setFormPublished(true);
    setFormPinned(false);
    setImageFiles([]);
    setAttachmentFiles([]);
    setExistingAttachments([]);
    setRemoveAttachmentIds([]);
    setError(null);
    setView("form");
  };

  const openEditForm = async (notice: AcademyNotice) => {
    const result = await getAcademyNoticeWithAttachments(notice.id);
    if (!result) return;
    setEditingId(notice.id);
    setFormTitle(result.notice.title);
    setFormContent(result.notice.content ?? "");
    setFormExcerpt(result.notice.excerpt ?? "");
    setFormPublished(result.notice.is_published);
    setFormPinned(result.notice.is_pinned);
    setImageFiles([]);
    setAttachmentFiles([]);
    setExistingAttachments([...result.images, ...result.attachments]);
    setRemoveAttachmentIds([]);
    setError(null);
    setView("form");
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    const fd = new FormData();
    if (editingId) fd.set("id", editingId);
    fd.set("title", formTitle);
    fd.set("content", formContent);
    fd.set("excerpt", formExcerpt);
    fd.set("is_published", String(formPublished));
    fd.set("is_pinned", String(formPinned));

    if (editingId) {
      for (const f of imageFiles) fd.append("new_images", f);
      for (const f of attachmentFiles) fd.append("new_attachments", f);
      fd.set("remove_attachment_ids", JSON.stringify(removeAttachmentIds));
    } else {
      for (const f of imageFiles) fd.append("images", f);
      for (const f of attachmentFiles) fd.append("attachments", f);
    }

    const result = editingId
      ? await updateAcademyNotice(fd)
      : await createAcademyNotice(fd);

    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    toast.success(editingId ? "공지사항이 수정되었습니다." : "공지사항이 등록되었습니다.");
    setView("list");
    router.refresh();
    await loadNotices();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 공지를 삭제하시겠습니까?")) return;
    setDeleting(id);
    const result = await deleteAcademyNotice(id);
    setDeleting(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    toast.success("공지사항이 삭제되었습니다.");
    router.refresh();
    await loadNotices();
  };

  if (loading) {
    return <LoadingState />;
  }

  // Form view
  if (view === "form") {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            {editingId ? "공지 수정" : "새 공지 작성"}
          </h2>
          <Button variant="outline" size="sm" onClick={() => setView("list")}>
            목록으로
          </Button>
        </div>

        {error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        <div>
          <label className="mb-1 block text-xs text-muted-foreground">제목</label>
          <Input
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder="제목을 입력하세요"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">내용</label>
          <Textarea
            value={formContent}
            onChange={(e) => setFormContent(e.target.value)}
            placeholder="내용을 입력하세요"
            rows={8}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">요약 (선택)</label>
          <Input
            value={formExcerpt}
            onChange={(e) => setFormExcerpt(e.target.value)}
            placeholder="목록에 표시될 요약 (미입력 시 자동 생성)"
          />
        </div>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={formPublished}
              onChange={(e) => setFormPublished(e.target.checked)}
              className="rounded border-input"
            />
            게시
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={formPinned}
              onChange={(e) => setFormPinned(e.target.checked)}
              className="rounded border-input"
            />
            고정
          </label>
        </div>

        {editingId && existingAttachments.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground">기존 첨부파일</h3>
            <FileList
              files={existingAttachments
                .filter((a) => !removeAttachmentIds.includes(a.id))
                .map((a) => ({
                  id: a.id,
                  original_filename: a.original_filename,
                  public_url: a.public_url,
                  mime_type: a.mime_type,
                  file_size: a.file_size,
                }))}
              onDelete={(id) => setRemoveAttachmentIds((prev) => [...prev, id])}
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs text-muted-foreground">이미지</label>
          <FileUpload
            accept="image/jpeg,image/png,image/webp"
            multiple
            maxFiles={10}
            files={imageFiles}
            onFilesChange={setImageFiles}
            label="이미지 선택"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">첨부파일</label>
          <FileUpload
            accept=".pdf,.zip,.doc,.docx,.xls,.xlsx"
            multiple
            maxFiles={5}
            files={attachmentFiles}
            onFilesChange={setAttachmentFiles}
            label="첨부파일 선택"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setView("list")}>취소</Button>
          <Button onClick={handleSave} disabled={saving || !formTitle.trim()}>
            {saving ? "저장 중…" : editingId ? "수정" : "작성"}
          </Button>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreateForm}>+ 새 공지 작성</Button>
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      {notices.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/30 p-12 text-center">
          <p className="text-sm text-muted-foreground">등록된 공지가 없습니다.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {notices.map((n) => (
            <li key={n.id} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {n.is_pinned && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        고정
                      </span>
                    )}
                    {!n.is_published && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                        비게시
                      </span>
                    )}
                    <h3 className="text-sm font-medium text-foreground truncate">{n.title}</h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{new Date(n.published_at).toLocaleDateString("ko-KR")}</span>
                    {((n.image_count ?? 0) + (n.attachment_count ?? 0)) > 0 && (
                      <>
                        <span>·</span>
                        <span>첨부 {(n.image_count ?? 0) + (n.attachment_count ?? 0)}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => openEditForm(n)}>
                    수정
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(n.id)}
                    disabled={deleting === n.id}
                  >
                    삭제
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
