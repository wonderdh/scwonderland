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
import { LoadingState } from "@/components/feedback/LoadingState";
import { StatusBadge } from "@/components/badges/StatusBadge";
import { ConfirmDialog } from "@/components/overlays/ConfirmDialog";
import { BUS_REQUEST_STATUS_CONFIG, BUS_CHANGE_TYPE_CONFIG } from "@/lib/constants/bus";
import { toastSuccess, toastError } from "@/lib/ui/toast";
import { AdminBusChangeDnD } from "./AdminBusChangeDnD";
import { formatTime } from "@/lib/bus/utils";

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

  // 거부 확인 모달
  const [rejectConfirm, setRejectConfirm] = useState<{ open: boolean; id?: string }>({ open: false });

  // 대기/완료 세그먼트
  const [segment, setSegment] = useState<"pending" | "completed">("pending");
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

  async function selectSegment(next: "pending" | "completed") {
    setSegment(next);
    if (next === "completed" && !completedLoaded) {
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
      toastError(result.error);
    } else {
      toastSuccess(editMode === "edit" ? "변경 요청이 수정되었습니다." : "변경 요청이 승인되었습니다.");
    }
    setEditingId(null);
    await load();
    if (completedLoaded) await loadCompleted();
    router.refresh();
    setActionLoading(null);
  }

  function requestReject(id: string) {
    setRejectConfirm({ open: true, id });
  }

  async function handleRejectConfirmed() {
    const id = rejectConfirm.id;
    setRejectConfirm({ open: false });
    if (!id) return;
    setActionLoading(id);
    const result = await rejectChangeRequest(id, adminId, editNote || undefined);
    if (result.error) {
      toastError(result.error);
    } else {
      toastSuccess("변경 요청이 거부되었습니다.");
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

  const pendingRequests = requests;
  const showList = segment === "pending" ? pendingRequests : completedRequests;

  function handleStopModeChange(mode: "stop" | "pickup") {
    setEditStopMode(mode);
    setEditStopId("");
    if (mode === "pickup") setEditBusId("");
  }

  return (
    <div className="space-y-6">
      {/* 당일 변경 (변경 생성 시 대기 목록 갱신) */}
      <AdminBusChangeDnD onChangeCreated={handleChangeCreated} />

      {/* 세그먼트 컨트롤 */}
      <div
        role="tablist"
        aria-label="변경 요청 상태"
        className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1"
      >
        {([
          { id: "pending", label: `대기 (${pendingRequests.length})` },
          { id: "completed", label: completedLoaded ? `처리 완료 (${completedRequests.length})` : "처리 완료" },
        ] as const).map((s) => {
          const active = segment === s.id;
          return (
            <button
              key={s.id}
              role="tab"
              aria-selected={active}
              onClick={() => selectSegment(s.id)}
              className={`h-11 px-5 text-base font-medium rounded-md transition-colors ${
                active ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-800"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* 리스트 */}
      {loading ? (
        <LoadingState label="변경 요청 불러오는 중..." />
      ) : segment === "completed" && completedLoading ? (
        <LoadingState label="처리 완료 요청 불러오는 중..." />
      ) : showList.length === 0 ? (
        <p className="text-base text-slate-500 py-10 text-center">
          {segment === "pending" ? "대기 중인 변경 요청이 없습니다." : "처리된 요청이 없습니다."}
        </p>
      ) : (
        <div className="space-y-3">
          {showList.map((req) => (
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
              onApprove={
                segment === "pending" || req.status === "rejected"
                  ? () => startEdit(req, "approve")
                  : undefined
              }
              onReject={
                segment === "pending" || req.status === "approved"
                  ? () => (editingId === req.id && editMode === "reject"
                      ? requestReject(req.id)
                      : startEdit(req, "reject"))
                  : undefined
              }
              onEdit={segment === "completed" ? () => startEdit(req, "edit") : undefined}
              onConfirm={() =>
                editMode === "reject"
                  ? requestReject(req.id)
                  : handleApproveConfirm(req.id)
              }
              onCancel={cancelEdit}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={rejectConfirm.open}
        title="요청을 거부하시겠습니까?"
        description="거부하면 학생은 기본 배정으로 복귀되며 변경 요청은 처리 완료 목록으로 이동합니다."
        impactList={["요청이 거부 상태로 변경됩니다.", "학생은 해당 일자 기본 배정으로 운행됩니다."]}
        danger
        confirmLabel="거부"
        onConfirm={handleRejectConfirmed}
        onCancel={() => setRejectConfirm({ open: false })}
      />
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
    <div className={`border rounded-xl p-5 space-y-3 ${
      req.status === "approved" ? "border-green-200 bg-green-50/30" :
      req.status === "rejected" ? "border-red-200 bg-red-50/30" : "border-slate-200 bg-white"
    }`}>
      {/* 헤더 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-lg font-semibold text-slate-900">
          {req.korean_name || req.english_name}
        </span>
        <span className="text-base bg-slate-100 px-2.5 py-0.5 rounded text-slate-700">{req.request_date}</span>
        <StatusBadge config={BUS_CHANGE_TYPE_CONFIG[req.change_type]} />
        <StatusBadge config={BUS_REQUEST_STATUS_CONFIG[req.status]} />
      </div>

      {/* 요청 내용 */}
      {(req.new_time_slot_label || req.new_bus_label || req.new_bus_stop_name) && (
        <div className="text-base text-slate-700 flex gap-4 flex-wrap">
          {req.new_time_slot_label && (
            <span>시간: <span className="font-medium">{req.new_time_slot_label}</span> ({formatTime(req.new_time_slot_time ?? "")})</span>
          )}
          {req.new_bus_label && <span>호차: <span className="font-medium">{req.new_bus_label}</span></span>}
          {req.new_bus_stop_name && <span>정류장: <span className="font-medium">{req.new_bus_stop_name}</span></span>}
        </div>
      )}

      {req.reason && (
        <p className="text-base text-slate-600">세부 사항: {req.reason}</p>
      )}

      {req.review_note && !editing && (
        <p className="text-sm text-slate-500">관리자 메모: {req.review_note}</p>
      )}

      {/* 편집 폼 (승인/거절/수정) */}
      {editing ? (
        <div className={`space-y-4 pt-2 rounded-lg p-4 ${
          editMode === "reject" ? "bg-red-50" : "bg-green-50"
        }`}>
          <p className="text-xl font-semibold text-slate-800">
            {editMode === "reject" ? "거절 처리" : editMode === "edit" ? "승인 내용 수정" : "승인 설정"}
          </p>

          {editMode !== "reject" && (
            <>
              {/* 구분: 정류장 / 픽업 */}
              <fieldset>
                <legend className="text-base font-semibold mb-2 text-slate-700">구분</legend>
                <div className="flex gap-2">
                  {(["stop", "pickup"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => onEditStopMode(mode)}
                      className={`h-11 px-5 text-base rounded-lg border font-medium transition-colors ${
                        editStopMode === mode
                          ? "bg-slate-700 text-white border-slate-700"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {mode === "stop" ? "정류장" : "픽업"}
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* 정류장 정보 */}
              <fieldset className="space-y-2">
                <legend className="text-base font-semibold mb-2 text-slate-700">정류장 정보</legend>
                <div className="flex gap-3 flex-wrap">
                  {editStopMode === "stop" && (
                    <div className="flex-1 min-w-[180px]">
                      <label className="text-sm text-slate-600 block mb-1">호차</label>
                      <select
                        value={editBusId}
                        onChange={(e) => onEditBusId(e.target.value)}
                        className="h-11 w-full px-3 border border-slate-300 rounded-lg text-base bg-white"
                      >
                        <option value="">선택 안함</option>
                        {filteredBusNumbers.map((b) => (
                          <option key={b.id} value={b.id}>{b.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-sm text-slate-600 block mb-1">
                      {editStopMode === "pickup" ? "픽업 정류장 (선택)" : "정류장"}
                    </label>
                    <select
                      value={editStopId}
                      onChange={(e) => onEditStopId(e.target.value)}
                      className="h-11 w-full px-3 border border-slate-300 rounded-lg text-base bg-white"
                    >
                      <option value="">선택 안함</option>
                      {filteredStops.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </fieldset>

              {/* 시간·호차 */}
              <fieldset>
                <legend className="text-base font-semibold mb-2 text-slate-700">시간대</legend>
                <select
                  value={editSlotId}
                  onChange={(e) => onEditSlotId(e.target.value)}
                  className="h-11 w-full max-w-sm px-3 border border-slate-300 rounded-lg text-base bg-white"
                >
                  <option value="">선택 안함</option>
                  {dirSlots.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} ({formatTime(s.time)})
                    </option>
                  ))}
                </select>
              </fieldset>
            </>
          )}

          {/* 메모 */}
          <fieldset>
            <legend className="text-base font-semibold mb-2 text-slate-700">
              {editMode === "reject" ? "거절 사유 (선택)" : "메모 (선택)"}
            </legend>
            <textarea
              value={editNote}
              onChange={(e) => onEditNote(e.target.value)}
              placeholder={editMode === "reject" ? "거절 사유를 입력하세요" : "메모를 입력하세요"}
              className="w-full text-base border border-slate-300 rounded-lg p-3 resize-none h-20"
            />
          </fieldset>

          <div className="flex gap-2">
            <Button
              size="default"
              variant={editMode === "reject" ? "outline" : "default"}
              className={`h-11 px-5 text-base ${editMode === "reject" ? "text-red-700 border-red-300 hover:bg-red-50" : ""}`}
              onClick={onConfirm}
              disabled={actionLoading}
            >
              {editMode === "reject" ? "거절 확인" : editMode === "edit" ? "수정 확인" : "승인 확인"}
            </Button>
            <Button
              size="default"
              variant="ghost"
              className="h-11 px-5 text-base"
              onClick={onCancel}
              disabled={actionLoading}
            >
              취소
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 pt-1 flex-wrap">
          {onApprove && (
            <Button size="default" className="h-11 px-5 text-base" onClick={onApprove} disabled={actionLoading}>
              {req.status === "rejected" ? "재승인" : "승인"}
            </Button>
          )}
          {onReject && (
            <Button
              size="default"
              variant="outline"
              className="h-11 px-5 text-base text-red-700 border-red-300 hover:bg-red-50"
              onClick={onReject}
              disabled={actionLoading}
            >
              {req.status === "approved" ? "취소" : "거절"}
            </Button>
          )}
          {onEdit && (
            <Button
              size="default"
              variant="outline"
              className="h-11 px-5 text-base text-blue-700 border-blue-300 hover:bg-blue-50"
              onClick={onEdit}
              disabled={actionLoading}
            >
              수정
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
