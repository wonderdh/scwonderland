/**
 * 리포트카드 본문·답글 읽기 전용 뷰.
 * 선생님 코멘트 / 답글 영역을 시각적으로 명확히 구분.
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
    <div className="mx-auto w-full max-w-2xl space-y-6 px-0 sm:px-0">
      <header className="text-sm font-medium text-slate-500">
        {year}년 {month}월 리포트
      </header>

      {/* 선생님 코멘트 — 라벨과 본문 분리 */}
      {hasContent ? (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-100 px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              선생님 코멘트
            </span>
          </div>
          <div className="p-4 sm:p-5">
            <p className="whitespace-pre-wrap text-base leading-relaxed text-slate-800 sm:text-sm">
              {content}
            </p>
          </div>
        </section>
      ) : (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50">
          <div className="border-b border-slate-200 bg-slate-100 px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              선생님 코멘트
            </span>
          </div>
          <p className="p-4 sm:p-5 text-sm text-slate-500">
            아직 작성된 본문이 없습니다.
          </p>
        </section>
      )}

      {/* 내 답글 — 라벨과 본문 분리 */}
      {hasReply && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-emerald-50 px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              {replyLabel}
            </span>
          </div>
          <div className="p-4 sm:p-5">
            <p className="whitespace-pre-wrap text-base leading-relaxed text-slate-800 sm:text-sm">
              {reply}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
