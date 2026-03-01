"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { StudentBusDefault, BusNumber, AcademyPeriod } from "@/lib/types";
import {
  getStudentBusDefaults,
  upsertStudentBusDefault,
  deleteStudentBusDefault,
  listBusNumbers,
  listAcademyPeriods,
} from "../../actions";

const DAY_NAMES = ["", "월", "화", "수", "목", "금"];
const DIR_LABEL = { pickup: "등원", dropoff: "하원" } as const;

function formatTime(t: string | undefined | null) {
  if (!t) return "-";
  return t.slice(0, 5);
}

export function StudentBusTab({ studentProfileId }: { studentProfileId: string }) {
  const router = useRouter();
  const [defaults, setDefaults] = useState<StudentBusDefault[]>([]);
  const [busNumbers, setBusNumbers] = useState<BusNumber[]>([]);
  const [academyPeriods, setAcademyPeriods] = useState<AcademyPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // 편집 모드
  const [editKey, setEditKey] = useState<string | null>(null); // "day-direction"
  const [editPeriodId, setEditPeriodId] = useState("");
  const [editBusId, setEditBusId] = useState("");
  const [editEstimatedTime, setEditEstimatedTime] = useState("");
  const [editNote, setEditNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [d, bn, ap] = await Promise.all([
      getStudentBusDefaults(studentProfileId),
      listBusNumbers(),
      listAcademyPeriods(),
    ]);
    setDefaults(d);
    setBusNumbers(bn);
    setAcademyPeriods(ap);
    setLoading(false);
  }, [studentProfileId]);

  useEffect(() => {
    load();
  }, [load]);

  function getDefault(day: number, dir: "pickup" | "dropoff") {
    return defaults.find((d) => d.day_of_week === day && d.direction === dir);
  }

  async function handleSave(day: number, dir: "pickup" | "dropoff") {
    if (!editPeriodId || !editBusId) {
      setError("수업 시간대와 호차를 모두 선택해 주세요.");
      return;
    }
    setSaving(true);
    setError("");
    const result = await upsertStudentBusDefault(
      studentProfileId,
      day,
      dir,
      editPeriodId,
      editBusId,
      editEstimatedTime || undefined,
      editNote || undefined
    );
    if (result.error) {
      setError(result.error);
    } else {
      setEditKey(null);
      await load();
      router.refresh();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("이 배정을 삭제하시겠습니까?")) return;
    setSaving(true);
    const result = await deleteStudentBusDefault(id);
    if (result.error) setError(result.error);
    else {
      await load();
      router.refresh();
    }
    setSaving(false);
  }

  if (loading) return <p className="text-sm text-slate-400 py-4">불러오는 중...</p>;

  const pickupPeriods = academyPeriods.filter((p) => p.has_pickup);
  const dropoffPeriods = academyPeriods.filter((p) => p.has_dropoff);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-700">주간 승하차 스케줄</h3>

      {error && (
        <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded">{error}</p>
      )}

      {busNumbers.length === 0 || academyPeriods.length === 0 ? (
        <p className="text-sm text-slate-400 py-4">
          호차 또는 수업 시간대가 등록되지 않았습니다. 먼저{" "}
          <a href="/admin/bus?tab=numbers" className="text-blue-500 underline">승하차 관리</a>
          에서 설정해 주세요.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-2 w-12">요일</th>
                <th className="text-left py-2 px-2">방향</th>
                <th className="text-left py-2 px-2">수업 시간대</th>
                <th className="text-left py-2 px-2">호차</th>
                <th className="text-left py-2 px-2">예상시간</th>
                <th className="text-left py-2 px-2">위치</th>
                <th className="text-right py-2 px-2 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((day) =>
                (["pickup", "dropoff"] as const).map((dir) => {
                  const def = getDefault(day, dir);
                  const key = `${day}-${dir}`;
                  const isEditing = editKey === key;
                  const relevantPeriods = dir === "pickup" ? pickupPeriods : dropoffPeriods;

                  return (
                    <tr key={key} className="border-b hover:bg-slate-50">
                      {dir === "pickup" && (
                        <td rowSpan={2} className="py-2 px-2 font-medium text-center align-middle border-r">
                          {DAY_NAMES[day]}
                        </td>
                      )}
                      <td className="py-2 px-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          dir === "pickup" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                        }`}>
                          {DIR_LABEL[dir]}
                        </span>
                      </td>
                      {isEditing ? (
                        <>
                          <td className="py-2 px-2">
                            <select
                              value={editPeriodId}
                              onChange={(e) => setEditPeriodId(e.target.value)}
                              className="h-8 px-2 border rounded text-xs w-full"
                            >
                              <option value="">선택</option>
                              {relevantPeriods.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {formatTime(p.start_time)}~{formatTime(p.end_time)} {p.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-2">
                            <select
                              value={editBusId}
                              onChange={(e) => setEditBusId(e.target.value)}
                              className="h-8 px-2 border rounded text-xs w-full"
                            >
                              <option value="">선택</option>
                              {busNumbers.map((b) => (
                                <option key={b.id} value={b.id}>{b.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-2">
                            <Input
                              type="time"
                              value={editEstimatedTime}
                              onChange={(e) => setEditEstimatedTime(e.target.value)}
                              className="h-8 text-xs w-full"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <Input
                              value={editNote}
                              onChange={(e) => setEditNote(e.target.value)}
                              placeholder="승하차 위치"
                              className="h-8 text-xs w-full"
                            />
                          </td>
                          <td className="py-2 px-2 text-right space-x-1">
                            <Button size="sm" className="h-6 text-xs" onClick={() => handleSave(day, dir)} disabled={saving}>
                              저장
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditKey(null)}>
                              취소
                            </Button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-2 px-2 text-slate-600">
                            {def ? (
                              <>
                                {formatTime(def.period_time)}
                                {def.period_name && <span className="text-xs text-slate-400 ml-1">{def.period_name}</span>}
                              </>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-slate-600">
                            {def ? def.bus_label : <span className="text-slate-300">-</span>}
                          </td>
                          <td className="py-2 px-2 text-slate-600">
                            {def?.estimated_time ? formatTime(def.estimated_time) : <span className="text-slate-300">-</span>}
                          </td>
                          <td className="py-2 px-2 text-slate-600">
                            {def?.note ? <span className="text-xs">{def.note}</span> : <span className="text-slate-300">-</span>}
                          </td>
                          <td className="py-2 px-2 text-right space-x-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-xs"
                              onClick={() => {
                                setEditKey(key);
                                setEditPeriodId(def?.academy_period_id ?? "");
                                setEditBusId(def?.bus_number_id ?? "");
                                setEditEstimatedTime(def?.estimated_time ? def.estimated_time.slice(0, 5) : "");
                                setEditNote(def?.note ?? "");
                              }}
                            >
                              {def ? "수정" : "설정"}
                            </Button>
                            {def && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-xs text-red-500"
                                onClick={() => handleDelete(def.id)}
                                disabled={saving}
                              >
                                삭제
                              </Button>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
