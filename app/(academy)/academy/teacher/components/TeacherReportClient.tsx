"use client";

import { useCallback, useEffect, useState } from "react";
import type { TeacherClassWithStudents, ReportCardStatus } from "@/lib/types";
import { getClassReportStatus } from "../../actions";
import {
  getReportCard,
  upsertReportCard,
} from "@/app/(admin)/admin/actions";
import type { ReportCard } from "@/lib/types";
import { reportLabels, ENGLISH_MONTHS } from "@/lib/teacher-labels";
import { useTeacherType } from "./TeacherTypeContext";
import { LoadingState } from "@/components/LoadingState";

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
  const teacherType = useTeacherType();
  const L = reportLabels[teacherType];
  const isNative = teacherType === "native";

  const [selectedClassId, setSelectedClassId] = useState(
    initialClassId ?? classes[0]?.id ?? ""
  );
  const [year, setYear] = useState(() => getDefaultYearMonth().year);
  const [month, setMonth] = useState(() => getDefaultYearMonth().month);
  const [statusList, setStatusList] = useState<ReportCardStatus[]>([]);
  const [statusLoading, setStatusLoading] = useState(false);

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [report, setReport] = useState<ReportCard | null>(null);
  const [content, setContent] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  const selectedClass = classes.find((c) => c.id === selectedClassId);

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
    setSaveMessage({ type: "success", text: L.saved });
    await loadReport();
    await loadStatus();
    setTimeout(() => setSaveMessage(null), 2000);
  };

  const selectedStudent = statusList.find(
    (s) => s.student_profile_id === selectedStudentId
  );

  const formatStudentName = (s: { korean_name: string | null; english_name: string | null }) => {
    if (isNative) {
      return (
        <>
          {s.english_name ?? s.korean_name ?? "—"}
          {s.korean_name && (
            <span className="text-slate-400 font-normal ml-1">
              ({s.korean_name})
            </span>
          )}
        </>
      );
    }
    return (
      <>
        {s.korean_name ?? "—"}
        {s.english_name && (
          <span className="text-slate-400 font-normal ml-1">
            ({s.english_name})
          </span>
        )}
      </>
    );
  };

  const formatYearMonth = () => {
    if (isNative) return `${ENGLISH_MONTHS[month]} ${year}`;
    return `${year}년 ${month}월`;
  };

  if (classes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center">
        <p className="text-sm text-slate-500">{L.noClasses}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-800">{L.title}</h1>

      {/* 반 / 년월 선택 */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="min-h-[44px] rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.students.length}{isNative ? " students" : "명"})
            </option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="min-h-[44px] rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}{L.year}</option>
          ))}
        </select>
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="min-h-[44px] rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
        >
          {MONTHS.map((m) => (
            <option key={m} value={m}>{isNative ? ENGLISH_MONTHS[m] : `${m}월`}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* 학생 목록 + 작성 현황 */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
            <h2 className="text-sm font-medium text-slate-600">
              {selectedClass?.name ?? (isNative ? "Class" : "반")} — {formatYearMonth()}
            </h2>
          </div>
          {statusLoading ? (
            <LoadingState label={L.loading} />
          ) : statusList.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-400 text-center">{L.noStudents}</p>
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
                          {formatStudentName(s)}
                        </p>
                        {s.student_number && (
                          <p className="text-xs text-slate-400 font-mono">{s.student_number}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {s.has_report ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            {L.written}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                            {L.notWritten}
                          </span>
                        )}
                        {s.has_report && (
                          s.has_reply ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              {L.reply}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                              {isNative ? "No Reply" : "미답글"}
                            </span>
                          )
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
                {L.writtenCount}: {statusList.filter((s) => s.has_report).length}/{statusList.length}
              </span>
              <span>
                {L.replyCount}: {statusList.filter((s) => s.has_reply).length}/{statusList.length}
              </span>
            </div>
          )}
        </div>

        {/* 리포트카드 작성 영역 */}
        <div>
          {!selectedStudentId ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center flex-1">
              <p className="text-sm text-slate-400">{L.selectStudent}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-semibold text-slate-800">
                  {selectedStudent ? (
                    isNative
                      ? (selectedStudent.english_name ?? selectedStudent.korean_name ?? "—")
                      : (selectedStudent.korean_name ?? "—")
                  ) : "—"}
                </h3>
                {selectedStudent && isNative && selectedStudent.korean_name && (
                  <span className="text-sm text-slate-400">
                    ({selectedStudent.korean_name})
                  </span>
                )}
                <span className="text-sm text-slate-500">
                  {formatYearMonth()}
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
                    {L.teacherComment}
                  </span>
                </div>
                <div className="p-4">
                  {reportLoading ? (
                    <LoadingState label={L.loading} />
                  ) : (
                    <>
                      <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        rows={8}
                        placeholder={L.placeholder}
                        className="w-full rounded-lg border border-slate-200 px-3 py-3 text-base text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 sm:text-sm"
                      />
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={handleSave}
                          disabled={saving}
                          className="min-h-[44px] rounded-lg bg-slate-800 px-5 py-2.5 text-base font-medium text-white hover:bg-slate-700 disabled:opacity-50 sm:min-h-[40px] sm:text-sm"
                        >
                          {saving ? L.saving : L.save}
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
                    {L.studentReply}
                  </span>
                </div>
                <div className="p-4">
                  {reportLoading ? (
                    <LoadingState label={L.loading} />
                  ) : report?.reply != null && report.reply.trim() !== "" ? (
                    <p className="whitespace-pre-wrap text-sm text-slate-800">
                      {report.reply}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-400">{L.noReply}</p>
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
