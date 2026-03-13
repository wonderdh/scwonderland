"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getAgeColor } from "@/lib/student-age-colors";
import {
  enrollStudent,
  removeAfterschoolStudent,
  bulkUpdateEnrollmentDays,
} from "../../actions";
import type { AfterschoolStudentEnrollment, DayEnrollment } from "../../actions/afterschool-actions";
import { Spinner } from "@/components/Spinner";

const DAY_LABELS = ["월", "화", "수", "목", "금"];
const AGE_GROUPS: { label: string; test: (age: number | null) => boolean }[] = [
  { label: "5세", test: (a) => a === 5 },
  { label: "6세", test: (a) => a === 6 },
  { label: "7세", test: (a) => a === 7 },
  { label: "기타", test: (a) => a !== 5 && a !== 6 && a !== 7 },
];

function ageOrder(age: number | null): number {
  if (age === 5) return 0;
  if (age === 6) return 1;
  if (age === 7) return 2;
  return 3;
}

function sortByAgeName(a: { age: number | null; korean_name: string | null }, b: { age: number | null; korean_name: string | null }) {
  const ageDiff = ageOrder(a.age) - ageOrder(b.age);
  if (ageDiff !== 0) return ageDiff;
  return (a.korean_name ?? "").localeCompare(b.korean_name ?? "");
}

type StudentOption = { id: string; korean_name: string | null; english_name: string | null; age: number | null };
type LocalEnrollment = AfterschoolStudentEnrollment & { _dirty?: boolean };

// 셀 상태: 0=없음, 1=1교시, 2=2교시
function DayCell({ state, onClick }: { state: 0 | 1 | 2; onClick: () => void }) {
  if (state === 0) return (
    <button
      type="button"
      onClick={onClick}
      className="w-10 h-7 rounded text-xs text-muted-foreground/30 hover:bg-muted/60 transition-colors"
      title="클릭: 1교시"
    >—</button>
  );
  if (state === 1) return (
    <button
      type="button"
      onClick={onClick}
      className="w-10 h-7 rounded text-xs font-semibold bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors"
      title="클릭: 2교시"
    >1교시</button>
  );
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-10 h-7 rounded text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 transition-colors"
      title="클릭: 제거"
    >1·2교시</button>
  );
}

