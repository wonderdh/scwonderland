"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/Spinner";
import { Input } from "@/components/ui/input";
import type { BusManifestGroup, BusManifestEntry, BusTimeSlot, BusNumber, NoRideEntry, AfterSchoolBusEntry } from "@/lib/types";
import { getAgeColor } from "@/lib/student-age-colors";
import {
  getDailyBusManifest,
  boardBusStudent,
  unboardBusStudent,
  checkBusStudent,
  uncheckBusStudent,
  createAdminBusChange,
  updateAdminBusChange,
  getExistingBusChange,
  deleteAdminBusChange,
  listAllActiveStudentNames,
  listBusStops,
} from "../../actions";

const DIR_LABEL = { pickup: "등원", dropoff: "하원" } as const;
const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

function formatTime(t: string) {
  return t.slice(0, 5);
}

function formatCheckedTime(iso: string) {
  const d = new Date(iso);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

async function getAdminId(): Promise<string> {
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? "";
}

type TimeGroup = {
  slotTime: string;
  slotLabel: string;
  cards: BusManifestGroup[];
};

function groupByTime(groups: BusManifestGroup[]): TimeGroup[] {
  const map = new Map<string, TimeGroup>();
  for (const g of groups) {
    const key = g.slot_time;
    if (!map.has(key)) {
      map.set(key, { slotTime: g.slot_time, slotLabel: g.slot_label, cards: [] });
    }
    map.get(key)!.cards.push(g);
  }
  return [...map.values()].sort((a, b) => a.slotTime.localeCompare(b.slotTime));
}

export function BusDashboard({ busTimeSlots, busNumbers }: { busTimeSlots: BusTimeSlot[]; busNumbers: BusNumber[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [direction, setDirection] = useState<"pickup" | "dropoff">("pickup");
  const [groups, setGroups] = useState<BusManifestGroup[]>([]);
  const [noRides, setNoRides] = useState<NoRideEntry[]>([]);
  const [afterschoolStudents, setAfterSchoolStudents] = useState<AfterSchoolBusEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [adminId, setAdminId] = useState("");
  const [isPending, startTransition] = useTransition();
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");
  const [showChangeModal, setShowChangeModal] = useState(false);

  useEffect(() => {
    getAdminId().then(setAdminId);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getDailyBusManifest(date, direction);
    setGroups(result.groups);
    setNoRides(result.noRides);
    setAfterSchoolStudents(result.afterschoolStudents);
    setLoading(false);
  }, [date, direction]);

  useEffect(() => {
    load();
  }, [load]);

  const handleBoard = useCallback(
    (
      student: BusManifestEntry,
      busTimeSlotId: string,
      busNumberId: string,
      shouldBoard: boolean
    ) => {
      // Optimistic update
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          students: g.students.map((s) =>
            s.student_profile_id === student.student_profile_id
              ? {
                  ...s,
                  boarded_at: shouldBoard ? new Date().toISOString() : null,
                }
              : s
          ),
        }))
      );

      startTransition(async () => {
        const result = shouldBoard
          ? await boardBusStudent(
              student.student_profile_id,
              date,
              direction,
              busTimeSlotId,
              busNumberId
            )
          : await unboardBusStudent(student.student_profile_id, date, direction);

        if (result.error) {
          setGroups((prev) =>
            prev.map((g) => ({
              ...g,
              students: g.students.map((s) =>
                s.student_profile_id === student.student_profile_id
                  ? { ...s, boarded_at: student.boarded_at }
                  : s
              ),
            }))
          );
          toast.error(`오류: ${result.error}`);
        } else {
          load();
        }
      });
    },
    [date, direction, load]
  );

  const handleCheck = useCallback(
    (
      student: BusManifestEntry,
      busTimeSlotId: string,
      busNumberId: string,
      shouldCheck: boolean
    ) => {
      // Optimistic update
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          students: g.students.map((s) =>
            s.student_profile_id === student.student_profile_id
              ? {
                  ...s,
                  checked_at: shouldCheck ? new Date().toISOString() : null,
                  check_record_id: shouldCheck ? "optimistic" : null,
                }
              : s
          ),
        }))
      );

      startTransition(async () => {
        const result = shouldCheck
          ? await checkBusStudent(
              student.student_profile_id,
              date,
              direction,
              busTimeSlotId,
              busNumberId,
              adminId
            )
          : await uncheckBusStudent(student.student_profile_id, date, direction);

        if (result.error) {
          setGroups((prev) =>
            prev.map((g) => ({
              ...g,
              students: g.students.map((s) =>
                s.student_profile_id === student.student_profile_id
                  ? {
                      ...s,
                      checked_at: student.checked_at,
                      check_record_id: student.check_record_id,
                    }
                  : s
              ),
            }))
          );
          toast.error(`오류: ${result.error}`);
        } else {
          load();
        }
      });
    },
    [date, direction, adminId, load]
  );

  const handleCancelNoRide = useCallback(
    (requestId: string) => {
      startTransition(async () => {
        const result = await deleteAdminBusChange(requestId);
        if (result.error) {
          toast.error(`오류: ${result.error}`);
        } else {
          toast.success("변경이 취소되었습니다.");
          load();
        }
      });
    },
    [load]
  );

  const d = new Date(date);
  const dayName = DAY_NAMES[d.getDay()];
  const filteredGroups = selectedSlotId
    ? groups.filter((g) => g.bus_time_slot_id === selectedSlotId)
    : groups;
  const timeGroups = groupByTime(filteredGroups);

  const directionSlots = busTimeSlots.filter((s) => s.direction === direction);

  // 미탑승/결석 분리
  const noRideOnly = noRides.filter((n) => n.change_type !== "absent");
  const absentOnly = noRides.filter((n) => n.change_type === "absent");

  return (
    <div className="space-y-5">
      {/* 필터 바 */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-40"
        />
        <span className="text-sm text-slate-500">({dayName})</span>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={direction === "pickup" ? "default" : "outline"}
            onClick={() => { setDirection("pickup"); setSelectedSlotId(""); }}
          >
            등원
          </Button>
          <Button
            size="sm"
            variant={direction === "dropoff" ? "default" : "outline"}
            onClick={() => { setDirection("dropoff"); setSelectedSlotId(""); }}
          >
            하원
          </Button>
        </div>
        {directionSlots.length > 0 && (
          <select
            value={selectedSlotId}
            onChange={(e) => setSelectedSlotId(e.target.value)}
            className="h-9 px-2 border rounded text-sm"
          >
            <option value="">전체 시간대</option>
            {directionSlots.map((s) => (
              <option key={s.id} value={s.id}>
                {formatTime(s.time)} {s.label}
              </option>
            ))}
          </select>
        )}
        <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
          {loading ? <><Spinner size="sm" /> 불러오는 중...</> : "새로고침"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={() => setShowChangeModal(true)}
        >
          당일 변경
        </Button>
      </div>

      <h3 className="text-sm font-semibold text-slate-700">
        {date} ({dayName}) — {DIR_LABEL[direction]}
      </h3>

      {/* 매니페스트 */}
      {filteredGroups.length === 0 && !loading && (
        <p className="text-sm text-slate-400 py-8 text-center">
          배정된 학생이 없습니다.
        </p>
      )}

      <div className="space-y-6">
        {timeGroups.map((tg) => (
          <div key={tg.slotTime}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm font-semibold text-slate-700">
                {formatTime(tg.slotTime)}
              </span>
              {tg.slotLabel && (
                <span className="text-sm text-slate-500">{tg.slotLabel}</span>
              )}
              <div className="flex-1 border-t border-slate-200" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {tg.cards.map((card) => {
                const boardedCount = card.students.filter(
                  (s) => s.boarded_at || s.checked_at
                ).length;
                const checkedCount = card.students.filter(
                  (s) => s.checked_at
                ).length;
                const totalCount = card.students.length;

                return (
                  <BusCard
                    key={`${card.bus_time_slot_id}-${card.bus_number_id}`}
                    card={card}
                    boardedCount={boardedCount}
                    checkedCount={checkedCount}
                    totalCount={totalCount}
                    onBoard={handleBoard}
                    onCheck={handleCheck}
                    isPending={isPending}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 방과후 학생 (하원 시만) */}
      {afterschoolStudents.length > 0 && direction === "dropoff" && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm font-semibold text-violet-700">
              방과후 ({afterschoolStudents.length}명)
            </span>
            <div className="flex-1 border-t border-violet-200" />
          </div>
          <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3">
            <div className="flex flex-wrap gap-1.5">
              {afterschoolStudents.map((student) => {
                const ageColor = getAgeColor(student.age);
                return (
                  <span
                    key={student.student_profile_id}
                    className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${ageColor.bg} ${ageColor.text}`}
                  >
                    {student.korean_name || student.english_name}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 미탑승 학생 */}
      {noRideOnly.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm font-semibold text-red-700">
              미탑승 ({noRideOnly.length}명)
            </span>
            <div className="flex-1 border-t border-red-200" />
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50/50 divide-y divide-red-100">
            {noRideOnly.map((student) => (
              <div
                key={student.student_profile_id}
                className="px-4 py-2.5 flex items-center gap-3 text-sm"
              >
                <span className="font-medium text-slate-700">
                  {student.korean_name || student.english_name}
                </span>
                {student.original_bus_label && (
                  <span className="text-xs text-slate-400">
                    (원래: {formatTime(student.original_slot_time ?? "")}{" "}
                    {student.original_bus_label})
                  </span>
                )}
                {student.request_id && (
                  <button
                    onClick={() => handleCancelNoRide(student.request_id!)}
                    disabled={isPending}
                    className="ml-auto text-xs text-red-500 hover:text-red-700 font-medium"
                  >
                    ✕ 취소
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 결석 학생 */}
      {absentOnly.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm font-semibold text-slate-600">
              결석 ({absentOnly.length}명)
            </span>
            <div className="flex-1 border-t border-slate-300" />
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-100 divide-y divide-slate-200">
            {absentOnly.map((student) => (
              <div
                key={student.student_profile_id}
                className="px-4 py-2.5 flex items-center gap-3 text-sm"
              >
                <span className="font-medium text-slate-600">
                  {student.korean_name || student.english_name}
                </span>
                {student.original_bus_label && (
                  <span className="text-xs text-slate-400">
                    (원래: {formatTime(student.original_slot_time ?? "")}{" "}
                    {student.original_bus_label})
                  </span>
                )}
                {student.request_id && (
                  <button
                    onClick={() => handleCancelNoRide(student.request_id!)}
                    disabled={isPending}
                    className="ml-auto text-xs text-slate-500 hover:text-slate-700 font-medium"
                  >
                    ✕ 취소
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 당일 변경 모달 */}
      {showChangeModal && (
        <AdminBusChangeModal
          date={date}
          direction={direction}
          busTimeSlots={busTimeSlots}
          busNumbers={busNumbers}
          onClose={() => setShowChangeModal(false)}
          onSaved={() => { setShowChangeModal(false); load(); }}
        />
      )}
    </div>
  );
}

// ── 호차 카드 ──

function BusCard({
  card,
  boardedCount,
  checkedCount,
  totalCount,
  onBoard,
  onCheck,
  isPending,
}: {
  card: BusManifestGroup;
  boardedCount: number;
  checkedCount: number;
  totalCount: number;
  onBoard: (
    student: BusManifestEntry,
    busTimeSlotId: string,
    busNumberId: string,
    shouldBoard: boolean
  ) => void;
  onCheck: (
    student: BusManifestEntry,
    busTimeSlotId: string,
    busNumberId: string,
    shouldCheck: boolean
  ) => void;
  isPending: boolean;
}) {
  const allDone = checkedCount === totalCount && totalCount > 0;

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* 카드 헤더 */}
      <div className={`px-4 py-2.5 flex items-center justify-between ${allDone ? "bg-green-50" : "bg-slate-50"}`}>
        <span className="text-sm font-semibold text-slate-700">
          {card.bus_label}
        </span>
        <span className="text-xs font-medium text-slate-500">
          탑승 {boardedCount}/{totalCount} · 하차 {checkedCount}/{totalCount}
        </span>
      </div>

      {/* 학생 리스트 */}
      <div className="divide-y divide-slate-100">
        {card.students.map((student) => {
          const isBoarded = !!student.boarded_at;
          const isChecked = !!student.checked_at;

          // 배경색: 변경 학생(amber) → 하차(초록) → 탑승(파란) → 기본
          const rowBg = isChecked
            ? "bg-green-50/60"
            : student.is_changed
              ? "bg-amber-50/60"
              : isBoarded
                ? "bg-blue-50/50"
                : "hover:bg-slate-50";

          return (
            <div
              key={student.student_profile_id}
              className={`flex items-center gap-3 px-4 py-2.5 ${rowBg}`}
            >
              {/* 탑승 체크박스 */}
              <input
                type="checkbox"
                checked={isBoarded || isChecked}
                disabled={isPending || isChecked}
                onChange={() =>
                  onBoard(
                    student,
                    card.bus_time_slot_id,
                    card.bus_number_id,
                    !isBoarded
                  )
                }
                title="탑승"
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 accent-blue-600"
              />

              {/* 하차 체크박스 */}
              <input
                type="checkbox"
                checked={isChecked}
                disabled={isPending || !isBoarded}
                onChange={() =>
                  onCheck(
                    student,
                    card.bus_time_slot_id,
                    card.bus_number_id,
                    !isChecked
                  )
                }
                title="하차"
                className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500 accent-green-600"
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium truncate ${getAgeColor(student.age).text}`}>
                    {student.korean_name || student.english_name}
                  </span>
                  {student.is_changed && (
                    <>
                      <span className="shrink-0 text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded font-medium">
                        변경
                      </span>
                      {student.original_bus_label && (
                        <span className="shrink-0 text-[10px] text-amber-500">
                          ({student.original_bus_label} → {card.bus_label})
                        </span>
                      )}
                    </>
                  )}
                </div>
                {(student.bus_stop_name || student.note) && (
                  <span className="text-xs text-slate-400 truncate block">
                    {student.bus_stop_name ? `📍 ${student.bus_stop_name}` : ""}{student.bus_stop_name && student.note ? " · " : ""}{student.note ?? ""}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {student.estimated_time && (
                  <span className="text-xs text-slate-400">
                    {formatTime(student.estimated_time)}
                  </span>
                )}
                {isBoarded && student.boarded_at && (
                  <>
                    {student.estimated_time && (
                      <span className="text-xs text-slate-300">→</span>
                    )}
                    <span className="text-xs text-blue-600">
                      탑승 {formatCheckedTime(student.boarded_at)}
                    </span>
                  </>
                )}
                {isChecked && student.checked_at && (
                  <span className="text-xs text-green-600">
                    하차 {formatCheckedTime(student.checked_at)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 당일 변경 모달 ──

function AdminBusChangeModal({
  date,
  direction,
  busTimeSlots,
  busNumbers,
  onClose,
  onSaved,
}: {
  date: string;
  direction: "pickup" | "dropoff";
  busTimeSlots: BusTimeSlot[];
  busNumbers: BusNumber[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [students, setStudents] = useState<{ profile_id: string; korean_name: string | null; english_name: string | null; age: number | null }[]>([]);
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [changeType, setChangeType] = useState<"change" | "no_ride" | "absent">("no_ride");
  const [slotId, setSlotId] = useState("");
  const [busId, setBusId] = useState("");
  const [stopId, setStopId] = useState("");
  const [stops, setStops] = useState<{ id: string; name: string }[]>([]);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalDirection, setModalDirection] = useState<"pickup" | "dropoff">(direction);

  // 수정 모드
  const [existingId, setExistingId] = useState<string | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(false);

  useEffect(() => {
    listAllActiveStudentNames().then(setStudents);
  }, []);

  // 학생+방향 선택 시 기존 변경 요청 확인
  useEffect(() => {
    if (!selectedStudent) {
      setExistingId(null);
      return;
    }
    setLoadingExisting(true);
    getExistingBusChange(selectedStudent, date, modalDirection).then((existing) => {
      if (existing) {
        setExistingId(existing.id);
        setChangeType(existing.change_type);
        if (existing.change_type === "change") {
          setSlotId(existing.new_bus_time_slot_id ?? "");
          setBusId(existing.new_bus_number_id ?? "");
          // stopId는 busId useEffect에서 stops 로드 후 설정
          setTimeout(() => setStopId(existing.new_bus_stop_id ?? ""), 300);
        }
        setReason(existing.reason ?? "");
      } else {
        setExistingId(null);
      }
      setLoadingExisting(false);
    });
  }, [selectedStudent, modalDirection, date]);

  // 호차 변경 시 해당 호차 정류장 로드
  useEffect(() => {
    if (busId) {
      listBusStops(busId).then((data) => setStops(data.map((s) => ({ id: s.id, name: s.name }))));
    } else {
      setStops([]);
      setStopId("");
    }
  }, [busId]);

  const dirSlots = busTimeSlots.filter((s) => s.direction === modalDirection);

  const filtered = search.trim()
    ? students.filter((s) => {
        const q = search.trim().toLowerCase();
        return (
          (s.korean_name?.toLowerCase().includes(q)) ||
          (s.english_name?.toLowerCase().includes(q))
        );
      })
    : [];

  async function handleSave() {
    if (!selectedStudent) {
      toast.error("학생을 선택해 주세요.");
      return;
    }
    if (changeType === "change" && (!slotId || !busId)) {
      toast.error("시간대와 호차를 선택해 주세요.");
      return;
    }
    setSaving(true);

    const result = existingId
      ? await updateAdminBusChange(
          existingId,
          selectedStudent,
          date,
          modalDirection,
          changeType,
          changeType === "change" ? slotId : undefined,
          changeType === "change" ? busId : undefined,
          changeType === "change" && stopId ? stopId : undefined,
          reason || undefined
        )
      : await createAdminBusChange(
          selectedStudent,
          date,
          modalDirection,
          changeType,
          changeType === "change" ? slotId : undefined,
          changeType === "change" ? busId : undefined,
          changeType === "change" && stopId ? stopId : undefined,
          reason || undefined
        );

    setSaving(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(existingId ? "변경 요청이 수정되었습니다." : "당일 변경이 적용되었습니다.");
      onSaved();
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
      onSaved();
    }
  }

  function handleStudentReset() {
    setSelectedStudent("");
    setSearch("");
    setExistingId(null);
    setChangeType("no_ride");
    setSlotId("");
    setBusId("");
    setStopId("");
    setReason("");
  }

  const selectedStudentInfo = students.find((s) => s.profile_id === selectedStudent);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-slate-800">당일 변경</h3>
          {existingId && (
            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">수정 모드</span>
          )}
        </div>
        <p className="text-xs text-slate-500">{date}</p>

        {/* 학생 검색 */}
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">학생 선택</label>
          {selectedStudentInfo ? (
            <div className="flex items-center gap-2 p-2 border rounded-lg bg-slate-50">
              <span className={`text-sm font-medium ${getAgeColor(selectedStudentInfo.age).text}`}>
                {selectedStudentInfo.korean_name || selectedStudentInfo.english_name}
              </span>
              {loadingExisting && <span className="text-xs text-slate-400">확인 중...</span>}
              <button
                onClick={handleStudentReset}
                className="ml-auto text-xs text-slate-400 hover:text-slate-600"
              >
                변경
              </button>
            </div>
          ) : (
            <>
              <Input
                placeholder="학생 이름 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-sm"
              />
              {filtered.length > 0 && (
                <div className="mt-1 border rounded-lg max-h-40 overflow-y-auto divide-y divide-slate-100">
                  {filtered.slice(0, 20).map((s) => (
                    <button
                      key={s.profile_id}
                      onClick={() => { setSelectedStudent(s.profile_id); setSearch(""); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                    >
                      <span className={getAgeColor(s.age).text}>
                        {s.korean_name || s.english_name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* 방향 */}
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">방향</label>
          <div className="flex gap-2">
            <Button size="sm" variant={modalDirection === "pickup" ? "default" : "outline"} onClick={() => setModalDirection("pickup")}>등원</Button>
            <Button size="sm" variant={modalDirection === "dropoff" ? "default" : "outline"} onClick={() => setModalDirection("dropoff")}>하원</Button>
          </div>
        </div>

        {/* 변경 유형 */}
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">변경 유형</label>
          <div className="flex gap-3">
            {([["change", "호차 변경"], ["no_ride", "미탑승"], ["absent", "결석"]] as const).map(([val, label]) => (
              <label key={val} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="changeType"
                  value={val}
                  checked={changeType === val}
                  onChange={() => setChangeType(val)}
                  className="accent-slate-700"
                />
                {label}
              </label>
            ))}
          </div>
          {changeType === "absent" && (
            <p className="text-xs text-slate-400 mt-1">자동으로 특수 호차 → 결석 정류장에 배정됩니다.</p>
          )}
        </div>

        {/* 호차 변경 시 옵션 */}
        {changeType === "change" && (
          <div className="space-y-2">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">시간대</label>
              <select value={slotId} onChange={(e) => setSlotId(e.target.value)} className="w-full h-9 px-2 border rounded text-sm">
                <option value="">시간대 선택</option>
                {dirSlots.map((s) => (
                  <option key={s.id} value={s.id}>{formatTime(s.time)} {s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">호차</label>
              <select value={busId} onChange={(e) => setBusId(e.target.value)} className="w-full h-9 px-2 border rounded text-sm">
                <option value="">호차 선택</option>
                {busNumbers.map((b) => (
                  <option key={b.id} value={b.id}>{b.label}</option>
                ))}
              </select>
            </div>
            {stops.length > 0 && (
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">정류장</label>
                <select value={stopId} onChange={(e) => setStopId(e.target.value)} className="w-full h-9 px-2 border rounded text-sm">
                  <option value="">정류장 선택</option>
                  {stops.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* 메모 */}
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">메모 (선택)</label>
          <Input
            placeholder="메모 입력..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="text-sm"
          />
        </div>

        {/* 버튼 */}
        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={handleSave} disabled={saving || !selectedStudent}>
            {saving ? "저장 중..." : existingId ? "수정" : "저장"}
          </Button>
          {existingId && (
            <Button size="sm" variant="destructive" onClick={handleDelete} disabled={saving}>
              삭제
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onClose}>취소</Button>
        </div>
      </div>
    </div>
  );
}
