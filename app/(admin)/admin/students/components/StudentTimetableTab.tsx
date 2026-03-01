"use client";

import { useState, useEffect, useCallback } from "react";
import { getStudentTimetable } from "../../actions";
import type { StudentTimetableRow } from "@/lib/types";

const DAY_NAMES = ["월", "화", "수", "목", "금"];

function formatTime(t: string) {
  return t.slice(0, 5);
}

export function StudentTimetableTab({
  studentProfileId,
}: {
  studentProfileId: string;
}) {
  const [rows, setRows] = useState<StudentTimetableRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getStudentTimetable(studentProfileId);
    setRows(data);
    setLoading(false);
  }, [studentProfileId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        불러오는 중...
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        배정된 수업이 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-700">주간 시간표</h3>
      <div className="overflow-x-auto rounded-xl border shadow-sm">
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
            {rows.map((row) => (
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
                  return (
                    <td key={day} className="py-2 px-2 text-center">
                      {cell ? (
                        <div className="rounded-lg bg-primary/5 border border-primary/20 p-2">
                          <div className="font-medium text-foreground text-xs">
                            {cell.class_name}
                          </div>
                          <div className="mt-0.5">
                            <span
                              className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                cell.teacher_type === "native"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {cell.teacher_name ?? "—"}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/30">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
