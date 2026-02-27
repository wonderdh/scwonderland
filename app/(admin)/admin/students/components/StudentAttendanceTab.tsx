"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  listAttendanceRecords,
  recordAttendance,
  deleteAttendance,
  getAttendanceStats,
  getStudentClasses,
} from "../../actions";
import type { AttendanceRecord, AttendanceStats, AdminStudentClassItem } from "@/lib/types";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  present: { label: "출석", color: "text-emerald-700", bg: "bg-emerald-100" },
  absent: { label: "결석", color: "text-red-700", bg: "bg-red-100" },
  late: { label: "지각", color: "text-amber-700", bg: "bg-amber-100" },
  excused: { label: "사유", color: "text-blue-700", bg: "bg-blue-100" },
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay();
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function StudentAttendanceTab({ studentProfileId }: { studentProfileId: string }) {
  const router = useRouter();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<AttendanceStats>({ total: 0, present: 0, absent: 0, late: 0, excused: 0 });
  const [classes, setClasses] = useState<AdminStudentClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Record form state
  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState("");
  const [formClassId, setFormClassId] = useState("");
  const [formStatus, setFormStatus] = useState("present");
  const [formNote, setFormNote] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [recs, st, cl] = await Promise.all([
      listAttendanceRecords(studentProfileId, year, month),
      getAttendanceStats(studentProfileId, year, month),
      getStudentClasses(studentProfileId),
    ]);
    setRecords(recs);
    setStats(st);
    setClasses(cl.classes);
    if (cl.classes.length > 0 && !formClassId) {
      setFormClassId(cl.classes[0].id);
    }
    setLoading(false);
  }, [studentProfileId, year, month, formClassId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openForm = (day?: number) => {
    const d = day
      ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      : new Date().toISOString().split("T")[0];
    setFormDate(d);
    setFormStatus("present");
    setFormNote("");
    setShowForm(true);
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const result = await recordAttendance(
      studentProfileId,
      formClassId,
      formDate,
      formStatus,
      formNote || undefined
    );
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setShowForm(false);
    router.refresh();
    await loadData();
  };

  const handleDelete = async (id: string) => {
    const result = await deleteAttendance(id);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
    await loadData();
  };

  // Calendar data
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const recordMap = new Map<string, AttendanceRecord>();
  for (const r of records) {
    recordMap.set(r.attendance_date, r);
  }

  const prevMonth = () => {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else setMonth(month + 1);
  };

  if (loading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">불러오는 중…</div>;
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-5 gap-2">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <div key={key} className={`rounded-lg ${cfg.bg} p-3 text-center`}>
            <p className={`text-lg font-bold ${cfg.color}`}>
              {stats[key as keyof AttendanceStats]}
            </p>
            <p className={`text-xs ${cfg.color}`}>{cfg.label}</p>
          </div>
        ))}
        <div className="rounded-lg bg-slate-100 p-3 text-center">
          <p className="text-lg font-bold text-slate-700">{stats.total}</p>
          <p className="text-xs text-slate-600">합계</p>
        </div>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button type="button" onClick={prevMonth} className="rounded-lg p-2 hover:bg-muted transition-colors">
          <svg className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h2 className="text-base font-semibold text-foreground">{year}년 {month}월</h2>
        <button type="button" onClick={nextMonth} className="rounded-lg p-2 hover:bg-muted transition-colors">
          <svg className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Calendar */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 border-b bg-muted/50">
          {WEEKDAYS.map((d, i) => (
            <div key={d} className={`py-2 text-center text-xs font-medium ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-muted-foreground"}`}>
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`e-${i}`} className="h-16 border-b border-r last:border-r-0" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const rec = recordMap.get(dateStr);
            const dayOfWeek = (firstDay + i) % 7;
            const cfg = rec ? STATUS_CONFIG[rec.status] : null;

            return (
              <button
                key={day}
                type="button"
                onClick={() => openForm(day)}
                className="group relative h-16 border-b border-r last:border-r-0 p-1 text-left hover:bg-muted/30 transition-colors"
              >
                <span className={`text-xs ${dayOfWeek === 0 ? "text-red-500" : dayOfWeek === 6 ? "text-blue-500" : "text-foreground"}`}>
                  {day}
                </span>
                {cfg && (
                  <div className={`mt-0.5 rounded px-1 py-0.5 text-[10px] font-medium ${cfg.bg} ${cfg.color}`}>
                    {cfg.label}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      {/* Record Form */}
      {showForm && (
        <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground">출결 기록</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">날짜</label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="min-h-[44px] w-full rounded-lg border border-input px-3 py-2 text-sm bg-background sm:min-h-0"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">반</label>
              <select
                value={formClassId}
                onChange={(e) => setFormClassId(e.target.value)}
                className="min-h-[44px] w-full rounded-lg border border-input px-3 py-2 text-sm bg-background sm:min-h-0"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">상태</label>
            <div className="flex gap-2">
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFormStatus(key)}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    formStatus === key
                      ? `${cfg.bg} ${cfg.color} ring-2 ring-offset-1 ring-current`
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">메모 (선택)</label>
            <input
              type="text"
              value={formNote}
              onChange={(e) => setFormNote(e.target.value)}
              placeholder="사유 등"
              className="min-h-[44px] w-full rounded-lg border border-input px-3 py-2 text-sm bg-background sm:min-h-0"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="min-h-[44px] rounded-lg border border-input px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted sm:min-h-[40px]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !formClassId}
              className="min-h-[44px] rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 sm:min-h-[40px]"
            >
              {saving ? "저장 중…" : "저장"}
            </button>
          </div>
        </div>
      )}

      {/* Recent records */}
      {records.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">이달의 기록</h3>
          <ul className="space-y-1">
            {records.map((rec) => {
              const cfg = STATUS_CONFIG[rec.status];
              return (
                <li key={rec.id} className="flex items-center gap-3 rounded-lg border bg-card px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg?.bg} ${cfg?.color}`}>
                    {cfg?.label}
                  </span>
                  <span className="text-sm text-foreground">{rec.attendance_date}</span>
                  {rec.class_name && (
                    <span className="text-xs text-muted-foreground">{rec.class_name}</span>
                  )}
                  {rec.note && (
                    <span className="text-xs text-muted-foreground truncate flex-1">{rec.note}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(rec.id)}
                    className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <svg className="size-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Add button */}
      <button
        type="button"
        onClick={() => openForm()}
        className="w-full rounded-xl border-2 border-dashed border-slate-200 py-3 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors"
      >
        + 출결 기록 추가
      </button>
    </div>
  );
}
