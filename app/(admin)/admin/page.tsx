import Link from "next/link";

export default function AdminDashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-800 mb-1">
        대시보드
      </h1>
      <p className="text-slate-500 text-sm mb-8">
        서비스 현황을 한눈에 확인하세요.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
        <Link
          href="/admin/students"
          className="block p-5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition"
        >
          <span className="text-lg font-medium text-slate-800">학생 관리</span>
          <p className="mt-1 text-sm text-slate-500">
            학생 목록 · 추가 · 수정 · 삭제
          </p>
        </Link>
        <Link
          href="/admin/teachers"
          className="block p-5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition"
        >
          <span className="text-lg font-medium text-slate-800">선생 관리</span>
          <p className="mt-1 text-sm text-slate-500">
            선생 목록 · 추가 · 수정 · 삭제
          </p>
        </Link>
      </div>
    </div>
  );
}
