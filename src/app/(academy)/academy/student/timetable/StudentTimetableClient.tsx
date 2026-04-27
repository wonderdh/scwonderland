"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { getStudentTimetable } from "@/app/(admin)/admin/actions/schedule-actions";
import { getStudentAfterschoolDays } from "@/app/(admin)/admin/actions/afterschool-actions";
import type { StudentTimetableRow } from "@/lib/types";
import { LoadingState } from "@/components/feedback/LoadingState";
import { escapeHtml } from "@/lib/utils/escape-html";
import { WEEKDAY_NAMES_5 } from "@/lib/constants/date";
import { buildTeacherColorMap } from "@/lib/constants/timetable";
import { formatTime } from "@/lib/bus/utils";

export function StudentTimetableClient({
  studentProfileId,
  studentName,
}: {
  studentProfileId: string;
  studentName: string;
}) {
  const [rows, setRows] = useState<StudentTimetableRow[]>([]);
  const [afterschoolDays, setAfterschoolDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  // 프린트 시점에 최신 classRows를 읽을 수 있도록 ref 유지 (아래 useEffect에서 동기화).
  const classRowsRef = useRef<StudentTimetableRow[]>([]);

  function handlePrint() {
    const classRows = classRowsRef.current;
    if (classRows.length === 0) return;
    const win = window.open("", "_blank");
    if (!win) return;

    // 사용자 입력은 전부 escapeHtml로 이스케이프하여 XSS 방지.
    const rowsHtml = classRows
      .map((row) => {
        const cellsHtml = [1, 2, 3, 4, 5]
          .map((day) => {
            const cell = row.cells[day];
            if (!cell) return "<td>-</td>";
            const teacher = cell.teacher_name
              ? `<div class="teacher">${escapeHtml(cell.teacher_name)}</div>`
              : "";
            const label = cell.label
              ? `<div class="label">${escapeHtml(cell.label)}</div>`
              : "";
            return `<td class="cell-filled">${teacher}${label}</td>`;
          })
          .join("");
        return `<tr><td class="period-cell">${escapeHtml(row.period_name)}<br/><span class="label">${escapeHtml(formatTime(row.start_time))}~${escapeHtml(formatTime(row.end_time))}</span></td>${cellsHtml}</tr>`;
      })
      .join("");

    const headHtml = `<tr><th>교시</th>${WEEKDAY_NAMES_5.map((n) => `<th>${escapeHtml(n)}</th>`).join("")}</tr>`;

    win.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(studentName)} 시간표</title>
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
<h2>${escapeHtml(studentName)} — 시간표</h2>
<table><thead>${headHtml}</thead><tbody>${rowsHtml}</tbody></table>
</body></html>`);
    win.document.close();
    win.onload = () => {
      win.print();
    };
  }

  const load = useCallback(async () => {
    setLoading(true);
    const [timetable, asDays] = await Promise.all([
      getStudentTimetable(studentProfileId),
      getStudentAfterschoolDays(studentProfileId),
    ]);
    setRows(timetable);
    setAfterschoolDays(asDays);
    setLoading(false);
  }, [studentProfileId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

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

  // 프린트 핸들러가 최신 classRows를 참조할 수 있도록 동기화.
  useEffect(() => {
    classRowsRef.current = classRows;
  }, [classRows]);

  if (loading) {
    return <LoadingState label="시간표 불러오는 중..." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">내 시간표</h3>
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
          {/* 화면 표시용 테이블 (프린트는 handlePrint에서 데이터 기반으로 별도 생성) */}
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="py-3 px-3 text-left text-xs font-medium text-muted-foreground w-28">
                  교시
                </th>
                {WEEKDAY_NAMES_5.map((name, i) => (
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
            {WEEKDAY_NAMES_5.map((name, idx) => {
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