export function AfterschoolPageClient({
  classId,
  initialEnrollments,
  initialAvailable,
}: {
  classId: string;
  initialEnrollments: AfterschoolStudentEnrollment[];
  initialAvailable: StudentOption[];
}) {
  const router = useRouter();
  const [students, setStudents] = useState<LocalEnrollment[]>(
    initialEnrollments.map((s) => ({ ...s, _dirty: false })),
  );
  const [available] = useState(initialAvailable);

  // 탭
  const [activeTab, setActiveTab] = useState<"enroll" | "schedule">("enroll");
  const printRef = useRef<HTMLDivElement>(null);

  // 학생 추가
  const [enrollStudentId, setEnrollStudentId] = useState("");
  const [enrollStudentName, setEnrollStudentName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [enrollDays, setEnrollDays] = useState<number[]>([]);
  const [enrollSecondPeriod, setEnrollSecondPeriod] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  // 일괄 저장
  const hasDirty = students.some((s) => s._dirty);
  const [bulkSaving, setBulkSaving] = useState(false);

  const refresh = useCallback(() => router.refresh(), [router]);

  // 학생 등록
  const handleEnroll = async () => {
    if (!enrollStudentId || !enrollDays.length) return;
    setEnrolling(true);
    try {
      const result = await enrollStudent(classId, enrollStudentId, enrollDays, enrollSecondPeriod);
      if (result.error) { toast.error(result.error); return; }
      toast.success("등록되었습니다.");
      setEnrollStudentId("");
      setEnrollStudentName("");
      setEnrollDays([]);
      setEnrollSecondPeriod(false);
      refresh();
    } finally {
      setEnrolling(false);
    }
  };

  // 학생 제거
  const handleRemove = async (studentProfileId: string) => {
    if (!confirm("이 학생을 제거하시겠습니까?")) return;
    const result = await removeAfterschoolStudent(classId, studentProfileId);
    if (result.error) { toast.error(result.error); return; }
    toast.success("제거되었습니다.");
    refresh();
  };

  // 요일/교시 사이클 (로컬): 없음 → 1교시 → 2교시 → 없음
  const cycleDay = (studentProfileId: string, day: number) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.student_profile_id !== studentProfileId) return s;
        const existing = s.days.find((d) => d.day === day);
        let newDays: DayEnrollment[];
        if (!existing) {
          newDays = [...s.days, { day, second_period: false }].sort((a, b) => a.day - b.day);
        } else if (!existing.second_period) {
          newDays = s.days.map((d) => d.day === day ? { ...d, second_period: true } : d);
        } else {
          newDays = s.days.filter((d) => d.day !== day);
        }
        return { ...s, days: newDays, _dirty: true };
      }),
    );
  };

  // 일괄 저장
  const handleBulkSave = async () => {
    setBulkSaving(true);
    try {
      const updates = students
        .filter((s) => s._dirty)
        .map((s) => ({ studentProfileId: s.student_profile_id, days: s.days }));
      const result = await bulkUpdateEnrollmentDays(classId, updates);
      if (result.error) { toast.error(result.error); return; }
      toast.success("저장되었습니다.");
      refresh();
    } finally {
      setBulkSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">방과후 관리</h1>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 border-b">
        {(["enroll", "schedule"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-violet-600 text-violet-700"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "enroll" ? "학생 등록" : "요일별 현황"}
          </button>
        ))}
      </div>

      {activeTab === "enroll" && <>
      {/* 학생 추가 */}
      <div className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold mb-3">학생 등록</h2>
        <div className="flex items-end gap-3 flex-wrap">
          {/* 학생 검색 */}
          <div className="flex-1 min-w-[220px]">
            <label className="text-xs text-muted-foreground mb-1 block">학생</label>
            {enrollStudentId ? (
              <div className="flex items-center gap-2 rounded-lg border border-violet-400 bg-violet-50 px-3 py-1.5">
                <span className="text-sm font-medium text-violet-800 flex-1">{enrollStudentName}</span>
                <button
                  type="button"
                  onClick={() => { setEnrollStudentId(""); setEnrollStudentName(""); setSearchQuery(""); }}
                  className="text-violet-400 hover:text-violet-700 text-xs"
                >✕</button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => {
                    if (searchBlurTimer.current) clearTimeout(searchBlurTimer.current);
                    setSearchFocused(true);
                  }}
                  onBlur={() => {
                    searchBlurTimer.current = setTimeout(() => setSearchFocused(false), 150);
                  }}
                  placeholder="이름 검색..."
                  className="w-full rounded-lg border border-input px-3 py-1.5 text-sm bg-background"
                />
                {searchFocused && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border bg-card shadow-lg max-h-60 overflow-y-auto">
                    {(() => {
                      const q = searchQuery.trim().toLowerCase();
                      const filtered = available.filter((s) => {
                        const name = (s.korean_name ?? s.english_name ?? "").toLowerCase();
                        return !q || name.includes(q);
                      });
                      if (!filtered.length) return (
                        <div className="px-3 py-3 text-xs text-muted-foreground text-center">검색 결과 없음</div>
                      );
                      return AGE_GROUPS.map(({ label, test }) => {
                        const group = filtered
                          .filter((s) => test(s.age))
                          .sort((a, b) => (a.korean_name ?? "").localeCompare(b.korean_name ?? ""));
                        if (!group.length) return null;
                        return (
                          <div key={label}>
                            <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground bg-muted/50 sticky top-0">{label}</div>
                            {group.map((s) => {
                              const ageColor = getAgeColor(s.age);
                              const name = s.korean_name ?? s.english_name ?? "—";
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => { setEnrollStudentId(s.id); setEnrollStudentName(name); setSearchQuery(""); }}
                                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/60 transition-colors flex items-center gap-2"
                                >
                                  <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${ageColor.bg} ${ageColor.text}`}>
                                    {name}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 요일 선택 */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">요일</label>
            <div className="flex gap-1">
              {DAY_LABELS.map((label, idx) => {
                const day = idx + 1;
                const checked = enrollDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() =>
                      setEnrollDays((prev) =>
                        checked ? prev.filter((d) => d !== day) : [...prev, day].sort(),
                      )
                    }
                    className={`w-8 h-8 rounded-md text-xs font-medium transition-colors ${
                      checked
                        ? "bg-violet-600 text-white"
                        : "bg-muted text-muted-foreground hover:bg-violet-100"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 교시 선택 */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">교시</label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setEnrollSecondPeriod(false)}
                className={`px-3 h-8 rounded-md text-xs font-medium transition-colors ${
                  !enrollSecondPeriod
                    ? "bg-violet-600 text-white"
                    : "bg-muted text-muted-foreground hover:bg-violet-100"
                }`}
              >1교시</button>
              <button
                type="button"
                onClick={() => setEnrollSecondPeriod(true)}
                className={`px-3 h-8 rounded-md text-xs font-medium transition-colors ${
                  enrollSecondPeriod
                    ? "bg-violet-600 text-white"
                    : "bg-muted text-muted-foreground hover:bg-violet-100"
                }`}
              >1·2교시</button>
            </div>
          </div>

          <button
            onClick={handleEnroll}
            disabled={enrolling || !enrollStudentId || !enrollDays.length}
            className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {enrolling ? <Spinner /> : "등록"}
          </button>
        </div>
      </div>

      {/* 저장 바 */}
      {hasDirty && (
        <div className="flex items-center justify-between rounded-lg bg-violet-50 border border-violet-200 px-4 py-2">
          <span className="text-sm text-violet-700 font-medium">변경사항이 있습니다.</span>
          <button
            onClick={handleBulkSave}
            disabled={bulkSaving}
            className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {bulkSaving ? <Spinner /> : "일괄 저장"}
          </button>
        </div>
      )}

      {/* 등록 학생 테이블 */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {/* 범례 */}
        <div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/20 text-xs text-muted-foreground">
          <span>셀 클릭으로 교시 변경:</span>
          <span className="inline-flex items-center gap-1">
            <span className="w-10 h-5 rounded bg-violet-100 text-violet-700 font-semibold text-[10px] inline-flex items-center justify-center">1교시</span>
            <span>→</span>
            <span className="w-14 h-5 rounded bg-violet-600 text-white font-semibold text-[10px] inline-flex items-center justify-center">1·2교시</span>
            <span>→ 없음</span>
          </span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">이름</th>
              {DAY_LABELS.map((label, idx) => {
                const day = idx + 1;
                const attending = students.filter((s) => s.days.some((d) => d.day === day));
                const secondCount = attending.filter((s) => s.days.find((d) => d.day === day)?.second_period).length;
                return (
                  <th key={idx} className="px-2 py-2.5 text-center font-medium text-muted-foreground w-16">
                    <div>{label}</div>
                    <div className="text-[10px] font-normal text-violet-500">{attending.length}명</div>
                    {secondCount > 0 && (
                      <div className="text-[9px] font-normal text-violet-400">2교시 {secondCount}</div>
                    )}
                  </th>
                );
              })}
              <th className="px-3 py-2.5 text-center font-medium text-muted-foreground w-12" />
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-muted-foreground">
                  등록된 학생이 없습니다.
                </td>
              </tr>
            ) : (
              (() => {
                return AGE_GROUPS.flatMap(({ label, test }) => {
                  const group = students
                    .filter((s) => test(s.age))
                    .sort((a, b) => (a.korean_name ?? "").localeCompare(b.korean_name ?? ""));
                  if (!group.length) return [];
                  return [
                    <tr key={`group-${label}`} className="border-b bg-muted/30">
                      <td colSpan={7} className="px-4 py-1.5 text-[11px] font-semibold text-muted-foreground">
                        {label} · {group.length}명
                      </td>
                    </tr>,
                    ...group.map((s) => {
                      const ageColor = getAgeColor(s.age);
                      return (
                        <tr key={s.student_profile_id} className="border-b last:border-b-0 hover:bg-muted/30">
                          <td className="px-4 py-2">
                            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${ageColor.bg} ${ageColor.text}`}>
                              {s.korean_name ?? s.english_name ?? "—"}
                            </span>
                          </td>
                          {DAY_LABELS.map((_, idx) => {
                            const day = idx + 1;
                            const found = s.days.find((d) => d.day === day);
                            const state: 0 | 1 | 2 = !found ? 0 : found.second_period ? 2 : 1;
                            return (
                              <td key={day} className="px-2 py-2 text-center">
                                <DayCell state={state} onClick={() => cycleDay(s.student_profile_id, day)} />
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => handleRemove(s.student_profile_id)}
                              className="text-red-400 hover:text-red-600 transition-colors"
                              title="제거"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    }),
                  ];
                });
              })()
            )}
          </tbody>
        </table>
      </div>

      </>}

      {activeTab === "schedule" && (() => {
        const VIZ_AGES = [
          { label: "5세", test: (a: number | null) => a === 5 },
          { label: "6세", test: (a: number | null) => a === 6 },
          { label: "7세", test: (a: number | null) => a === 7 },
        ];

        const handlePrint = () => {
          const el = printRef.current;
          if (!el) return;

          const styles = Array.from(document.styleSheets)
            .map((ss) => {
              try {
                return Array.from(ss.cssRules).map((r) => r.cssText).join("\n");
              } catch { return ""; }
            })
            .join("\n");

          const w = window.open("", "_blank", "width=1100,height=700");
          if (!w) return;
          w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>방과후 요일별 현황</title>
<style>
${styles}
body { background: white !important; padding: 20px; }
* { overflow: visible !important; }
table { width: 100% !important; }
@media print { @page { size: A4 landscape; margin: 10mm; } button { display: none !important; } }
</style></head><body><div class="text-sm">${el.outerHTML}</div></body></html>`);
          w.document.close();
          w.focus();
          setTimeout(() => { w.print(); }, 500);
        };

        return (
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center justify-between">
              <h2 className="text-sm font-semibold">요일별 현황</h2>
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/60 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z" />
                </svg>
                인쇄
              </button>
            </div>
            <div className="overflow-x-auto" ref={printRef}>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b bg-muted/30">
                    {DAY_LABELS.map((label, idx) => {
                      const day = idx + 1;
                      const count = students.filter((s) => s.days.some((d) => d.day === day)).length;
                      return (
                        <th key={idx} colSpan={3} className={`px-3 py-2 text-center font-semibold text-muted-foreground ${idx > 0 ? "border-l-2 border-border" : ""}`}>
                          <div>{label}</div>
                          <div className="text-[10px] font-normal text-violet-500">{count}명</div>
                        </th>
                      );
                    })}
                  </tr>
                  <tr className="border-b bg-muted/10">
                    {DAY_LABELS.map((_, dayIdx) =>
                      VIZ_AGES.map(({ label }, ageIdx) => (
                        <th
                          key={`${dayIdx}-${ageIdx}`}
                          className={`px-2 py-1.5 text-center font-medium text-muted-foreground text-[10px] whitespace-nowrap
                            ${ageIdx === 0 && dayIdx > 0 ? "border-l-2 border-border" : ageIdx > 0 ? "border-l border-border/40" : ""}`}
                        >
                          {label}
                        </th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody>
                  <tr className="align-top">
                    {DAY_LABELS.map((_, dayIdx) => {
                      const day = dayIdx + 1;
                      return VIZ_AGES.map(({ test }, ageIdx) => {
                        const cell = students
                          .filter((s) => test(s.age) && s.days.some((d) => d.day === day))
                          .sort((a, b) => (a.korean_name ?? "").localeCompare(b.korean_name ?? ""));
                        const firstOnly = cell.filter((s) => !s.days.find((d) => d.day === day)?.second_period);
                        const both = cell.filter((s) => s.days.find((d) => d.day === day)?.second_period);
                        return (
                          <td
                            key={`${day}-${ageIdx}`}
                            className={`px-2 py-2 align-top min-w-[76px]
                              ${ageIdx === 0 && dayIdx > 0 ? "border-l-2 border-border" : ageIdx > 0 ? "border-l border-border/40" : ""}`}
                          >
                            {cell.length === 0 ? (
                              <span className="text-muted-foreground/20">—</span>
                            ) : (
                              <div className="flex flex-col">
                                {/* 1교시 */}
                                {firstOnly.length > 0 && (
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[9px] font-semibold text-violet-400 uppercase tracking-wide">1교시</span>
                                    {firstOnly.map((s) => {
                                      const ageColor = getAgeColor(s.age);
                                      return (
                                        <span key={s.student_profile_id} className={`rounded px-1.5 py-0.5 font-medium whitespace-nowrap w-fit ${ageColor.bg} ${ageColor.text}`}>
                                          {s.korean_name ?? s.english_name ?? "—"}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                                {/* 구분선 */}
                                {firstOnly.length > 0 && both.length > 0 && (
                                  <div className="border-t border-dashed border-border my-2" />
                                )}
                                {/* 1·2교시 */}
                                {both.length > 0 && (
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[9px] font-semibold text-violet-600 uppercase tracking-wide">1·2교시</span>
                                    {both.map((s) => {
                                      const ageColor = getAgeColor(s.age);
                                      return (
                                        <span key={s.student_profile_id} className={`rounded px-1.5 py-0.5 font-medium whitespace-nowrap w-fit ${ageColor.bg} ${ageColor.text}`}>
                                          {s.korean_name ?? s.english_name ?? "—"}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      });
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

