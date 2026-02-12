/**
 * 리포트카드 본문·답글 읽기 전용 뷰.
 * 모바일 우선 (학생이 자기 리포트 볼 때 재사용).
 */
export function ReportCardReadView({
  year,
  month,
  content,
  reply,
  replyLabel = "학생 답글",
}: {
  year: number;
  month: number;
  content: string | null;
  reply: string | null;
  replyLabel?: string;
}) {
  const hasContent = content != null && content.trim() !== "";
  const hasReply = reply != null && reply.trim() !== "";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 px-0 sm:px-0">
      <header className="text-sm font-medium text-slate-500">
        {year}년 {month}월 리포트
      </header>

      {hasContent ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="mb-2 text-sm font-medium text-slate-600">선생님 코멘트</h2>
          <p className="whitespace-pre-wrap text-base leading-relaxed text-slate-800 sm:text-sm">
            {content}
          </p>
        </section>
      ) : (
        <p className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm text-slate-500">
          아직 작성된 본문이 없습니다.
        </p>
      )}

      {hasReply && (
        <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
          <h2 className="mb-2 text-sm font-medium text-slate-700">{replyLabel}</h2>
          <p className="whitespace-pre-wrap text-base leading-relaxed text-slate-800 sm:text-sm">
            {reply}
          </p>
        </section>
      )}
    </div>
  );
}
