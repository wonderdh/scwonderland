"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LoadingState } from "@/components/LoadingState";
import { Spinner } from "@/components/Spinner";
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
const DIR_LABEL = { pickup: "등원", dropoff: "하원" } as const;
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
  const [formDir, setFormDir] = useState<"pickup" | "dropoff">("pickup");
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
      formDir,
      formType,
      formType === "change" ? formSlotId : undefined,
      formType === "change" ? formBusId : undefined,
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

  if (loading) return <LoadingState />;

  const pickupSlots = busTimeSlots.filter((s) => s.direction === "pickup");
  const dropoffSlots = busTimeSlots.filter((s) => s.direction === "dropoff");

  return (
    <div className="space-y-6">
      {/* 주간 스케줄 */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-3">내 승하차 스케줄</h2>
        {defaults.length === 0 ? (
          <p className="text-sm text-slate-400 py-4">등록된 승하차 스케줄이 없습니다.</p>
        ) : (
          <div className="grid gap-2">
            {[1, 2, 3, 4, 5].map((day) => {
              const dayDefaults = defaults.filter((d) => d.day_of_week === day);
              if (!dayDefaults.length) return null;
              return (
                <div key={day} className="border rounded-lg p-3">
                  <span className="text-sm font-medium text-slate-700">{DAY_NAMES[day]}요일</span>
                  <div className="mt-1 flex gap-4 flex-wrap">
                    {dayDefaults.map((d) => (
                      <span key={d.id} className="text-xs text-slate-600">
                        <span className={`inline-block px-1.5 py-0.5 rounded mr-1 ${
                          d.direction === "pickup" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                        }`}>
                          {DIR_LABEL[d.direction]}
                        </span>
                        {d.time_slot_label && <span className="font-medium mr-1">{d.time_slot_label}</span>}
                        {formatTime(d.time_slot_time)} {d.bus_label}
                        {d.estimated_time && <span className="ml-1 text-slate-400">({formatTime(d.estimated_time)})</span>}
                        {d.note && <span className="ml-1 text-slate-400">· {d.note}</span>}
                      </span>
                    ))}
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
                <label className="text-xs text-slate-500 block mb-1">방향</label>
                <select
                  value={formDir}
                  onChange={(e) => {
                    setFormDir(e.target.value as "pickup" | "dropoff");
                    setFormSlotId("");
                  }}
                  className="h-9 px-2 border rounded text-sm"
                >
                  <option value="pickup">등원</option>
                  <option value="dropoff">하원</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">유형</label>
                <select value={formType} onChange={(e) => setFormType(e.target.value as "change" | "no_ride")} className="h-9 px-2 border rounded text-sm">
                  <option value="change">버스 변경</option>
                  <option value="no_ride">미탑승</option>
                </select>
              </div>
            </div>

            {formType === "change" && (
              <div className="flex gap-3 flex-wrap">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">시간대</label>
                  <select value={formSlotId} onChange={(e) => setFormSlotId(e.target.value)} className="h-9 px-2 border rounded text-sm">
                    <option value="">선택</option>
                    {(formDir === "pickup" ? pickupSlots : dropoffSlots).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label} ({formatTime(s.time)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">호차</label>
                  <select value={formBusId} onChange={(e) => setFormBusId(e.target.value)} className="h-9 px-2 border rounded text-sm">
                    <option value="">선택</option>
                    {busNumbers.map((b) => (
                      <option key={b.id} value={b.id}>{b.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-slate-500 block mb-1">사유 (선택)</label>
              <Input
                placeholder="변경 사유를 입력하세요"
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
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  req.direction === "pickup" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                }`}>
                  {DIR_LABEL[req.direction]}
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
                    className="h-6 text-xs text-red-500 ml-auto"
                    onClick={() => handleCancel(req.id)}
                    disabled={submitting}
                  >
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
