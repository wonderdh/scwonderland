"use client";

import { updateReportCardReply } from "@/app/(admin)/admin/actions";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/feedback/Spinner";

export function ReportCardReplyForm({
  reportCardId,
  initialReply,
  initialReplyEn,
}: {
  reportCardId: string;
  initialReply: string;
  initialReplyEn?: string | null;
}) {
  const router = useRouter();
  const [reply, setReply] = useState(initialReply);
  const [translateToEnglish, setTranslateToEnglish] = useState(!!initialReplyEn);
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasExistingReply = initialReply.trim() !== "";
  const buttonLabel = hasExistingReply ? "수정" : "저장";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await updateReportCardReply(reportCardId, reply.trim(), translateToEnglish);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    toast.success(translateToEnglish ? "답변이 저장되었습니다. (영어 번역 포함)" : "답변이 저장되었습니다.");
    router.refresh();
  };

  const handleDelete = async () => {
    if (!window.confirm("답글을 삭제하시겠습니까?")) return;
    setDeleting(true);
    setError(null);
    const result = await updateReportCardReply(reportCardId, "");
    setDeleting(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    toast.success("답글이 삭제되었습니다.");
    router.refresh();
  };

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-emerald-50 px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
          답글 쓰기
        </span>
      </div>
      <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3">
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={4}
          placeholder="선생님 코멘트에 대한 답글을 남겨 주세요."
          className="w-full rounded-lg border border-slate-200 px-3 py-3 text-base text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 sm:text-sm"
        />

        {/* 영어 번역 옵션 */}
        <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
          <input
            type="checkbox"
            checked={translateToEnglish}
            onChange={(e) => {
              if (!e.target.checked && initialReplyEn) {
                if (!window.confirm("체크 해제 시 기존 영어 번역이 삭제됩니다. 계속하시겠습니까?")) return;
              }
              setTranslateToEnglish(e.target.checked);
            }}
            className="h-4 w-4 rounded border-slate-300 text-slate-800 accent-slate-800"
          />
          <span className="text-sm text-slate-600">선생님께 영어로도 전달하기</span>
          {initialReplyEn && (
            <span className="text-xs text-emerald-600 font-medium">(번역됨)</span>
          )}
        </label>

        <div className="flex items-center justify-between gap-2">
          {hasExistingReply ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || pending}
              className="inline-flex items-center gap-1.5 min-h-[44px] rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 touch-manipulation"
            >
              {deleting && <Spinner size="sm" />}
              {deleting ? "삭제 중…" : "삭제"}
            </button>
          ) : (
            <div />
          )}
          <button
            type="submit"
            disabled={pending || deleting}
            className="min-h-[44px] rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 touch-manipulation"
          >
            {pending ? <><Spinner size="sm" /> {buttonLabel} 중…</> : buttonLabel}
          </button>
        </div>
      </form>
    </section>
  );
}
