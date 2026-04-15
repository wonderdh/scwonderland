"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getStudentHomework,
  submitHomework,
  getSubmissionFiles,
} from "@/app/(admin)/admin/actions";
import { toast } from "sonner";
import { AudioRecorder } from "@/components/AudioRecorder";
import { LoadingState } from "@/components/LoadingState";
import { Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { HomeworkAssignment, HomeworkSubmission, HomeworkSubmissionFile } from "@/lib/types";

type AssignmentWithSub = HomeworkAssignment & { submission: HomeworkSubmission | null };

const STATUS_CONFIG = {
  pending: { label: "미제출", color: "text-red-700", bg: "bg-red-100" },
  submitted: { label: "제출 완료", color: "text-blue-700", bg: "bg-blue-100" },
  reviewed: { label: "확인 완료", color: "text-emerald-700", bg: "bg-emerald-100" },
};

export function StudentHomeworkClient({
  studentProfileId,
}: {
  studentProfileId: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState<AssignmentWithSub[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<AssignmentWithSub | null>(null);
  const [submissionFiles, setSubmissionFiles] = useState<HomeworkSubmissionFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Submit form
  const [textContent, setTextContent] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getStudentHomework(studentProfileId);
    setItems(data);
    setLoading(false);
  }, [studentProfileId]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (item: AssignmentWithSub) => {
    setSelectedItem(item);
    setTextContent(item.submission?.text_content ?? "");
    setAudioBlob(null);
    setError(null);

    if (item.submission && item.submission.status !== "pending") {
      const files = await getSubmissionFiles(item.submission.id);
      setSubmissionFiles(files);
    } else {
      setSubmissionFiles([]);
    }
  };

  const handleSubmit = async () => {
    if (!selectedItem?.submission) return;
    setSubmitting(true);
    setError(null);

    let audioFile: File | undefined;
    if (audioBlob) {
      audioFile = new File([audioBlob], `recording_${Date.now()}.webm`, {
        type: audioBlob.type,
      });
    }

    const result = await submitHomework(
      selectedItem.submission.id,
      textContent || undefined,
      audioFile
    );

    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }

    toast.success("숙제가 제출되었습니다.");
    setSelectedItem(null);
    router.refresh();
    await load();
  };

  if (loading) {
    return <LoadingState label="숙제 불러오는 중..." />;
  }

  // Detail view
  if (selectedItem) {
    const sub = selectedItem.submission;
    const status = sub ? STATUS_CONFIG[sub.status] : STATUS_CONFIG.pending;
    const canSubmit = sub?.status === "pending";

    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setSelectedItem(null)}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          목록으로
        </button>

        <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${status.bg} ${status.color}`}>
                {status.label}
              </span>
              {selectedItem.class_name && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                  {selectedItem.class_name}
                </span>
              )}
            </div>
            <h2 className="text-lg font-semibold text-foreground">{selectedItem.title}</h2>
            {selectedItem.due_date && (
              <p className="mt-1 text-xs text-muted-foreground">
                마감: {new Date(selectedItem.due_date).toLocaleDateString("ko-KR")}
              </p>
            )}
          </div>

          {selectedItem.description && (
            <div className="whitespace-pre-wrap text-sm text-foreground leading-relaxed rounded-lg bg-muted/30 p-4">
              {selectedItem.description}
            </div>
          )}

          {/* 이미 제출한 경우 */}
          {sub && sub.status !== "pending" && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">내 제출</h3>
              {sub.text_content && (
                <div className="whitespace-pre-wrap text-sm text-muted-foreground rounded-lg border p-3">
                  {sub.text_content}
                </div>
              )}
              {submissionFiles.length > 0 && (
                <div className="space-y-2">
                  {submissionFiles.map((f) => (
                    <div key={f.id} className="rounded-lg border bg-card p-3">
                      <p className="text-sm font-medium text-foreground">{f.original_filename}</p>
                      {f.mime_type.startsWith("audio/") && f.signed_url && (
                        /* eslint-disable-next-line jsx-a11y/media-has-caption */
                        <audio controls src={f.signed_url} className="mt-2 w-full h-10" preload="metadata" />
                      )}
                    </div>
                  ))}
                </div>
              )}
              {sub.submitted_at && (
                <p className="text-xs text-muted-foreground">
                  제출 시각: {new Date(sub.submitted_at).toLocaleString("ko-KR")}
                </p>
              )}

              {/* 교사 피드백 */}
              {sub.status === "reviewed" && sub.teacher_feedback && (
                <div className="rounded-lg border-l-4 border-emerald-500 bg-emerald-50 p-4">
                  <h4 className="text-sm font-medium text-emerald-700 mb-1">선생님 피드백</h4>
                  <p className="text-sm text-emerald-800 whitespace-pre-wrap">{sub.teacher_feedback}</p>
                </div>
              )}
            </div>
          )}

          {/* 제출 폼 */}
          {canSubmit && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-sm font-medium text-foreground">숙제 제출</h3>

              {error && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
              )}

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">음성 녹음</label>
                <AudioRecorder
                  onRecordingComplete={setAudioBlob}
                  maxDuration={300}
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">텍스트 메모 (선택)</label>
                <Textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="메모를 입력하세요"
                  rows={3}
                  disabled={submitting}
                />
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || (!audioBlob && !textContent.trim())}
                  className="min-h-[44px] sm:min-h-[40px]"
                >
                  {submitting ? <><Spinner size="sm" /> 제출 중…</> : "제출하기"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // List view
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/30 p-12 text-center">
        <p className="text-sm text-muted-foreground">배정된 숙제가 없습니다.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const status = item.submission
          ? STATUS_CONFIG[item.submission.status]
          : STATUS_CONFIG.pending;
        const isOverdue =
          item.due_date &&
          new Date(item.due_date) < new Date() &&
          item.submission?.status === "pending";

        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => openDetail(item)}
              className="w-full text-left rounded-xl border bg-card p-4 shadow-sm hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-start gap-2">
                <span className={`shrink-0 mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${status.bg} ${status.color}`}>
                  {status.label}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {item.class_name && (
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        {item.class_name}
                      </span>
                    )}
                    <h3 className="text-sm font-medium text-foreground truncate">{item.title}</h3>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{new Date(item.created_at).toLocaleDateString("ko-KR")}</span>
                    {item.due_date && (
                      <>
                        <span>·</span>
                        <span className={isOverdue ? "text-red-500 font-medium" : ""}>
                          마감: {new Date(item.due_date).toLocaleDateString("ko-KR")}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
