import Link from "next/link";

export default function AcademyStudentPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-800 mb-4">학생</h1>
      <p className="text-slate-600 mb-6">
        숙제 제출 · 제출 이력 · 리포트 카드 보기 (준비 중)
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
