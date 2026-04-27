import {
  getReportCard,
  listReportCardsByStudent,
} from "@/app/(admin)/admin/actions";
import type { ReportCard } from "@/lib/types";
import { getCurrentStudentProfile } from "../../actions";
import Link from "next/link";
import { ReportCardReplyForm } from "../components/ReportCardReplyForm";

export default async function StudentReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const profile = await getCurrentStudentProfile();
  if (!profile) return null;

  const list = await listReportCardsByStudent(profile.id);
  const { year: y, month: m } = await searchParams;
  const year = y ? parseInt(y, 10) : null;
  const month = m ? parseInt(m, 10) : null;

  let selectedReport: ReportCard | null = null;
  if (year != null && month != null && !isNaN(year) && !isNaN(month)) {
    selectedReport = await getReportCard(profile.id, year, month);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-800">리포트카드</h1>

      {list.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-8 text-center text-sm text-slate-500">
          아직 받은 리포트카드가 없습니다.
        </div>
      ) : (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-medium text-slate-600 mb-3">목록</h2>
            <ul className="flex flex-wrap gap-2">
              {list.map((item) => {
                const isSelected =
                  selectedReport?.year === item.year &&
                  selectedReport?.month === item.month;
                return (
                  <li key={item.id}>
                    <Link
                      href={`/academy/student/reports?year=${item.year}&month=${item.month}`}
                      className={`inline-block min-h-[44px] rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors touch-manipulation ${
                        isSelected
                          ? "border-slate-800 bg-slate-800 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {item.year}년 {item.month}월
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          {selectedReport ? (
            <div className="space-y-5">
              <StudentReportView report={selectedReport} />
              {selectedReport.content != null &&
                selectedReport.content.trim() !== "" && (
                  <ReportCardReplyForm
                    key={selectedReport.id}
                    reportCardId={selectedReport.id}
                    initialReply={selectedReport.reply ?? ""}
                    initialReplyEn={selectedReport.reply_en}
                  />
                )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              위 목록에서 확인할 리포트를 선택하세요.
            </p>
          )}
        </>
      )}

      <p>
        <Link
          href="/academy/dashboard"
          className="text-sm text-slate-500 underline hover:text-slate-700"
        >
          ← 대시보드로
        </Link>
      </p>
    </div>
  );
}

/** 학부모용 리포트 뷰: 영어 원문 기본 표시, 한국어 번역은 클릭 시 펼침 */
function StudentReportView({ report }: { report: ReportCard }) {
  const hasContent = report.content != null && report.content.trim() !== "";
  const hasKo = report.content_ko != null && report.content_ko.trim() !== "";
  const hasReply = report.reply != null && report.reply.trim() !== "";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <header className="text-sm font-medium text-slate-500">
        {report.year}년 {report.month}월 리포트
        {report.author_name && (
          <span className="ml-2 text-slate-400">· 작성: {report.author_name}</span>
        )}
      </header>

      {/* 선생님 코멘트 */}
      {hasContent ? (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-100 px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              선생님 코멘트
            </span>
          </div>
          <div className="p-4 sm:p-5 space-y-4">
            <p className="whitespace-pre-wrap text-base leading-relaxed text-slate-800 sm:text-sm">
              {report.content}
            </p>
            {hasKo && (
              <details className="border-t border-slate-100 pt-3">
                <summary className="cursor-pointer text-xs font-medium text-blue-500 hover:text-blue-700 select-none w-fit">
                  번역 보기
                </summary>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                  {report.content_ko}
                </p>
              </details>
            )}
          </div>
        </section>
      ) : (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50">
          <div className="border-b border-slate-200 bg-slate-100 px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              선생님 코멘트
            </span>
          </div>
          <p className="p-4 sm:p-5 text-sm text-slate-400">
            아직 작성된 본문이 없습니다.
          </p>
        </section>
      )}

      {/* 내 답글 */}
      {hasReply && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-emerald-50 px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              내 답글 (학부모)
            </span>
          </div>
          <div className="p-4 sm:p-5">
            <p className="whitespace-pre-wrap text-base leading-relaxed text-slate-800 sm:text-sm">
              {report.reply}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
