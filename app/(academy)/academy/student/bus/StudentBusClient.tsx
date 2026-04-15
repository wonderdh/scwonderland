"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LoadingState } from "@/components/feedback/LoadingState";
import { Spinner } from "@/components/feedback/Spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { StudentBusDefault, BusChangeRequest, BusNumber, BusTimeSlot } from "@/lib/types";
import {
  getStudentBusDefaults,
  getStudentChangeRequests,
  listBusNumbers,
  listBusTimeSlots,
  submitBusChangeRequest,
  cancelBusChangeRequest,
} from "@/app/(admin)/admin/actions";

const DAY_NAMES = ["", "월", "화", "수", "목", "금"];
const STATUS_LABEL = { pending: "대기중", approved: "승인됨", rejected: "거절됨" } as const;
const STATUS_COLOR = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
} as const;

function formatTime(t: string | undefined) {
  if (!t) return "-";
  return t.slice(0, 5);
}

export function StudentBusClient({ studentProfileId }: { studentProfileId: string }) {
  const router = useRouter();
  const [defaults, setDefaults] = useState<StudentBusDefault[]>([]);
  const [requests, setRequests] = useState<BusChangeRequest[]>([]);
  const [busNumbers, setBusNumbers] = useState<BusNumber[]>([]);
  const [busTimeSlots, setBusTimeSlots] = useState<BusTimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // 변경 요청 폼
  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState("");
  const [formType, setFormType] = useState<"change" | "no_ride">("change");
  const [formSlotId, setFormSlotId] = useState("");
  const [formBusId, setFormBusId] = useState("");
  const [formReason, setFormReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [d, r, bn, ts] = await Promise.all([
      getStudentBusDefaults(studentProfileId),
      getStudentChangeRequests(studentProfileId),
      listBusNumbers(),
      listBusTimeSlots(),
    ]);
    setDefaults(d);
    setRequests(r);
    setBusNumbers(bn);
    setBusTimeSlots(ts);
    setLoading(false);
  }, [studentProfileId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    setSuccess("");
    const result = await submitBusChangeRequest(
      studentProfileId,
      formDate,
      formType,
      formSlotId || undefined,
      formBusId || undefined,
      formReason || undefined
    );
    if (result.error) {
      setError(result.error);
    } else {
      toast.success("변경 요청이 제출되었습니다.");
      setSuccess("변경 요청이 제출되었습니다.");
      setShowForm(false);
      setFormDate("");
      setFormReason("");
      await load();
      router.refresh();
    }
    setSubmitting(false);
  }

  async function handleCancel(id: string) {
    if (!confirm("이 변경 요청을 취소하시겠습니까?")) return;
    setSubmitting(true);
    const result = await cancelBusChangeRequest(id, studentProfileId);
    if (result.error) setError(result.error);
    else {
      toast.success("변경 요청이 취소되었습니다.");
      await load();
      router.refresh();
    }
    setSubmitting(false);
  }

  if (loading) return <LoadingState label="승하차 정보 불러오는 중..." />;

  // 오늘 날짜 & 요일 계산
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const todayDow = now.getDay(); // 0=Sun, 1=Mon...6=Sat
  const todayDayOfWeek = todayDow === 0 ? 7 : todayDow; // 1=Mon...7=Sun

  // 오늘 날짜의 변경 요청 (대기중 또는 승인됨)
  const todayChanges = requests.filter(
    (r) => r.request_date === todayStr && (r.status === "pending" || r.status === "approved")
  );

  return (
    <div className="space-y-6">
      {/* 주간 스케줄 */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-3">내 하원 스케줄</h2>
        {defaults.length === 0 ? (
          <p className="text-sm text-slate-400 py-4">등록된 하원 스케줄이 없습니다.</p>
        ) : (
          <div className="grid gap-3">
            {[1, 2, 3, 4, 5].map((day) => {
              const dayDefaults = defaults.filter((d) => d.day_of_week === day);
              if (!dayDefaults.length) return null;
              const isToday = day === todayDayOfWeek;
              return (
                <div key={day}>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 px-1">
                    {DAY_NAMES[day]}요일{isToday && <span className="ml-1 text-blue-500">(오늘)</span>}
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {dayDefaults.map((d) => {
                      const change = isToday ? todayChanges.find((r) => r.student_profile_id === studentProfileId) : undefined;

                      return (
                        <div
                          key={d.id}
                          className="rounded-xl border-l-4 border bg-white shadow-sm p-3 border-l-orange-500"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                              하원
                            </span>
                            {d.time_slot_label && (
                              <span className="text-xs font-medium text-slate-600">{d.time_slot_label}</span>
                            )}
                          </div>

                          <div className={change ? "flex gap-3" : ""}>
                            {/* 기존 스케줄 */}
                            <div className={`space-y-1 text-sm ${change ? "flex-1" : ""}`}>
                              <div className="flex items-center gap-2">
                                <span className="text-slate-400 text-xs w-10 shrink-0">시간</span>
                                <span className={`font-semibold ${change ? "text-slate-400 line-through" : "text-slate-800"}`}>{formatTime(d.time_slot_time)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-slate-400 text-xs w-10 shrink-0">호차</span>
                                <span className={`font-medium ${change ? "text-slate-400 line-through" : "text-slate-700"}`}>{d.bus_label || "-"}</span>
                              </div>
                              {d.bus_stop_name && (
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-400 text-xs w-10 shrink-0">정류장</span>
                                  <span className={change ? "text-slate-400 line-through" : "text-slate-700"}>{d.bus_stop_name}</span>
                                </div>
                              )}
                              {!change && d.estimated_time && (
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-400 text-xs w-10 shrink-0">예상</span>
                                  <span className="text-blue-600 font-medium">{formatTime(d.estimated_time)}</span>
                                </div>
                              )}
                              {!change && d.note && (
                                <div className="flex items-start gap-2">
                                  <span className="text-slate-400 text-xs w-10 shrink-0 mt-0.5">메모</span>
                                  <span className="text-slate-500 text-xs">{d.note}</span>
                                </div>
                              )}
                            </div>

                            {/* 변경 정보 */}
                            {change && (
                              <div className="flex-1 border-l-2 border-blue-300 pl-3 space-y-1 text-sm">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                    change.change_type === "no_ride"
                                      ? "bg-red-100 text-red-600"
                                      : "bg-blue-100 text-blue-700"
                                  }`}>
                                    {change.change_type === "no_ride" ? "미탑승" : "변경"}
                                  </span>
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_COLOR[change.status]}`}>
                                    {STATUS_LABEL[change.status]}
                                  </span>
                                </div>
                                {change.change_type !== "no_ride" && (
                                  <>
                                    {change.new_time_slot_time && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-blue-400 text-xs w-10 shrink-0">시간</span>
                                        <span className="font-semibold text-blue-700">{formatTime(change.new_time_slot_time)}</span>
                                      </div>
                                    )}
                                    {change.new_bus_label && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-blue-400 text-xs w-10 shrink-0">호차</span>
                                        <span className="font-medium text-blue-700">{change.new_bus_label}</span>
                                      </div>
                                    )}
                                  </>
                                )}
                                {change.review_note && (
                                  <div className="flex items-start gap-2">
                                    <span className="text-blue-400 text-xs w-10 shrink-0 mt-0.5">메모</span>
                                    <span className="text-blue-600 text-xs">{change.review_note}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 변경 요청 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-800">변경 요청</h2>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? "닫기" : "변경 요청하기"}
          </Button>
        </div>

        {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded mb-3">{error}</p>}
        {success && <p className="text-xs text-green-600 bg-green-50 px-3 py-2 rounded mb-3">{success}</p>}

        {showForm && (
          <div className="border rounded-lg p-4 mb-4 space-y-3 bg-slate-50">
            <div className="flex gap-3 flex-wrap">
              <div>
                <label className="text-xs text-slate-500 block mb-1">날짜</label>
                <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="w-40" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">유형</label>
                <select value={formType} onChange={(e) => setFormType(e.target.value as "change" | "no_ride")} className="h-9 px-2 border rounded text-sm">
                  <option value="change">버스 변경</option>
                  <option value="no_ride">미탑승</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 flex-wrap">
              <div>
                <label className="text-xs text-slate-500 block mb-1">시간대 (선택)</label>
                <select value={formSlotId} onChange={(e) => setFormSlotId(e.target.value)} className="h-9 px-2 border rounded text-sm">
                  <option value="">선택</option>
                  {busTimeSlots.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} ({formatTime(s.time)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">호차 (선택)</label>
                <select value={formBusId} onChange={(e) => setFormBusId(e.target.value)} className="h-9 px-2 border rounded text-sm">
                  <option value="">선택</option>
                  {busNumbers.map((b) => (
                    <option key={b.id} value={b.id}>{b.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500 block mb-1">세부 사항 (선택)</label>
              <Input
                placeholder="세부 사항을 입력하세요"
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
                className="max-w-xs"
              />
            </div>

            <Button size="sm" onClick={handleSubmit} disabled={submitting || !formDate}>
              {submitting ? <><Spinner size="sm" /> 제출 중...</> : "제출"}
            </Button>
          </div>
        )}

        {/* 요청 목록 */}
        {requests.length === 0 ? (
          <p className="text-sm text-slate-400 py-2">변경 요청 내역이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {requests.map((req) => (
              <div key={req.id} className="border rounded-lg p-3 flex items-center gap-2 flex-wrap">
                <span className="text-sm">{req.request_date}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">
                  하원
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  req.change_type === "no_ride" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                }`}>
                  {req.change_type === "no_ride" ? "미탑승" : `→ ${req.new_time_slot_label ? req.new_time_slot_label + " " : ""}${formatTime(req.new_time_slot_time)} ${req.new_bus_label}`}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_COLOR[req.status]}`}>
                  {STATUS_LABEL[req.status]}
                </span>
                {req.review_note && (
                  <span className="text-xs text-slate-500">({req.review_note})</span>
                )}
                {req.status === "pending" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs text-red-500 ml-auto gap-1"
                    onClick={() => handleCancel(req.id)}
                    disabled={submitting}
                  >
                    {submitting && <Spinner size="sm" />}
                    취소
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
