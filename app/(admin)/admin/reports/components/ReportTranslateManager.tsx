"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { translateReportCard } from "@/app/(admin)/admin/actions";
import type { UntranslatedReport } from "@/app/(admin)/admin/actions";
import { Spinner } from "@/components/feedback/Spinner";

export function ReportTranslateManager({
  reports,
  year,
  month,
}: {
  reports: UntranslatedReport[];
  year: number;
  month: number;
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const needsContentTranslation = reports.filter((r) => !r.content_ko);
  const needsReplyTranslation = reports.filter((r) => r.reply && !r.reply_en);
  const translated = reports.filter((r) => r.content_ko);

  const handleTranslate = async (id: string, target: "content" | "reply") => {
    setLoadingId(`${id}-${target}`);
    const result = await translateReportCard(id, target);
    setLoadingId(null);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("번역 완료");
    router.refresh();
  };

  const handleTranslateAll = async () => {
    if (needsContentTranslation.length === 0) return;
    setLoadingId("all");
    // DeepL Free API rate limit(초당 5건) 대응: 순차 처리
    let failCount = 0;
    let doneCount = 0;
    for (const r of needsContentTranslation) {
      const result = await translateReportCard(r.id, "content");
      if (result?.error) failCount++;
      else doneCount++;
    }
    setLoadingId(null);
    if (failCount > 0) {
      toast.error(`${failCount}건 실패, ${doneCount}건 완료`);
    } else {
      toast.success(`${doneCount}건 전체 번역 완료`);
    }
    router.refresh();
  };

  if (reports.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-8 text-center text-sm text-slate-400">
        {year}년 {month}월에 작성된 리포트카드가 없습니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">

      {/* 리포트 번역 대기 */}
      <section>
        <div className="flex items-center justify-between mb-3 gap-2">
          <h2 className="text-sm font-semibold text-slate-700">
            번역 대기
            <span className="ml-2 text-xs font-normal text-slate-400">
              ({needsContentTranslation.length}건 · 영어 → 한국어)
            </span>
          </h2>
          {needsContentTranslation.length > 1 && (
            <button
              type="button"
              onClick={handleTranslateAll}
              disabled={loadingId !== null}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {loadingId === "all" ? (
                <><Spinner size="sm" /> 번역 중…</>
              ) : (
                `전체 번역 (${needsContentTranslation.length}건)`
              )}
            </button>
          )}
        </div>

        {needsContentTranslation.length === 0 ? (
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            모든 리포트가 번역되었습니다.
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs">학생</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs">반</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs">영어 원문</th>
                  <th className="px-4 py-2.5 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {needsContentTranslation.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{r.student_name}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{r.class_name}</td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs">
                      <span className="line-clamp-1">{r.content?.slice(0, 100)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleTranslate(r.id, "content")}
                        disabled={loadingId !== null}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {loadingId === `${r.id}-content` ? <Spinner size="sm" /> : "번역"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 학부모 답글 번역 대기 */}
      {needsReplyTranslation.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">
            학부모 답글 번역 대기
            <span className="ml-2 text-xs font-normal text-slate-400">
              ({needsReplyTranslation.length}건 · 한국어 → 영어)
            </span>
          </h2>
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs">학생</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs">반</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs">답글</th>
                  <th className="px-4 py-2.5 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {needsReplyTranslation.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{r.student_name}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{r.class_name}</td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs">
                      <span className="line-clamp-1">{r.reply?.slice(0, 100)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleTranslate(r.id, "reply")}
                        disabled={loadingId !== null}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {loadingId === `${r.id}-reply` ? <Spinner size="sm" /> : "번역"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 번역 완료 */}
      {translated.length > 0 && (
        <section>
          <details>
            <summary className="cursor-pointer text-sm font-medium text-slate-500 hover:text-slate-700 select-none w-fit">
              번역 완료 ({translated.length}건) ▼
            </summary>
            <div className="mt-3 rounded-lg border border-slate-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 py-2.5 font-medium text-slate-400 text-xs">학생</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-400 text-xs">반</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-400 text-xs">한국어 번역</th>
                    <th className="px-4 py-2.5 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {translated.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{r.student_name}</td>
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{r.class_name}</td>
                      <td className="px-4 py-3 text-slate-400 max-w-xs">
                        <span className="line-clamp-1">{r.content_ko?.slice(0, 100)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleTranslate(r.id, "content")}
                          disabled={loadingId !== null}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {loadingId === `${r.id}-content` ? <Spinner size="sm" /> : "재번역"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      )}
    </div>
  );
}
