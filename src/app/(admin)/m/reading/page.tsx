import Link from "next/link";
import { getAllReadingStats } from "../../admin/actions/raz-actions";

export default async function MobileReadingPage() {
  const stats = await getAllReadingStats();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background px-4 py-3">
        <Link href="/m" className="text-muted-foreground">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="text-base font-semibold text-foreground">리딩 관리</h1>
      </header>

      <div className="flex-1 space-y-4 px-4 py-4">
        {stats.length === 0 ? (
          <p className="py-20 text-center text-sm text-muted-foreground">표시할 반이 없습니다.</p>
        ) : (
          stats.map((c) => (
            <section key={c.classId} className="overflow-hidden rounded-2xl border border-border bg-card">
              <h2 className="border-b border-border px-4 py-2.5 text-sm font-semibold text-foreground">
                {c.className}
              </h2>
              <ul>
                {c.students.map((s) => (
                  <li key={s.studentId} className="border-b border-border last:border-b-0">
                    <Link
                      href={`/m/reading/${s.studentId}`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-muted"
                    >
                      <span className="text-sm font-medium text-foreground">
                        {s.koreanName ?? s.englishName ?? "이름 없음"}
                      </span>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        {s.readCount}권{s.topLevel ? ` · 최고 ${s.topLevel}` : ""}
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
