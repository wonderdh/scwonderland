import {
  listAllClassesReportStatus,
  listAllClassesWithStudents,
  listUntranslatedReports,
} from "@/app/(admin)/admin/actions/report-actions";
import { ReportTranslateManager } from "./_components/ReportTranslateManager";
import { TeacherReportClient } from "@/app/academy/teacher/_components/TeacherReportClient";
import Link from "next/link";

export const metadata = {
  title: "리포트카드 현황 | Admin",
};

function getRateBadgeClass(written: number, total: number): string {
  if (total === 0) return "bg-slate-100 text-slate-500";
  const rate = written / total;
  if (rate >= 1) return "bg-emerald-100 text-emerald-700";
  if (rate >= 0.5) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; tab?: string; classId?: string }>;
}) {
  const { year: yearStr, month: monthStr, tab, classId } = await searchParams;

  const now = new Date();
  const year = yearStr ? parseInt(yearStr, 10) : now.getFullYear();
  const month = monthStr ? parseInt(monthStr, 10) : now.getMonth() + 1;

  const safeYear = isNaN(year) || year < 2000 || year > 2100 ? now.getFullYear() : year;
  const safeMonth = isNaN(month) || month < 1 || month > 12 ? now.getMonth() + 1 : month;
  const activeTab =
    tab === "translate" ? "translate" : tab === "browse" ? "browse" : "status";

  // 탭별 데이터 fetch
  const [classes, reports, browseClasses] = await Promise.all([
    activeTab === "status" ? listAllClassesReportStatus(safeYear, safeMonth) : Promise.resolve([]),
    activeTab === "translate" ? listUntranslatedReports(safeYear, safeMonth) : Promise.resolve([]),
    activeTab === "browse" ? listAllClassesWithStudents() : Promise.resolve([]),
  ]);

  // 딥링크로 넘어온 classId 가 실제 존재하는 반일 때만 초기 선택
  const initialClassId = browseClasses.some((c) => c.id === classId) ? classId! : null;

  const totalWritten = classes.reduce((sum, c) => sum + c.written, 0);
  const totalStudents = classes.reduce((sum, c) => sum + c.total, 0);

  const currentYear = now.getFullYear();
  const years = Array.from({ length: 3 }, (_, i) => currentYear - 1 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const baseParams = (t: string) =>
    `?year=${safeYear}&month=${safeMonth}&tab=${t}`;
  const filterHref = (y: number, m: number) =>
    `/admin/reports?year=${y}&month=${m}&tab=${activeTab}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">리포트카드</h1>
        </div>

        {/* 년/월 필터 (반별 조회 탭은 자체 선택 UI 보유) */}
        {activeTab !== "browse" && (
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {years.map((y) => (
              <Link
                key={y}
                href={filterHref(y, safeMonth)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  y === safeYear
                    ? "bg-slate-800 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {y}년
              </Link>
            ))}
          </div>
          <div className="flex gap-1">
            {months.map((m) => (
              <Link
                key={m}
                href={filterHref(safeYear, m)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  m === safeMonth
                    ? "bg-slate-800 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {m}월
              </Link>
            ))}
          </div>
        </div>
        )}
      </div>

      {/* 탭 네비 */}
      <div className="flex gap-1 border-b border-slate-200">
        {[
          { key: "status", label: "작성 현황" },
          { key: "browse", label: "반별 조회" },
          { key: "translate", label: "번역 관리" },
        ].map(({ key, label }) => (
          <Link
            key={key}
            href={`/admin/reports${baseParams(key)}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === key
                ? "border-slate-800 text-slate-800"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* 작성 현황 탭 */}
      {activeTab === "status" && (
        <>
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">반 이름</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">학생 수</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">작성</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">미작성</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">작성률</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">
                      등록된 반이 없습니다.
                    </td>
                  </tr>
                ) : (
                  classes.map((cls) => {
                    const missing = cls.total - cls.written;
                    const rateText =
                      cls.total === 0
                        ? "-"
                        : `${Math.round((cls.written / cls.total) * 100)}%`;
                    return (
                      <tr key={cls.classId} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-800">
                          <Link
                            href={`/admin/reports?year=${safeYear}&month=${safeMonth}&tab=browse&classId=${cls.classId}`}
                            className="hover:text-blue-600 hover:underline"
                          >
                            {cls.className}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-center text-slate-600">{cls.total}명</td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-emerald-700 font-medium">{cls.written}명</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={missing > 0 ? "text-red-600 font-medium" : "text-slate-400"}>
                            {missing}명
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs ${getRateBadgeClass(cls.written, cls.total)}`}
                          >
                            {rateText}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {classes.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200 font-semibold">
                    <td className="px-4 py-3 text-slate-700">전체 합산</td>
                    <td className="px-4 py-3 text-center text-slate-700">{totalStudents}명</td>
                    <td className="px-4 py-3 text-center text-emerald-700">{totalWritten}명</td>
                    <td className="px-4 py-3 text-center">
                      <span className={totalStudents - totalWritten > 0 ? "text-red-600" : "text-slate-400"}>
                        {totalStudents - totalWritten}명
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs ${getRateBadgeClass(totalWritten, totalStudents)}`}
                      >
                        {totalStudents === 0
                          ? "-"
                          : `${Math.round((totalWritten / totalStudents) * 100)}%`}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <p className="text-xs text-slate-400">
            {safeYear}년 {safeMonth}월 기준 · 전체 {classes.length}개 반
          </p>
        </>
      )}

      {/* 반별 조회 탭 */}
      {activeTab === "browse" && (
        <TeacherReportClient
          classes={browseClasses}
          initialClassId={initialClassId}
          isReadOnly
          hideTitle
          initialYear={safeYear}
          initialMonth={safeMonth}
        />
      )}

      {/* 번역 관리 탭 */}
      {activeTab === "translate" && (
        <ReportTranslateManager
          reports={reports}
          year={safeYear}
          month={safeMonth}
        />
      )}
    </div>
  );
}
