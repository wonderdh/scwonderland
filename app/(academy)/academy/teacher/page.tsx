import Link from "next/link";

export default function AcademyTeacherPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-800 mb-4">선생님</h1>
      <p className="text-slate-600 mb-6">
        담당 학생 목록 · 리포트 카드 작성 (준비 중)
      </p>
      <Link
        href="/academy/dashboard"
        className="text-sm text-slate-500 underline hover:text-slate-700"
      >
        ← 대시보드로
      </Link>
    </div>
  );
}
