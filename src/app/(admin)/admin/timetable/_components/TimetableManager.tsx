"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/overlays/ConfirmDialog";
import { FormGroup } from "@/components/forms/FormGroup";
import type { AcademyPeriod } from "@/lib/types";
import { GROUP_TYPE_TO_LABEL } from "@/lib/constants/class";
import {
  createAcademyPeriod,
  updateAcademyPeriod,
  deleteAcademyPeriod,
} from "@/app/(admin)/admin/actions/timetable-actions";

const GROUP_OPTIONS = ["유치부", "방과후", "오후반"] as const;

const TIME_OPTIONS: string[] = [];
for (let h = 7; h <= 22; h++) {
  for (let m = 0; m < 60; m += 5) {
    TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

function formatTime(t: string) {
  return t.slice(0, 5); // "09:00:00" → "09:00"
}

export function TimetableManager({
  academyPeriods,
}: {
  academyPeriods: AcademyPeriod[];
}) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [newStartTime, setNewStartTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");
  const [newGroupLabel, setNewGroupLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editGroupLabel, setEditGroupLabel] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  async function handleCreate() {
    setLoading(true);
    setError("");
    const result = await createAcademyPeriod(
      newName,
      newStartTime,
      newEndTime,
      newGroupLabel,
    );
    if (result.error) {
      setError(result.error);
    } else {
      setNewName("");
      setNewStartTime("");
      setNewEndTime("");
      setNewGroupLabel("");
      router.refresh();
    }
    setLoading(false);
  }

  async function handleUpdate(id: string) {
    setLoading(true);
    setError("");
    const result = await updateAcademyPeriod(
      id,
      editName,
      editStartTime,
      editEndTime,
      editGroupLabel,
    );
    if (result.error) {
      setError(result.error);
    } else {
      setEditingId(null);
      router.refresh();
    }
    setLoading(false);
  }

  async function performDelete(id: string) {
    setLoading(true);
    const result = await deleteAcademyPeriod(id);
    if (result.error) setError(result.error);
    else router.refresh();
    setLoading(false);
    setDeleteTarget(null);
  }

  // 그룹별로 분리
  const grouped: { label: string; periods: AcademyPeriod[] }[] = [];
  const groupMap = new Map<string, AcademyPeriod[]>();
  const ungrouped: AcademyPeriod[] = [];

  for (const period of academyPeriods) {
    const label = GROUP_TYPE_TO_LABEL[period.group_type] ?? "";
    if (label) {
      const existing = groupMap.get(label);
      if (existing) {
        existing.push(period);
      } else {
        groupMap.set(label, [period]);
      }
    } else {
      ungrouped.push(period);
    }
  }

  for (const g of GROUP_OPTIONS) {
    const periods = groupMap.get(g);
    if (periods) grouped.push({ label: g, periods });
  }

  if (ungrouped.length > 0) {
    grouped.push({ label: "", periods: ungrouped });
  }

  function renderPeriodRow(period: AcademyPeriod) {
    const isEditing = editingId === period.id;

    return (
      <div
        key={period.id}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        {isEditing ? (
          <>
            <Input
              placeholder="이름"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="max-w-36 h-8 text-sm"
            />
            <select
              value={editStartTime}
              onChange={(e) => setEditStartTime(e.target.value)}
              className="h-8 px-2 border rounded text-xs w-24"
            >
              <option value="">시작</option>
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              value={editEndTime}
              onChange={(e) => setEditEndTime(e.target.value)}
              className={`h-8 px-2 border rounded text-xs w-24 ${editStartTime && editEndTime && editStartTime >= editEndTime ? "border-red-500" : ""}`}
            >
              <option value="">종료</option>
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              value={editGroupLabel}
              onChange={(e) => setEditGroupLabel(e.target.value)}
              className="h-8 px-2 border rounded text-xs w-24"
            >
              <option value="">그룹</option>
              {GROUP_OPTIONS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => handleUpdate(period.id)}
              disabled={loading || (!!editStartTime && !!editEndTime && editStartTime >= editEndTime)}
            >
              저장
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setEditingId(null)}
            >
              취소
            </Button>
          </>
        ) : (
          <>
            <span className="text-sm font-medium">
              {formatTime(period.start_time)} ~{" "}
              {formatTime(period.end_time)}
            </span>
            <span className="text-sm text-slate-600">{period.name}</span>
            <span className="flex-1" />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => {
                setEditingId(period.id);
                setEditName(period.name);
                setEditStartTime(formatTime(period.start_time));
                setEditEndTime(formatTime(period.end_time));
                setEditGroupLabel(GROUP_TYPE_TO_LABEL[period.group_type] ?? "");
              }}
            >
              수정
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-red-500 hover:text-red-700"
              onClick={() => setDeleteTarget({ id: period.id, name: period.name })}
              disabled={loading}
            >
              삭제
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-800">수업 시간대</h3>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
          {error}
        </p>
      )}

      {/* 추가 폼 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
        <FormGroup label="이름" required>
          <Input
            placeholder="예: 1교시"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="h-11 text-base"
          />
        </FormGroup>
        <FormGroup label="시작 시간" required>
          <select
            value={newStartTime}
            onChange={(e) => setNewStartTime(e.target.value)}
            className="h-11 px-3 border rounded-lg text-base w-full bg-white"
          >
            <option value="">선택</option>
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </FormGroup>
        <FormGroup
          label="종료 시간"
          required
          error={newStartTime && newEndTime && newStartTime >= newEndTime ? "시작 시간은 종료 시간보다 빨라야 합니다." : null}
        >
          <select
            value={newEndTime}
            onChange={(e) => setNewEndTime(e.target.value)}
            className={`h-11 px-3 border rounded-lg text-base w-full bg-white ${newStartTime && newEndTime && newStartTime >= newEndTime ? "border-red-500" : ""}`}
          >
            <option value="">선택</option>
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </FormGroup>
        <FormGroup label="그룹">
          <div className="flex gap-2">
            <select
              value={newGroupLabel}
              onChange={(e) => setNewGroupLabel(e.target.value)}
              className="h-11 px-3 border rounded-lg text-base flex-1 bg-white"
            >
              <option value="">선택</option>
              {GROUP_OPTIONS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <Button
              onClick={handleCreate}
              disabled={
                loading || !newName.trim() || !newStartTime || !newEndTime || (!!newStartTime && !!newEndTime && newStartTime >= newEndTime)
              }
            >
              추가
            </Button>
          </div>
        </FormGroup>
      </div>

      {/* 목록 — 그룹별 */}
      {academyPeriods.length === 0 && (
        <p className="text-base text-slate-500 py-4">
          등록된 수업 시간대가 없습니다.
        </p>
      )}

      {grouped.map((group) => (
        <div key={group.label || "__ungrouped"} className="space-y-1">
          {group.label ? (
            <h4 className="text-base font-semibold text-slate-700 px-1 pt-2 border-b pb-1">
              {group.label}
            </h4>
          ) : grouped.length > 1 ? (
            <h4 className="text-base font-semibold text-slate-500 px-1 pt-2 border-b pb-1">
              기타
            </h4>
          ) : null}
          {group.periods.map(renderPeriodRow)}
        </div>
      ))}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="수업 시간대 삭제"
        description={deleteTarget ? `"${deleteTarget.name}" 수업 시간대를 삭제하시겠습니까?` : undefined}
        danger
        impactList={["이 시간대에 배정된 시간표도 영향을 받을 수 있습니다."]}
        disabled={loading}
        onConfirm={() => deleteTarget && performDelete(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
