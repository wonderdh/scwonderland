import { getCurrentStudentClasses, getCurrentStudentProfile } from "../actions";
import Link from "next/link";

export default async function StudentInfoPage() {
  const [profile, classes] = await Promise.all([
    getCurrentStudentProfile(),
    getCurrentStudentClasses(),
  ]);
  if (!profile) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <h1 className="text-lg font-semibold text-slate-800 mb-4">내 정보</h1>
      <dl className="space-y-3">
        <div className="flex gap-3">
          <dt className="w-24 shrink-0 text-slate-500 text-sm">이름</dt>
          <dd className="text-slate-800">
            {profile.korean_name ?? "—"}
            {profile.english_name && (
              <span className="text-slate-500 ml-1">({profile.english_name})</span>
            )}
          </dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-24 shrink-0 text-slate-500 text-sm">학번</dt>
          <dd className="text-slate-800 font-mono">{profile.student_number ?? "—"}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-24 shrink-0 text-slate-500 text-sm">이메일</dt>
          <dd className="text-slate-800 break-all">{profile.email || "—"}</dd>
        </div>
      </dl>

      {/* 소속 반 */}
      <div className="mt-6 pt-4 border-t border-slate-100">
        <h2 className="text-sm font-medium text-slate-600 mb-3">소속 반</h2>
        {classes.length === 0 ? (
          <p className="text-sm text-slate-500">소속된 반이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {classes.map((item, i) => (
              <li
                key={`${item.class_name}-${i}`}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2 text-sm"
              >
                <span className="font-medium text-slate-800">{item.class_name}</span>
                <span className="text-slate-500">
                  담당 선생님: {item.teacher_name ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-4 text-sm text-slate-500">
        정보 수정이 필요하면 선생님 또는 관리자에게 문의하세요.
      </p>
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
