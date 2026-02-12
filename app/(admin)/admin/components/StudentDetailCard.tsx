import type { UserWithProfile } from "../actions";

export function StudentDetailCard({ user }: { user: UserWithProfile }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden max-w-lg">
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/80">
        <h2 className="text-lg font-semibold text-slate-800">학생 정보</h2>
      </div>
      <dl className="divide-y divide-slate-100">
        <div className="px-5 py-3 flex gap-4">
          <dt className="w-28 shrink-0 text-slate-500 text-sm">한글 이름</dt>
          <dd className="text-slate-800">{user.korean_name ?? user.first_name ?? "—"}</dd>
        </div>
        <div className="px-5 py-3 flex gap-4">
          <dt className="w-28 shrink-0 text-slate-500 text-sm">영어 이름</dt>
          <dd className="text-slate-800">{user.english_name ?? user.last_name ?? "—"}</dd>
        </div>
        <div className="px-5 py-3 flex gap-4">
          <dt className="w-28 shrink-0 text-slate-500 text-sm">학번</dt>
          <dd className="text-slate-800 font-mono">{user.student_number ?? "—"}</dd>
        </div>
        <div className="px-5 py-3 flex gap-4">
          <dt className="w-28 shrink-0 text-slate-500 text-sm">이메일</dt>
          <dd className="text-slate-800 break-all">{user.email || "—"}</dd>
        </div>
      </dl>
    </div>
  );
}
