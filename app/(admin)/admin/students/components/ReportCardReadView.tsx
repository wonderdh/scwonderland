export function ReportCardReadView({
  year,
  month,
  content,
  reply,
  replyLabel = "학부모 답글",
  authorName,
}: {
  year: number;
  month: number;
  content: string | null;
  reply: string | null;
  replyLabel?: string;
  authorName?: string | null;
}) {
  const hasContent = content != null && content.trim() !== "";
  const hasReply = reply != null && reply.trim() !== "";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-0 sm:px-0">
      <header className="text-sm font-medium text-muted-foreground">
        {year}년 {month}월 리포트
      </header>

      {hasContent ? (
        <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="border-b bg-muted/50 px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              선생님 코멘트
            </span>
            {authorName && (
              <span className="text-xs text-muted-foreground">작성: {authorName}</span>
            )}
          </div>
          <div className="p-4 sm:p-5">
            <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground sm:text-sm">
              {content}
            </p>
          </div>
        </section>
      ) : (
        <section className="overflow-hidden rounded-xl border bg-muted/30">
          <div className="border-b bg-muted/50 px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              선생님 코멘트
            </span>
          </div>
          <p className="p-4 sm:p-5 text-sm text-muted-foreground">
            아직 작성된 본문이 없습니다.
          </p>
        </section>
      )}

      {hasReply && (
        <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="border-b bg-emerald-50 px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              {replyLabel}
            </span>
          </div>
          <div className="p-4 sm:p-5">
            <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground sm:text-sm">
              {reply}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
