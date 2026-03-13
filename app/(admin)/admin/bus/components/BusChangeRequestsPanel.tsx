"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BusChangeRequest, BusNumber, BusTimeSlot, BusStop } from "@/lib/types";
import {
  listAllChangeRequests,
  approveChangeRequest,
  rejectChangeRequest,
  listBusNumbers,
  listBusTimeSlots,
  listBusStops,
  createAdminBusChange,
  updateAdminBusChange,
  getExistingBusChange,
  deleteAdminBusChange,
  listAllActiveStudentNames,
} from "../../actions";
import { LoadingState } from "@/components/LoadingState";
import { getAgeColor } from "@/lib/student-age-colors";
import { toast } from "sonner";

const DIR_LABEL = { pickup: "등원", dropoff: "하원" } as const;
const TYPE_LABEL = { change: "변경", no_ride: "미탑승", absent: "결석" } as const;
const STATUS_LABEL = { pending: "대기중", approved: "승인", rejected: "거절" } as const;
const STATUS_COLOR = {
  pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  approved: "bg-green-100 text-green-700 border-green-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
} as const;

function formatTime(t: string | undefined) {
  if (!t) return "";
  return t.slice(0, 5);
}

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
  const [editSlotId, setEditSlotId] = useState("");
  const [editBusId, setEditBusId] = useState("");
  const [editStopId, setEditStopId] = useState("");
  const [editNote, setEditNote] = useState("");

  // 처리 완료 목록 표시
  const [showCompleted, setShowCompleted] = useState(false);

  // 관리자 당일 변경 모달
  const [showAdminModal, setShowAdminModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [data, bn, ts, stops] = await Promise.all([
      listAllChangeRequests(),
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

  function startEdit(req: BusChangeRequest, mode: "approve" | "reject" | "edit") {
    setEditingId(req.id);
    setEditMode(mode);
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
    const result = await approveChangeRequest(id, adminId, {
      newBusTimeSlotId: editSlotId || undefined,
      newBusNumberId: editBusId || undefined,
      newBusStopId: editStopId || undefined,
      reviewNote: editNote || undefined,
    });
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("변경 요청이 승인되었습니다.");
    }
    setEditingId(null);
    await load();
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
    router.refresh();
    setActionLoading(null);
  }

  if (loading) {
    return <LoadingState className="py-4" />;
  }

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const completedRequests = requests.filter((r) => r.status !== "pending");

  // 선택한 호차에 해당하는 정류장 필터
  const filteredStops = busStops;

  return (
    <div className="space-y-4">
      {/* 관리자 당일 변경 버튼 */}
      <div className="flex items-center justify-between">
        <Button
          size="sm"
          onClick={() => setShowAdminModal(true)}
        >
          관리자 당일 변경
        </Button>
        <Button size="sm" variant="ghost" onClick={load}>
          새로고침
        </Button>
      </div>

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
                onEditBusId={(v) => { setEditBusId(v); setEditStopId(""); }}
                onEditStopId={setEditStopId}
                onEditNote={setEditNote}
                busTimeSlots={busTimeSlots}
                busNumbers={busNumbers}
                filteredStops={filteredStops}
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
          onClick={() => setShowCompleted(!showCompleted)}
          className="flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-700"
        >
          <span className="text-xs">{showCompleted ? "▼" : "▶"}</span>
          처리 완료 ({completedRequests.length}건)
        </button>

        {showCompleted && (
          <div className="space-y-2 mt-2">
            {completedRequests.length === 0 ? (
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
                  onEditBusId={(v) => { setEditBusId(v); setEditStopId(""); }}
                  onEditStopId={setEditStopId}
                  onEditNote={setEditNote}
                  busTimeSlots={busTimeSlots}
                  busNumbers={busNumbers}
                  filteredStops={filteredStops}
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

      {/* 관리자 당일 변경 모달 */}
      {showAdminModal && (
        <AdminBusChangeModal
          busTimeSlots={busTimeSlots}
          onClose={() => setShowAdminModal(false)}
          onSaved={() => { setShowAdminModal(false); load(); router.refresh(); }}
        />
      )}
    </div>
  );
}

function RequestCard({
  req,
  editing,
  editMode,
  editSlotId,
  editBusId,
  editStopId,
  editNote,
  onEditSlotId,
  onEditBusId,
  onEditStopId,
  onEditNote,
  busTimeSlots,
  busNumbers,
  filteredStops,
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
  editSlotId: string;
  editBusId: string;
  editStopId: string;
  editNote: string;
  onEditSlotId: (v: string) => void;
  onEditBusId: (v: string) => void;
  onEditStopId: (v: string) => void;
  onEditNote: (v: string) => void;
  busTimeSlots: BusTimeSlot[];
  busNumbers: BusNumber[];
  filteredStops: BusStop[];
  actionLoading: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  onEdit?: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dirSlots = busTimeSlots.filter((s) => s.direction === req.direction);

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
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
          {DIR_LABEL[req.direction]}
        </span>
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
            <span>시간: {req.new_time_slot_label} ({formatTime(req.new_time_slot_time)})</span>
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
                <div>
                  <label className="text-xs text-slate-500 block mb-1">호차</label>
                  <select
                    value={editBusId}
                    onChange={(e) => onEditBusId(e.target.value)}
                    className="h-8 px-2 border rounded text-xs"
                  >
                    <option value="">선택 안함</option>
                    {busNumbers.map((b) => (
                      <option key={b.id} value={b.id}>{b.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">정류장</label>
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

// ── 관리자 당일 변경 모달 ──

function AdminBusChangeModal({
  busTimeSlots,
  onClose,
  onSaved,
}: {
  busTimeSlots: BusTimeSlot[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [students, setStudents] = useState<{ profile_id: string; korean_name: string | null; english_name: string | null; age: number | null }[]>([]);
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [changeType, setChangeType] = useState<"change" | "no_ride" | "absent">("no_ride");
  const [slotId, setSlotId] = useState("");
  const [stopId, setStopId] = useState("");
  const [stopSearch, setStopSearch] = useState("");
  const [stops, setStops] = useState<{ id: string; name: string }[]>([]);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [direction, setDirection] = useState<"pickup" | "dropoff">("pickup");

  const [existingId, setExistingId] = useState<string | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(false);

  useEffect(() => {
    listAllActiveStudentNames().then(setStudents);
    listBusStops().then((data) => setStops(data.map((s) => ({ id: s.id, name: s.name }))));
  }, []);

  useEffect(() => {
    if (!selectedStudent) { setExistingId(null); return; }
    setLoadingExisting(true);
    getExistingBusChange(selectedStudent, date, direction).then((existing) => {
      if (existing) {
        setExistingId(existing.id);
        setChangeType(existing.change_type);
        setSlotId(existing.new_bus_time_slot_id ?? "");
        setStopId(existing.new_bus_stop_id ?? "");
        setStopSearch("");
        setReason(existing.reason ?? "");
      } else {
        setExistingId(null);
      }
      setLoadingExisting(false);
    });
  }, [selectedStudent, direction, date]);

  const dirSlots = busTimeSlots.filter((s) => s.direction === direction);

  const filteredStudents = search.trim()
    ? students.filter((s) => {
        const q = search.trim().toLowerCase();
        return s.korean_name?.toLowerCase().includes(q) || s.english_name?.toLowerCase().includes(q);
      })
    : [];

  const selectedStopInfo = stops.find((s) => s.id === stopId);

  const filteredStops = stopSearch.trim()
    ? stops.filter((s) => s.name.toLowerCase().includes(stopSearch.trim().toLowerCase()))
    : stops;

  async function handleSave() {
    if (!selectedStudent) { toast.error("학생을 선택해 주세요."); return; }
    if (!stopId) { toast.error("정류장을 선택해 주세요."); return; }
    if (changeType === "change" && !slotId) { toast.error("시간대를 선택해 주세요."); return; }
    setSaving(true);
    const result = existingId
      ? await updateAdminBusChange(existingId, selectedStudent, date, direction, changeType,
          changeType === "change" ? slotId : undefined, undefined,
          stopId, reason || undefined)
      : await createAdminBusChange(selectedStudent, date, direction, changeType,
          changeType === "change" ? slotId : undefined, undefined,
          stopId, reason || undefined);
    setSaving(false);
    if (result.error) { toast.error(result.error); }
    else { toast.success(existingId ? "변경 요청이 수정되었습니다." : "당일 변경이 적용되었습니다."); onSaved(); }
  }

  async function handleDelete() {
    if (!existingId) return;
    setSaving(true);
    const result = await deleteAdminBusChange(existingId);
    setSaving(false);
    if (result.error) { toast.error(result.error); }
    else { toast.success("변경이 삭제되었습니다."); onSaved(); }
  }

  function handleStudentReset() {
    setSelectedStudent(""); setSearch(""); setExistingId(null);
    setChangeType("no_ride"); setSlotId(""); setStopId(""); setStopSearch(""); setReason("");
  }

  function handleStopReset() {
    setStopId(""); setStopSearch("");
  }

  const selectedStudentInfo = students.find((s) => s.profile_id === selectedStudent);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-slate-800">관리자 당일 변경</h3>
          {existingId && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">수정 모드</span>}
        </div>

        {/* 날짜 */}
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">날짜</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-sm w-44" />
        </div>

        {/* 학생 검색 */}
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">학생</label>
          {selectedStudentInfo ? (
            <div className="flex items-center gap-2 p-2 border rounded-lg bg-slate-50">
              <span className={`text-sm font-medium ${getAgeColor(selectedStudentInfo.age).text}`}>
                {selectedStudentInfo.korean_name || selectedStudentInfo.english_name}
              </span>
              {loadingExisting && <span className="text-xs text-slate-400">확인 중...</span>}
              <button onClick={handleStudentReset} className="ml-auto text-xs text-slate-400 hover:text-slate-600">변경</button>
            </div>
          ) : (
            <>
              <Input placeholder="학생 이름 검색..." value={search} onChange={(e) => setSearch(e.target.value)} className="text-sm" />
              {filteredStudents.length > 0 && (
                <div className="mt-1 border rounded-lg max-h-40 overflow-y-auto divide-y divide-slate-100">
                  {filteredStudents.slice(0, 20).map((s) => (
                    <button key={s.profile_id} onClick={() => { setSelectedStudent(s.profile_id); setSearch(""); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">
                      <span className={getAgeColor(s.age).text}>{s.korean_name || s.english_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* 방향 */}
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">등하원</label>
          <div className="flex gap-2">
            <Button size="sm" variant={direction === "pickup" ? "default" : "outline"} onClick={() => setDirection("pickup")}>등원</Button>
            <Button size="sm" variant={direction === "dropoff" ? "default" : "outline"} onClick={() => setDirection("dropoff")}>하원</Button>
          </div>
        </div>

        {/* 변경 유형 */}
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">변경 유형</label>
          <div className="flex gap-3">
            {([["no_ride", "미탑승"], ["change", "호차 변경"], ["absent", "결석"]] as const).map(([val, label]) => (
              <label key={val} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="radio" name="changeType" value={val} checked={changeType === val} onChange={() => setChangeType(val)} className="accent-slate-700" />
                {label}
              </label>
            ))}
          </div>
          {changeType === "absent" && <p className="text-xs text-slate-400 mt-1">해당 날짜 승하차 매니페스트에서 제외됩니다.</p>}
        </div>

        {/* 호차 변경 시 시간대 */}
        {changeType === "change" && (
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">시간대</label>
            <select value={slotId} onChange={(e) => setSlotId(e.target.value)} className="w-full h-9 px-2 border rounded text-sm">
              <option value="">시간대 선택</option>
              {dirSlots.map((s) => (<option key={s.id} value={s.id}>{formatTime(s.time)} {s.label}</option>))}
            </select>
          </div>
        )}

        {/* 정류장 검색 (필수) */}
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">정류장</label>
          {selectedStopInfo ? (
            <div className="flex items-center gap-2 p-2 border rounded-lg bg-slate-50">
              <span className="text-sm">📍</span>
              <span className="text-sm font-medium text-slate-700">{selectedStopInfo.name}</span>
              <button onClick={handleStopReset} className="ml-auto text-xs text-slate-400 hover:text-slate-600">변경</button>
            </div>
          ) : (
            <>
              <Input placeholder="정류장 검색..." value={stopSearch} onChange={(e) => setStopSearch(e.target.value)} className="text-sm" />
              <div className="mt-1 border rounded-lg max-h-36 overflow-y-auto divide-y divide-slate-100">
                {filteredStops.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center">정류장이 없습니다.</p>
                ) : (
                  filteredStops.map((s) => (
                    <button key={s.id} onClick={() => { setStopId(s.id); setStopSearch(""); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">
                      <span className="text-slate-400 mr-1.5">📍</span>{s.name}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* 메모 */}
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">메모</label>
          <Input placeholder="메모 입력..." value={reason} onChange={(e) => setReason(e.target.value)} className="text-sm" />
        </div>

        {/* 버튼 */}
        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={handleSave} disabled={saving || !selectedStudent || !stopId}>
            {saving ? "저장 중..." : existingId ? "수정" : "저장"}
          </Button>
          {existingId && (
            <Button size="sm" variant="destructive" onClick={handleDelete} disabled={saving}>삭제</Button>
          )}
          <Button size="sm" variant="outline" onClick={onClose}>닫기</Button>
        </div>
      </div>
    </div>
  );
}
