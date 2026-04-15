"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { MultiDatePicker } from "@/components/forms/MultiDatePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/feedback/LoadingState";
import { StatusBadge } from "@/components/badges/StatusBadge";
import { PageHeader } from "@/components/navigation/PageHeader";
import { ConfirmDialog } from "@/components/overlays/ConfirmDialog";
import { BUS_CHANGE_TYPE_CONFIG } from "@/lib/constants/bus";
import {
  bulkReserveAttendance,
  bulkCreateBusChanges,
  deleteAttendance,
  deleteAdminBusChange,
} from "@/app/(admin)/admin/actions";
import type {
  ReservationAttendance,
  ReservationBusChange,
} from "@/app/(admin)/admin/actions";
import type { BusNumber, BusTimeSlot } from "@/lib/types";
import { formatDateYmdKst, todayWeekdayArray } from "@/lib/utils/date-kst";
import {
  ATTENDANCE_STATUS_CONFIG,
  ATTENDANCE_STATUSES,
  type AttendanceStatus,
} from "@/lib/constants/attendance";
import {
  groupAttendanceReservations,
  groupBusReservations,
} from "@/lib/utils/group-consecutive-reservations";

function formatGroupRange(startDate: string, endDate: string, count: number) {
  if (count === 1) return format(parseISO(startDate), "M/d(EEE)", { locale: ko });
  const start = format(parseISO(startDate), "M/d", { locale: ko });
  const end = format(parseISO(endDate), "M/d", { locale: ko });
  return `${start} ~ ${end} (${count}일)`;
}

type StudentOption = {
  id: string;
  korean_name: string | null;
  age: number | null;
};

type Props = {
  initialReservations: {
    attendance: ReservationAttendance[];
    busChanges: ReservationBusChange[];
  };
  students: StudentOption[];
  busNumbers: BusNumber[];
  busTimeSlots: BusTimeSlot[];
};

type Tab = "overview" | "attendance" | "bus";


