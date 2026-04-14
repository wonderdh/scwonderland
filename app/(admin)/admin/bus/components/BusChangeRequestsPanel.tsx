"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { BusChangeRequest, BusNumber, BusTimeSlot, BusStop } from "@/lib/types";
import {
  listAllChangeRequests,
  approveChangeRequest,
  rejectChangeRequest,
  listBusNumbers,
  listBusTimeSlots,
  listBusStops,
} from "../../actions";
import { LoadingState } from "@/components/LoadingState";
import { toast } from "sonner";
import { AdminBusChangeDnD } from "./AdminBusChangeDnD";
import { formatTime } from "@/lib/bus/utils";

const TYPE_LABEL = { change: "변경", no_ride: "미탑승", absent: "결석" } as const;
const STATUS_LABEL = { pending: "대기중", approved: "승인", rejected: "거절" } as const;
const STATUS_COLOR = {
  pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  approved: "bg-green-100 text-green-700 border-green-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
} as const;

export function BusChangeRequestsPanel({ adminId }: { adminId: string }) {
  const router = useRouter();
  const [requests, setRequests] = useState<BusChangeRequest[]>([]);
  const [busNumbers, setBusNumbers] = useState<BusNumber[]>([]);
  const [busTimeSlots, setBusTimeSlots] = useState<BusTimeSlot[]>([]);
  const [busStops, setBusStops] = useState<BusStop[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 승인/거절/수정 모드
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<"approve" | "reject" | "edit">("approve");
  const [editStopMode, setEditStopMode] = useState<"stop" | "pickup">("stop");
  const [editSlotId, setEditSlotId] = useState("");
  const [editBusId, setEditBusId] = useState("");
  const [editStopId, setEditStopId] = useState("");
  const [editNote, setEditNote] = useState("");

  // 처리 완료 목록 (레이지 로드)
  const [showCompleted, setShowCompleted] = useState(false);
  const [completedRequests, setCompletedRequests] = useState<BusChangeRequest[]>([]);
  const [completedLoading, setCompletedLoading] = useState(false);
  const [completedLoaded, setCompletedLoaded] = useState(false);

  // 대기 중만 초기 로드 (빠름)
  const load = useCallback(async () => {
    setLoading(true);
    const [data, bn, ts, stops] = await Promise.all([
      listAllChangeRequests("pending"),
      listBusNumbers(),
      listBusTimeSlots(),
      listBusStops(),
    ]);
    setRequests(data);
    setBusNumbers(bn);
    setBusTimeSlots(ts);
    setBusStops(stops);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 처리 완료 레이지 로드
  const loadCompleted = useCallback(async () => {
    setCompletedLoading(true);
    const data = await listAllChangeRequests("completed");
    setCompletedRequests(data);
    setCompletedLoaded(true);
    setCompletedLoading(false);
  }, []);

  async function toggleCompleted() {
    const next = !showCompleted;
    setShowCompleted(next);
    if (next && !completedLoaded) {
      await loadCompleted();
    }
  }

  function startEdit(req: BusChangeRequest, mode: "approve" | "reject" | "edit") {
    setEditingId(req.id);
    setEditMode(mode);
    setEditStopMode(req.change_type === "no_ride" ? "pickup" : "stop");
    setEditSlotId(req.new_bus_time_slot_id || "");
    setEditBusId(req.new_bus_number_id || "");
    setEditStopId(req.new_bus_stop_id || "");
    setEditNote(mode === "reject" ? "" : (req.review_note || ""));
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function handleApproveConfirm(id: string) {
    setActionLoading(id);
    const changeType = editStopMode === "pickup" ? "no_ride" : "change";
    const result = await approveChangeRequest(id, adminId, {
      changeType,
      newBusTimeSlotId: editSlotId || undefined,
      newBusNumberId: editStopMode === "stop" ? (editBusId || undefined) : undefined,
      newBusStopId: editStopId || undefined,
      reviewNote: editNote || undefined,
    });
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(editMode === "edit" ? "변경 요청이 수정되었습니다." : "변경 요청이 승인되었습니다.");
    }
    setEditingId(null);
    await load();
    if (completedLoaded) await loadCompleted();
    router.refresh();
    setActionLoading(null);
  }

  async function handleRejectConfirm(id: string) {
    setActionLoading(id);
    const result = await rejectChangeRequest(id, adminId, editNote || undefined);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("변경 요청이 거부되었습니다.");
    }
    setEditingId(null);
    await load();
    if (completedLoaded) await loadCompleted();
    router.refresh();
    setActionLoading(null);
  }

  /** AdminBusChangeDnD에서 변경 생성 후 콜백 */
  async function handleChangeCreated() {
    await load();
    router.refresh();
  }

  if (loading) {
    return <LoadingState className="py-4" />;
  }

  const pendingRequests = requests;

  function handleStopModeChange(mode: "stop" | "pickup") {
    setEditStopMode(mode);
    setEditStopId("");
    if (mode === "pickup") setEditBusId("");
  }

  return (
    <div className="space-y-4">
      {/* 당일 변경 (변경 생성 시 대기 목록 갱신) */}
      <AdminBusChangeDnD onChangeCreated={handleChangeCreated} />

      {/* 대기중 */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-2">
          대기 중 ({pendingRequests.length}건)
        </h3>

        {pendingRequests.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">대기 중인 변경 요청이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {pendingRequests.map((req) => (
              <RequestCard
                key={req.id}
                req={req}
                editing={editingId === req.id}
                editMode={editMode}
                editSlotId={editSlotId}
                editBusId={editBusId}
                editStopId={editStopId}
                editNote={editNote}
                onEditSlotId={setEditSlotId}
                editStopMode={editStopMode}
                onEditStopMode={handleStopModeChange}
                onEditBusId={(v) => { setEditBusId(v); setEditStopId(""); }}
                onEditStopId={setEditStopId}
                onEditNote={setEditNote}
                busTimeSlots={busTimeSlots}
                busNumbers={busNumbers}
                busStops={busStops}
                actionLoading={actionLoading === req.id}
                onApprove={() => startEdit(req, "approve")}
                onReject={() => startEdit(req, "reject")}
                onConfirm={() => editMode === "reject" ? handleRejectConfirm(req.id) : handleApproveConfirm(req.id)}
                onCancel={cancelEdit}
              />
            ))}
          </div>
        )}
      </div>

      {/* 처리 완료 */}
      <div>
        <button
          onClick={toggleCompleted}
          className="flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-700"
        >
          <span className="text-xs">{showCompleted ? "▼" : "▶"}</span>
          처리 완료 {completedLoaded ? `(${completedRequests.length}건)` : ""}
        </button>

        {showCompleted && (
          <div className="space-y-2 mt-2">
            {completedLoading ? (
              <LoadingState className="py-4" />
            ) : completedRequests.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">처리된 요청이 없습니다.</p>
            ) : (
              completedRequests.map((req) => (
                <RequestCard
                  key={req.id}
                  req={req}
                  editing={editingId === req.id}
                  editMode={editMode}
                  editSlotId={editSlotId}
                  editBusId={editBusId}
                  editStopId={editStopId}
                  editNote={editNote}
                  onEditSlotId={setEditSlotId}
                  editStopMode={editStopMode}
                  onEditStopMode={handleStopModeChange}
                  onEditBusId={(v) => { setEditBusId(v); setEditStopId(""); }}
                  onEditStopId={setEditStopId}
                  onEditNote={setEditNote}
                  busTimeSlots={busTimeSlots}
                  busNumbers={busNumbers}
                  busStops={busStops}
                  actionLoading={actionLoading === req.id}
                  onApprove={req.status === "rejected" ? () => startEdit(req, "approve") : undefined}
                  onReject={req.status === "approved" ? () => startEdit(req, "reject") : undefined}
                  onEdit={() => startEdit(req, "edit")}
                  onConfirm={() => editMode === "reject" ? handleRejectConfirm(req.id) : handleApproveConfirm(req.id)}
                  onCancel={cancelEdit}
                />
              ))
            )}
          </div>
        )}
      </div>

    </div>
  );
}

