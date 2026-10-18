"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/overlays/ConfirmDialog";
import type { BusNumber, BusTimeSlot, BusStop, BusDefaultAssignment, BusStopDayAssignment } from "@/lib/types";
import { GROUP_TYPE_TO_LABEL } from "@/lib/constants/class";
import {
  listAfterschoolStudentIdsByDay,
} from "@/app/(admin)/admin/actions/afterschool-actions";
import {
  getBulkBusDefaults,
  saveBulkBusDefaults,
  listBusStopDayAssignments,
} from "@/app/(admin)/admin/actions/bus-actions";
import { getAgeColor } from "@/lib/ui/student-age-colors";
import { formatStudentName } from "@/lib/utils/student-name";
import { BUS_WEEKDAYS } from "@/lib/constants/bus";

const DAY_GROUPS = [
  { key: "mwf", label: "월수금", days: [1, 3, 5] },
  { key: "tt", label: "화목", days: [2, 4] },
] as const;

const dayLabel = (d: number) => BUS_WEEKDAYS.find((x) => x.value === d)?.label ?? "";

const GROUP_LABELS = ["전체", "유치부", "오후반"] as const;
type GroupFilter = (typeof GROUP_LABELS)[number];

type StudentItem = {
  profile_id: string;
  korean_name: string | null;
  english_name: string | null;
  age?: number | null;
  group_type?: string | null;
};

type StudentName = { korean_name: string | null; english_name: string | null; age: number | null };

// 현재 시간대의 (요일, 학생) 배정. 키 = `요일|학생`
type Assign = { studentId: string; day: number; busId: string | null; stopId: string | null; note: string | null };
const ak = (day: number, studentId: string) => `${day}|${studentId}`;

// 드래그 payload — fromDay 가 없으면 사이드바에서 끌어온 것
type DragData = { studentId: string; fromDay?: number };

