"use client";

import { updateReportCardReply } from "@/app/(admin)/admin/actions";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReportCardReplyForm({
  reportCardId,
  initialReply,
}: {
  reportCardId: string;
  initialReply: string;
}) {
  const router = useRouter();
  const [reply, setReply] = useState(initialReply);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasExistingReply = initialReply.trim() !== "";
  const buttonLabel = hasExistingReply ? "수정" : "저장";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await updateReportCardReply(reportCardId, reply.trim());
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
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
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="min-h-[44px] rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 touch-manipulation"
          >
            {pending ? `${buttonLabel} 중…` : buttonLabel}
          </button>
        </div>
      </form>
    </section>
  );
}
