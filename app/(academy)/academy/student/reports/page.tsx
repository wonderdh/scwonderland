import {
  getReportCard,
  listReportCardsByStudent,
} from "@/app/(admin)/admin/actions";
import type { ReportCard, ReportCardListItem } from "@/lib/types";
import { getCurrentStudentProfile } from "../../actions";
import Link from "next/link";
import { ReportCardReplyForm } from "../components/ReportCardReplyForm";
import { ReportCardReadView } from "@/app/(admin)/admin/students/components/ReportCardReadView";

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
              <ReportCardReadView
                year={selectedReport.year}
                month={selectedReport.month}
                content={selectedReport.content}
                reply={selectedReport.reply}
                replyLabel="내 답글 (학부모)"
                authorName={selectedReport.author_name}
              />
              {selectedReport.content != null &&
                selectedReport.content.trim() !== "" && (
                  <ReportCardReplyForm
                    key={selectedReport.id}
                    reportCardId={selectedReport.id}
                    initialReply={selectedReport.reply ?? ""}
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
