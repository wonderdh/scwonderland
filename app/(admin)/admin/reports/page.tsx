import { listAllClassesReportStatus } from "../actions";
import Link from "next/link";

export const metadata = {
  title: "리포트카드 현황 | Admin",
};

function getRateColor(written: number, total: number): string {
  if (total === 0) return "text-slate-400";
  const rate = written / total;
  if (rate >= 1) return "text-emerald-600 font-semibold";
  if (rate >= 0.5) return "text-amber-600 font-semibold";
  return "text-red-600 font-semibold";
}

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
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { year: yearStr, month: monthStr } = await searchParams;

  const now = new Date();
  const year = yearStr ? parseInt(yearStr, 10) : now.getFullYear();
  const month = monthStr ? parseInt(monthStr, 10) : now.getMonth() + 1;

  const safeYear = isNaN(year) || year < 2000 || year > 2100 ? now.getFullYear() : year;
  const safeMonth = isNaN(month) || month < 1 || month > 12 ? now.getMonth() + 1 : month;

  const classes = await listAllClassesReportStatus(safeYear, safeMonth);

  const totalWritten = classes.reduce((sum, c) => sum + c.written, 0);
  const totalStudents = classes.reduce((sum, c) => sum + c.total, 0);

  // 년/월 선택 범위 생성
  const currentYear = now.getFullYear();
  const years = Array.from({ length: 3 }, (_, i) => currentYear - 1 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">리포트카드 현황</h1>
          <p className="text-sm text-slate-500 mt-0.5">반별 리포트카드 작성 현황을 조회합니다.</p>
        </div>

        {/* 년/월 필터 */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {years.map((y) => (
              <Link
                key={y}
                href={`/admin/reports?year=${y}&month=${safeMonth}`}
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
                href={`/admin/reports?year=${safeYear}&month=${m}`}
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
      </div>

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
                    <td className="px-4 py-3 font-medium text-slate-800">{cls.className}</td>
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
    </div>
  );
}
