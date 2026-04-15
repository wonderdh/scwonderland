"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  listHomeworkAssignments,
  createHomeworkAssignment,
  updateHomeworkAssignment,
  deleteHomeworkAssignment,
  listSubmissions,
  reviewSubmission,
} from "@/app/(admin)/admin/actions";
import { toast } from "sonner";
import { homeworkLabels } from "@/lib/ui/teacher-labels";
import { LoadingState } from "@/components/feedback/LoadingState";
import { Spinner } from "@/components/feedback/Spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { HomeworkAssignment, HomeworkSubmission } from "@/lib/types";

type TeacherClass = { id: string; name: string };

const STATUS_COLORS = {
  pending: "bg-red-100 text-red-700",
  submitted: "bg-blue-100 text-blue-700",
  reviewed: "bg-emerald-100 text-emerald-700",
};

export function TeacherHomeworkClient({
  classes,
  teacherId,
  teacherType,
}: {
  classes: TeacherClass[];
  teacherId: string;
  teacherType: "korean" | "native";
}) {
  const router = useRouter();
  const L = homeworkLabels[teacherType];
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id ?? "");
  const [assignments, setAssignments] = useState<HomeworkAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "form" | "submissions">("list");
  const [error, setError] = useState<string | null>(null);

  // Form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Submissions
  const [submissions, setSubmissions] = useState<HomeworkSubmission[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<HomeworkAssignment | null>(null);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState<string | null>(null);

  const loadAssignments = useCallback(async () => {
    if (!selectedClassId) return;
    setLoading(true);
    const data = await listHomeworkAssignments(selectedClassId);
    setAssignments(data);
    setLoading(false);
  }, [selectedClassId]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const openCreateForm = () => {
    setEditingId(null);
    setFormTitle("");
    setFormDesc("");
    setFormDueDate("");
    setError(null);
    setView("form");
  };

  const openEditForm = (a: HomeworkAssignment) => {
    setEditingId(a.id);
    setFormTitle(a.title);
    setFormDesc(a.description ?? "");
    setFormDueDate(a.due_date ?? "");
    setError(null);
    setView("form");
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    const result = editingId
      ? await updateHomeworkAssignment(editingId, formTitle, formDesc, formDueDate)
      : await createHomeworkAssignment(selectedClassId, teacherId, formTitle, formDesc, formDueDate);

    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    toast.success(editingId ? "숙제가 수정되었습니다." : "숙제가 출제되었습니다.");
    setView("list");
    router.refresh();
    await loadAssignments();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(L.deleteConfirm)) return;
    setDeletingId(id);
    const result = await deleteHomeworkAssignment(id);
    setDeletingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
    await loadAssignments();
  };

  const openSubmissions = async (a: HomeworkAssignment) => {
    setSelectedAssignment(a);
    const subs = await listSubmissions(a.id);
    setSubmissions(subs);
    setFeedbackMap({});
    setView("submissions");
  };

  const handleReview = async (subId: string) => {
    const feedback = feedbackMap[subId] ?? "";
    setReviewing(subId);
    const result = await reviewSubmission(subId, feedback, teacherId);
    setReviewing(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    toast.success("피드백이 저장되었습니다.");
    // 새로고침
    if (selectedAssignment) {
      const subs = await listSubmissions(selectedAssignment.id);
      setSubmissions(subs);
    }
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
      {/* Class selector */}
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
          <Button variant="outline" onClick={() => setView("list")} className="min-h-[44px] sm:min-h-[40px]">
            {L.back}
          </Button>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      {/* List */}
      {view === "list" && (
        loading ? (
          <LoadingState label={L.loading} />
        ) : assignments.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-muted/30 p-12 text-center">
            <p className="text-sm text-muted-foreground">{L.noHomework}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {assignments.map((a) => (
              <li key={a.id} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openSubmissions(a)}>
                    <h3 className="text-sm font-medium text-foreground">{a.title}</h3>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{new Date(a.created_at).toLocaleDateString("ko-KR")}</span>
                      {a.due_date && (
                        <>
                          <span>·</span>
                          <span>{teacherType === "native" ? "Due: " : "마감: "}{new Date(a.due_date).toLocaleDateString("ko-KR")}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>{L.submissionRate}: {a.submission_count ?? 0}/{a.total_students ?? 0}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => openEditForm(a)}>
                      {L.edit}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(a.id)}
                      disabled={deletingId === a.id}
                    >
                      {deletingId === a.id ? <><Spinner size="sm" /> {L.deleting}</> : L.delete}
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )
      )}

      {/* Form */}
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
            <label className="mb-1 block text-xs text-muted-foreground">{L.descriptionField}</label>
            <Textarea
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder={L.descriptionField}
              rows={4}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{L.dueDateField}</label>
            <Input
              type="date"
              value={formDueDate}
              onChange={(e) => setFormDueDate(e.target.value)}
              className="min-h-[44px] sm:min-h-0"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setView("list")}>{L.cancel}</Button>
            <Button onClick={handleSave} disabled={saving || !formTitle.trim()}>
              {saving ? <><Spinner size="sm" /> {L.saving}</> : L.save}
            </Button>
          </div>
        </div>
      )}

      {/* Submissions */}
      {view === "submissions" && selectedAssignment && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">{selectedAssignment.title}</h2>
            {selectedAssignment.description && (
              <p className="mt-1 text-sm text-muted-foreground">{selectedAssignment.description}</p>
            )}
          </div>

          <h3 className="text-sm font-medium text-foreground">{L.submissions}</h3>

          {submissions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{L.noHomework}</p>
          ) : (
            <ul className="space-y-2">
              {submissions.map((sub) => {
                const statusLabel = L[sub.status as keyof typeof L] as string;
                return (
                  <li key={sub.id} className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{sub.student_name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[sub.status]}`}>
                          {statusLabel}
                        </span>
                      </div>
                      {sub.submitted_at && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(sub.submitted_at).toLocaleString("ko-KR")}
                        </span>
                      )}
                    </div>

                    {/* 제출 내용 */}
                    {sub.text_content && (
                      <p className="text-sm text-foreground rounded-lg bg-muted/30 p-3">{sub.text_content}</p>
                    )}

                    {/* 오디오 파일 */}
                    {sub.files && sub.files.length > 0 && (
                      <div className="space-y-2">
                        {sub.files.map((f) => (
                          <div key={f.id} className="rounded-lg border p-3">
                            <p className="text-xs text-muted-foreground mb-1">{f.original_filename}</p>
                            {f.mime_type.startsWith("audio/") && f.signed_url && (
                              /* eslint-disable-next-line jsx-a11y/media-has-caption */
                              <audio controls src={f.signed_url} className="w-full h-10" preload="metadata" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 기존 피드백 */}
                    {sub.status === "reviewed" && sub.teacher_feedback && (
                      <div className="rounded-lg border-l-4 border-emerald-500 bg-emerald-50 p-3">
                        <p className="text-xs font-medium text-emerald-700 mb-1">{L.feedback}</p>
                        <p className="text-sm text-emerald-800">{sub.teacher_feedback}</p>
                      </div>
                    )}

                    {/* 리뷰 폼 */}
                    {sub.status === "submitted" && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder={L.feedbackPlaceholder}
                          value={feedbackMap[sub.id] ?? ""}
                          onChange={(e) => setFeedbackMap((prev) => ({ ...prev, [sub.id]: e.target.value }))}
                          className="flex-1 min-h-[40px] rounded-lg border border-input px-3 py-2 text-sm bg-background"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleReview(sub.id)}
                          disabled={reviewing === sub.id}
                          className="min-h-[40px]"
                        >
                          {reviewing === sub.id ? <><Spinner size="sm" /> {L.reviewing}</> : L.review}
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
