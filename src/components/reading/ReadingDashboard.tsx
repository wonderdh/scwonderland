import Link from "next/link";
import type { ClassReadingStats } from "@/lib/raz/stats";

interface ReadingDashboardProps {
  stats: ClassReadingStats[];
  hrefBase: string; // "/academy/teacher/reading" | "/admin/reading"
}

export function ReadingDashboard({ stats, hrefBase }: ReadingDashboardProps) {
  if (stats.length === 0) {
    return <p className="py-20 text-center text-sm text-muted-foreground">표시할 반이 없습니다.</p>;
  }
  return (
    <div className="space-y-6">
      {stats.map((c) => (
        <section key={c.classId} className="rounded-lg border border-slate-200 bg-white">
          <h2 className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800">
            {c.className}
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">학생</th>
                <th className="px-4 py-2 font-medium">읽은 권수</th>
                <th className="px-4 py-2 font-medium">최고 레벨</th>
                <th className="px-4 py-2 font-medium">레벨 분포</th>
              </tr>
            </thead>
            <tbody>
              {c.students.map((s) => (
                <tr key={s.studentId} className="border-t border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`${hrefBase}/${s.studentId}`} className="font-medium text-blue-600 hover:underline">
                      {s.koreanName ?? s.englishName ?? "이름 없음"}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{s.readCount}권</td>
                  <td className="px-4 py-2">{s.topLevel ?? "—"}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {Object.entries(s.levelCounts).map(([lv, n]) => `${lv}(${n})`).join(" ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
