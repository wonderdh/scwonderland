"use client";

import { useCallback, useEffect, useState } from "react";
import type { TeacherClassWithStudents, ReportCardStatus } from "@/lib/types";
import { getClassReportStatus } from "../../actions";
import {
  getReportCard,
  upsertReportCard,
} from "@/app/(admin)/admin/actions";
import type { ReportCard } from "@/lib/types";

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function getDefaultYearMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function TeacherReportClient({
  classes,
  initialClassId,
}: {
  classes: TeacherClassWithStudents[];
  initialClassId: string | null;
}) {
  const [selectedClassId, setSelectedClassId] = useState(
    initialClassId ?? classes[0]?.id ?? ""
  );
  const [year, setYear] = useState(() => getDefaultYearMonth().year);
  const [month, setMonth] = useState(() => getDefaultYearMonth().month);
  const [statusList, setStatusList] = useState<ReportCardStatus[]>([]);
  const [statusLoading, setStatusLoading] = useState(false);

  // 선택된 학생의 리포트카드 편집
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [report, setReport] = useState<ReportCard | null>(null);
  const [content, setContent] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  // 반 + 년/월 변경 시 작성 현황 로드
  const loadStatus = useCallback(async () => {
    if (!selectedClassId) return;
    setStatusLoading(true);
    const data = await getClassReportStatus(selectedClassId, year, month);
    setStatusList(data);
    setStatusLoading(false);
  }, [selectedClassId, year, month]);

  useEffect(() => {
    loadStatus();
    setSelectedStudentId(null);
    setReport(null);
    setContent("");
  }, [loadStatus]);

  // 학생 선택 시 리포트카드 로드
  const loadReport = useCallback(async () => {
    if (!selectedStudentId) return;
    setReportLoading(true);
    setSaveMessage(null);
    const data = await getReportCard(selectedStudentId, year, month);
    setReport(data);
    setContent(data?.content ?? "");
    setReportLoading(false);
  }, [selectedStudentId, year, month]);

  useEffect(() => {
    if (selectedStudentId) loadReport();
  }, [loadReport, selectedStudentId]);

  const handleSave = async () => {
    if (!selectedStudentId) return;
    setSaving(true);
    setSaveMessage(null);
    const result = await upsertReportCard(selectedStudentId, year, month, content);
    setSaving(false);
    if (result?.error) {
      setSaveMessage({ type: "error", text: result.error });
      return;
    }
    setSaveMessage({ type: "success", text: "저장되었습니다." });
    await loadReport();
    await loadStatus();
    setTimeout(() => setSaveMessage(null), 2000);
  };

  const selectedStudent = statusList.find(
    (s) => s.student_profile_id === selectedStudentId
  );

  if (classes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center">
        <p className="text-sm text-slate-500">담당 반이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-800">리포트카드 작성</h1>

      {/* 반 / 년월 선택 */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="min-h-[44px] rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.students.length}명)
            </option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="min-h-[44px] rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}년</option>
          ))}
        </select>
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="min-h-[44px] rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
        >
          {MONTHS.map((m) => (
            <option key={m} value={m}>{m}월</option>
          ))}
        </select>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* 학생 목록 + 작성 현황 */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
            <h2 className="text-sm font-medium text-slate-600">
              {selectedClass?.name ?? "반"} — {year}년 {month}월
            </h2>
          </div>
          {statusLoading ? (
            <p className="px-4 py-6 text-sm text-slate-400 text-center">불러오는 중…</p>
          ) : statusList.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-400 text-center">학생이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
              {statusList.map((s) => {
                const isSelected = s.student_profile_id === selectedStudentId;
                return (
                  <li key={s.student_profile_id}>
                    <button
                      type="button"
                      onClick={() => setSelectedStudentId(s.student_profile_id)}
                      className={`w-full text-left px-4 py-3 flex items-center gap-2 transition-colors ${
                        isSelected
                          ? "bg-slate-100"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {s.korean_name ?? "—"}
                          {s.english_name && (
                            <span className="text-slate-400 font-normal ml-1">
                              ({s.english_name})
                            </span>
                          )}
                        </p>
                        {s.student_number && (
                          <p className="text-xs text-slate-400 font-mono">{s.student_number}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {s.has_report ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            작성
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                            미작성
                          </span>
                        )}
                        {s.has_reply && (
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                            답변
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {/* 요약 */}
          {!statusLoading && statusList.length > 0 && (
            <div className="border-t border-slate-100 px-4 py-2.5 bg-slate-50/50 flex gap-4 text-xs text-slate-500">
              <span>
                작성: {statusList.filter((s) => s.has_report).length}/{statusList.length}
              </span>
              <span>
                답변: {statusList.filter((s) => s.has_reply).length}/{statusList.length}
              </span>
            </div>
          )}
        </div>

        {/* 리포트카드 작성 영역 */}
        <div>
          {!selectedStudentId ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center flex-1">
              <p className="text-sm text-slate-400">왼쪽 목록에서 학생을 선택하세요.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-semibold text-slate-800">
                  {selectedStudent?.korean_name ?? "—"}
                </h3>
                <span className="text-sm text-slate-500">
                  {year}년 {month}월
                </span>
              </div>

              {saveMessage && (
                <p className={`text-sm px-3 py-2 rounded-lg ${
                  saveMessage.type === "error"
                    ? "text-red-600 bg-red-50"
                    : "text-emerald-600 bg-emerald-50"
                }`}>
                  {saveMessage.text}
                </p>
              )}

              {/* 선생님 코멘트 */}
              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 bg-slate-100 px-4 py-2.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                    선생님 코멘트 (본문)
                  </span>
                </div>
                <div className="p-4">
                  {reportLoading ? (
                    <p className="text-sm text-slate-400">불러오는 중…</p>
                  ) : (
                    <>
                      <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        rows={8}
                        placeholder="이 달의 학습·생활 내용을 작성하세요."
                        className="w-full rounded-lg border border-slate-200 px-3 py-3 text-base text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 sm:text-sm"
                      />
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={handleSave}
                          disabled={saving}
                          className="min-h-[44px] rounded-lg bg-slate-800 px-5 py-2.5 text-base font-medium text-white hover:bg-slate-700 disabled:opacity-50 sm:min-h-[40px] sm:text-sm"
                        >
                          {saving ? "저장 중…" : "저장"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </section>

              {/* 학생 답글 */}
              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 bg-emerald-50 px-4 py-2.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                    학생 답글
                  </span>
                </div>
                <div className="p-4">
                  {reportLoading ? (
                    <p className="text-sm text-slate-400">불러오는 중…</p>
                  ) : report?.reply != null && report.reply.trim() !== "" ? (
                    <p className="whitespace-pre-wrap text-sm text-slate-800">
                      {report.reply}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-400">아직 답글이 없습니다.</p>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
