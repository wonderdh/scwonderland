import Link from "next/link";

export default function AdminStudentsClassesPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-slate-800 mb-2">반 이동</h1>
      <p className="text-slate-500 text-sm mb-6">
        학생을 다른 반으로 이동시키는 기능입니다. 추후 구현 예정입니다.
      </p>
      <div className="p-6 bg-white rounded-xl border border-slate-200 text-center text-slate-500">
        준비 중입니다.
      </div>
      <p className="mt-4 text-sm">
        <Link href="/admin/students" className="text-slate-600 hover:underline">
          ← 학생 목록으로
        </Link>
      </p>
    </div>
  );
}
