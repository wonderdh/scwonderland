"use client";

import {
  getReportCard,
  listReportCardsByStudent,
  upsertReportCard,
} from "../../actions";
import type { ReportCard, ReportCardListItem } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LoadingState } from "@/components/feedback/LoadingState";

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
    setContent(data?.content_en ?? "");
    setLoading(false);
  }, [studentProfileId, year, month]);

  const loadList = useCallback(async () => {
    setListLoading(true);
    const items = await listReportCardsByStudent(studentProfileId);
    setList(items);
    setListLoading(false);
  }, [studentProfileId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadReport();
  }, [loadReport]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    return <LoadingState label="리포트카드 불러오는 중..." />;
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-0 sm:px-0">
      <section className="rounded-xl border bg-muted/30 p-4 sm:p-4">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">기존 리포트</h2>
        {listLoading ? (
          <LoadingState label="목록 불러오는 중…" className="py-2" />
        ) : list.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">아직 작성된 리포트가 없습니다.</p>
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
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:border-primary/30 hover:bg-muted"
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

      <section className="flex flex-wrap items-center gap-3 gap-y-2">
        <span className="text-sm font-medium text-muted-foreground">또는 선택</span>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="rc-year" className="sr-only sm:not-sr-only sm:inline-block sm:text-sm sm:text-foreground">
            년도
          </label>
          <select
            id="rc-year"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="min-h-[44px] flex-1 touch-manipulation rounded-lg border border-input px-3 py-2 text-base text-foreground bg-background sm:min-h-0 sm:flex-initial sm:text-sm"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
          <label htmlFor="rc-month" className="sr-only sm:not-sr-only sm:inline-block sm:text-sm sm:text-foreground">
            월
          </label>
          <select
            id="rc-month"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="min-h-[44px] flex-1 touch-manipulation rounded-lg border border-input px-3 py-2 text-base text-foreground bg-background sm:min-h-0 sm:flex-initial sm:text-sm"
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
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b bg-muted/50 px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            선생님 코멘트 (본문)
          </span>
        </div>
        <div className="p-4 sm:p-5">
          {loading && (
            <LoadingState label="불러오는 중..." className="py-0 mb-2" />
          )}
          <label htmlFor="rc-content" className="sr-only">
            리포트 본문
          </label>
          <Textarea
            id="rc-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            placeholder="이 달의 학습·생활 내용을 작성하세요."
            disabled={loading}
          />
          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="min-h-[44px] touch-manipulation sm:min-h-[40px]"
            >
              {saving ? "저장 중…" : "저장"}
            </Button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b bg-emerald-50 px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            학부모 답글
          </span>
        </div>
        <div className="p-4 sm:p-5">
          {report?.reply_ko != null && report.reply_ko !== "" ? (
            <p className="whitespace-pre-wrap text-base text-foreground sm:text-sm">
              {report.reply_ko}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">아직 답글이 없습니다.</p>
          )}
        </div>
      </section>
    </div>
  );
}
