import Link from "next/link";

export default function AcademyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <Link
          href="/academy/dashboard"
          className="font-semibold text-slate-800 hover:text-slate-600"
        >
          원더랜드 학원
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link
            href="/academy/dashboard"
            className="text-slate-600 hover:text-slate-900"
          >
            대시보드
          </Link>
          <span className="text-slate-400">|</span>
          <Link
            href="/"
            className="text-slate-500 hover:text-slate-700"
          >
            학원 소개 사이트
          </Link>
        </nav>
      </header>
      <main className="flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