export function ReservationDashboard({
  initialReservations,
  students,
  busNumbers,
  busTimeSlots,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [saving, setSaving] = useState(false);
  const [deleteAttTarget, setDeleteAttTarget] = useState<{ ids: string[] } | null>(null);
  const [deleteBusTarget, setDeleteBusTarget] = useState<{ ids: string[] } | null>(null);

  // 예약 폼 상태 — 출결
  const [attStudentId, setAttStudentId] = useState("");
  const [attDates, setAttDates] = useState<Date[]>(() => todayWeekdayArray());
  const [attStatus, setAttStatus] = useState("absent");
  const [attNote, setAttNote] = useState("");
  const [attAutoBus, setAttAutoBus] = useState(true);

  // 예약 폼 상태 — 버스
  const [busStudentId, setBusStudentId] = useState("");
  const [busDates, setBusDates] = useState<Date[]>(() => todayWeekdayArray());
  const [busChangeType, setBusChangeType] = useState<"no_ride" | "change" | "absent">("no_ride");
  const [busSlotId, setBusSlotId] = useState("");
  const [busNumberId, setBusNumberId] = useState("");
  const [busReason, setBusReason] = useState("");

  // 통계
  const { attendance, busChanges } = initialReservations;
  const attCount = attendance.length;
  const busCount = busChanges.length;

  // 연속 날짜 그룹화
  const attendanceGroups = useMemo(
    () => groupAttendanceReservations(attendance),
    [attendance],
  );
  const busChangeGroups = useMemo(
    () => groupBusReservations(busChanges),
    [busChanges],
  );

  // 캘린더 히트맵 데이터
  const heatmapDates = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of attendance) {
      map.set(a.attendance_date, (map.get(a.attendance_date) ?? 0) + 1);
    }
    for (const b of busChanges) {
      map.set(b.request_date, (map.get(b.request_date) ?? 0) + 1);
    }
    return map;
  }, [attendance, busChanges]);

  const heatmapModifiers = useMemo(() => {
    const light: Date[] = [];
    const medium: Date[] = [];
    const heavy: Date[] = [];
    for (const [dateStr, count] of heatmapDates) {
      const d = parseISO(dateStr);
      if (count >= 3) heavy.push(d);
      else if (count >= 2) medium.push(d);
      else light.push(d);
    }
    return { light, medium, heavy };
  }, [heatmapDates]);

  // 학생 검색
  const [studentSearch, setStudentSearch] = useState("");
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students.slice(0, 20);
    const q = studentSearch.trim().toLowerCase();
    return students.filter((s) =>
      (s.korean_name ?? "").toLowerCase().includes(q),
    ).slice(0, 20);
  }, [students, studentSearch]);

  async function handleAttendanceSubmit() {
    if (!attStudentId) return toast.error("학생을 선택해 주세요.");
    if (attDates.length === 0) return toast.error("날짜를 선택해 주세요.");

    setSaving(true);
    const dates = attDates.map((d) => formatDateYmdKst(d));
    const result = await bulkReserveAttendance(
      attStudentId,
      dates,
      attStatus,
      attNote,
      attAutoBus && attStatus === "absent",
    );
    setSaving(false);

    if (result.error) return toast.error(result.error);

    const busMsg =
      result.busCount && result.busCount > 0
        ? ` (버스 미탑승 ${result.busCount}건 연동)`
        : "";
    toast.success(`${result.count}일 출결 예약 완료${busMsg}`);
    setAttDates(todayWeekdayArray());
    setAttNote("");
    router.refresh();
  }

  async function handleBusSubmit() {
    if (!busStudentId) return toast.error("학생을 선택해 주세요.");
    if (busDates.length === 0) return toast.error("날짜를 선택해 주세요.");

    setSaving(true);
    const dates = busDates.map((d) => formatDateYmdKst(d));
    const result = await bulkCreateBusChanges(
      busStudentId,
      dates,
      busChangeType,
      busSlotId || undefined,
      busNumberId || undefined,
      undefined,
      busReason,
    );
    setSaving(false);

    if (result.error) return toast.error(result.error);
    toast.success(
      `${result.created}건 생성${result.skipped ? `, ${result.skipped}건 건너뜀` : ""}`,
    );
    setBusDates(todayWeekdayArray());
    setBusReason("");
    router.refresh();
  }

  async function performDeleteAttendance(ids: string[]) {
    const results = await Promise.all(ids.map((id) => deleteAttendance(id)));
    const failed = results.find((r) => r.error);
    if (failed?.error) return toast.error(failed.error);
    toast.success(`${ids.length}건 삭제되었습니다.`);
    setDeleteAttTarget(null);
    router.refresh();
  }

  async function performDeleteBusChange(ids: string[]) {
    const results = await Promise.all(ids.map((id) => deleteAdminBusChange(id)));
    const failed = results.find((r) => r.error);
    if (failed?.error) return toast.error(failed.error);
    toast.success(`${ids.length}건 삭제되었습니다.`);
    setDeleteBusTarget(null);
    router.refresh();
  }

  function StudentSelect({
    value,
    onChange,
  }: {
    value: string;
    onChange: (id: string) => void;
  }) {
    return (
      <div className="space-y-2">
        <Input
          placeholder="학생 이름 검색"
          value={studentSearch}
          onChange={(e) => setStudentSearch(e.target.value)}
          className="h-11 text-base"
        />
        <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
          {filteredStudents.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onChange(s.id);
                setStudentSearch(s.korean_name ?? "");
              }}
              className={`w-full text-left px-3 py-2.5 text-base transition-colors ${
                value === s.id ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50"
              }`}
            >
              {s.korean_name ?? "이름 없음"}
              {s.age && (
                <span className="ml-1 text-sm text-slate-400">{s.age}세</span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="예약 현황"
        description="향후 30일의 출결·버스 예약을 한눈에 확인하고 일괄 등록·삭제할 수 있습니다."
      />

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            출결 예약
          </span>
          <p className="mt-1 text-4xl font-bold text-slate-800">{attCount}건</p>
          <p className="text-sm text-slate-500">향후 30일</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            버스 변경
          </span>
          <p className="mt-1 text-4xl font-bold text-slate-800">{busCount}건</p>
          <p className="text-sm text-slate-500">향후 30일</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            전체
          </span>
          <p className="mt-1 text-4xl font-bold text-orange-600">
            {attCount + busCount}건
          </p>
          <p className="text-sm text-slate-500">출결 + 버스</p>
        </div>
      </div>

      {/* 캘린더 히트맵 */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-base font-semibold text-slate-700">
          월간 예약 현황
        </h2>
        <Calendar
          locale={ko}
          modifiers={heatmapModifiers}
          modifiersClassNames={{
            light: "bg-blue-100 text-blue-800 rounded-md",
            medium: "bg-blue-200 text-blue-900 rounded-md font-semibold",
            heavy: "bg-blue-400 text-white rounded-md font-bold",
          }}
          className="mx-auto"
        />
        <div className="mt-3 flex items-center gap-4 text-sm text-slate-600 justify-center">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded bg-blue-100" /> 1건
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded bg-blue-200" /> 2건
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded bg-blue-400" /> 3건 이상
          </span>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5 w-fit">
        {(
          [
            ["overview", "전체 목록"],
            ["attendance", "출결 예약"],
            ["bus", "버스 변경"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-md px-5 py-2 text-base font-medium transition-colors ${
              tab === key
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 탭 내용 */}
      {tab === "overview" && (
        <div className="space-y-4">
          {/* 출결 목록 */}
          {attendance.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                <span className="text-base font-semibold text-slate-700">
                  출결 예약 ({attendance.length}건)
                </span>
              </div>
              <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {attendanceGroups.map((g) => {
                  const head = g.items[0];
                  const cfg = ATTENDANCE_STATUS_CONFIG[head.status as AttendanceStatus];
                  return (
                    <li
                      key={head.id}
                      className="flex items-center gap-3 px-4 py-3 text-base"
                    >
                      <span className={`text-sm text-slate-500 ${g.count > 1 ? "w-36" : "w-24"}`}>
                        {formatGroupRange(g.startDate, g.endDate, g.count)}
                      </span>
                      <span className="text-base font-medium text-slate-800 min-w-0 truncate flex-1">
                        {head.student_name}
                      </span>
                      {cfg ? (
                        <StatusBadge config={cfg} size="sm" />
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-sm text-slate-600">
                          {head.status}
                        </span>
                      )}
                      {head.note && (
                        <span className="text-sm text-slate-500 truncate max-w-28">
                          {head.note}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeleteAttTarget({ ids: g.items.map((i) => i.id) })}
                        className="text-sm font-medium text-slate-400 hover:text-red-500 shrink-0"
                      >
                        삭제
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* 버스 변경 목록 */}
          {busChanges.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                <span className="text-base font-semibold text-slate-700">
                  버스 변경 ({busChanges.length}건)
                </span>
              </div>
              <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {busChangeGroups.map((g) => {
                  const head = g.items[0];
                  const cfg = BUS_CHANGE_TYPE_CONFIG[head.change_type as "change" | "no_ride" | "absent"];
                  return (
                    <li
                      key={head.id}
                      className="flex items-center gap-3 px-4 py-3 text-base"
                    >
                      <span className={`text-sm text-slate-500 ${g.count > 1 ? "w-36" : "w-24"}`}>
                        {formatGroupRange(g.startDate, g.endDate, g.count)}
                      </span>
                      <span className="text-base font-medium text-slate-800 min-w-0 truncate flex-1">
                        {head.student_name}
                      </span>
                      {cfg ? (
                        <StatusBadge config={cfg} size="sm" />
                      ) : (
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-sm text-orange-700">
                          {head.change_type}
                        </span>
                      )}
                      {head.new_bus_number_label && (
                        <span className="text-sm text-slate-500">
                          → {head.new_bus_number_label}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeleteBusTarget({ ids: g.items.map((i) => i.id) })}
                        className="text-sm font-medium text-slate-400 hover:text-red-500 shrink-0"
                      >
                        삭제
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {attCount + busCount === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center text-base text-slate-500">
              향후 30일 내 예약된 출결/버스 변경이 없습니다.
            </div>
          )}
        </div>
      )}

      {tab === "attendance" && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
          <h2 className="text-lg font-semibold text-slate-800">
            출결 일괄 예약
          </h2>
          <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
            {/* 학생 선택 */}
            <div className="space-y-3">
              <label className="text-base font-medium text-slate-700">
                학생 선택
              </label>
              <StudentSelect
                value={attStudentId}
                onChange={setAttStudentId}
              />

              <label className="text-base font-medium text-slate-700">상태</label>
              <div className="flex flex-wrap gap-2">
                {ATTENDANCE_STATUSES.map((key) => {
                  const cfg = ATTENDANCE_STATUS_CONFIG[key];
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setAttStatus(key)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        attStatus === key
                          ? `${cfg.badgeClass} ring-2 ring-current/30`
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{cfg.label}</span>
                    </button>
                  );
                })}
              </div>

              <label className="text-base font-medium text-slate-700">메모</label>
              <textarea
                value={attNote}
                onChange={(e) => setAttNote(e.target.value)}
                placeholder="사유 메모 (선택)"
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base"
              />

              {attStatus === "absent" && (
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={attAutoBus}
                    onChange={(e) => setAttAutoBus(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  결석 시 버스 미탑승 자동 등록
                </label>
              )}
            </div>

            {/* 캘린더 */}
            <div className="space-y-3">
              <label className="text-base font-medium text-slate-700">
                날짜 선택
              </label>
              <MultiDatePicker
                selected={attDates}
                onSelect={setAttDates}

              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleAttendanceSubmit}
              disabled={saving || !attStudentId || attDates.length === 0}
            >
              {saving ? "저장 중…" : `일괄 예약 (${attDates.length}일)`}
            </Button>
          </div>
        </div>
      )}

      {tab === "bus" && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
          <h2 className="text-lg font-semibold text-slate-800">
            버스 변경 일괄 등록
          </h2>
          <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
            {/* 학생 + 옵션 */}
            <div className="space-y-3">
              <label className="text-base font-medium text-slate-700">
                학생 선택
              </label>
              <StudentSelect
                value={busStudentId}
                onChange={setBusStudentId}
              />

              <label className="text-base font-medium text-slate-700">
                유형
              </label>
              <div className="flex gap-2">
                {(
                  [
                    ["no_ride", "미탑승"],
                    ["absent", "결석"],
                    ["change", "변경"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setBusChangeType(key)}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      busChangeType === key
                        ? "bg-orange-100 text-orange-700 ring-2 ring-orange-300"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {busChangeType === "change" && (
                <>
                  <label className="text-base font-medium text-slate-700">
                    시간대
                  </label>
                  <select
                    value={busSlotId}
                    onChange={(e) => setBusSlotId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base"
                  >
                    <option value="">선택...</option>
                    {busTimeSlots.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                  </select>

                  <label className="text-base font-medium text-slate-700">
                    호차
                  </label>
                  <select
                    value={busNumberId}
                    onChange={(e) => setBusNumberId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base"
                  >
                    <option value="">선택...</option>
                    {busNumbers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </>
              )}

              <label className="text-base font-medium text-slate-700">사유</label>
              <textarea
                value={busReason}
                onChange={(e) => setBusReason(e.target.value)}
                placeholder="사유 (선택)"
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base"
              />
            </div>

            {/* 캘린더 */}
            <div className="space-y-3">
              <label className="text-base font-medium text-slate-700">
                날짜 선택
              </label>
              <MultiDatePicker
                selected={busDates}
                onSelect={setBusDates}

              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleBusSubmit}
              disabled={saving || !busStudentId || busDates.length === 0}
            >
              {saving ? "저장 중…" : `일괄 등록 (${busDates.length}일)`}
            </Button>
          </div>
        </div>
      )}

      {saving && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-white/60">
          <LoadingState label="예약 저장 중" />
        </div>
      )}

      <ConfirmDialog
        open={deleteAttTarget !== null}
        title="출결 예약 삭제"
        description={
          deleteAttTarget
            ? deleteAttTarget.ids.length === 1
              ? "이 출결 예약을 삭제하시겠습니까?"
              : `연속된 ${deleteAttTarget.ids.length}일 출결 예약을 모두 삭제하시겠습니까?`
            : undefined
        }
        danger
        onConfirm={() => deleteAttTarget && performDeleteAttendance(deleteAttTarget.ids)}
        onCancel={() => setDeleteAttTarget(null)}
      />
      <ConfirmDialog
        open={deleteBusTarget !== null}
        title="버스 변경 삭제"
        description={
          deleteBusTarget
            ? deleteBusTarget.ids.length === 1
              ? "이 버스 변경을 삭제하시겠습니까?"
              : `연속된 ${deleteBusTarget.ids.length}일 버스 변경을 모두 삭제하시겠습니까?`
            : undefined
        }
        danger
        onConfirm={() => deleteBusTarget && performDeleteBusChange(deleteBusTarget.ids)}
        onCancel={() => setDeleteBusTarget(null)}
      />
    </div>
  );
}
