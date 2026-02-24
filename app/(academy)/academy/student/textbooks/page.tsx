import { getCurrentStudentTextbooks } from "../../actions";

const STATUS_MAP = {
  not_started: { label: "시작 전", color: "bg-slate-100 text-slate-600" },
  in_progress: { label: "진행 중", color: "bg-blue-100 text-blue-700" },
  completed: { label: "완료", color: "bg-emerald-100 text-emerald-700" },
} as const;

const CATEGORY_MAP: Record<string, string> = {
  general: "일반",
  phonics: "파닉스",
  reading: "읽기",
  grammar: "문법",
  speaking: "말하기",
  writing: "쓰기",
  vocabulary: "어휘",
};

export default async function StudentTextbooksPage() {
  const textbooks = await getCurrentStudentTextbooks();

  const completed = textbooks.filter((t) => t.status === "completed").length;
  const inProgress = textbooks.filter((t) => t.status === "in_progress").length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <h1 className="text-lg font-semibold text-slate-800 mb-4">내 교재</h1>

      {/* 요약 통계 */}
      {textbooks.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-lg border border-slate-200 p-3 text-center">
            <p className="text-2xl font-bold text-slate-800">{textbooks.length}</p>
            <p className="text-xs text-slate-500">전체</p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-center">
            <p className="text-2xl font-bold text-blue-700">{inProgress}</p>
            <p className="text-xs text-blue-600">진행 중</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-center">
            <p className="text-2xl font-bold text-emerald-700">{completed}</p>
            <p className="text-xs text-emerald-600">완료</p>
          </div>
        </div>
      )}

      {textbooks.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-8 text-center text-sm text-slate-500">
          배정된 교재가 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {textbooks.map((t) => {
            const pct = t.total_units > 0 ? Math.round((t.completed_units / t.total_units) * 100) : 0;
            const st = STATUS_MAP[t.status];
            const catLabel = CATEGORY_MAP[t.textbook_category] ?? t.textbook_category;

            return (
              <div
                key={t.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="font-medium text-slate-800">{t.textbook_title}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                      <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">{catLabel}</span>
                      {t.textbook_level && <span>Lv. {t.textbook_level}</span>}
                      {t.textbook_series && <span>{t.textbook_series}</span>}
                      <span className="text-slate-400">
                        {t.source_type === "class"
                          ? `반 배정 (${t.source_class_name ?? ""})`
                          : "개별 배정"}
                      </span>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${st.color}`}>
                    {st.label}
                  </span>
                </div>

                {/* 진도 바 */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct >= 100 ? "bg-emerald-500" : "bg-blue-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-slate-600 shrink-0 min-w-[5rem] text-right">
                    {t.completed_units}/{t.total_units}단원 ({pct}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
