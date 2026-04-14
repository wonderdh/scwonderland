"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BusNumber, BusTimeSlot, BusStop, BusDefaultAssignment, BusStopDayAssignment } from "@/lib/types";
import {
  getBulkBusDefaults,
  saveBulkBusDefaults,
  listBusStops,
  listBusStopDayAssignments,
  listAfterschoolStudentIdsByDay,
} from "../../actions";
import { getAgeColor } from "@/lib/student-age-colors";

const DAYS = [
  { value: 1, label: "월" },
  { value: 2, label: "화" },
  { value: 3, label: "수" },
  { value: 4, label: "목" },
  { value: 5, label: "금" },
];

const GROUP_LABELS = ["전체", "유치부", "오후반"] as const;
type GroupFilter = (typeof GROUP_LABELS)[number];

type StudentItem = {
  profile_id: string;
  korean_name: string | null;
  english_name: string | null;
  age?: number | null;
  group_label?: string | null;
};

export function BusStudentAssignmentManager({
  busNumbers,
  busTimeSlots,
  initialStops,
  allStudents,
}: {
  busNumbers: BusNumber[];
  busTimeSlots: BusTimeSlot[];
  initialStops: BusStop[];
  allStudents: StudentItem[];
}) {
  const [day, setDay] = useState(1);
  const [timeSlotId, setTimeSlotId] = useState(() => {
    return busTimeSlots[0]?.id ?? "";
  });
  const [stops, setStops] = useState<BusStop[]>(initialStops);
  const [dayAssignments, setDayAssignments] = useState<BusStopDayAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("전체");

  // 서버 원본 vs 로컬 작업 사본
  const [serverAssignments, setServerAssignments] = useState<BusDefaultAssignment[]>([]);
  const [localAssignments, setLocalAssignments] = useState<BusDefaultAssignment[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // 같은 요일+방향의 다른 시간대에 배정된 학생 (현재 시간대 제외)
  const [otherSlotAssigned, setOtherSlotAssigned] = useState<BusDefaultAssignment[]>([]);
  const [hoveredStudentId, setHoveredStudentId] = useState<string | null>(null);

  // 해당 요일 방과후 학생 ID 세트
  const [afterschoolIds, setAfterschoolIds] = useState<Set<string>>(new Set());

  // fetch 버전 카운터 (race condition 방지)
  const fetchVersionRef = useRef(0);

  // 메모 편집
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteValue, setEditingNoteValue] = useState("");
  const [notePopupPos, setNotePopupPos] = useState<{ x: number; y: number } | null>(null);

  const filteredSlots = busTimeSlots;

  const fetchAll = useCallback(async () => {
    const version = ++fetchVersionRef.current;
    setLoading(true);
    const [defaults, stopDayData, allDirDefaults, asIds] = await Promise.all([
      getBulkBusDefaults(day, timeSlotId || undefined),
      listBusStopDayAssignments(day, timeSlotId || undefined),
      // 같은 요일의 전체 배정 조회 (다른 시간대 배정 학생 필터용)
      getBulkBusDefaults(day),
      listAfterschoolStudentIdsByDay(day),
    ]);
    // 이미 다른 필터로 변경된 경우 무시
    if (version !== fetchVersionRef.current) return;
    setServerAssignments(defaults);
    setLocalAssignments(defaults);
    setDayAssignments(stopDayData);
    setAfterschoolIds(new Set(asIds));
    // 현재 시간대가 아닌 다른 시간대에 배정된 학생
    const currentIds = new Set(defaults.map((d) => d.student_profile_id));
    setOtherSlotAssigned(
      allDirDefaults.filter((d) => !currentIds.has(d.student_profile_id))
    );
    setHasChanges(false);
    setLoading(false);
  }, [day, timeSlotId]);

  const refreshStops = useCallback(async () => {
    const data = await listBusStops();
    setStops(data);
  }, []);

  // 필터 변경 시 미저장 경고
  const guardedSetFilter = useCallback(
    (setter: () => void) => {
      if (hasChanges) {
        if (!confirm("저장하지 않은 변경사항이 있습니다. 계속하시겠습니까?")) return;
      }
      setter();
    },
    [hasChanges]
  );

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── 파생 데이터 계산 ────────────────────────────────────────────────────────

  // stop_id → bus_number_id 매핑 (현재 요일/방향/시간대 기준)
  const stopToBusMap = new Map<string, string>();
  for (const da of dayAssignments) {
    stopToBusMap.set(da.bus_stop_id, da.bus_number_id);
  }

  // bus_number_id → BusNumber 조회 맵
  const busById = new Map(busNumbers.map((b) => [b.id, b]));

  // 활성 정류장 목록 — 요일별 배정 sort_order 우선, 배정 없는 정류장은 전역 sort_order 폴백
  const dayAssignmentSortMap = new Map(dayAssignments.map((da) => [da.bus_stop_id, da.sort_order]));
  const activeStops = stops
    .filter((s) => s.is_active)
    .sort((a, b) => {
      const sa = dayAssignmentSortMap.get(a.id) ?? a.sort_order;
      const sb = dayAssignmentSortMap.get(b.id) ?? b.sort_order;
      return sa - sb;
    });

  // 정류장을 버스별로 그룹핑:
  //   busId → BusStop[]
  //   null (미배정) → BusStop[]
  const stopsByBus = new Map<string | null, BusStop[]>();
  stopsByBus.set(null, []);
  for (const bus of busNumbers) {
    stopsByBus.set(bus.id, []);
  }
  for (const stop of activeStops) {
    const busId = stopToBusMap.get(stop.id) ?? null;
    if (!stopsByBus.has(busId)) stopsByBus.set(busId, []);
    stopsByBus.get(busId)!.push(stop);
  }

  // 로컬 배정: stop_id → BusDefaultAssignment[]
  const assignedByStop = new Map<string, BusDefaultAssignment[]>();
  // 정류장 없이 배정된 학생 (stop_id null)
  const assignedNoStop: BusDefaultAssignment[] = [];
  for (const a of localAssignments) {
    if (a.bus_stop_id) {
      if (!assignedByStop.has(a.bus_stop_id)) assignedByStop.set(a.bus_stop_id, []);
      assignedByStop.get(a.bus_stop_id)!.push(a);
    } else {
      assignedNoStop.push(a);
    }
  }

  // 다른 시간대 배정 학생 ID Set
  const otherSlotAssignedIds = new Set(otherSlotAssigned.map((a) => a.student_profile_id));

  // 미배정 학생 (현재 시간대 배정 + 다른 시간대 배정 모두 제외)
  const assignedIds = new Set(localAssignments.map((a) => a.student_profile_id));
  const filterStudent = (s: StudentItem) => {
    if (assignedIds.has(s.profile_id)) return false;
    if (otherSlotAssignedIds.has(s.profile_id)) return false;
    if (groupFilter !== "전체" && s.group_label !== groupFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return s.korean_name?.toLowerCase().includes(q) || s.english_name?.toLowerCase().includes(q);
    }
    return true;
  };
  const unassigned = allStudents.filter(filterStudent);

  // 다른 시간대에 이미 배정된 학생 (검색/그룹 필터 적용)
  const otherSlotFiltered = otherSlotAssigned.filter((a) => {
    const student = allStudents.find((s) => s.profile_id === a.student_profile_id);
    if (!student) return false;
    if (groupFilter !== "전체" && student.group_label !== groupFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return student.korean_name?.toLowerCase().includes(q) || student.english_name?.toLowerCase().includes(q);
    }
    return true;
  });

  // 슬롯 ID → 라벨 맵
  const slotById = new Map(busTimeSlots.map((s) => [s.id, s]));

  // tooltip 위치 (fixed positioning)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // ── D&D 핸들러 ──────────────────────────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent, student: StudentItem) => {
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ studentProfileId: student.profile_id })
    );
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDropOnStop = (e: React.DragEvent, busStopId: string) => {
    e.preventDefault();
    e.currentTarget.classList.remove("border-emerald-400", "bg-emerald-50/30");
    try {
      const raw = e.dataTransfer.getData("application/json");
      const { studentProfileId } = JSON.parse(raw) as { studentProfileId: string };

      const slotId = timeSlotId || filteredSlots[0]?.id;
      if (!slotId) {
        toast.error("시간대를 먼저 설정해 주세요.");
        return;
      }

      const student = allStudents.find((s) => s.profile_id === studentProfileId);
      const existing = localAssignments.find((a) => a.student_profile_id === studentProfileId);

      // 같은 정류장이면 무시
      if (existing && existing.bus_stop_id === busStopId) return;

      const stopName = stops.find((s) => s.id === busStopId)?.name ?? null;
      // 해당 정류장에 배정된 버스 (파생 정보 — 저장 시에는 bus_number_id 생략)
      const derivedBusId = stopToBusMap.get(busStopId) ?? null;

      const newAssignment: BusDefaultAssignment = {
        id: existing?.id ?? `new_${studentProfileId}`,
        student_profile_id: studentProfileId,
        korean_name: student?.korean_name ?? existing?.korean_name ?? null,
        english_name: student?.english_name ?? existing?.english_name ?? null,
        age: student?.age ?? existing?.age ?? null,
        bus_number_id: derivedBusId,
        bus_stop_id: busStopId,
        bus_stop_name: stopName,
        bus_time_slot_id: existing?.bus_time_slot_id ?? slotId,
        estimated_time: existing?.estimated_time ?? null,
        note: existing?.note ?? null,
      };

      setLocalAssignments((prev) => [
        ...prev.filter((a) => a.student_profile_id !== studentProfileId),
        newAssignment,
      ]);
      setHasChanges(true);
    } catch { /* ignore */ }
  };

  const handleDropOnUnassigned = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove("border-emerald-400", "bg-emerald-50/30");
    try {
      const raw = e.dataTransfer.getData("application/json");
      const { studentProfileId } = JSON.parse(raw) as { studentProfileId: string };
      const exists = localAssignments.some((a) => a.student_profile_id === studentProfileId);
      if (!exists) return;

      setLocalAssignments((prev) => prev.filter((a) => a.student_profile_id !== studentProfileId));
      setHasChanges(true);
    } catch { /* ignore */ }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add("border-emerald-400", "bg-emerald-50/30");
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("border-emerald-400", "bg-emerald-50/30");
  };

  // ── 메모 핸들러 ────────────────────────────────────────────────────────────

  const openNoteEditor = (profileId: string, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const existing = localAssignments.find((a) => a.student_profile_id === profileId);
    setEditingNoteId(profileId);
    setEditingNoteValue(existing?.note ?? "");
    setNotePopupPos({ x: rect.left + rect.width / 2, y: rect.bottom });
  };

  const saveNote = () => {
    if (!editingNoteId) return;
    setLocalAssignments((prev) =>
      prev.map((a) =>
        a.student_profile_id === editingNoteId
          ? { ...a, note: editingNoteValue.trim() || null }
          : a
      )
    );
    setHasChanges(true);
    setEditingNoteId(null);
    setNotePopupPos(null);
  };

  const cancelNote = () => {
    setEditingNoteId(null);
    setNotePopupPos(null);
  };

  // ── 저장 / 되돌리기 ─────────────────────────────────────────────────────────

  const handleReset = () => {
    setLocalAssignments(serverAssignments);
    setHasChanges(false);
    cancelNote();
  };

  const handleSaveAll = async () => {
    setSaving(true);
    const result = await saveBulkBusDefaults(
      day,
      localAssignments.map((a) => ({
        student_profile_id: a.student_profile_id,
        bus_time_slot_id: a.bus_time_slot_id,
        bus_stop_id: a.bus_stop_id,
        note: a.note,
      }))
    );

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("저장되었습니다.");
      await refreshStops();
    }

    await fetchAll();
    setSaving(false);
  };

  const studentName = (s: { korean_name: string | null; english_name: string | null }) =>
    s.korean_name || s.english_name || "이름 없음";

  // ── 렌더: 학생 뱃지 ─────────────────────────────────────────────────────────

  const renderStudentBadge = (
    profileId: string,
    name: { korean_name: string | null; english_name: string | null },
    age: number | null | undefined,
    assigned?: boolean
  ) => {
    const ac = getAgeColor(age);
    const hasNote = assigned && localAssignments.find((a) => a.student_profile_id === profileId)?.note;
    const isAfterschool = afterschoolIds.has(profileId);
    return (
      <span
        key={profileId}
        draggable
        onDragStart={(e) =>
          handleDragStart(e, {
            profile_id: profileId,
            korean_name: name.korean_name,
            english_name: name.english_name,
            age,
          })
        }
        onClick={assigned ? (e) => { e.stopPropagation(); openNoteEditor(profileId, e); } : undefined}
        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md cursor-grab active:cursor-grabbing hover:shadow-sm select-none ${ac.bg} ${ac.text} border ${ac.border} ${assigned ? "cursor-pointer" : ""}`}
      >
        {isAfterschool && <span className="text-violet-500 text-[10px] leading-none">●</span>}
        {studentName(name)}
        {hasNote && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50 shrink-0" />}
      </span>
    );
  };

  // ── 렌더: 정류장 드롭존 ─────────────────────────────────────────────────────

  const renderStopZone = (stop: BusStop, derivedBusLabel: string | null) => {
    const students = [...(assignedByStop.get(stop.id) ?? [])].sort((a, b) => {
      const ageA = a.age ?? 99;
      const ageB = b.age ?? 99;
      if (ageA !== ageB) return ageA - ageB;
      return (a.korean_name ?? a.english_name ?? "").localeCompare(b.korean_name ?? b.english_name ?? "");
    });
    return (
      <div
        key={stop.id}
        className="border border-dashed border-slate-200 rounded-lg p-2 min-h-[52px] transition-colors"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDropOnStop(e, stop.id)}
      >
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-xs font-medium text-slate-600">
            📍 {stop.name}
          </span>
          {derivedBusLabel && (
            <span className="text-xs text-slate-400">({derivedBusLabel})</span>
          )}
          <span className="text-xs text-muted-foreground ml-auto">{students.length}명</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {students.map((a) =>
            renderStudentBadge(a.student_profile_id, a, a.age, true)
          )}
        </div>
      </div>
    );
  };

  // ── 렌더: 버스 섹션 ─────────────────────────────────────────────────────────

  const renderBusSection = (busId: string | null, stopsInBus: BusStop[]) => {
    const bus = busId ? busById.get(busId) : null;
    const headerLabel = bus ? `🚌 ${bus.label}` : "미배정 정류장";
    const headerBg = bus ? "bg-slate-50" : "bg-amber-50";
    const headerBorder = bus ? "border-slate-200" : "border-amber-200";
    const headerText = bus ? "text-slate-800" : "text-amber-700";
    const totalStudents = stopsInBus.reduce(
      (sum, s) => sum + (assignedByStop.get(s.id)?.length ?? 0),
      0
    );

    if (stopsInBus.length === 0) return null;

    return (
      <div
        key={busId ?? "__unassigned__"}
        className={`border ${headerBorder} rounded-xl overflow-hidden`}
      >
        <div className={`flex items-center justify-between px-4 py-3 ${headerBg} border-b ${headerBorder}`}>
          <span className={`font-semibold text-sm ${headerText}`}>{headerLabel}</span>
          <span className="text-xs text-muted-foreground">{totalStudents}명</span>
        </div>
        <div className="p-3 space-y-2">
          {stopsInBus.map((stop) =>
            renderStopZone(stop, bus ? bus.label : null)
          )}
        </div>
      </div>
    );
  };

  // ── 렌더: 메인 ──────────────────────────────────────────────────────────────

  // 표시할 버스 섹션: 배정된 버스 먼저 (label 순), 미배정 정류장 마지막
  const busIdsWithStops = busNumbers
    .filter((b) => (stopsByBus.get(b.id)?.length ?? 0) > 0)
    .sort((a, b) => a.label.localeCompare(b.label));
  const unassignedStops = stopsByBus.get(null) ?? [];

  const hasAnyStops = activeStops.length > 0;

  return (
    <div className="space-y-4">
      {/* 툴바 */}
      <div className="flex flex-wrap items-center gap-3">
        {/* 요일 */}
        <div className="flex gap-1">
          {DAYS.map((d) => (
            <button
              key={d.value}
              onClick={() => guardedSetFilter(() => setDay(d.value))}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                day === d.value
                  ? "bg-slate-800 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* 시간대 */}
        <select
          value={timeSlotId}
          onChange={(e) => guardedSetFilter(() => setTimeSlotId(e.target.value))}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
        >
          {filteredSlots.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label} ({s.time})
            </option>
          ))}
        </select>

        {/* 저장 / 되돌리기 */}
        {hasChanges && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-amber-600 font-medium">미저장 변경사항</span>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={handleReset}
              disabled={saving}
            >
              되돌리기
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleSaveAll}
              disabled={saving}
            >
              {saving ? "저장 중..." : "저장"}
            </Button>
          </div>
        )}
        {loading && <span className="text-sm text-muted-foreground animate-pulse">불러오는 중...</span>}
      </div>

      {/* 메인 그리드 */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 bg-white/70 z-10 flex items-center justify-center rounded-xl">
            <span className="text-sm text-slate-500 animate-pulse">불러오는 중...</span>
          </div>
        )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 왼쪽: 정류장별 학생 배정 (버스 그룹 헤더 포함) */}
        <div className="lg:col-span-2 space-y-4">
          {!hasAnyStops && (
            <p className="text-sm text-muted-foreground text-center py-8">
              정류장이 없습니다. &quot;호차/정류장 관리&quot; 탭에서 정류장을 추가해 주세요.
            </p>
          )}

          {/* 버스별 정류장 섹션 */}
          {busIdsWithStops.map((bus) =>
            renderBusSection(bus.id, stopsByBus.get(bus.id) ?? [])
          )}

          {/* 미배정 정류장 섹션 */}
          {unassignedStops.length > 0 && renderBusSection(null, unassignedStops)}
        </div>

        {/* 오른쪽: 미배정 학생 (sticky) */}
        <div className="lg:col-span-1">
          <div
            className="border border-slate-200 rounded-xl sticky top-4 transition-colors"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDropOnUnassigned}
          >
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 rounded-t-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800 text-sm">미배정 학생</span>
                <span className="text-xs text-muted-foreground">{unassigned.length}명</span>
              </div>

              {/* 그룹 필터 */}
              <div className="flex gap-1 flex-wrap">
                {GROUP_LABELS.map((g) => (
                  <button
                    key={g}
                    onClick={() => setGroupFilter(g)}
                    className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                      groupFilter === g
                        ? "bg-slate-700 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>

              {/* 이름 검색 */}
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="이름 검색..."
                className="h-8 text-sm"
              />
            </div>

            <div className="p-3 max-h-[40vh] overflow-y-auto">
              <div className="flex flex-wrap gap-1.5">
                {unassigned.map((s) =>
                  renderStudentBadge(s.profile_id, s, s.age)
                )}
                {unassigned.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2 w-full text-center">
                    {search || groupFilter !== "전체"
                      ? "검색 결과 없음"
                      : "모든 학생이 배정되었습니다"}
                  </p>
                )}
              </div>
            </div>

            {/* 다른 시간대에 이미 배정된 학생 */}
            {otherSlotFiltered.length > 0 && (
              <>
                <div className="px-4 py-2 bg-amber-50 border-t border-amber-200">
                  <span className="text-xs font-semibold text-amber-700">
                    다른 시간대 배정 ({otherSlotFiltered.length}명)
                  </span>
                </div>
                <div className="p-3 max-h-[20vh] overflow-y-auto bg-amber-50/30">
                  <div className="flex flex-wrap gap-1.5">
                    {[...otherSlotFiltered]
                      .sort((a, b) => {
                        const ageA = a.age ?? 99;
                        const ageB = b.age ?? 99;
                        if (ageA !== ageB) return ageA - ageB;
                        return (a.korean_name ?? a.english_name ?? "").localeCompare(b.korean_name ?? b.english_name ?? "");
                      })
                      .map((a) => {
                      const slot = slotById.get(a.bus_time_slot_id);
                      const slotLabel = slot ? `${slot.label} (${slot.time?.slice(0, 5)})` : "";
                      const stopLabel = a.bus_stop_name ?? "정류장 없음";
                      const ac = getAgeColor(a.age);
                      const isAfterschool = afterschoolIds.has(a.student_profile_id);
                      return (
                        <span
                          key={a.student_profile_id}
                          className="inline-flex items-center"
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoveredStudentId(a.student_profile_id);
                            setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
                          }}
                          onMouseLeave={() => {
                            setHoveredStudentId(null);
                            setTooltipPos(null);
                          }}
                        >
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md cursor-default opacity-70 ${ac.bg} ${ac.text} border ${ac.border}`}
                          >
                            {isAfterschool && <span className="text-violet-500 text-[10px] leading-none">●</span>}
                            {a.korean_name || a.english_name || "이름 없음"}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* Fixed tooltip — overflow 영향 안 받음 */}
      {hoveredStudentId && tooltipPos && (() => {
        const a = otherSlotAssigned.find((x) => x.student_profile_id === hoveredStudentId);
        if (!a) return null;
        const slot = slotById.get(a.bus_time_slot_id);
        const slotLabel = slot ? `${slot.label} (${slot.time?.slice(0, 5)})` : "";
        const stopLabel = a.bus_stop_name ?? "정류장 없음";
        return (
          <div
            className="fixed z-[100] px-2.5 py-1.5 text-xs bg-slate-800 text-white rounded-lg shadow-lg whitespace-nowrap pointer-events-none"
            style={{ left: tooltipPos.x, top: tooltipPos.y, transform: "translate(-50%, -100%) translateY(-6px)" }}
          >
            {slotLabel} · {stopLabel}
          </div>
        );
      })()}

      {/* 메모 편집 팝오버 */}
      {editingNoteId && notePopupPos && (
        <>
          {/* 배경 클릭 시 닫기 */}
          <div className="fixed inset-0 z-[99]" onClick={cancelNote} />
          <div
            className="fixed z-[100] bg-white border border-slate-200 rounded-lg shadow-xl p-3 w-64"
            style={{ left: notePopupPos.x, top: notePopupPos.y + 6, transform: "translateX(-50%)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700">
                {(() => {
                  const a = localAssignments.find((a) => a.student_profile_id === editingNoteId);
                  return a ? (a.korean_name || a.english_name || "") : "";
                })()} 메모
              </span>
              <button onClick={cancelNote} className="text-slate-400 hover:text-slate-600 text-sm leading-none">&times;</button>
            </div>
            <input
              autoFocus
              value={editingNoteValue}
              onChange={(e) => setEditingNoteValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveNote(); if (e.key === "Escape") cancelNote(); }}
              placeholder="메모 입력..."
              className="w-full h-8 px-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <div className="flex justify-end gap-1.5 mt-2">
              <button
                onClick={cancelNote}
                className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700"
              >
                취소
              </button>
              <button
                onClick={saveNote}
                className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                확인
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
