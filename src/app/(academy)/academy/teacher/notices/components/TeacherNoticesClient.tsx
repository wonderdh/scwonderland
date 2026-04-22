"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  listClassNotices,
  getClassNoticeWithAttachments,
  createClassNotice,
  updateClassNotice,
  deleteClassNotice,
} from "@/app/(admin)/admin/actions";
import { toast } from "sonner";
import { noticeLabels } from "@/lib/ui/teacher-labels";
import { LoadingState } from "@/components/feedback/LoadingState";
import { Spinner } from "@/components/feedback/Spinner";
import { formatFileSize } from "@/lib/supabase/storage";
import { FileUpload } from "@/components/forms/FileUpload";
import { FileList } from "@/components/forms/FileList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ClassNotice, ClassNoticeAttachment } from "@/lib/types";

type TeacherClass = { id: string; name: string };

const L = noticeLabels.korean;

export function TeacherNoticesClient({
  classes,
  teacherId,
}: {
  classes: TeacherClass[];
  teacherId: string;
}) {
  const router = useRouter();
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id ?? "");
  const [notices, setNotices] = useState<ClassNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "detail" | "form">("list");
  const [selectedNotice, setSelectedNotice] = useState<ClassNotice | null>(null);
  const [selectedAttachments, setSelectedAttachments] = useState<ClassNoticeAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formPinned, setFormPinned] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<ClassNoticeAttachment[]>([]);
  const [removeAttachmentIds, setRemoveAttachmentIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const loadNotices = useCallback(async () => {
    if (!selectedClassId) return;
    setLoading(true);
    const data = await listClassNotices(selectedClassId);
    setNotices(data);
    setLoading(false);
  }, [selectedClassId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadNotices();
  }, [loadNotices]);

  const openDetail = async (notice: ClassNotice) => {
    const result = await getClassNoticeWithAttachments(notice.id);
    if (result) {
      setSelectedNotice(result.notice);
      setSelectedAttachments(result.attachments);
      setView("detail");
    }
  };

  const openCreateForm = () => {
    setEditingId(null);
    setFormTitle("");
    setFormContent("");
    setFormPinned(false);
    setImageFiles([]);
    setAttachmentFiles([]);
    setExistingAttachments([]);
    setRemoveAttachmentIds([]);
    setError(null);
    setView("form");
  };

  const openEditForm = async (notice: ClassNotice) => {
    const result = await getClassNoticeWithAttachments(notice.id);
    if (!result) return;
    setEditingId(notice.id);
    setFormTitle(result.notice.title);
    setFormContent(result.notice.content ?? "");
    setFormPinned(result.notice.is_pinned);
    setImageFiles([]);
    setAttachmentFiles([]);
    setExistingAttachments(result.attachments);
    setRemoveAttachmentIds([]);
    setError(null);
    setView("form");
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    const fd = new FormData();
    if (editingId) {
      fd.set("id", editingId);
    } else {
      fd.set("class_id", selectedClassId);
      fd.set("author_id", teacherId);
    }
    fd.set("title", formTitle);
    fd.set("content", formContent);
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
      ? await updateClassNotice(fd)
      : await createClassNotice(fd);

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

  const handleDelete = async (noticeId: string) => {
    if (!confirm(L.deleteConfirm)) return;
    const result = await deleteClassNotice(noticeId);
    if (result.error) {
      setError(result.error);
      return;
    }
    toast.success("공지사항이 삭제되었습니다.");
    setView("list");
    router.refresh();
    await loadNotices();
  };

  if (classes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/30 p-12 text-center">
        <p className="text-sm text-muted-foreground">{L.noClasses}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Class selector + actions */}
      <div className="flex items-center justify-between gap-3">
        <select
          value={selectedClassId}
          onChange={(e) => { setSelectedClassId(e.target.value); setView("list"); }}
          className="min-h-[44px] rounded-lg border border-input px-3 py-2 text-sm bg-background sm:min-h-0"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {view === "list" && (
          <Button onClick={openCreateForm} className="min-h-[44px] sm:min-h-[40px]">
            + {L.create}
          </Button>
        )}
        {view !== "list" && (
          <Button
            variant="outline"
            onClick={() => setView("list")}
            className="min-h-[44px] sm:min-h-[40px]"
          >
            {L.back}
          </Button>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      {/* List view */}
      {view === "list" && (
        loading ? (
          <LoadingState label={L.loading} />
        ) : notices.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-muted/30 p-12 text-center">
            <p className="text-sm text-muted-foreground">{L.noNotices}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {notices.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => openDetail(n)}
                  className="w-full text-left rounded-xl border bg-card p-4 shadow-sm hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    {n.is_pinned && (
                      <span className="shrink-0 mt-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        {L.pinned}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-foreground truncate">{n.title}</h3>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{n.author_name}</span>
                        <span>·</span>
                        <span>{new Date(n.created_at).toLocaleDateString("ko-KR")}</span>
                        {(n.attachment_count ?? 0) > 0 && (
                          <>
                            <span>·</span>
                            <span>{L.attachmentCount} {n.attachment_count}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )
      )}

      {/* Detail view */}
      {view === "detail" && selectedNotice && (
        <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {selectedNotice.is_pinned && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                    {L.pinned}
                  </span>
                )}
                <h2 className="text-lg font-semibold text-foreground">{selectedNotice.title}</h2>
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedNotice.author_name} · {new Date(selectedNotice.created_at).toLocaleDateString("ko-KR")}
              </p>
            </div>
            {selectedNotice.author_id === teacherId && (
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={() => openEditForm(selectedNotice)}>
                  {L.edit}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(selectedNotice.id)}
                >
                  {L.delete}
                </Button>
              </div>
            )}
          </div>
          {selectedNotice.content && (
            <div className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
              {selectedNotice.content}
            </div>
          )}
          {selectedAttachments.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground">{L.attachments}</h3>
              <FileList
                files={selectedAttachments.map((a) => ({
                  id: a.id,
                  original_filename: a.original_filename,
                  public_url: a.public_url,
                  mime_type: a.mime_type,
                  file_size: a.file_size,
                }))}
              />
            </div>
          )}
        </div>
      )}

      {/* Form view */}
      {view === "form" && (
        <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-foreground">
            {editingId ? L.edit : L.create}
          </h2>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{L.titleField}</label>
            <Input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder={L.titleField}
              className="min-h-[44px] sm:min-h-0"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{L.contentField}</label>
            <Textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder={L.contentField}
              rows={6}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={formPinned}
              onChange={(e) => setFormPinned(e.target.checked)}
              className="rounded border-input"
            />
            {L.pin}
          </label>

          {/* Existing attachments (edit mode) */}
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
            <label className="mb-1 block text-xs text-muted-foreground">{L.images}</label>
            <FileUpload
              accept="image/jpeg,image/png,image/webp"
              multiple
              maxFiles={5}
              files={imageFiles}
              onFilesChange={setImageFiles}
              label={L.images}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{L.attachments}</label>
            <FileUpload
              accept=".pdf,.zip,.doc,.docx,.xls,.xlsx"
              multiple
              maxFiles={5}
              files={attachmentFiles}
              onFilesChange={setAttachmentFiles}
              label={L.attachments}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setView("list")} className="min-h-[44px] sm:min-h-[40px]">
              {L.cancel}
            </Button>
            <Button onClick={handleSave} disabled={saving || !formTitle.trim()} className="min-h-[44px] sm:min-h-[40px]">
              {saving ? <><Spinner size="sm" /> {L.saving}</> : L.save}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
