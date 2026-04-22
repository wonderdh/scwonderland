"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toastSuccess, toastError } from "@/lib/ui/toast";
import { Info } from "lucide-react";
import { getAgeColor } from "@/lib/ui/student-age-colors";
import type { BusStop, BusTimeSlot, StudentBusDefault } from "@/lib/types";
import { detectAfterschoolSlot } from "@/lib/bus/afterschool-sync";
import { MultiDatePicker } from "@/components/forms/MultiDatePicker";
import { formatDateYmdKst, todayKst } from "@/lib/utils/date-kst";
import { formatStudentName } from "@/lib/utils/student-name";
import {
  listBusStops,
  listBusTimeSlots,
  listAllActiveStudentNames,
  getStudentBusDefaults,
  getExistingBusChange,
  createAdminBusChange,
  updateAdminBusChange,
  deleteAdminBusChange,
  getStudentAfterschoolDetail,
  updateAfterschoolSecondPeriod,
  deleteAfterschoolEnrollmentDay,
  bulkCreateBusChanges,
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

export function AdminBusChangeDnD({
  onChangeCreated,
}: {
  onChangeCreated?: () => void;
} = {}) {
  const today = todayKst();
  const router = useRouter();

  // Reference data (loaded once)
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [busStops, setBusStops] = useState<BusStop[]>([]);
  const [busTimeSlots, setBusTimeSlots] = useState<BusTimeSlot[]>([]);

  // Date
  const [selectedDates, setSelectedDates] = useState<Date[]>([new Date(today)]);

  // Student selection
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [loadingStudent, setLoadingStudent] = useState(false);
  const [studentDefault, setStudentDefault] = useState<StudentBusDefault | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);

  // 방과후 enrollment
  const [afterschoolDays, setAfterschoolDays] = useState<{ day_of_week: number; second_period: boolean }[]>([]);

  // Form fields
  const [stopMode, setStopMode] = useState<StopMode>("stop");
  const [slotId, setSlotId] = useState("");
  const [stopId, setStopId] = useState("");
  const [stopSearch, setStopSearch] = useState("");
  const [stopListOpen, setStopListOpen] = useState(false);
  const [reason, setReason] = useState("");

  // 원본 값 (기존 변경 로드 시 저장 → 변경 없으면 저장 불필요)
  const [originalSlotId, setOriginalSlotId] = useState("");
  const [originalStopId, setOriginalStopId] = useState("");
  const [originalReason, setOriginalReason] = useState("");

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

  // When student / date changes → load existing data
  useEffect(() => {
    if (!selectedStudentId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingStudent(true);
    const firstDate = selectedDates[0] ? formatDateYmdKst(selectedDates[0]) : today;
    const dow = (() => { const d = new Date(firstDate).getDay(); return d === 0 ? 7 : d; })();
    Promise.all([
      getStudentBusDefaults(selectedStudentId),
      getExistingBusChange(selectedStudentId, firstDate),
      getStudentAfterschoolDetail(selectedStudentId),
    ]).then(([defaults, existing, afterschool]) => {
      setAfterschoolDays(afterschool);
      const def = defaults.find((d) => d.day_of_week === dow) ?? null;
      setStudentDefault(def);
      if (existing) {
        const loadedSlotId = existing.new_bus_time_slot_id ?? def?.bus_time_slot_id ?? "";
        const loadedStopId = existing.new_bus_stop_id ?? def?.bus_stop_id ?? "";
        const loadedReason = existing.reason ?? "";
        setExistingId(existing.id);
        setStopMode(existing.change_type === "no_ride" ? "pickup" : "stop");
        setSlotId(loadedSlotId);
        setStopId(loadedStopId);
        setStopSearch("");
        setStopListOpen(false);
        setReason(loadedReason);
        setOriginalSlotId(loadedSlotId);
        setOriginalStopId(loadedStopId);
        setOriginalReason(loadedReason);
      } else {
        setExistingId(null);
        setStopMode("stop");
        setSlotId(def?.bus_time_slot_id ?? "");
        setStopId(def?.bus_stop_id ?? "");
        setStopSearch("");
        setStopListOpen(false);
        setReason("");
        setOriginalSlotId("");
        setOriginalStopId("");
        setOriginalReason("");
      }
      setLoadingStudent(false);
    });
  }, [selectedStudentId, selectedDates]);

  // ── Derived ──

  const selectedStudentInfo = students.find((s) => s.profile_id === selectedStudentId);

  // 방과후 교시 관련
  const firstDateStr = selectedDates[0] ? formatDateYmdKst(selectedDates[0]) : today;
  const dow = (() => { const d = new Date(firstDateStr).getDay(); return d === 0 ? 7 : d; })();
  const afterschoolToday = afterschoolDays.find((e) => e.day_of_week === dow);
  const isAfterschoolDay = !!afterschoolToday;

  // 방과후 슬롯 ID 상수
  const slot1Id = busTimeSlots.find((s) => s.label === "방과후1차")?.id ?? "";
  const slot2Id = busTimeSlots.find((s) => s.label === "오후반 1차/방과후2차")?.id ?? "";

  // 현재 선택된 슬롯이 방과후 슬롯인지
  const selectedSlotObj = busTimeSlots.find((s) => s.id === slotId);
  const { isAfterschoolSlot, secondPeriod: newSecondPeriod } = detectAfterschoolSlot(selectedSlotObj);

  function handleAfterschoolPeriodSelect(secondPeriod: boolean) {
    setSlotId(secondPeriod ? slot2Id : slot1Id);
  }

  const filteredStudents = studentSearch.trim()
    ? students
        .filter((s) => {
          const q = studentSearch.trim().toLowerCase();
          return s.korean_name?.toLowerCase().includes(q) || s.english_name?.toLowerCase().includes(q);
        })
        .slice(0, 20)
    : [];

  const dirSlots = busTimeSlots;

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
    setSelectedDates([new Date(today)]);
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
    setStopListOpen(false);
    setReason("");
    setOriginalSlotId("");
    setOriginalStopId("");
    setOriginalReason("");
    setAfterschoolDays([]);
  }

  function handleStopModeChange(mode: StopMode) {
    setStopMode(mode);
    // Clear stop if it doesn't match the new mode
    if (selectedStopInfo) {
      const isPickup = selectedStopInfo.name.includes("픽업");
      if ((mode === "pickup" && !isPickup) || (mode === "stop" && isPickup)) {
        setStopId("");
        setStopSearch("");
        setStopListOpen(false);
      }
    }
  }

  async function handleSave() {
    if (!selectedStudentId) { toastError("학생을 선택해 주세요."); return; }
    if (selectedDates.length === 0) { toastError("날짜를 선택해 주세요."); return; }
    if (!stopId) { toastError("정류장을 선택해 주세요."); return; }
    if (!slotId) { toastError("시간대를 선택해 주세요."); return; }

    const changeType = stopMode === "pickup" ? "no_ride" : "change";
    const busNumberId = stopMode === "stop" ? (selectedStopInfo?.bus_number_id ?? undefined) : undefined;

    setSaving(true);

    if (selectedDates.length > 1) {
      // 다중 날짜 일괄 등록
      const result = await bulkCreateBusChanges(
        selectedStudentId,
        selectedDates.map((d) => formatDateYmdKst(d)),
        changeType,
        slotId,
        busNumberId,
        stopId,
        reason || undefined,
      );
      setSaving(false);
      if (result.error) {
        toastError(result.error);
      } else {
        toastSuccess(`${result.created}건 등록`);
        setSelectedDates([]);
        resetAll();
        onChangeCreated?.();
        router.refresh();
      }
      return;
    }

    // 단일 날짜
    const singleDate = formatDateYmdKst(selectedDates[0]);
    const result = existingId
      ? await updateAdminBusChange(
          existingId,
          changeType,
          slotId,
          busNumberId,
          stopId,
          reason || undefined
        )
      : await createAdminBusChange(
          selectedStudentId, singleDate,
          changeType,
          slotId,
          busNumberId,
          stopId,
          reason || undefined
        );
    setSaving(false);

    if (result.error) {
      toastError(result.error);
    } else {
      // 방과후 연동: 교시 변경 시 enrollment 업데이트
      if (isAfterschoolDay) {
        if (isAfterschoolSlot) {
          if (afterschoolToday && afterschoolToday.second_period !== newSecondPeriod) {
            await updateAfterschoolSecondPeriod(selectedStudentId, dow, newSecondPeriod);
          }
        } else {
          // 방과후 슬롯 아닌 걸 선택 → 해당 요일 enrollment 삭제 (방과후 없음)
          await deleteAfterschoolEnrollmentDay(selectedStudentId, dow);
        }
      }
      toastSuccess(existingId ? "변경이 수정되었습니다." : "당일 변경이 저장되었습니다.");
      setSelectedDates([]);
      resetAll();
      onChangeCreated?.();
      router.refresh();
    }
  }

  async function handleDelete() {
    if (!existingId) return;
    setSaving(true);
    const result = await deleteAdminBusChange(existingId);
    setSaving(false);
    if (result.error) {
      toastError(result.error);
    } else {
      toastSuccess("변경이 삭제되었습니다.");
      resetAll();
      router.refresh();
    }
  }

  return (
    <div className="border border-slate-200 rounded-xl bg-slate-50/60 p-5 space-y-5">
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-base text-blue-900">
        <Info className="h-5 w-5 mt-0.5 shrink-0" aria-hidden />
        <div>
          <p className="font-semibold">학생을 선택한 뒤 날짜와 정류장을 지정해 당일 하원 변경을 등록할 수 있습니다.</p>
          <p className="mt-0.5 text-sm text-blue-800">
            여러 날짜를 한 번에 선택하면 같은 변경 내용이 선택한 날짜에 모두 적용됩니다.
          </p>
        </div>
      </div>

      {/* Header: date */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-lg font-semibold text-slate-800">당일 변경</span>
        <MultiDatePicker selected={selectedDates} onSelect={setSelectedDates} />
      </div>

      {/* Student search */}
      <div>
        <label className="text-base font-semibold text-slate-700 block mb-2">학생</label>
        {selectedStudentInfo ? (
          <div className="border rounded-lg bg-white divide-y divide-slate-100">
            <div className="flex items-center gap-2 p-3">
              <span className={`text-sm px-2 py-0.5 rounded font-medium shrink-0 ${getAgeColor(selectedStudentInfo.age).bg} ${getAgeColor(selectedStudentInfo.age).text}`}>
                {selectedStudentInfo.age ? `${selectedStudentInfo.age}세` : "-"}
              </span>
              <span className={`text-lg font-semibold ${getAgeColor(selectedStudentInfo.age).text}`}>
                {formatStudentName(selectedStudentInfo, { fallback: "" })}
              </span>
              {existingId && (
                <span className="text-sm bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium">
                  수정 모드
                </span>
              )}
              {loadingStudent && <span className="text-sm text-slate-500">확인 중...</span>}
              <button
                onClick={resetAll}
                className="ml-auto h-9 px-3 text-sm text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100"
              >
                변경
              </button>
            </div>
            {!loadingStudent && (
              <div className="px-4 py-2 text-sm text-slate-600">
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
                  <span className="text-slate-400">해당 요일 기본 배정 없음</span>
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
              className="text-base"
            />
            {filteredStudents.length > 0 && (
              <div className="mt-1 border border-slate-200 rounded-lg max-h-56 overflow-y-auto divide-y divide-slate-100 bg-white shadow-sm">
                {filteredStudents.map((s) => (
                  <button
                    key={s.profile_id}
                    onClick={() => handleStudentSelect(s.profile_id)}
                    className="w-full text-left px-3 py-3 text-base hover:bg-slate-50 flex items-center gap-2"
                  >
                    <span className={`text-sm px-2 py-0.5 rounded font-medium shrink-0 ${getAgeColor(s.age).bg} ${getAgeColor(s.age).text}`}>
                      {s.age ? `${s.age}세` : "-"}
                    </span>
                    <span className={`text-base font-medium ${getAgeColor(s.age).text}`}>
                      {formatStudentName(s, { fallback: "" })}
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
            <label className="text-base font-semibold text-slate-700 block mb-2">구분</label>
            <div className="flex gap-2">
              {(["stop", "pickup"] as StopMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleStopModeChange(mode)}
                  className={`h-11 px-5 text-base rounded-lg border font-medium transition-colors ${
                    stopMode === mode
                      ? "bg-slate-700 text-white border-slate-700"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {mode === "stop" ? "정류장" : "픽업"}
                </button>
              ))}
            </div>
          </div>

          {/* 방과후 교시 선택 (방과후 등록된 날만 표시) */}
          {isAfterschoolDay && (
            <div>
              <label className="text-base font-semibold text-slate-700 block mb-2">
                방과후 교시
                <span className="ml-1.5 text-slate-400 font-normal">
                  (기본: {afterschoolToday?.second_period ? "1,2교시" : "1교시"})
                </span>
              </label>
              <div className="flex gap-2">
                {([false, true] as const).map((second) => (
                  <button
                    key={String(second)}
                    onClick={() => handleAfterschoolPeriodSelect(second)}
                    className={`h-11 px-5 text-base rounded-lg border font-medium transition-colors ${
                      isAfterschoolSlot && (slotId === slot2Id) === second
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {second ? "1,2교시" : "1교시"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Time slot */}
          <div>
            <label className="text-base font-semibold text-slate-700 block mb-2">시간대</label>
              <select
                value={slotId}
                onChange={(e) => setSlotId(e.target.value)}
                className="w-full h-11 px-3 border border-slate-300 rounded-lg text-base bg-white"
              >
                <option value="">시간대 선택</option>
                {dirSlots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatTime(s.time)} {s.label}
                  </option>
                ))}
              </select>
          </div>

          {/* Stop selection */}
          <div>
            <label className="text-base font-semibold text-slate-700 block mb-2">
              {stopMode === "pickup" ? "픽업 정류장" : "정류장"}
            </label>
            {stopId && stopMatchesMode && !stopListOpen ? (
              <div className="flex items-center gap-2 p-3 border border-slate-200 rounded-lg bg-slate-50">
                <span className="text-slate-500" aria-hidden>📍</span>
                <span className="text-base font-medium text-slate-800">{selectedStopInfo!.name}</span>
                <button
                  onClick={() => { setStopId(""); setStopSearch(""); setStopListOpen(true); }}
                  className="ml-auto h-9 px-3 text-sm text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100"
                >
                  변경
                </button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  placeholder={stopMode === "pickup" ? "픽업 정류장 검색..." : "정류장 검색..."}
                  value={stopSearch}
                  onChange={(e) => setStopSearch(e.target.value)}
                  onFocus={() => setStopListOpen(true)}
                  onBlur={() => setTimeout(() => setStopListOpen(false), 150)}
                  className="text-base"
                />
                {stopListOpen && (
                  <div className="mt-1 border border-slate-200 rounded-lg max-h-56 overflow-y-auto divide-y divide-slate-100 bg-white shadow-sm absolute w-full z-10">
                    {filteredStops.length === 0 ? (
                      <p className="text-base text-slate-500 py-3 text-center">정류장이 없습니다.</p>
                    ) : (
                      filteredStops.map((s) => (
                        <button
                          key={s.id}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { setStopId(s.id); setStopSearch(""); setStopListOpen(false); }}
                          className="w-full text-left px-3 py-3 text-base hover:bg-slate-50 flex items-center gap-2"
                        >
                          <span className="text-slate-500 shrink-0" aria-hidden>📍</span>
                          <span className="flex-1">{s.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Memo */}
          <div>
            <label className="text-base font-semibold text-slate-700 block mb-2">메모 (선택)</label>
            <Input
              placeholder="메모 입력..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="text-base"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              size="default"
              className="h-11 px-6 text-base"
              onClick={handleSave}
              disabled={
                saving ||
                !stopId ||
                (stopMode === "stop" && !slotId) ||
                // 기존 변경과 동일하면 저장 불필요
                !!(existingId &&
                  slotId === originalSlotId &&
                  stopId === originalStopId &&
                  reason === originalReason)
              }
            >
              {saving ? "저장 중..." : existingId ? "수정" : "저장"}
            </Button>
            {existingId && (
              <Button size="default" variant="destructive" className="h-11 px-6 text-base" onClick={handleDelete} disabled={saving}>
                삭제
              </Button>
            )}
            <Button size="default" variant="ghost" className="h-11 px-5 text-base" onClick={resetAll} disabled={saving}>
              취소
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
