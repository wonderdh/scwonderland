"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { StudentBusDefault, BusTimeSlot, BusStop } from "@/lib/types";
import {
  getStudentBusDefaults,
  upsertStudentBusDefault,
  deleteStudentBusDefaults,
  listBusTimeSlots,
  listBusStops,
  getStudentAfterschoolDetail,
} from "../../actions";
import { LoadingState } from "@/components/LoadingState";
import { formatTime } from "@/lib/bus/utils";

const DAY_NAMES = ["", "월", "화", "수", "목", "금"];
const DIR_LABEL = { pickup: "등원", dropoff: "하원" } as const;

// 방과후 등록 상태별 카드 색상
type AfterschoolStatus = "none" | "first_only" | "both";
const AFTERSCHOOL_STYLES: Record<AfterschoolStatus, { border: string; bg: string; badge: string; label: string }> = {
  none: { border: "", bg: "", badge: "", label: "" },
  first_only: { border: "border-violet-300", bg: "bg-violet-50/60", badge: "bg-violet-100 text-violet-700", label: "방과후 1교시" },
  both: { border: "border-indigo-300", bg: "bg-indigo-50/60", badge: "bg-indigo-100 text-indigo-700", label: "방과후 1·2교시" },
};

export function StudentBusTab({ studentProfileId }: { studentProfileId: string }) {
  const router = useRouter();
  const [defaults, setDefaults] = useState<StudentBusDefault[]>([]);
  const [busTimeSlots, setBusTimeSlots] = useState<BusTimeSlot[]>([]);
  const [busStops, setBusStops] = useState<BusStop[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // 방과후 등록 상태 (요일 → 상태)
  const [afterschoolMap, setAfterschoolMap] = useState<Map<number, AfterschoolStatus>>(new Map());

  // 서브탭
  const [activeTab, setActiveTab] = useState<string>("combined");

  // 편집 상태 (통합: 개별+일괄)
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [checkedDays, setCheckedDays] = useState<Set<number>>(new Set());
  const [editSlotId, setEditSlotId] = useState("");
  const [editStopId, setEditStopId] = useState("");
  const [editNote, setEditNote] = useState("");

  // 삭제 확인
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [d, ts, stops, afterschool] = await Promise.all([
      getStudentBusDefaults(studentProfileId),
      listBusTimeSlots(),
      listBusStops(),
      getStudentAfterschoolDetail(studentProfileId),
    ]);
    setDefaults(d);
    setBusTimeSlots(ts);
    setBusStops([...stops].sort((a, b) => a.name.localeCompare(b.name, "ko")));

    // 방과후 맵 구성
    const asMap = new Map<number, AfterschoolStatus>();
    for (const e of afterschool) {
      asMap.set(e.day_of_week, e.second_period ? "both" : "first_only");
    }
    setAfterschoolMap(asMap);

    setLoading(false);
  }, [studentProfileId]);

  useEffect(() => {
    load();
  }, [load]);

  const currentDirection = activeTab === "dropoff" ? "dropoff" : "pickup";

  function getDefault(day: number, dir: "pickup" | "dropoff") {
    return defaults.find((d) => d.day_of_week === day && d.direction === dir);
  }

  function openEdit(day: number, dir?: "pickup" | "dropoff") {
    const direction = dir ?? currentDirection;
    if (dir && activeTab === "combined") {
      setActiveTab(dir);
    }
    setEditingDay(day);
    setCheckedDays(new Set([day]));
    const existing = getDefault(day, direction);
    setEditSlotId(existing?.bus_time_slot_id ?? "");
    setEditStopId(existing?.bus_stop_id ?? "");
    setEditNote(existing?.note ?? "");
    setError("");
  }

  function closeEdit() {
    setEditingDay(null);
    setCheckedDays(new Set());
    setEditSlotId("");
    setEditStopId("");
    setEditNote("");
    setError("");
  }

  function toggleDay(day: number) {
    setCheckedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  async function handleSave() {
    if (checkedDays.size === 0) {
      setError("요일을 하나 이상 선택해 주세요.");
      return;
    }
    if (!editSlotId) {
      setError("시간대를 선택해 주세요.");
      return;
    }
    setSaving(true);
    setError("");
    const dir = currentDirection;
    for (const day of checkedDays) {
      const result = await upsertStudentBusDefault(
        studentProfileId,
        day,
        dir,
        editSlotId,
        undefined,
        editNote || undefined,
        editStopId || undefined
      );
      if (result.error) {
        setError(result.error);
        setSaving(false);
        return;
      }
    }
    closeEdit();
    await load();
    router.refresh();
    setSaving(false);
  }

  async function handleDelete() {
    const dir = currentDirection;
    const ids = Array.from(checkedDays)
      .map((day) => getDefault(day, dir)?.id)
      .filter((id): id is string => !!id);
    if (ids.length === 0) return;
    setSaving(true);
    setError("");
    const result = await deleteStudentBusDefaults(ids);
    if (result.error) {
      setError(result.error);
    } else {
      closeEdit();
      await load();
      router.refresh();
    }
    setSaving(false);
    setDeleteConfirmOpen(false);
  }

  // 체크된 요일 중 기존 데이터가 있는 개수
  const checkedWithData = Array.from(checkedDays).filter(
    (day) => !!getDefault(day, currentDirection)
  ).length;

  if (loading) return <LoadingState className="py-4" />;

  const pickupSlots = busTimeSlots.filter((s) => s.direction === "pickup");
  const dropoffSlots = busTimeSlots.filter((s) => s.direction === "dropoff");

  if (busTimeSlots.length === 0) {
    return (
      <p className="text-sm text-slate-400 py-4">
        시간대가 등록되지 않았습니다. 먼저{" "}
        <a href="/admin/bus?tab=numbers" className="text-blue-500 underline">승하차 관리</a>
        에서 설정해 주세요.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); closeEdit(); }}>
        <TabsList variant="line">
          <TabsTrigger value="combined">종합</TabsTrigger>
          <TabsTrigger value="pickup">등원</TabsTrigger>
          <TabsTrigger value="dropoff">하원</TabsTrigger>
        </TabsList>

        {error && (
          <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded">{error}</p>
        )}

        {/* 등원 탭 */}
        <TabsContent value="pickup">
          <DirectionGrid
            direction="pickup"
            defaults={defaults}
            editingDay={editingDay}
            afterschoolMap={afterschoolMap}
            onCellClick={(day) => openEdit(day)}
          />
          {editingDay !== null && (
            <EditPanel
              direction="pickup"
              checkedDays={checkedDays}
              onToggleDay={toggleDay}
              slots={pickupSlots}
              stops={busStops}
              slotId={editSlotId}
              stopId={editStopId}
              note={editNote}
              onSlotChange={setEditSlotId}
              onStopChange={setEditStopId}
              onNoteChange={setEditNote}
              onSave={handleSave}
              onCancel={closeEdit}
              onDelete={checkedWithData > 0 ? () => setDeleteConfirmOpen(true) : undefined}
              saving={saving}
            />
          )}
        </TabsContent>

        {/* 하원 탭 */}
        <TabsContent value="dropoff">
          <DirectionGrid
            direction="dropoff"
            defaults={defaults}
            editingDay={editingDay}
            afterschoolMap={afterschoolMap}
            onCellClick={(day) => openEdit(day)}
          />
          {editingDay !== null && (
            <EditPanel
              direction="dropoff"
              checkedDays={checkedDays}
              onToggleDay={toggleDay}
              slots={dropoffSlots}
              stops={busStops}
              slotId={editSlotId}
              stopId={editStopId}
              note={editNote}
              onSlotChange={setEditSlotId}
              onStopChange={setEditStopId}
              onNoteChange={setEditNote}
              onSave={handleSave}
              onCancel={closeEdit}
              onDelete={checkedWithData > 0 ? () => setDeleteConfirmOpen(true) : undefined}
              saving={saving}
            />
          )}
        </TabsContent>

        {/* 종합 탭 */}
        <TabsContent value="combined">
          <CombinedGrid
            defaults={defaults}
            afterschoolMap={afterschoolMap}
            onCellClick={(day, dir) => openEdit(day, dir)}
          />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="승하차 설정 삭제"
        description={`선택한 ${checkedWithData}개 요일의 ${DIR_LABEL[currentDirection]} 설정을 삭제하시겠습니까?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
        disabled={saving}
      />
    </div>
  );
}

/* ── 방향별 카드 그리드 ── */

function DirectionGrid({
  direction,
  defaults,
  editingDay,
  afterschoolMap,
  onCellClick,
}: {
  direction: "pickup" | "dropoff";
  defaults: StudentBusDefault[];
  editingDay: number | null;
  afterschoolMap: Map<number, AfterschoolStatus>;
  onCellClick: (day: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
      {[1, 2, 3, 4, 5].map((day) => {
        const def = defaults.find((d) => d.day_of_week === day && d.direction === direction);
        const isEditing = editingDay === day;
        const asStatus = afterschoolMap.get(day) ?? "none";
        return (
          <DayCell
            key={day}
            day={day}
            data={def}
            isEditing={isEditing}
            afterschool={asStatus}
            onClick={() => onCellClick(day)}
          />
        );
      })}
    </div>
  );
}

/* ── 요일 카드 (단일 방향) ── */

function DayCell({
  day,
  data,
  isEditing,
  afterschool,
  onClick,
}: {
  day: number;
  data: StudentBusDefault | undefined;
  isEditing: boolean;
  afterschool: AfterschoolStatus;
  onClick: () => void;
}) {
  const hasData = !!data;
  const asStyle = AFTERSCHOOL_STYLES[afterschool];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-lg border p-3 transition-all w-full min-h-[80px] ${
        isEditing
          ? "ring-2 ring-blue-500 border-blue-300 bg-blue-50/50"
          : hasData
            ? `${afterschool !== "none" ? `${asStyle.border} ${asStyle.bg}` : "border-slate-200 bg-white"} hover:shadow-sm`
            : `border-dashed ${afterschool !== "none" ? `${asStyle.border} ${asStyle.bg}` : "border-slate-300 bg-slate-50/50"} hover:border-slate-400`
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-xs font-semibold text-slate-500">{DAY_NAMES[day]}</span>
        {afterschool !== "none" && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${asStyle.badge}`}>
            {asStyle.label}
          </span>
        )}
      </div>
      {hasData ? (
        <div className="space-y-0.5">
          <div className="text-sm font-medium text-slate-800">
            {data.time_slot_time ? formatTime(data.time_slot_time) : "-"}
            {data.time_slot_label && (
              <span className="text-xs text-slate-400 ml-1">{data.time_slot_label}</span>
            )}
          </div>
          {data.bus_label && (
            <div className="text-xs text-slate-600">{data.bus_label}</div>
          )}
          {data.bus_stop_name && (
            <div className="text-xs text-slate-500">{data.bus_stop_name}</div>
          )}
          {data.note && (
            <div className="text-xs text-slate-400 truncate">{data.note}</div>
          )}
        </div>
      ) : (
        <div className="text-xs text-slate-400">미설정</div>
      )}
    </button>
  );
}

