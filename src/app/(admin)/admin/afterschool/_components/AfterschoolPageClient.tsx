"use client";

import { useRef } from "react";
import { getAgeColor } from "@/lib/ui/student-age-colors";
import type { AfterschoolStudentEnrollment } from "@/lib/types";
import { formatStudentName } from "@/lib/utils/student-name";

import { WEEKDAY_NAMES_5 as DAY_LABELS } from "@/lib/constants/date";

export function AfterschoolPageClient({
  initialEnrollments,
}: {
  initialEnrollments: AfterschoolStudentEnrollment[];
}) {
  const students = initialEnrollments;
  const printRef = useRef<HTMLDivElement>(null);

  const VIZ_AGES = [
    { label: "5세", test: (a: number | null) => a === 5 },
    { label: "6세", test: (a: number | null) => a === 6 },
    { label: "7세", test: (a: number | null) => a === 7 },
  ];

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const styles = Array.from(document.styleSheets).map((ss) => { try { return Array.from(ss.cssRules).map((r) => r.cssText).join("\n"); } catch { return ""; } }).join("\n");
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>방과후 요일별 현황 (나이별)</title><style>${styles}body{background:white!important;padding:20px;}*{overflow:visible!important;}table{width:100%!important;}@media print{@page{size:A4 landscape;margin:10mm;}button{display:none!important;}}</style></head><body><div class="text-sm">${el.outerHTML}</div></body></html>`);
    w.document.close(); w.focus(); setTimeout(() => { w.print(); }, 500);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">방과후 관리</h1>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center justify-between">
          <h2 className="text-sm font-semibold">요일별 현황 — 나이별</h2>
          <button type="button" onClick={handlePrint} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/60 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z" /></svg>
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
                      <div className="text-xs font-normal text-violet-500">{count}명</div>
                    </th>
                  );
                })}
              </tr>
              <tr className="border-b bg-muted/10">
                {DAY_LABELS.map((_, dayIdx) =>
                  VIZ_AGES.map(({ label }, ageIdx) => (
                    <th key={`${dayIdx}-${ageIdx}`} className={`px-2 py-1.5 text-center font-medium text-muted-foreground text-xs whitespace-nowrap ${ageIdx === 0 && dayIdx > 0 ? "border-l-2 border-border" : ageIdx > 0 ? "border-l border-border/40" : ""}`}>
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
                    const cell = students.filter((s) => test(s.age) && s.days.some((d) => d.day === day)).sort((a, b) => (a.korean_name ?? "").localeCompare(b.korean_name ?? ""));
                    const firstOnly = cell.filter((s) => !s.days.find((d) => d.day === day)?.second_period);
                    const both = cell.filter((s) => s.days.find((d) => d.day === day)?.second_period);
                    return (
                      <td key={`${day}-${ageIdx}`} className={`px-2 py-2 align-top min-w-[76px] ${ageIdx === 0 && dayIdx > 0 ? "border-l-2 border-border" : ageIdx > 0 ? "border-l border-border/40" : ""}`}>
                        {cell.length === 0 ? <span className="text-muted-foreground/20">—</span> : (
                          <div className="flex flex-col">
                            {firstOnly.length > 0 && <div className="flex flex-col gap-1"><span className="text-[9px] font-semibold text-violet-400 uppercase tracking-wide">1교시</span>{firstOnly.map((s) => { const c = getAgeColor(s.age); return <span key={s.student_profile_id} className={`rounded px-1.5 py-0.5 font-medium whitespace-nowrap w-fit ${c.bg} ${c.text}`}>{formatStudentName(s, { fallback: "—" })}</span>; })}</div>}
                            {firstOnly.length > 0 && both.length > 0 && <div className="border-t border-dashed border-border my-2" />}
                            {both.length > 0 && <div className="flex flex-col gap-1"><span className="text-[9px] font-semibold text-violet-600 uppercase tracking-wide">1·2교시</span>{both.map((s) => { const c = getAgeColor(s.age); return <span key={s.student_profile_id} className={`rounded px-1.5 py-0.5 font-medium whitespace-nowrap w-fit ${c.bg} ${c.text}`}>{formatStudentName(s, { fallback: "—" })}</span>; })}</div>}
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
    </div>
  );
}
