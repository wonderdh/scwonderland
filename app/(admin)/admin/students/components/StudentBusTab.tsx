"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { StudentBusDefault, BusTimeSlot, BusStop, AfterschoolStatus } from "@/lib/types";
import { detectAfterschoolSlot } from "@/lib/bus/afterschool-sync";
import { toast } from "sonner";
import {
  getStudentBusDefaults,
  upsertStudentBusDefault,
  deleteStudentBusDefaults,
  listBusTimeSlots,
  listBusStops,
  getStudentAfterschoolDetail,
  updateAfterschoolSecondPeriod,
  deleteAfterschoolEnrollmentDay,
  getOrCreateAfterschoolClass,
  enrollStudent,
} from "../../actions";
import { LoadingState } from "@/components/LoadingState";
import { formatTime } from "@/lib/bus/utils";

const DAY_NAMES = ["", "월", "화", "수", "목", "금"];

// 방과후 등록 상태별 카드 색상
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

  function getDefault(day: number) {
    return defaults.find((d) => d.day_of_week === day);
  }

  function openEdit(day: number) {
    setEditingDay(day);
    setCheckedDays(new Set([day]));
    const existing = getDefault(day);
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

    // 방과후 슬롯 판별
    const selectedSlot = busTimeSlots.find((s) => s.id === editSlotId);
    const { isAfterschoolSlot, secondPeriod: newSecondPeriod } = detectAfterschoolSlot(selectedSlot);

    for (const day of checkedDays) {
      const result = await upsertStudentBusDefault(
        studentProfileId,
        day,
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

      // 방과후 연동: 변경 시 자동 동기화
      const asStatus = afterschoolMap.get(day);
      const isEnrolled = asStatus && asStatus !== "none";

      if (isAfterschoolSlot) {
        if (!isEnrolled) {
          // 방과후 미등록 → 자동 등록
          const classResult = await getOrCreateAfterschoolClass();
          if (!classResult.id) {
            toast.error("방과후 자동 등록 실패: 방과후 반을 찾을 수 없습니다.");
          } else {
            const enrollResult = await enrollStudent(classResult.id, studentProfileId, [day], newSecondPeriod);
            if (enrollResult.error) {
              toast.error(`방과후 자동 등록 실패: ${enrollResult.error}`);
            } else {
              toast.success(
                `${DAY_NAMES[day]}요일 방과후가 자동으로 등록됐습니다. (${newSecondPeriod ? "1·2교시" : "1교시"})`
              );
            }
          }
        } else {
          // 이미 등록 → 교시만 동기화
          const currentSecondPeriod = asStatus === "both";
          if (currentSecondPeriod !== newSecondPeriod) {
            const syncResult = await updateAfterschoolSecondPeriod(studentProfileId, day, newSecondPeriod);
            if (!syncResult.error) {
              toast.success(
                `${DAY_NAMES[day]}요일 방과후 교시가 ${newSecondPeriod ? "1·2교시" : "1교시"}로 업데이트됐습니다.`
              );
            }
          }
        }
      } else if (isEnrolled) {
        // 방과후 슬롯 아닌 걸 선택 → 해당 요일 enrollment 삭제
        await deleteAfterschoolEnrollmentDay(studentProfileId, day);
      }
    }
    closeEdit();
    await load();
    router.refresh();
    setSaving(false);
  }

  async function handleDelete() {
    const ids = Array.from(checkedDays)
      .map((day) => getDefault(day)?.id)
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
    (day) => !!getDefault(day)
  ).length;

  if (loading) return <LoadingState className="py-4" />;

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
      {error && (
        <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded">{error}</p>
      )}

      <DirectionGrid
        defaults={defaults}
        editingDay={editingDay}
        afterschoolMap={afterschoolMap}
        onCellClick={(day) => openEdit(day)}
      />
      {editingDay !== null && (
        <EditPanel
          checkedDays={checkedDays}
          onToggleDay={toggleDay}
          slots={busTimeSlots}
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
          afterschoolMap={afterschoolMap}
        />
      )}

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="승하차 설정 삭제"
        description={`선택한 ${checkedWithData}개 요일의 하원 설정을 삭제하시겠습니까?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
        disabled={saving}
      />
    </div>
  );
}

/* ── 요일별 카드 그리드 ── */

function DirectionGrid({
  defaults,
  editingDay,
  afterschoolMap,
  onCellClick,
}: {
  defaults: StudentBusDefault[];
  editingDay: number | null;
  afterschoolMap: Map<number, AfterschoolStatus>;
  onCellClick: (day: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
      {[1, 2, 3, 4, 5].map((day) => {
        const def = defaults.find((d) => d.day_of_week === day);
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

/* ── 요일 카드 ── */

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

/* ── 편집 패널 ── */

function EditPanel({
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
  afterschoolMap,
}: {
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
  afterschoolMap?: Map<number, AfterschoolStatus>;
}) {
  // 방과후 등록된 요일 표시
  const afterschoolCheckedDays = afterschoolMap
    ? Array.from(checkedDays).filter((d) => {
        const s = afterschoolMap.get(d);
        return s && s !== "none";
      })
    : [];

  return (
    <div className="mt-3 border rounded-lg p-4 bg-slate-50 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
        편집 — 하원
      </div>

      {afterschoolCheckedDays.length > 0 && (
        <div className="flex items-start gap-2 text-xs bg-violet-50 border border-violet-200 rounded-lg px-3 py-2 text-violet-700">
          <span className="shrink-0 mt-0.5">ⓘ</span>
          <span>
            <span className="font-medium">{afterschoolCheckedDays.map((d) => DAY_NAMES[d]).join("·")}요일</span>은 방과후 등록된 날입니다.
            {" "}시간대 선택에 따라 방과후 교시가 자동으로 연동됩니다.
          </span>
        </div>
      )}

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
