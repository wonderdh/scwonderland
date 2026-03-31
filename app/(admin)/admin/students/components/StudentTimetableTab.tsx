"use client";

import { useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { getStudentTimetable } from "../../actions";
import { getStudentAfterschoolDays } from "../../actions/afterschool-actions";
import type { StudentTimetableRow } from "@/lib/types";
import { LoadingState } from "@/components/LoadingState";
import { useAsyncData } from "../../hooks/useAsyncData";

const DAY_NAMES = ["월", "화", "수", "목", "금"];

// IMPORTANT: All strings must be complete Tailwind class names (no dynamic concat) for purging to work.
const TEACHER_COLOR_PALETTE: { bg: string; text: string }[] = [
  { bg: "bg-blue-200",    text: "text-blue-800"    },
  { bg: "bg-emerald-200", text: "text-emerald-800"  },
  { bg: "bg-violet-200",  text: "text-violet-800"   },
  { bg: "bg-rose-200",    text: "text-rose-800"     },
  { bg: "bg-amber-200",   text: "text-amber-800"    },
  { bg: "bg-cyan-200",    text: "text-cyan-800"     },
  { bg: "bg-pink-200",    text: "text-pink-800"     },
  { bg: "bg-orange-200",  text: "text-orange-800"   },
  { bg: "bg-teal-200",    text: "text-teal-800"     },
  { bg: "bg-indigo-200",  text: "text-indigo-800"   },
  { bg: "bg-lime-200",    text: "text-lime-800"     },
  { bg: "bg-sky-200",     text: "text-sky-800"      },
];

function buildTeacherColorMap(
  rows: StudentTimetableRow[],
): Map<string, { bg: string; text: string }> {
  const seen = new Map<string, string>(); // id → name
  for (const row of rows) {
    for (const cell of Object.values(row.cells)) {
      if (cell?.teacher_profile_id && cell.teacher_name && !seen.has(cell.teacher_profile_id)) {
        seen.set(cell.teacher_profile_id, cell.teacher_name);
      }
    }
  }
  const sorted = [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const map = new Map<string, { bg: string; text: string }>();
  sorted.forEach(([id], i) => {
    map.set(id, TEACHER_COLOR_PALETTE[i % TEACHER_COLOR_PALETTE.length]);
  });
  return map;
}

function formatTime(t: string) {
  return t.slice(0, 5);
}

export function StudentTimetableTab({
  studentProfileId,
  studentName,
}: {
  studentProfileId: string;
  studentName: string;
}) {
  const printRef = useRef<HTMLDivElement>(null);

  const { data, loading } = useAsyncData(
    async () => {
      const [rows, afterschoolDays] = await Promise.all([
        getStudentTimetable(studentProfileId),
        getStudentAfterschoolDays(studentProfileId),
      ]);
      return { rows, afterschoolDays };
    },
    [studentProfileId],
  );

  const rows: StudentTimetableRow[] = data?.rows ?? [];
  const afterschoolDays: number[] = data?.afterschoolDays ?? [];

  function handlePrint() {
    if (!printRef.current) return;
    const printContent = printRef.current.innerHTML;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${studentName} 시간표</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, sans-serif; padding: 24px; }
  h2 { font-size: 18px; font-weight: 700; margin-bottom: 16px; text-align: center; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: center; font-size: 12px; }
  th { background: #f1f5f9; font-weight: 600; }
  td.period-cell { text-align: left; font-weight: 500; white-space: nowrap; }
  .teacher { font-size: 11px; font-weight: 600; }
  .label { font-size: 10px; color: #64748b; }
  .cell-filled { background: #f0f9ff; }
</style></head><body>
<h2>${studentName} — 시간표</h2>
${printContent}
</body></html>`);
    win.document.close();
    win.onload = () => { win.print(); };
  }

  // Teacher color map built from all rows
  const teacherColorMap = useMemo(() => buildTeacherColorMap(rows), [rows]);

  // Filter class-based rows (source === "class")
  const classRows = useMemo(() => {
    return rows.filter((row) => {
      return Object.values(row.cells).some((cell) => cell && cell.source === "class");
    }).map((row) => ({
      ...row,
      cells: Object.fromEntries(
        Object.entries(row.cells).map(([day, cell]) => [
          day,
          cell && cell.source === "class" ? cell : null,
        ]),
      ) as typeof row.cells,
    })).filter((row) => Object.values(row.cells).some((c) => c !== null));
  }, [rows]);

  if (loading) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">시간표</h3>
        {classRows.length > 0 && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handlePrint}>
            출력
          </Button>
        )}
      </div>
      {classRows.length === 0 ? (
        <div className="py-4 text-center text-sm text-muted-foreground">
          배정된 시간표가 없습니다.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border shadow-sm">
          {/* 출력용 숨겨진 테이블 */}
          <div ref={printRef} className="hidden">
            <table>
              <thead>
                <tr>
                  <th>교시</th>
                  {DAY_NAMES.map((name) => (
                    <th key={name}>{name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {classRows.map((row) => (
                  <tr key={row.academy_period_id}>
                    <td className="period-cell">
                      {row.period_name}<br />
                      <span className="label">{formatTime(row.start_time)}~{formatTime(row.end_time)}</span>
                    </td>
                    {[1, 2, 3, 4, 5].map((day) => {
                      const cell = row.cells[day];
                      return (
                        <td key={day} className={cell ? "cell-filled" : ""}>
                          {cell ? (
                            <>
                              {cell.teacher_name && <div className="teacher">{cell.teacher_name}</div>}
                              {cell.label && <div className="label">{cell.label}</div>}
                            </>
                          ) : "-"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* 화면 표시용 테이블 */}
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="py-3 px-3 text-left text-xs font-medium text-muted-foreground w-28">
                  교시
                </th>
                {DAY_NAMES.map((name, i) => (
                  <th
                    key={i}
                    className="py-3 px-3 text-center text-xs font-medium text-muted-foreground"
                  >
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {classRows.map((row) => (
                <tr key={row.academy_period_id} className="border-b">
                  <td className="py-3 px-3 border-r">
                    <div className="font-medium text-foreground">
                      {row.period_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatTime(row.start_time)}~{formatTime(row.end_time)}
                    </div>
                  </td>
                  {[1, 2, 3, 4, 5].map((day) => {
                    const cell = row.cells[day];
                    if (!cell) {
                      return (
                        <td key={day} className="py-2 px-2 text-center">
                          <span className="text-muted-foreground/30">-</span>
                        </td>
                      );
                    }

                    const color = cell.teacher_profile_id
                      ? teacherColorMap.get(cell.teacher_profile_id)
                      : null;

                    return (
                      <td key={day} className="py-2 px-2 text-center">
                        <div className={`rounded-lg p-2 ${
                          color
                            ? `${color.bg} ${color.text}`
                            : "bg-amber-100 text-amber-800"
                        }`}>
                          {cell.teacher_name && (
                            <div className="text-xs font-semibold">
                              {cell.teacher_name}
                            </div>
                          )}
                          {cell.label && (
                            <div className={`text-[10px] font-medium ${
                              cell.teacher_name ? "opacity-70" : ""
                            }`}>
                              {cell.label}
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 방과후 등록 현황 */}
      {afterschoolDays.length > 0 && (
        <div className="mt-6 space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">방과후</h3>
          <div className="flex gap-2">
            {DAY_NAMES.map((name, idx) => {
              const day = idx + 1;
              const enrolled = afterschoolDays.includes(day);
              return (
                <div
                  key={day}
                  className={`w-12 h-10 rounded-lg flex items-center justify-center text-sm font-medium ${
                    enrolled
                      ? "bg-violet-100 text-violet-700 border border-violet-200"
                      : "bg-muted/30 text-muted-foreground/30"
                  }`}
                >
                  {name}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