function RequestCard({
  req,
  editing,
  editMode,
  editStopMode,
  editSlotId,
  editBusId,
  editStopId,
  editNote,
  onEditSlotId,
  onEditStopMode,
  onEditBusId,
  onEditStopId,
  onEditNote,
  busTimeSlots,
  busNumbers,
  busStops,
  actionLoading,
  onApprove,
  onReject,
  onEdit,
  onConfirm,
  onCancel,
}: {
  req: BusChangeRequest;
  editing: boolean;
  editMode: "approve" | "reject" | "edit";
  editStopMode: "stop" | "pickup";
  editSlotId: string;
  editBusId: string;
  editStopId: string;
  editNote: string;
  onEditSlotId: (v: string) => void;
  onEditStopMode: (v: "stop" | "pickup") => void;
  onEditBusId: (v: string) => void;
  onEditStopId: (v: string) => void;
  onEditNote: (v: string) => void;
  busTimeSlots: BusTimeSlot[];
  busNumbers: BusNumber[];
  busStops: BusStop[];
  actionLoading: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  onEdit?: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dirSlots = busTimeSlots;
  const filteredStops = editStopMode === "pickup"
    ? busStops.filter((s) => s.name.includes("픽업"))
    : busStops.filter((s) => !s.name.includes("픽업"));
  const filteredBusNumbers = busNumbers.filter((b) => !b.label.includes("픽업"));

  return (
    <div className={`border rounded-lg p-4 space-y-2 ${
      req.status === "approved" ? "border-green-200 bg-green-50/30" :
      req.status === "rejected" ? "border-red-200 bg-red-50/30" : ""
    }`}>
      {/* 헤더 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium">
          {req.korean_name || req.english_name}
        </span>
        <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">{req.request_date}</span>
        <span className={`text-xs px-2 py-0.5 rounded ${
          req.change_type === "no_ride"
            ? "bg-red-100 text-red-700"
            : req.change_type === "absent"
              ? "bg-slate-200 text-slate-700"
              : "bg-amber-100 text-amber-700"
        }`}>
          {TYPE_LABEL[req.change_type]}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLOR[req.status]}`}>
          {STATUS_LABEL[req.status]}
        </span>
      </div>

      {/* 요청 내용 */}
      {(req.new_time_slot_label || req.new_bus_label || req.new_bus_stop_name) && (
        <div className="text-xs text-slate-600 flex gap-3 flex-wrap">
          {req.new_time_slot_label && (
            <span>시간: {req.new_time_slot_label} ({formatTime(req.new_time_slot_time ?? "")})</span>
          )}
          {req.new_bus_label && <span>호차: {req.new_bus_label}</span>}
          {req.new_bus_stop_name && <span>정류장: {req.new_bus_stop_name}</span>}
        </div>
      )}

      {req.reason && (
        <p className="text-xs text-slate-500">세부 사항: {req.reason}</p>
      )}

      {req.review_note && !editing && (
        <p className="text-xs text-slate-500">관리자 메모: {req.review_note}</p>
      )}

      {/* 편집 폼 (승인/거절/수정) */}
      {editing ? (
        <div className={`space-y-2 pt-1 rounded-lg p-3 ${
          editMode === "reject" ? "bg-red-50" : "bg-green-50"
        }`}>
          <p className="text-xs font-medium text-slate-600">
            {editMode === "reject" ? "거절 처리" : editMode === "edit" ? "승인 내용 수정" : "승인 설정"}
          </p>

          {editMode !== "reject" && (
            <>
              {/* 구분: 정류장 / 픽업 */}
              <div>
                <label className="text-xs text-slate-500 block mb-1">구분</label>
                <div className="flex gap-2">
                  {(["stop", "pickup"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => onEditStopMode(mode)}
                      className={`px-3 py-1 text-xs rounded-lg border font-medium transition-colors ${
                        editStopMode === mode
                          ? "bg-slate-700 text-white border-slate-700"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {mode === "stop" ? "정류장" : "픽업"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 flex-wrap">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">시간대</label>
                  <select
                    value={editSlotId}
                    onChange={(e) => onEditSlotId(e.target.value)}
                    className="h-8 px-2 border rounded text-xs"
                  >
                    <option value="">선택 안함</option>
                    {dirSlots.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label} ({formatTime(s.time)})
                      </option>
                    ))}
                  </select>
                </div>
                {editStopMode === "stop" && (
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">호차</label>
                    <select
                      value={editBusId}
                      onChange={(e) => onEditBusId(e.target.value)}
                      className="h-8 px-2 border rounded text-xs"
                    >
                      <option value="">선택 안함</option>
                      {filteredBusNumbers.map((b) => (
                        <option key={b.id} value={b.id}>{b.label}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-xs text-slate-500 block mb-1">
                    {editStopMode === "pickup" ? "픽업 정류장 (선택)" : "정류장"}
                  </label>
                  <select
                    value={editStopId}
                    onChange={(e) => onEditStopId(e.target.value)}
                    className="h-8 px-2 border rounded text-xs"
                  >
                    <option value="">선택 안함</option>
                    {filteredStops.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="text-xs text-slate-500 block mb-1">
              {editMode === "reject" ? "거절 사유 (선택)" : "메모 (선택)"}
            </label>
            <textarea
              value={editNote}
              onChange={(e) => onEditNote(e.target.value)}
              placeholder={editMode === "reject" ? "거절 사유를 입력하세요" : "메모를 입력하세요"}
              className="w-full text-xs border border-slate-200 rounded-lg p-2 resize-none h-12"
            />
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant={editMode === "reject" ? "outline" : "default"}
              className={`h-7 text-xs ${editMode === "reject" ? "text-red-600 border-red-200 hover:bg-red-50" : ""}`}
              onClick={onConfirm}
              disabled={actionLoading}
            >
              {editMode === "reject" ? "거절 확인" : editMode === "edit" ? "수정 확인" : "승인 확인"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={onCancel}
              disabled={actionLoading}
            >
              취소
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 pt-1">
          {onApprove && (
            <Button size="sm" className="h-7 text-xs" onClick={onApprove} disabled={actionLoading}>
              {req.status === "rejected" ? "재승인" : "승인"}
            </Button>
          )}
          {onReject && (
            <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={onReject} disabled={actionLoading}>
              {req.status === "approved" ? "취소" : "거절"}
            </Button>
          )}
          {onEdit && (
            <Button size="sm" variant="outline" className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50" onClick={onEdit} disabled={actionLoading}>
              수정
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

