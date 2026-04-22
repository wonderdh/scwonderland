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
import { FileUpload } from "@/components/forms/FileUpload";
import { FileList } from "@/components/forms/FileList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AcademyNotice, AcademyNoticeAttachment } from "@/lib/types";
import { LoadingState } from "@/components/feedback/LoadingState";
import { PageHeader } from "@/components/navigation/PageHeader";
import { FormGroup } from "@/components/forms/FormGroup";
import { ConfirmDialog } from "@/components/overlays/ConfirmDialog";
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
  const [deleteTarget, setDeleteTarget] = useState<AcademyNotice | null>(null);

  const loadNotices = useCallback(async () => {
    setLoading(true);
    const data = await listAcademyNotices(true);
    setNotices(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    setDeleting(id);
    const result = await deleteAcademyNotice(id);
    setDeleting(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDeleteTarget(null);
    toast.success("공지사항이 삭제되었습니다.");
    router.refresh();
    await loadNotices();
  };

  if (loading) {
    return <LoadingState label="공지 불러오는 중" />;
  }

  // Form view
  if (view === "form") {
    return (
      <div className="space-y-6">
        <PageHeader
          title={editingId ? "공지 수정" : "새 공지 작성"}
          description="학생·교사 포털에 노출되는 공지입니다."
          actions={
            <Button variant="outline" onClick={() => setView("list")}>
              목록으로
            </Button>
          }
        />
        <div className="rounded-xl border bg-card p-6 shadow-sm space-y-5">
          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <FormGroup label="제목" required>
            <Input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="제목을 입력하세요"
              className="h-11 text-base"
            />
          </FormGroup>
          <FormGroup label="내용">
            <Textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder="내용을 입력하세요"
              rows={8}
              className="text-base"
            />
          </FormGroup>
          <FormGroup label="요약" help="선택 — 미입력 시 내용에서 자동 생성">
            <Input
              value={formExcerpt}
              onChange={(e) => setFormExcerpt(e.target.value)}
              placeholder="목록에 표시될 요약"
              className="h-11 text-base"
            />
          </FormGroup>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-base">
              <input
                type="checkbox"
                checked={formPublished}
                onChange={(e) => setFormPublished(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              게시
            </label>
            <label className="flex items-center gap-2 text-base">
              <input
                type="checkbox"
                checked={formPinned}
                onChange={(e) => setFormPinned(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              고정
            </label>
          </div>

          {editingId && existingAttachments.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-base font-medium text-slate-700">기존 첨부파일</h3>
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

          <FormGroup label="이미지">
            <FileUpload
              accept="image/jpeg,image/png,image/webp"
              multiple
              maxFiles={10}
              files={imageFiles}
              onFilesChange={setImageFiles}
              label="이미지 선택"
            />
          </FormGroup>
          <FormGroup label="첨부파일">
            <FileUpload
              accept=".pdf,.zip,.doc,.docx,.xls,.xlsx"
              multiple
              maxFiles={5}
              files={attachmentFiles}
              onFilesChange={setAttachmentFiles}
              label="첨부파일 선택"
            />
          </FormGroup>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setView("list")}>취소</Button>
            <Button onClick={handleSave} disabled={saving || !formTitle.trim()}>
              {saving ? "저장 중…" : editingId ? "수정" : "작성"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <PageHeader
        title="Academy 공지 관리"
        description="학생·교사 포털 내부에서 노출되는 공지를 관리하세요."
        actions={<Button onClick={openCreateForm}>+ 새 공지 작성</Button>}
      />

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
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-sm font-medium text-amber-700">
                        고정
                      </span>
                    )}
                    {!n.is_published && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-sm font-medium text-slate-500">
                        비게시
                      </span>
                    )}
                    <h3 className="text-base font-semibold text-foreground truncate">{n.title}</h3>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{new Date(n.published_at).toLocaleDateString("ko-KR")}</span>
                    {((n.image_count ?? 0) + (n.attachment_count ?? 0)) > 0 && (
                      <>
                        <span>·</span>
                        <span>첨부 {(n.image_count ?? 0) + (n.attachment_count ?? 0)}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => openEditForm(n)}>
                    수정
                  </Button>
                  <Button
                    variant="outline"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteTarget(n)}
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

      <ConfirmDialog
        open={deleteTarget !== null}
        title="공지 삭제"
        description={deleteTarget ? `"${deleteTarget.title}" 공지를 삭제할까요?` : undefined}
        danger
        impactList={["첨부된 이미지와 파일이 함께 삭제됩니다.", "이 작업은 되돌릴 수 없습니다."]}
        disabled={deleting === deleteTarget?.id}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