/* ── 종합 탭 그리드 ── */

function CombinedGrid({
  defaults,
  afterschoolMap,
  onCellClick,
}: {
  defaults: StudentBusDefault[];
  afterschoolMap: Map<number, AfterschoolStatus>;
  onCellClick: (day: number, dir: "pickup" | "dropoff") => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
      {[1, 2, 3, 4, 5].map((day) => {
        const pickup = defaults.find((d) => d.day_of_week === day && d.direction === "pickup");
        const dropoff = defaults.find((d) => d.day_of_week === day && d.direction === "dropoff");
        const asStatus = afterschoolMap.get(day) ?? "none";
        const asStyle = AFTERSCHOOL_STYLES[asStatus];
        return (
          <div key={day} className={`rounded-lg border overflow-hidden ${asStatus !== "none" ? `${asStyle.border} ${asStyle.bg}` : "border-slate-200 bg-white"}`}>
            <div className="flex items-center gap-1.5 px-3 pt-2 pb-1">
              <span className="text-xs font-semibold text-slate-500">{DAY_NAMES[day]}</span>
              {asStatus !== "none" && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${asStyle.badge}`}>
                  {asStyle.label}
                </span>
              )}
            </div>
            {/* 등원 */}
            <button
              type="button"
              onClick={() => onCellClick(day, "pickup")}
              className="w-full text-left px-3 py-1.5 hover:bg-green-50/50 transition-colors"
            >
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                등원
              </span>
              {pickup ? (
                <div className="text-xs text-slate-600 mt-0.5">
                  {pickup.time_slot_time ? formatTime(pickup.time_slot_time) : "-"}
                  {pickup.bus_label && <span className="ml-1">{pickup.bus_label}</span>}
                  {pickup.bus_stop_name && <span className="text-slate-400 ml-1">{pickup.bus_stop_name}</span>}
                </div>
              ) : (
                <div className="text-xs text-slate-300 mt-0.5">-</div>
              )}
            </button>
            <div className="border-t border-slate-100" />
            {/* 하원 */}
            <button
              type="button"
              onClick={() => onCellClick(day, "dropoff")}
              className="w-full text-left px-3 py-1.5 hover:bg-orange-50/50 transition-colors"
            >
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">
                하원
              </span>
              {dropoff ? (
                <div className="text-xs text-slate-600 mt-0.5">
                  {dropoff.time_slot_time ? formatTime(dropoff.time_slot_time) : "-"}
                  {dropoff.bus_label && <span className="ml-1">{dropoff.bus_label}</span>}
                  {dropoff.bus_stop_name && <span className="text-slate-400 ml-1">{dropoff.bus_stop_name}</span>}
                </div>
              ) : (
                <div className="text-xs text-slate-300 mt-0.5">-</div>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ── 편집 패널 ── */

function EditPanel({
  direction,
  checkedDays,
  onToggleDay,
  slots,
  stops,
  slotId,
  stopId,
  note,
  onSlotChange,
  onStopChange,
  onNoteChange,
  onSave,
  onCancel,
  onDelete,
  saving,
}: {
  direction: "pickup" | "dropoff";
  checkedDays: Set<number>;
  onToggleDay: (day: number) => void;
  slots: BusTimeSlot[];
  stops: BusStop[];
  slotId: string;
  stopId: string;
  note: string;
  onSlotChange: (v: string) => void;
  onStopChange: (v: string) => void;
  onNoteChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  saving: boolean;
}) {
  return (
    <div className="mt-3 border rounded-lg p-4 bg-slate-50 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
        편집 — {DIR_LABEL[direction]}
      </div>

      {/* 요일 체크박스 */}
      <div>
        <label className="text-xs font-medium text-slate-600 block mb-1">적용 요일</label>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => onToggleDay(day)}
              className={`w-9 h-9 rounded-lg text-xs font-medium border transition-colors ${
                checkedDays.has(day)
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-white text-slate-600 border-slate-300 hover:border-blue-300"
              }`}
            >
              {DAY_NAMES[day]}
            </button>
          ))}
        </div>
      </div>

      {/* 폼 필드 */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="min-w-[140px]">
          <label className="text-xs font-medium text-slate-600 block mb-1">시간대</label>
          <select
            value={slotId}
            onChange={(e) => onSlotChange(e.target.value)}
            className="h-9 px-2 border rounded-lg text-sm w-full bg-white"
          >
            <option value="">선택</option>
            {slots.map((s) => (
              <option key={s.id} value={s.id}>
                {formatTime(s.time)} {s.label}
              </option>
            ))}
          </select>
        </div>
        {stops.length > 0 && (
          <div className="min-w-[120px]">
            <label className="text-xs font-medium text-slate-600 block mb-1">정류장</label>
            <select
              value={stopId}
              onChange={(e) => onStopChange(e.target.value)}
              className="h-9 px-2 border rounded-lg text-sm w-full bg-white"
            >
              <option value="">선택 (선택사항)</option>
              {stops.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex-1 min-w-[120px]">
          <label className="text-xs font-medium text-slate-600 block mb-1">메모</label>
          <Input
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="추가 메모"
            className="h-9 text-sm"
          />
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex items-center justify-between pt-1">
        <div>
          {onDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={onDelete}
              disabled={saving}
            >
              삭제
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={onCancel} disabled={saving}>
            취소
          </Button>
          <Button size="sm" className="h-8 text-xs" onClick={onSave} disabled={saving}>
            {saving ? "저장 중..." : "저장"}
          </Button>
        </div>
      </div>
    </div>
  );
}
