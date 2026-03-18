"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getAgeColor } from "@/lib/student-age-colors";
import type { BusStop, BusTimeSlot, StudentBusDefault } from "@/lib/types";
import {
  listBusStops,
  listBusTimeSlots,
  listAllActiveStudentNames,
  getStudentBusDefaults,
  getExistingBusChange,
  createAdminBusChange,
  updateAdminBusChange,
  deleteAdminBusChange,
} from "../../actions";

type StudentItem = {
  profile_id: string;
  korean_name: string | null;
  english_name: string | null;
  age: number | null;
};

type StopMode = "stop" | "pickup";

function formatTime(t: string | undefined | null) {
  if (!t) return "";
  return t.slice(0, 5);
}

export function AdminBusChangeDnD() {
  const today = new Date().toISOString().slice(0, 10);
  const router = useRouter();

  // Reference data (loaded once)
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [busStops, setBusStops] = useState<BusStop[]>([]);
  const [busTimeSlots, setBusTimeSlots] = useState<BusTimeSlot[]>([]);

  // Date / direction
  const [date, setDate] = useState(today);
  const [direction, setDirection] = useState<"pickup" | "dropoff">("dropoff");

  // Student selection
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [loadingStudent, setLoadingStudent] = useState(false);
  const [studentDefault, setStudentDefault] = useState<StudentBusDefault | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);

  // Form fields
  const [stopMode, setStopMode] = useState<StopMode>("stop");
  const [slotId, setSlotId] = useState("");
  const [stopId, setStopId] = useState("");
  const [stopSearch, setStopSearch] = useState("");
  const [reason, setReason] = useState("");

  const [saving, setSaving] = useState(false);

  // Load reference data on mount
  useEffect(() => {
    Promise.all([
      listAllActiveStudentNames(),
      listBusStops(),
      listBusTimeSlots(),
    ]).then(([s, stops, slots]) => {
      setStudents(s);
      setBusStops(stops);
      setBusTimeSlots(slots);
    });
  }, []);

  // When student / date / direction changes → load existing data
  useEffect(() => {
    if (!selectedStudentId) return;
    setLoadingStudent(true);
    const dow = (() => { const d = new Date(date).getDay(); return d === 0 ? 7 : d; })();
    Promise.all([
      getStudentBusDefaults(selectedStudentId),
      getExistingBusChange(selectedStudentId, date, direction),
    ]).then(([defaults, existing]) => {
      const def = defaults.find((d) => d.day_of_week === dow && d.direction === direction) ?? null;
      setStudentDefault(def);
      if (existing) {
        setExistingId(existing.id);
        setStopMode(existing.change_type === "no_ride" ? "pickup" : "stop");
        setSlotId(existing.new_bus_time_slot_id ?? def?.bus_time_slot_id ?? "");
        setStopId(existing.new_bus_stop_id ?? "");
        setStopSearch("");
        setReason(existing.reason ?? "");
      } else {
        setExistingId(null);
        setStopMode("stop");
        setSlotId(def?.bus_time_slot_id ?? "");
        setStopId("");
        setStopSearch("");
        setReason("");
      }
      setLoadingStudent(false);
    });
  }, [selectedStudentId, date, direction]);

  // ── Derived ──

  const selectedStudentInfo = students.find((s) => s.profile_id === selectedStudentId);

  const filteredStudents = studentSearch.trim()
    ? students
        .filter((s) => {
          const q = studentSearch.trim().toLowerCase();
          return s.korean_name?.toLowerCase().includes(q) || s.english_name?.toLowerCase().includes(q);
        })
        .slice(0, 20)
    : [];

  const dirSlots = busTimeSlots.filter((s) => s.direction === direction);

  const baseStops =
    stopMode === "pickup"
      ? busStops.filter((s) => s.name.includes("픽업"))
      : busStops.filter((s) => !s.name.includes("픽업"));

  const filteredStops = stopSearch.trim()
    ? baseStops.filter((s) => s.name.toLowerCase().includes(stopSearch.trim().toLowerCase()))
    : baseStops;

  const selectedStopInfo = busStops.find((s) => s.id === stopId);
  // Check if the selected stop still matches the current mode
  const stopMatchesMode =
    selectedStopInfo &&
    (stopMode === "pickup"
      ? selectedStopInfo.name.includes("픽업")
      : !selectedStopInfo.name.includes("픽업"));

  // ── Handlers ──

  function handleStudentSelect(profileId: string) {
    setSelectedStudentId(profileId);
    setStudentSearch("");
  }

  function resetAll() {
    setSelectedStudentId("");
    setStudentSearch("");
    setStudentDefault(null);
    setExistingId(null);
    setStopMode("stop");
    setSlotId("");
    setStopId("");
    setStopSearch("");
    setReason("");
  }

  function handleStopModeChange(mode: StopMode) {
    setStopMode(mode);
    // Clear stop if it doesn't match the new mode
    if (selectedStopInfo) {
      const isPickup = selectedStopInfo.name.includes("픽업");
      if ((mode === "pickup" && !isPickup) || (mode === "stop" && isPickup)) {
        setStopId("");
        setStopSearch("");
      }
    }
  }

  async function handleSave() {
    if (!selectedStudentId) { toast.error("학생을 선택해 주세요."); return; }
    if (!stopId) { toast.error("정류장을 선택해 주세요."); return; }
    if (stopMode === "stop" && !slotId) { toast.error("시간대를 선택해 주세요."); return; }

    const changeType = stopMode === "pickup" ? "no_ride" : "change";
    const busNumberId = stopMode === "stop" ? (selectedStopInfo?.bus_number_id ?? undefined) : undefined;

    setSaving(true);
    const result = existingId
      ? await updateAdminBusChange(
          existingId, selectedStudentId, date, direction,
          changeType,
          stopMode === "stop" ? slotId : undefined,
          busNumberId,
          stopId,
          reason || undefined
        )
      : await createAdminBusChange(
          selectedStudentId, date, direction,
          changeType,
          stopMode === "stop" ? slotId : undefined,
          busNumberId,
          stopId,
          reason || undefined
        );
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(existingId ? "변경이 수정되었습니다." : "당일 변경이 저장되었습니다.");
      resetAll();
      router.refresh();
    }
  }

  async function handleDelete() {
    if (!existingId) return;
    setSaving(true);
    const result = await deleteAdminBusChange(existingId);
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("변경이 삭제되었습니다.");
      resetAll();
      router.refresh();
    }
  }

  return (
    <div className="border rounded-xl bg-slate-50/40 p-4 space-y-4">
      {/* Header: date + direction */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-slate-700">당일 변경</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-8 px-2 border rounded text-sm bg-white"
        />
        <div className="flex rounded-lg overflow-hidden border border-slate-200">
          {(["pickup", "dropoff"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDirection(d)}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                direction === d ? "bg-slate-700 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {d === "pickup" ? "등원" : "하원"}
            </button>
          ))}
        </div>
      </div>

      {/* Student search */}
      <div>
        <label className="text-xs font-medium text-slate-600 block mb-1">학생</label>
        {selectedStudentInfo ? (
          <div className="border rounded-lg bg-white divide-y divide-slate-100">
            <div className="flex items-center gap-2 p-2.5">
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${getAgeColor(selectedStudentInfo.age).bg} ${getAgeColor(selectedStudentInfo.age).text}`}>
                {selectedStudentInfo.age ? `${selectedStudentInfo.age}세` : "-"}
              </span>
              <span className={`text-sm font-medium ${getAgeColor(selectedStudentInfo.age).text}`}>
                {selectedStudentInfo.korean_name || selectedStudentInfo.english_name}
              </span>
              {existingId && (
                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                  수정 모드
                </span>
              )}
              {loadingStudent && <span className="text-xs text-slate-400">확인 중...</span>}
              <button
                onClick={resetAll}
                className="ml-auto text-xs text-slate-400 hover:text-slate-600"
              >
                변경
              </button>
            </div>
            {!loadingStudent && (
              <div className="px-3 py-1.5 text-xs text-slate-500">
                {studentDefault ? (
                  <>
                    평소:{" "}
                    {studentDefault.bus_label && (
                      <span className="font-medium">{studentDefault.bus_label}</span>
                    )}
                    {studentDefault.bus_stop_name && (
                      <span className="ml-1 text-slate-400">· {studentDefault.bus_stop_name}</span>
                    )}
                    {studentDefault.time_slot_label && (
                      <span className="ml-1 text-slate-400">
                        ({formatTime(studentDefault.time_slot_time)}{" "}
                        {studentDefault.time_slot_label})
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-slate-300">해당 요일 기본 배정 없음</span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div>
            <Input
              placeholder="학생 이름 검색..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="text-sm"
            />
            {filteredStudents.length > 0 && (
              <div className="mt-1 border rounded-lg max-h-44 overflow-y-auto divide-y divide-slate-100 bg-white shadow-sm">
                {filteredStudents.map((s) => (
                  <button
                    key={s.profile_id}
                    onClick={() => handleStudentSelect(s.profile_id)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
                  >
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${getAgeColor(s.age).bg} ${getAgeColor(s.age).text}`}>
                      {s.age ? `${s.age}세` : "-"}
                    </span>
                    <span className={getAgeColor(s.age).text}>
                      {s.korean_name || s.english_name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Form — shown only after student is selected and loaded */}
      {selectedStudentId && !loadingStudent && (
        <>
          {/* Stop mode: 정류장 | 픽업 */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">구분</label>
            <div className="flex gap-2">
              {(["stop", "pickup"] as StopMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleStopModeChange(mode)}
                  className={`px-4 py-1.5 text-sm rounded-lg border font-medium transition-colors ${
                    stopMode === mode
                      ? "bg-slate-700 text-white border-slate-700"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {mode === "stop" ? "정류장" : "픽업"}
                </button>
              ))}
            </div>
          </div>

          {/* Time slot (정류장 only) */}
          {stopMode === "stop" && (
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">시간대</label>
              <select
                value={slotId}
                onChange={(e) => setSlotId(e.target.value)}
                className="w-full h-9 px-2 border rounded text-sm bg-white"
              >
                <option value="">시간대 선택</option>
                {dirSlots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatTime(s.time)} {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Stop selection */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">
              {stopMode === "pickup" ? "픽업 정류장" : "정류장"}
            </label>
            {stopId && stopMatchesMode ? (
              <div className="flex items-center gap-2 p-2.5 border rounded-lg bg-slate-50">
                <span className="text-slate-400">📍</span>
                <span className="text-sm font-medium text-slate-700">{selectedStopInfo!.name}</span>
                <button
                  onClick={() => { setStopId(""); setStopSearch(""); }}
                  className="ml-auto text-xs text-slate-400 hover:text-slate-600"
                >
                  변경
                </button>
              </div>
            ) : (
              <>
                <Input
                  placeholder={stopMode === "pickup" ? "픽업 정류장 검색..." : "정류장 검색..."}
                  value={stopSearch}
                  onChange={(e) => setStopSearch(e.target.value)}
                  className="text-sm"
                />
                <div className="mt-1 border rounded-lg max-h-36 overflow-y-auto divide-y divide-slate-100 bg-white shadow-sm">
                  {filteredStops.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3 text-center">정류장이 없습니다.</p>
                  ) : (
                    filteredStops.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => { setStopId(s.id); setStopSearch(""); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
                      >
                        <span className="text-slate-400 shrink-0">📍</span>
                        <span className="flex-1">{s.name}</span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* Memo */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">메모 (선택)</label>
            <Input
              placeholder="메모 입력..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !stopId || (stopMode === "stop" && !slotId)}
            >
              {saving ? "저장 중..." : existingId ? "수정" : "저장"}
            </Button>
            {existingId && (
              <Button size="sm" variant="destructive" onClick={handleDelete} disabled={saving}>
                삭제
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={resetAll} disabled={saving}>
              취소
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
