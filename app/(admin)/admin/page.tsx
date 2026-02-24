import Link from "next/link";
import { getDashboardStats } from "./actions";

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();

  const statCards = [
    { label: "학생", value: stats.studentCount, color: "text-emerald-600" },
    { label: "교사", value: stats.teacherCount, color: "text-blue-600" },
    { label: "반", value: stats.classCount, color: "text-violet-600" },
    { label: "리포트카드", value: stats.reportCardCount, color: "text-amber-600" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-800 mb-1">
        대시보드
      </h1>
      <p className="text-slate-500 text-sm mb-8">
        서비스 현황을 한눈에 확인하세요.
      </p>

      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4 max-w-2xl mb-8">
        {statCards.map((s) => (
          <div
            key={s.label}
            className="p-4 bg-white rounded-xl border border-slate-200"
          >
            <p className="text-xs font-medium text-slate-500">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

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
        <Link
          href="/admin/classes"
          className="block p-5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition"
        >
          <span className="text-lg font-medium text-slate-800">반 관리</span>
          <p className="mt-1 text-sm text-slate-500">
            반 생성 · 담당 선생 지정 · 소속 학생 관리
          </p>
        </Link>
        <Link
          href="/admin/textbooks"
          className="block p-5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition"
        >
          <span className="text-lg font-medium text-slate-800">교재 관리</span>
          <p className="mt-1 text-sm text-slate-500">
            교재 등록 · 반/학생 배정 · 진도 관리
          </p>
        </Link>
      </div>
    </div>
  );
}
