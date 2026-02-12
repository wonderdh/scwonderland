import Link from "next/link";

export default function StudentHomeworkPage() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <h1 className="text-lg font-semibold text-slate-800 mb-4">숙제</h1>
      <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-8 text-center text-sm text-slate-500">
        숙제 제출 기능은 준비 중입니다.
      </div>
      <p className="mt-4">
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
