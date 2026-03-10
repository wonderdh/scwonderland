"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { BusChangeRequest } from "@/lib/types";
import {
  listPendingChangeRequests,
  approveChangeRequest,
  rejectChangeRequest,
} from "../../actions";
import { LoadingState } from "@/components/LoadingState";
import { toast } from "sonner";

const DIR_LABEL = { pickup: "등원", dropoff: "하원" } as const;
const TYPE_LABEL = { change: "변경", no_ride: "미탑승" } as const;

function formatTime(t: string | undefined) {
  if (!t) return "";
  return t.slice(0, 5);
}

export function BusChangeRequestsPanel({ adminId }: { adminId: string }) {
  const router = useRouter();
  const [requests, setRequests] = useState<BusChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await listPendingChangeRequests();
    setRequests(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleApprove(id: string) {
    setActionLoading(id);
    await approveChangeRequest(id, adminId);
    toast.success("변경 요청이 승인되었습니다.");
    await load();
    router.refresh();
    setActionLoading(null);
  }

  async function handleReject(id: string) {
    const note = prompt("거절 사유를 입력하세요 (선택):");
    if (note === null) return; // 취소
    setActionLoading(id);
    await rejectChangeRequest(id, adminId, note || undefined);
    toast.success("변경 요청이 거부되었습니다.");
    await load();
    router.refresh();
    setActionLoading(null);
  }

  if (loading) {
    return <LoadingState className="py-4" />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">
          대기 중 변경 요청 ({requests.length}건)
        </h3>
        <Button size="sm" variant="ghost" onClick={load}>
          새로고침
        </Button>
      </div>

      {requests.length === 0 && (
        <p className="text-sm text-slate-400 py-8 text-center">대기 중인 변경 요청이 없습니다.</p>
      )}

      <div className="space-y-2">
        {requests.map((req) => (
          <div key={req.id} className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">
                {req.korean_name || req.english_name}
              </span>
              <span className="text-xs text-slate-400">#{req.student_number}</span>
              <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">{req.request_date}</span>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                {DIR_LABEL[req.direction]}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded ${
                req.change_type === "no_ride"
                  ? "bg-red-100 text-red-700"
                  : "bg-amber-100 text-amber-700"
              }`}>
                {TYPE_LABEL[req.change_type]}
              </span>
            </div>

            {req.change_type === "change" && (
              <p className="text-xs text-slate-600">
                → {formatTime(req.new_time_slot_time)} {req.new_time_slot_label} {req.new_bus_label}
              </p>
            )}

            {req.reason && (
              <p className="text-xs text-slate-500">사유: {req.reason}</p>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleApprove(req.id)}
                disabled={actionLoading === req.id}
              >
                승인
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => handleReject(req.id)}
                disabled={actionLoading === req.id}
              >
                거절
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
