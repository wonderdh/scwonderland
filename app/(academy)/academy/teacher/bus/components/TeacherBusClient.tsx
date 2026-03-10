"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/Spinner";
import { Input } from "@/components/ui/input";
import type { BusManifestGroup, NoRideEntry } from "@/lib/types";
import { getDailyBusManifest } from "@/app/(admin)/admin/actions";

const DIR_LABEL = { pickup: "등원", dropoff: "하원" } as const;
const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

function formatTime(t: string) {
  return t.slice(0, 5);
}

export function TeacherBusClient() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [direction, setDirection] = useState<"pickup" | "dropoff">("pickup");
  const [groups, setGroups] = useState<BusManifestGroup[]>([]);
  const [noRides, setNoRides] = useState<NoRideEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getDailyBusManifest(date, direction);
    setGroups(result.groups);
    setNoRides(result.noRides);
    setLoading(false);
  }, [date, direction]);

  useEffect(() => {
    load();
  }, [load]);

  const d = new Date(date);
  const dayName = DAY_NAMES[d.getDay()];

  return (
    <div className="space-y-4">
      {/* 필터 */}
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
            onClick={() => setDirection("pickup")}
          >
            등원
          </Button>
          <Button
            size="sm"
            variant={direction === "dropoff" ? "default" : "outline"}
            onClick={() => setDirection("dropoff")}
          >
            하원
          </Button>
        </div>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
          {loading ? <><Spinner size="sm" /> 불러오는 중...</> : "새로고침"}
        </Button>
      </div>

      <h3 className="text-sm font-semibold text-slate-700">
        {date} ({dayName}) — {DIR_LABEL[direction]}
      </h3>

      {groups.length === 0 && !loading && (
        <p className="text-sm text-slate-400 py-8 text-center">배정된 학생이 없습니다.</p>
      )}

      <div className="space-y-4">
        {groups.map((group) => (
          <div key={`${group.bus_time_slot_id}-${group.bus_number_id}`} className="border rounded-lg overflow-hidden">
            <div className="bg-slate-100 px-4 py-2 flex items-center gap-3">
              <span className="text-sm font-semibold">{formatTime(group.slot_time)}</span>
              <span className="text-xs text-slate-500">({group.slot_label})</span>
              <span className="text-sm font-medium text-blue-700">{group.bus_label}</span>
              <span className="text-xs text-slate-400 ml-auto">{group.students.length}명</span>
            </div>
            <div className="divide-y">
              {group.students.map((student) => (
                <div
                  key={student.student_profile_id}
                  className={`px-4 py-2 flex items-center gap-3 text-sm ${
                    student.is_changed ? "bg-amber-50" : ""
                  }`}
                >
                  <span className="font-medium">
                    {student.korean_name || student.english_name}
                  </span>
                  {student.english_name && student.korean_name && (
                    <span className="text-xs text-slate-400">{student.english_name}</span>
                  )}
                  <span className="text-xs text-slate-400">#{student.student_number}</span>
                  {student.estimated_time && (
                    <span className="text-xs text-slate-500">{formatTime(student.estimated_time)}</span>
                  )}
                  {student.note && (
                    <span className="text-xs text-slate-400">· {student.note}</span>
                  )}
                  {student.is_changed && (
                    <span className="text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded font-medium">
                      변경됨
                      {student.original_bus_label && (
                        <span className="font-normal ml-1">
                          (원래: {formatTime(student.original_slot_time ?? "")} {student.original_bus_label})
                        </span>
                      )}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {noRides.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-red-50 px-4 py-2">
            <span className="text-sm font-semibold text-red-700">미탑승 ({noRides.length}명)</span>
          </div>
          <div className="divide-y">
            {noRides.map((student) => (
              <div key={student.student_profile_id} className="px-4 py-2 flex items-center gap-3 text-sm">
                <span className="font-medium">{student.korean_name || student.english_name}</span>
                <span className="text-xs text-slate-400">#{student.student_number}</span>
                {student.original_bus_label && (
                  <span className="text-xs text-slate-400">
                    (원래: {formatTime(student.original_slot_time ?? "")} {student.original_bus_label})
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
