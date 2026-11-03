"use client";

import { useState } from "react";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useRouter } from "next/navigation";
import {
  listAttendanceRecords,
  recordAttendance,
  deleteAttendance,
  getAttendanceStats,
  bulkReserveAttendance,
} from "@/app/(admin)/admin/actions/attendance-actions";
import type { AttendanceRecord, AttendanceStats } from "@/lib/types";
import { LoadingState } from "@/components/feedback/LoadingState";
import { MultiDatePicker } from "@/components/forms/MultiDatePicker";
import { formatDateYmdKst, todayWeekdayArray } from "@/lib/utils/date-kst";
import { WEEKDAY_NAMES_7 } from "@/lib/constants/date";
import {
  ATTENDANCE_STATUS_CONFIG,
  ATTENDANCE_STATUSES,
  type AttendanceStatus,
} from "@/lib/constants/attendance";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay();
}

export function StudentAttendanceTab({ studentProfileId }: { studentProfileId: string }) {
  const router = useRouter();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const { data, loading, reload } = useAsyncData(
    async () => {
      const [records, stats] = await Promise.all([
        listAttendanceRecords(studentProfileId, year, month),
        getAttendanceStats(studentProfileId, year, month),
      ]);
      return { records, stats };
    },
    [studentProfileId, year, month],
  );

  const records: AttendanceRecord[] = data?.records ?? [];
  const stats: AttendanceStats = data?.stats ?? { total: 0, present: 0, absent: 0, late: 0, early_leave: 0 };

  // Action-level error (save/delete, distinct from load error)
  const [actionError, setActionError] = useState<string | null>(null);

  // Record form state
  const [showForm, setShowForm] = useState(false);
  const [formDates, setFormDates] = useState<Date[]>(() => todayWeekdayArray());
  const [formStatus, setFormStatus] = useState("present");
  const [formNote, setFormNote] = useState("");
  const [saving, setSaving] = useState(false);

  const openForm = (day?: number) => {
    const d = day
      ? new Date(year, month - 1, day)
      : new Date();
    setFormDates([d]);
    setFormStatus("present");
    setFormNote("");
    setShowForm(true);
    setActionError(null);
  };

  const handleSave = async () => {
    if (formDates.length === 0) return;
    setSaving(true);
    setActionError(null);
    let result: { error?: string };
    if (formDates.length === 1) {
      result = await recordAttendance(
        studentProfileId,
        formatDateYmdKst(formDates[0]),
        formStatus,
        formNote || undefined
      );
    } else {
      result = await bulkReserveAttendance(
        studentProfileId,
        formDates.map((d) => formatDateYmdKst(d)),
        formStatus,
        formNote || undefined
      );
    }
    setSaving(false);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    setFormDates(todayWeekdayArray());
    setShowForm(false);
    router.refresh();
    await reload();
  };

  const handleDelete = async (id: string) => {
    const result = await deleteAttendance(id);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    router.refresh();
    await reload();
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
    return <LoadingState label="출결 기록 불러오는 중..." />;
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-5 gap-2">
        {ATTENDANCE_STATUSES.map((key) => {
          const cfg = ATTENDANCE_STATUS_CONFIG[key];
          return (
            <div key={key} className={`rounded-lg ${cfg.badgeClass} p-3 text-center`}>
              <p className="text-lg font-bold">
                {stats[key as keyof AttendanceStats]}
              </p>
              <p className="text-xs">{cfg.label}</p>
            </div>
          );
        })}
        <div className="rounded-lg bg-slate-100 p-3 text-center">
          <p className="text-lg font-bold text-slate-700">{stats.total}</p>
          <p className="text-xs text-slate-600">합계</p>
        </div>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button type="button" onClick={prevMonth} className="rounded-lg p-2 hover:bg-muted transition-colors">
          <ChevronLeft className="size-5" strokeWidth={1.5} />
        </button>
        <h2 className="text-base font-semibold text-foreground">{year}년 {month}월</h2>
        <button type="button" onClick={nextMonth} className="rounded-lg p-2 hover:bg-muted transition-colors">
          <ChevronRight className="size-5" strokeWidth={1.5} />
        </button>
      </div>

      {/* Calendar */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 border-b bg-muted/50">
          {WEEKDAY_NAMES_7.map((d, i) => (
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
            const cfg = rec ? ATTENDANCE_STATUS_CONFIG[rec.status as AttendanceStatus] : null;

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
                  <div className={`mt-0.5 rounded px-1 py-0.5 text-xs font-medium ${cfg.badgeClass}`}>
                    {cfg.label}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {actionError && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{actionError}</p>
      )}

      {/* Record Form */}
      {showForm && (
        <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground">출결 기록</h3>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">날짜</label>
            <MultiDatePicker selected={formDates} onSelect={setFormDates} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">상태</label>
            <div className="flex gap-2">
              {ATTENDANCE_STATUSES.map((key) => {
                const cfg = ATTENDANCE_STATUS_CONFIG[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFormStatus(key)}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      formStatus === key
                        ? `${cfg.badgeClass} ring-2 ring-offset-1 ring-current`
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {cfg.label}
                  </button>
                );
              })}
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
              disabled={saving}
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
              const cfg = ATTENDANCE_STATUS_CONFIG[rec.status as AttendanceStatus];
              return (
                <li key={rec.id} className="flex items-center gap-3 rounded-lg border bg-card px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg?.badgeClass}`}>
                    {cfg?.label}
                  </span>
                  <span className="text-sm text-foreground">{rec.attendance_date}</span>
                  {rec.note && (
                    <span className="text-xs text-muted-foreground truncate flex-1">{rec.note}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(rec.id)}
                    className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="size-3.5" strokeWidth={1.5} />
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
