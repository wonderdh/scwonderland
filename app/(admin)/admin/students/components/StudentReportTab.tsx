"use client";

import {
  getReportCard,
  listReportCardsByStudent,
  upsertReportCard,
  type ReportCard,
  type ReportCardListItem,
} from "../../actions";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function getDefaultYearMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function StudentReportTab({ studentProfileId }: { studentProfileId: string }) {
  const router = useRouter();
  const [year, setYear] = useState(() => getDefaultYearMonth().year);
  const [month, setMonth] = useState(() => getDefaultYearMonth().month);
  const [content, setContent] = useState("");
  const [report, setReport] = useState<ReportCard | null>(null);
  const [list, setList] = useState<ReportCardListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await getReportCard(studentProfileId, year, month);
    setReport(data);
    setContent(data?.content ?? "");
    setLoading(false);
  }, [studentProfileId, year, month]);

  const loadList = useCallback(async () => {
    setListLoading(true);
    const items = await listReportCardsByStudent(studentProfileId);
    setList(items);
    setListLoading(false);
  }, [studentProfileId]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const result = await upsertReportCard(studentProfileId, year, month, content);
    setSaving(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
    await loadReport();
    await loadList();
  };

  const handleSelectYearMonth = useCallback((y: number, m: number) => {
    setYear(y);
    setMonth(m);
  }, []);

  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  const isInitialLoad = loading && report === null && list.length === 0 && !listLoading;
  if (isInitialLoad) {
    return (
      <div className="py-8 text-center text-slate-500 text-sm">불러오는 중…</div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-0 sm:px-0">
      {/* 기존 리포트 목록 — 모바일에서 터치하기 좋게 min-h, padding */}
      <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:p-4">
        <h2 className="mb-3 text-sm font-medium text-slate-600">기존 리포트</h2>
        {listLoading ? (
          <p className="py-2 text-sm text-slate-400">목록 불러오는 중…</p>
        ) : list.length === 0 ? (
          <p className="py-2 text-sm text-slate-400">아직 작성된 리포트가 없습니다.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {list.map((item) => {
              const isSelected = item.year === year && item.month === month;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectYearMonth(item.year, item.month)}
                    className={`min-h-[44px] w-full rounded-lg border px-3 py-3 text-left text-sm font-medium transition-colors touch-manipulation sm:min-h-[40px] sm:py-2 ${
                      isSelected
                        ? "border-slate-800 bg-slate-800 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {item.year}년 {item.month}월
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 년·월 직접 선택 */}
      <section className="flex flex-wrap items-center gap-3 gap-y-2">
        <span className="text-sm font-medium text-slate-600">또는 선택</span>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="rc-year" className="sr-only sm:not-sr-only sm:inline-block sm:text-sm sm:text-slate-700">
            년도
          </label>
          <select
            id="rc-year"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="min-h-[44px] flex-1 touch-manipulation rounded-lg border border-slate-200 px-3 py-2 text-base text-slate-800 sm:min-h-0 sm:flex-initial sm:text-sm"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
          <label htmlFor="rc-month" className="sr-only sm:not-sr-only sm:inline-block sm:text-sm sm:text-slate-700">
            월
          </label>
          <select
            id="rc-month"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="min-h-[44px] flex-1 touch-manipulation rounded-lg border border-slate-200 px-3 py-2 text-base text-slate-800 sm:min-h-0 sm:flex-initial sm:text-sm"
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>
        </div>
      </section>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {/* 본문 — 라벨과 입력 영역 분리 */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-100 px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
            선생님 코멘트 (본문)
          </span>
        </div>
        <div className="p-4 sm:p-5">
          {loading && (
            <p className="mb-2 text-sm text-slate-500">불러오는 중…</p>
          )}
          <label htmlFor="rc-content" className="sr-only">
            리포트 본문
          </label>
          <textarea
            id="rc-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            placeholder="이 달의 학습·생활 내용을 작성하세요."
            disabled={loading}
            className="w-full rounded-lg border border-slate-200 px-3 py-3 text-base text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-70 sm:py-2 sm:text-sm"
          />
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="min-h-[44px] touch-manipulation rounded-lg bg-slate-800 px-5 py-2.5 text-base font-medium text-white hover:bg-slate-700 disabled:opacity-50 sm:min-h-[40px] sm:text-sm"
            >
              {saving ? "저장 중…" : "저장"}
            </button>
          </div>
        </div>
      </section>

      {/* 학생 답글 — 라벨과 본문 분리 */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-emerald-50 px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            학생 답글
          </span>
        </div>
        <div className="p-4 sm:p-5">
          {report?.reply != null && report.reply !== "" ? (
            <p className="whitespace-pre-wrap text-base text-slate-800 sm:text-sm">
              {report.reply}
            </p>
          ) : (
            <p className="text-sm text-slate-400">아직 답글이 없습니다.</p>
          )}
        </div>
      </section>
    </div>
  );
}