const sameAssign = (a?: Assign, b?: Assign) =>
  !!a && !!b && a.busId === b.busId && a.stopId === b.stopId && (a.note ?? null) === (b.note ?? null);

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
  const [groupIdx, setGroupIdx] = useState(0);
  const [timeSlotId, setTimeSlotId] = useState(() => busTimeSlots[0]?.id ?? "");
  const days: readonly number[] = DAY_GROUPS[groupIdx].days;
  const stops = initialStops;

  const [slotRows, setSlotRows] = useState<BusStopDayAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("전체");
  const [onlyEmpty, setOnlyEmpty] = useState(false);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  // 서버 원본 vs 로컬 작업 사본 (현재 시간대, 보이는 요일)
  const [serverAssignments, setServerAssignments] = useState<Map<string, Assign>>(new Map());
  const [localAssignments, setLocalAssignments] = useState<Map<string, Assign>>(new Map());

  // 요일별 다른 시간대에 배정된 학생
  const [otherSlotByDay, setOtherSlotByDay] = useState<Map<number, BusDefaultAssignment[]>>(new Map());
  // 요일별 방과후 학생 ID
  const [afterschoolByDay, setAfterschoolByDay] = useState<Map<number, Set<string>>>(new Map());
  // 서버 응답의 이름 (allStudents 에 없는 학생 대비)
  const [fetchedNames, setFetchedNames] = useState<Map<string, StudentName>>(new Map());

  // fetch 버전 카운터 (race condition 방지)
  const fetchVersionRef = useRef(0);

  // 메모 편집 (키 = `요일|학생`)
  const [editingNoteKey, setEditingNoteKey] = useState<string | null>(null);
  const [editingNoteValue, setEditingNoteValue] = useState("");
  const [notePopupPos, setNotePopupPos] = useState<{ x: number; y: number } | null>(null);

  const fetchAll = useCallback(async () => {
    const version = ++fetchVersionRef.current;
    const dayList = [...days];
    setLoading(true);
    const [rows, defaultsByDay, asIdsByDay] = await Promise.all([
      listBusStopDayAssignments(dayList, timeSlotId),
      Promise.all(dayList.map((d) => getBulkBusDefaults(d))),
      Promise.all(dayList.map((d) => listAfterschoolStudentIdsByDay(d))),
    ]);
    // 이미 다른 필터로 변경된 경우 무시
    if (version !== fetchVersionRef.current) return;

    const server = new Map<string, Assign>();
    const other = new Map<number, BusDefaultAssignment[]>();
    const names = new Map<string, StudentName>();
    dayList.forEach((d, i) => {
      other.set(d, []);
      for (const a of defaultsByDay[i]) {
        names.set(a.student_profile_id, { korean_name: a.korean_name, english_name: a.english_name, age: a.age });
        if (a.bus_time_slot_id === timeSlotId) {
          server.set(ak(d, a.student_profile_id), {
            studentId: a.student_profile_id, day: d, busId: a.bus_number_id, stopId: a.bus_stop_id, note: a.note,
          });
        } else {
          other.get(d)!.push(a);
        }
      }
    });
    setSlotRows(rows);
    setServerAssignments(server);
    setLocalAssignments(new Map(server));
    setOtherSlotByDay(other);
    setFetchedNames(names);
    setAfterschoolByDay(new Map(dayList.map((d, i) => [d, new Set(asIdsByDay[i])])));
    setLoading(false);
  }, [days, timeSlotId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll();
  }, [fetchAll]);

  // ── 미저장 가드 ─────────────────────────────────────────────────────────────

  const isDayDirty = (day: number) => {
    const keys = new Set([...localAssignments.keys(), ...serverAssignments.keys()]);
    for (const k of keys) {
      if (Number(k.split("|")[0]) !== day) continue;
      const l = localAssignments.get(k);
      const s = serverAssignments.get(k);
      if (!l || !s || !sameAssign(l, s)) return true;
    }
    return false;
  };
  const hasChanges = days.some(isDayDirty);

  const [filterChangeConfirm, setFilterChangeConfirm] = useState<{ open: boolean; setter?: () => void }>({ open: false });

  const guardedSetFilter = (setter: () => void) => {
    if (hasChanges) {
      setFilterChangeConfirm({ open: true, setter });
      return;
    }
    setter();
  };

  function confirmFilterChange() {
    const setter = filterChangeConfirm.setter;
    setFilterChangeConfirm({ open: false });
    setLocalAssignments(new Map(serverAssignments));
    setter?.();
  }

  // ── 파생 데이터 ─────────────────────────────────────────────────────────────

  const allStudentMap = new Map(allStudents.map((s) => [s.profile_id, s]));
  const nameOf = (id: string): StudentName => {
    const s = allStudentMap.get(id);
    if (s) return { korean_name: s.korean_name, english_name: s.english_name, age: s.age ?? null };
    return fetchedNames.get(id) ?? { korean_name: null, english_name: null, age: null };
  };
  const byAgeName = (a: string, b: string) => {
    const na = nameOf(a), nb = nameOf(b);
    if ((na.age ?? 99) !== (nb.age ?? 99)) return (na.age ?? 99) - (nb.age ?? 99);
    return formatStudentName(na, { fallback: "" }).localeCompare(formatStudentName(nb, { fallback: "" }), "ko");
  };

  const stopNameMap = new Map(stops.map((s) => [s.id, s.name]));
  const busById = new Map(busNumbers.map((b) => [b.id, b]));
  const slotById = new Map(busTimeSlots.map((s) => [s.id, s]));

  // (요일, 호차) 의 정류장 — 운행 순서, 같으면 정류장 목록 순서 (마스터 편집기 cellStops 와 동일)
  const stopIndex = new Map(stops.map((s, i) => [s.id, i]));
  const cellStops = (day: number, busId: string) =>
    slotRows
      .filter((r) => r.day_of_week === day && r.bus_number_id === busId)
      .sort((a, b) => a.sort_order - b.sort_order || (stopIndex.get(a.bus_stop_id) ?? 0) - (stopIndex.get(b.bus_stop_id) ?? 0))
      .map((r) => r.bus_stop_id);
  const servedKeys = new Set(slotRows.map((r) => `${r.day_of_week}|${r.bus_stop_id}|${r.bus_number_id}`));

  // `요일|정류장|호차` → 학생 ID[] / 표에 못 놓이는 배정 (호차 미지정·운행 안 함·정류장 없음)
  const studentsByStop = new Map<string, string[]>();
  const unplaced: Assign[] = [];
  for (const a of localAssignments.values()) {
    const key = `${a.day}|${a.stopId}|${a.busId}`;
    if (!a.stopId || !a.busId || !servedKeys.has(key)) {
      unplaced.push(a);
      continue;
    }
    studentsByStop.set(key, [...(studentsByStop.get(key) ?? []), a.studentId]);
  }
  const invalid = (a: Assign) => !!a.stopId && !servedKeys.has(`${a.day}|${a.stopId}|${a.busId}`);

  const otherSlotOf = (day: number, studentId: string) =>
    otherSlotByDay.get(day)?.find((a) => a.student_profile_id === studentId);

  // 사이드바 학생 상태: ● 이 시간대 배정 / ○ 어느 시간대에도 없음 / null 다른 시간대 (아래 섹션에 표시)
  const dayStatus = (day: number, studentId: string): "on" | "off" | null => {
    if (localAssignments.has(ak(day, studentId))) return "on";
    if (otherSlotOf(day, studentId)) return null;
    return "off";
  };

  const matchesFilter = (s: { korean_name: string | null; english_name: string | null; group_type?: string | null }) => {
    if (groupFilter !== "전체" && (GROUP_TYPE_TO_LABEL[s.group_type ?? ""] ?? "") !== groupFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return !!(s.korean_name?.toLowerCase().includes(q) || s.english_name?.toLowerCase().includes(q));
    }
    return true;
  };

  const sidebarStudents = allStudents
    .filter(matchesFilter)
    .filter((s) => {
      const st = days.map((d) => dayStatus(d, s.profile_id));
      // 보이는 요일 모두 다른 시간대 배정이면 목록에서 제외 (아래 "다른 시간대 배정" 섹션)
      if (st.every((x) => x === null)) return false;
      return !onlyEmpty || st.includes("off");
    })
    .sort((a, b) => formatStudentName(a, { fallback: "" }).localeCompare(formatStudentName(b, { fallback: "" }), "ko"));

  const otherSlotFiltered = days.map((d) => ({
    day: d,
    list: (otherSlotByDay.get(d) ?? [])
      .filter((a) => {
        const s = allStudentMap.get(a.student_profile_id);
        return !!s && matchesFilter(s);
      })
      .sort((a, b) => byAgeName(a.student_profile_id, b.student_profile_id)),
  })).filter((x) => x.list.length > 0);

  // ── D&D ─────────────────────────────────────────────────────────────────────

  const startDrag = (e: React.DragEvent, data: DragData) => {
    e.dataTransfer.setData("application/json", JSON.stringify(data));
    e.dataTransfer.effectAllowed = "move";
  };

  const readDrag = (e: React.DragEvent): DragData | null => {
    try {
      return JSON.parse(e.dataTransfer.getData("application/json")) as DragData;
    } catch {
      return null;
    }
  };

  const dragProps = (target: string) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOverTarget(target); },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverTarget((t) => (t === target ? null : t));
    },
  });

  // 정류장에 드롭: 그 요일·시간대에 (호차, 정류장) 으로 배정. 다른 요일 칩이면 원래 요일은 해제.
  const handleDropOnStop = (e: React.DragEvent, day: number, busId: string, stopId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(null);
    const data = readDrag(e);
    if (!data?.studentId) return;
    const { studentId, fromDay } = data;

    const other = otherSlotOf(day, studentId);
    if (other) {
      const slot = slotById.get(other.bus_time_slot_id);
      toast.error(
        `${formatStudentName(nameOf(studentId))} 학생은 ${dayLabel(day)}요일 다른 시간대(${slot?.label ?? ""})에 배정되어 있습니다.`
      );
      return;
    }

    const next = new Map(localAssignments);
    const src = fromDay !== undefined && fromDay !== day ? next.get(ak(fromDay, studentId)) : undefined;
    if (src) next.delete(ak(fromDay!, studentId));
    const cur = next.get(ak(day, studentId));
    if (!src && cur && cur.busId === busId && cur.stopId === stopId) return;
    next.set(ak(day, studentId), { studentId, day, busId, stopId, note: cur?.note ?? src?.note ?? null });
    setLocalAssignments(next);
  };

  const removeAssign = (day: number, studentId: string) => {
    setLocalAssignments((prev) => {
      const next = new Map(prev);
      next.delete(ak(day, studentId));
      return next;
    });
  };

  const handleDropOnSidebar = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverTarget(null);
    const data = readDrag(e);
    if (data?.fromDay !== undefined) removeAssign(data.fromDay, data.studentId);
  };

  // ── 메모 ────────────────────────────────────────────────────────────────────

  const openNoteEditor = (key: string, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setEditingNoteKey(key);
    setEditingNoteValue(localAssignments.get(key)?.note ?? "");
    setNotePopupPos({ x: rect.left + rect.width / 2, y: rect.bottom });
  };

  const cancelNote = () => {
    setEditingNoteKey(null);
    setNotePopupPos(null);
  };

  const saveNote = () => {
    if (!editingNoteKey) return;
    const key = editingNoteKey;
    setLocalAssignments((prev) => {
      const cur = prev.get(key);
      if (!cur) return prev;
      return new Map(prev).set(key, { ...cur, note: editingNoteValue.trim() || null });
    });
    cancelNote();
  };

  // ── 저장 / 되돌리기 ─────────────────────────────────────────────────────────

  const handleReset = () => {
    setLocalAssignments(new Map(serverAssignments));
    cancelNote();
  };

  const handleSaveAll = async () => {
    const dirtyDays = days.filter(isDayDirty);
    const dayRows = (d: number) => [...localAssignments.values()].filter((a) => a.day === d);
    if (dirtyDays.some((d) => dayRows(d).some(invalid))) {
      toast.error("호차·정류장 확인이 필요한 학생이 있습니다. 표의 정류장으로 옮기거나 제거해 주세요.");
      return;
    }
    setSaving(true);
    const errors: string[] = [];
    for (const d of dirtyDays) {
      const r = await saveBulkBusDefaults(
        d,
        timeSlotId,
        dayRows(d).map((a) => ({
          student_profile_id: a.studentId,
          bus_stop_id: a.stopId,
          bus_number_id: a.busId,
          note: a.note,
        }))
      );
      if (r.error) errors.push(`${dayLabel(d)}: ${r.error}`);
    }
    if (errors.length) toast.error(`저장 실패 — ${errors.join(", ")}`);
    else toast.success("저장되었습니다.");
    await fetchAll();
    setSaving(false);
  };

  // ── 렌더: 학생 칩 ───────────────────────────────────────────────────────────

  const renderChip = (day: number, studentId: string) => {
    const key = ak(day, studentId);
    const name = nameOf(studentId);
    const ac = getAgeColor(name.age);
    const note = localAssignments.get(key)?.note;
    const isAfterschool = afterschoolByDay.get(day)?.has(studentId);
    return (
      <span
        key={key}
        draggable
        onDragStart={(e) => startDrag(e, { studentId, fromDay: day })}
        onClick={(e) => { e.stopPropagation(); openNoteEditor(key, e); }}
        title={note ?? undefined}
        className={`inline-flex items-center gap-1 pl-2 pr-1 py-1 text-xs font-medium rounded-md cursor-grab active:cursor-grabbing hover:shadow-sm select-none ${ac.bg} ${ac.text} border ${ac.border}`}
      >
        {isAfterschool && <span className="text-violet-500 text-xs leading-none">●</span>}
        {formatStudentName(name)}
        {note && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50 shrink-0" />}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); removeAssign(day, studentId); }}
          className="opacity-50 hover:opacity-100 hover:text-red-600 px-0.5 leading-none"
          aria-label={`${formatStudentName(name)} 제거`}
        >
          ×
        </button>
      </span>
    );
  };

  // ── 렌더: 메인 ──────────────────────────────────────────────────────────────

  const editingAssign = editingNoteKey ? localAssignments.get(editingNoteKey) : undefined;

  return (
    <div className="space-y-4">
      {/* 툴바: 시간대 · 요일 묶음 · 그룹 · 저장 */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={timeSlotId}
          onChange={(e) => { const id = e.target.value; guardedSetFilter(() => setTimeSlotId(id)); }}
          className="h-8 text-xs border border-slate-200 rounded px-2 bg-white"
        >
          {busTimeSlots.map((slot) => (
            <option key={slot.id} value={slot.id}>
              {slot.label} ({slot.time.slice(0, 5)})
            </option>
          ))}
        </select>

        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          {DAY_GROUPS.map((g, i) => (
            <button
              key={g.key}
              type="button"
              onClick={() => { if (i !== groupIdx) guardedSetFilter(() => setGroupIdx(i)); }}
              className={`px-3.5 py-1.5 text-sm font-medium transition-colors ${
                groupIdx === i ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1">
          {GROUP_LABELS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroupFilter(g)}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                groupFilter === g ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        {loading && <span className="text-sm text-muted-foreground animate-pulse">불러오는 중...</span>}

        <div className="flex items-center gap-2 ml-auto">
          {hasChanges && (
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleReset} disabled={saving}>
              되돌리기
            </Button>
          )}
          <Button
            size="sm"
            className={`h-8 ${hasChanges ? "bg-blue-600 hover:bg-blue-700" : ""}`}
            onClick={handleSaveAll}
            disabled={saving || !hasChanges}
          >
            {saving ? "저장 중..." : hasChanges ? "저장" : "저장됨"}
          </Button>
        </div>
      </div>

      {hasChanges && (
        <p className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded border border-amber-200">
          저장하지 않은 변경사항이 있습니다.
        </p>
      )}

      {/* 표에 놓을 수 없는 배정 — 호차 미지정 / 이 시간대에 그 호차가 운행 안 함 / 정류장 없음 */}
      {unplaced.length > 0 && (
        <div className="border border-amber-300 bg-amber-50 rounded-xl p-3 space-y-2">
          <p className="text-sm font-semibold text-amber-800">
            ⚠ 확인 필요 ({unplaced.length}명) — 표의 정류장으로 드래그해 다시 배정하거나 × 로 제거하세요.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {[...unplaced].sort((a, b) => a.day - b.day || byAgeName(a.studentId, b.studentId)).map((a) => (
              <div key={ak(a.day, a.studentId)} className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-amber-800">{dayLabel(a.day)}</span>
                {renderChip(a.day, a.studentId)}
                <span className="text-xs text-amber-700">
                  📍 {a.stopId ? (stopNameMap.get(a.stopId) ?? "(삭제됨)") : "정류장 없음"}
                  {a.stopId && (a.busId ? ` · ${busById.get(a.busId)?.label ?? ""} 운행 안 함` : " · 호차 미지정")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-4 items-start">
        {/* 왼쪽: 학생 목록 (sticky) — 여기로 드롭하면 배정 해제 */}
        <div
          className={`w-60 shrink-0 rounded-lg border p-3 space-y-2 sticky top-4 transition-colors ${
            dragOverTarget === "sidebar" ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-slate-50"
          }`}
          {...dragProps("sidebar")}
          onDrop={handleDropOnSidebar}
        >
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-600">학생</h4>
            <span className="text-xs text-muted-foreground">{sidebarStudents.length}명</span>
          </div>
          <Input
            placeholder="이름 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 text-xs"
          />
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" checked={onlyEmpty} onChange={(e) => setOnlyEmpty(e.target.checked)} />
            빈 요일 있는 학생만
          </label>
          <div className="space-y-1 max-h-[55vh] overflow-y-auto">
            {sidebarStudents.length === 0 && (
              <p className="text-xs text-slate-400 py-4 text-center">
                {search || groupFilter !== "전체" || onlyEmpty ? "검색 결과 없음" : "학생 없음"}
              </p>
            )}
            {sidebarStudents.map((s) => {
              const ac = getAgeColor(s.age);
              const isAfterschool = days.some((d) => afterschoolByDay.get(d)?.has(s.profile_id));
              return (
                <div
                  key={s.profile_id}
                  draggable
                  onDragStart={(e) => startDrag(e, { studentId: s.profile_id })}
                  className="flex items-center gap-2 px-2 py-1 rounded border bg-white border-slate-200 cursor-grab active:cursor-grabbing hover:border-slate-300"
                >
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded ${ac.bg} ${ac.text} truncate`}>
                    {isAfterschool && <span className="text-violet-500 leading-none">●</span>}
                    {formatStudentName(s)}
                  </span>
                  <span className="ml-auto flex gap-1.5 text-[11px] whitespace-nowrap">
                    {days.map((d) => {
                      const st = dayStatus(d, s.profile_id);
                      return (
                        <span
                          key={d}
                          className={st === "on" ? "text-blue-600" : st === "off" ? "text-orange-400" : "text-slate-300"}
                          title={st === null ? "다른 시간대 배정" : undefined}
                        >
                          {dayLabel(d)}{st === "on" ? "●" : st === "off" ? "○" : "–"}
                        </span>
                      );
                    })}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-400">● 이 시간대 배정 · ○ 없음 · – 다른 시간대</p>

          {/* 다른 시간대에 이미 배정된 학생 (요일별) */}
          {otherSlotFiltered.length > 0 && (
            <div className="border-t border-amber-200 pt-2 space-y-1.5 max-h-[25vh] overflow-y-auto">
              <span className="text-xs font-semibold text-amber-700">다른 시간대 배정</span>
              {otherSlotFiltered.map(({ day, list }) => (
                <div key={day} className="space-y-1">
                  <div className="text-[11px] font-semibold text-slate-500">{dayLabel(day)} ({list.length}명)</div>
                  <div className="flex flex-wrap gap-1">
                    {list.map((a) => {
                      const ac = getAgeColor(a.age);
                      const slot = slotById.get(a.bus_time_slot_id);
                      return (
                        <span
                          key={a.student_profile_id}
                          title={`${slot ? `${slot.label} (${slot.time?.slice(0, 5)})` : ""} · ${a.bus_stop_name ?? "정류장 없음"}`}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded-md cursor-default opacity-70 ${ac.bg} ${ac.text} border ${ac.border}`}
                        >
                          {afterschoolByDay.get(day)?.has(a.student_profile_id) && <span className="text-violet-500 leading-none">●</span>}
                          {formatStudentName(a)}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 오른쪽: 호차 × 요일 표 */}
        <div className="flex-1 min-w-0 overflow-x-auto relative">
          {loading && (
            <div className="absolute inset-0 bg-white/70 z-10 flex items-center justify-center">
              <span className="text-sm text-slate-500 animate-pulse">불러오는 중...</span>
            </div>
          )}
          {busNumbers.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">등록된 호차가 없습니다.</p>
          ) : (
            <table className="w-full border-collapse text-xs" style={{ minWidth: 80 + days.length * 260 }}>
              <thead>
                <tr className="border-b-2 border-slate-300">
                  <th className="w-20 py-2 px-2 text-left bg-slate-100 text-sm font-bold">호차</th>
                  {days.map((d) => (
                    <th key={d} className="py-2 px-2 text-center bg-slate-100 text-sm font-bold border-l border-slate-200">
                      {dayLabel(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {busNumbers.map((bus) => (
                  <tr key={bus.id} className="border-b border-slate-200 align-top">
                    <td className="py-2 px-2 bg-slate-50 whitespace-nowrap">
                      <div className="font-semibold text-slate-700">{bus.label}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {days.reduce((sum, d) => sum + cellStops(d, bus.id).reduce((n, st) => n + (studentsByStop.get(`${d}|${st}|${bus.id}`)?.length ?? 0), 0), 0)}명
                      </div>
                    </td>
                    {days.map((d) => {
                      const list = cellStops(d, bus.id);
                      return (
                        <td key={d} className="p-1.5 border-l border-slate-200 bg-white">
                          <div className="space-y-1 min-h-[40px]">
                            {list.map((stopId) => {
                              const key = `${d}|${stopId}|${bus.id}`;
                              const students = [...(studentsByStop.get(key) ?? [])].sort(byAgeName);
                              return (
                                <div
                                  key={stopId}
                                  {...dragProps(key)}
                                  onDrop={(e) => handleDropOnStop(e, d, bus.id, stopId)}
                                  className={`rounded border border-dashed p-1.5 transition-colors ${
                                    dragOverTarget === key ? "border-emerald-400 bg-emerald-50" : "border-slate-200"
                                  }`}
                                >
                                  <div className="text-xs font-medium text-slate-600 mb-1">
                                    {stopNameMap.get(stopId) ?? "(삭제됨)"}{" "}
                                    <span className="text-slate-400 font-normal">({students.length})</span>
                                  </div>
                                  {students.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">{students.map((id) => renderChip(d, id))}</div>
                                  ) : (
                                    <p className="text-[11px] text-slate-300">여기에 학생을 드래그하세요</p>
                                  )}
                                </div>
                              );
                            })}
                            {list.length === 0 && (
                              <p className="text-[11px] text-slate-300 text-center py-2">정류장 없음 — 마스터 탭에서 설정</p>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 메모 편집 팝오버 */}
      {editingAssign && notePopupPos && (
        <>
          {/* 배경 클릭 시 닫기 */}
          <div className="fixed inset-0 z-[99]" onClick={cancelNote} />
          <div
            className="fixed z-[100] bg-white border border-slate-200 rounded-lg shadow-xl p-3 w-64"
            style={{ left: notePopupPos.x, top: notePopupPos.y + 6, transform: "translateX(-50%)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700">
                {formatStudentName(nameOf(editingAssign.studentId), { fallback: "" })} {dayLabel(editingAssign.day)}요일 메모
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
              <button onClick={cancelNote} className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700">
                취소
              </button>
              <button onClick={saveNote} className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">
                확인
              </button>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={filterChangeConfirm.open}
        variant="primary"
        title="저장하지 않은 변경사항이 있습니다"
        description="계속하면 지금까지의 변경이 사라집니다. 계속하시겠습니까?"
        confirmLabel="계속"
        onConfirm={confirmFilterChange}
        onCancel={() => setFilterChangeConfirm({ open: false })}
      />
    </div>
  );
}
