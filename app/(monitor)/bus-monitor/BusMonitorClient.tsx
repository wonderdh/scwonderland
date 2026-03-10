"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { BusManifestGroup, BusManifestEntry, BusTimeSlot } from "@/lib/types";
import { getAgeColor } from "@/lib/student-age-colors";
import { getDailyBusManifest, listAllActiveStudentNames } from "@/app/(admin)/admin/actions";

const DIR_LABEL = { pickup: "등원", dropoff: "하원" } as const;
const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
const REFRESH_INTERVAL = 30;

// 호차별 색상 팔레트 (Tailwind purge-safe 리터럴)
const BUS_CARD_COLORS = [
  { bg: "bg-blue-50", border: "border-l-blue-500", text: "text-blue-700" },
  { bg: "bg-emerald-50", border: "border-l-emerald-500", text: "text-emerald-700" },
  { bg: "bg-amber-50", border: "border-l-amber-500", text: "text-amber-700" },
  { bg: "bg-purple-50", border: "border-l-purple-500", text: "text-purple-700" },
  { bg: "bg-rose-50", border: "border-l-rose-500", text: "text-rose-700" },
  { bg: "bg-cyan-50", border: "border-l-cyan-500", text: "text-cyan-700" },
  { bg: "bg-indigo-50", border: "border-l-indigo-500", text: "text-indigo-700" },
  { bg: "bg-orange-50", border: "border-l-orange-500", text: "text-orange-700" },
] as const;

function formatTime(t: string) {
  return t.slice(0, 5);
}

function formatCheckedTime(iso: string) {
  const d = new Date(iso);
  return `${d.getHours()}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function getToday() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getCurrentHHMM() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

type StopGroup = {
  stopName: string;
  estimatedTime: string | null;
  students: BusManifestEntry[];
};

function groupStudentsByStop(students: BusManifestEntry[]): StopGroup[] {
  const sorted = [...students].sort((a, b) => {
    const ta = a.estimated_time ?? "99:99";
    const tb = b.estimated_time ?? "99:99";
    if (ta !== tb) return ta.localeCompare(tb);
    return (a.bus_stop_name ?? "").localeCompare(b.bus_stop_name ?? "");
  });

  const groups: StopGroup[] = [];
  let current: StopGroup | null = null;

  for (const s of sorted) {
    const key = `${s.bus_stop_name ?? ""}|${s.estimated_time ?? ""}`;
    if (!current || `${current.stopName}|${current.estimatedTime ?? ""}` !== key) {
      current = {
        stopName: s.bus_stop_name ?? "",
        estimatedTime: s.estimated_time ?? null,
        students: [],
      };
      groups.push(current);
    }
    current.students.push(s);
  }

  return groups;
}

function ProgressBar({ boarded, total }: { boarded: number; total: number }) {
  const pct = total > 0 ? Math.round((boarded / total) * 100) : 0;
  const color =
    pct >= 90 ? "bg-blue-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function MonitorBusCard({
  card,
  color,
}: {
  card: BusManifestGroup;
  color: (typeof BUS_CARD_COLORS)[number];
}) {
  const boardedCount = card.students.filter(
    (s) => s.boarded_at || s.checked_at
  ).length;
  const checkedCount = card.students.filter((s) => s.checked_at).length;
  const totalCount = card.students.length;
  const allDone = checkedCount === totalCount && totalCount > 0;
  const stopGroups = groupStudentsByStop(card.students);

  const renderStudent = (student: BusManifestEntry) => {
    const isBoarded = !!student.boarded_at;
    const isChecked = !!student.checked_at;

    const rowBg = isChecked
      ? "bg-green-50/50"
      : student.is_changed
        ? "bg-amber-50"
        : isBoarded
          ? "bg-blue-50/40"
          : "";

    return (
      <div
        key={student.student_profile_id}
        className={`px-3 py-1 flex items-center gap-2 ${rowBg}`}
      >
        <span className="text-xl shrink-0">
          {isChecked ? "✅" : isBoarded ? "🚌" : "⬜"}
        </span>
        <div className="flex-1 min-w-0">
          <span
            className={`block truncate text-2xl ${
              isChecked
                ? "text-slate-400 line-through"
                : `font-bold ${getAgeColor(student.age).text}`
            }`}
          >
            {student.korean_name || student.english_name}
          </span>
          {student.is_changed && student.original_bus_label && (
            <span className="block truncate text-xs text-amber-500 -mt-0.5">
              ← {student.original_bus_label}
              {student.note ? ` · ${student.note}` : ""}
            </span>
          )}
          {student.note && !student.is_changed && (
            <span className="block truncate text-xs text-slate-400 -mt-0.5">
              {student.note}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isBoarded && student.boarded_at && !isChecked && (
            <span className="text-base text-blue-600 font-medium">
              {formatCheckedTime(student.boarded_at)}
            </span>
          )}
          {isChecked && student.checked_at && (
            <span className="text-base text-green-600 font-medium">
              {formatCheckedTime(student.checked_at)}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderStopGroup = (group: StopGroup, gi: number) => (
    <div key={gi}>
      {(group.stopName || group.estimatedTime) && (
        <div className="px-4 py-1 bg-slate-50/60 flex items-center gap-2">
          <span className="text-sm text-slate-500">▸</span>
          {group.estimatedTime && (
            <span className="text-sm font-semibold text-slate-600">
              {formatTime(group.estimatedTime)}
            </span>
          )}
          {group.stopName && (
            <span className="text-sm text-slate-500 truncate">
              📍 {group.stopName}
            </span>
          )}
        </div>
      )}
      <div className="grid grid-cols-2">
        {group.students.map(renderStudent)}
      </div>
    </div>
  );

  return (
    <div className={`rounded-xl border border-l-4 ${color.border} bg-white shadow-sm overflow-hidden`}>
      <div
        className={`px-4 py-2.5 ${allDone ? "bg-green-50" : color.bg}`}
      >
        <div className="flex items-center justify-between mb-1">
          <span className={`text-2xl font-extrabold ${color.text}`}>
            {card.bus_label}
          </span>
          <span className="text-base font-medium text-slate-500">
            탑승 {boardedCount}/{totalCount} · 하차 {checkedCount}/{totalCount}
          </span>
        </div>
        <ProgressBar boarded={boardedCount} total={totalCount} />
      </div>

      <div className="divide-y divide-slate-100">
        {stopGroups.map((g, i) => renderStopGroup(g, i))}
      </div>
    </div>
  );
}

// 시간대별 그룹 (방향 포함)
type TimeGroup = {
  slotTime: string;
  slotLabel: string;
  direction: "pickup" | "dropoff";
  cards: BusManifestGroup[];
};

function UnassignedCard({
  students,
}: {
  students: { korean_name: string | null; english_name: string | null; age?: number | null }[];
}) {
  if (students.length === 0) return null;

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-100">
        <div className="flex items-center justify-between">
          <span className="text-2xl font-extrabold text-slate-600">미배정</span>
          <span className="text-base font-medium text-slate-500">
            {students.length}명
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4">
        {students.map((s, i) => (
          <div key={i} className="px-3 py-1 flex items-center gap-2">
            <span className="text-xl shrink-0">⬜</span>
            <span className={`flex-1 truncate text-2xl font-bold ${getAgeColor(s.age).text}`}>
              {s.korean_name || s.english_name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BusMonitorClient({
  busTimeSlots,
}: {
  busTimeSlots: BusTimeSlot[];
}) {
  const [date, setDate] = useState(getToday);
  const [allGroups, setAllGroups] = useState<TimeGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [showAll, setShowAll] = useState(true);
  const [currentTime, setCurrentTime] = useState(getCurrentHHMM);
  const [groupFilter, setGroupFilter] = useState<string>("");
  const [slotFilter, setSlotFilter] = useState<string>("");
  const [unassignedStudents, setUnassignedStudents] = useState<{korean_name: string | null; english_name: string | null; age?: number | null}[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const currentDate = getToday();
    setDate(currentDate);

    const [pickupResult, dropoffResult, allStudents] = await Promise.all([
      getDailyBusManifest(currentDate, "pickup"),
      getDailyBusManifest(currentDate, "dropoff"),
      listAllActiveStudentNames(),
    ]);

    const merged: TimeGroup[] = [];

    const addGroups = (
      groups: BusManifestGroup[],
      direction: "pickup" | "dropoff"
    ) => {
      const timeMap = new Map<string, TimeGroup>();
      for (const g of groups) {
        const key = g.slot_time;
        if (!timeMap.has(key)) {
          timeMap.set(key, {
            slotTime: g.slot_time,
            slotLabel: g.slot_label,
            direction,
            cards: [],
          });
        }
        timeMap.get(key)!.cards.push(g);
      }
      merged.push(...timeMap.values());
    };

    addGroups(pickupResult.groups, "pickup");
    addGroups(dropoffResult.groups, "dropoff");

    merged.sort((a, b) => {
      const cmp = a.slotTime.localeCompare(b.slotTime);
      if (cmp !== 0) return cmp;
      return a.direction === "pickup" ? -1 : 1;
    });

    // 미배정 학생 계산: manifest에 등장하지 않는 학생
    const assignedIds = new Set<string>();
    for (const g of pickupResult.groups) {
      for (const s of g.students) assignedIds.add(s.student_profile_id);
    }
    for (const g of dropoffResult.groups) {
      for (const s of g.students) assignedIds.add(s.student_profile_id);
    }
    const unassigned = allStudents
      .filter((s) => !assignedIds.has(s.profile_id))
      .sort((a, b) => (a.korean_name ?? a.english_name ?? "").localeCompare(b.korean_name ?? b.english_name ?? ""));
    setUnassignedStudents(unassigned);

    setAllGroups(merged);
    setLoading(false);
    setInitialLoaded(true);
    setCurrentTime(getCurrentHHMM());
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(), REFRESH_INTERVAL * 1000);
    return () => clearInterval(interval);
  }, [load]);

  // 필터 카테고리 추출 (등록된 시간대 label에서 키워드)
  const GROUP_FILTERS = ["유치부", "오후반", "방과후"] as const;
  const availableFilters = GROUP_FILTERS.filter((gf) =>
    busTimeSlots.some((s) => s.label.includes(gf))
  );

  // 그룹 필터에 맞는 시간대 목록 (드롭다운용)
  const filteredSlots = busTimeSlots.filter((s) => !groupFilter || s.label.includes(groupFilter));

  const filteredGroups = allGroups
    .filter((tg) => showAll || tg.slotTime >= currentTime)
    .filter((tg) => !groupFilter || tg.slotLabel.includes(groupFilter))
    .filter((tg) => !slotFilter || tg.cards.some((c) => c.bus_time_slot_id === slotFilter));

  // 호차별 고유 색상 매핑 (라벨 기준 정렬 → 인덱스)
  const busColorMap = (() => {
    const labels = new Set<string>();
    for (const tg of allGroups) {
      for (const c of tg.cards) labels.add(c.bus_label);
    }
    const sorted = [...labels].sort();
    const map = new Map<string, (typeof BUS_CARD_COLORS)[number]>();
    sorted.forEach((label, i) => {
      map.set(label, BUS_CARD_COLORS[i % BUS_CARD_COLORS.length]);
    });
    return map;
  })();

  const d = new Date(date);
  const dayName = DAY_NAMES[d.getDay()];

  if (!initialLoaded) {
    return (
      <div className="w-full space-y-4 animate-pulse">
        {/* 상단 바 스켈레톤 */}
        <div className="flex items-center gap-3">
          <div className="h-7 w-40 bg-slate-200 rounded" />
          <div className="h-8 w-20 bg-slate-200 rounded" />
          <div className="h-8 w-24 bg-slate-200 rounded" />
        </div>
        {/* 시간대 헤더 스켈레톤 */}
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-6 w-14 bg-slate-200 rounded" />
                <div className="h-6 w-12 bg-slate-200 rounded-full" />
                <div className="flex-1 border-t border-slate-200" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[1, 2].map((j) => (
                  <div key={j} className="rounded-xl border bg-white shadow-sm overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="h-7 w-20 bg-slate-200 rounded" />
                        <div className="h-5 w-32 bg-slate-200 rounded" />
                      </div>
                      <div className="h-1.5 bg-slate-200 rounded-full" />
                    </div>
                    <div className="px-3 py-2 space-y-2">
                      {[1, 2, 3, 4].map((k) => (
                        <div key={k} className="flex items-center gap-2">
                          <div className="h-6 w-6 bg-slate-200 rounded" />
                          <div className="h-6 flex-1 bg-slate-200 rounded" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* 상단 바 */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-slate-800">
          {date} ({dayName})
        </h1>

        <div className="flex gap-1">
          <Button
            size="sm"
            variant={showAll ? "default" : "outline"}
            onClick={() => setShowAll(true)}
          >
            전체 보기
          </Button>
          <Button
            size="sm"
            variant={!showAll ? "default" : "outline"}
            onClick={() => {
              setShowAll(false);
              setCurrentTime(getCurrentHHMM());
            }}
          >
            현재 시간
          </Button>
        </div>

        {/* 그룹 필터 */}
        {availableFilters.length > 0 && (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={groupFilter === "" ? "default" : "outline"}
              onClick={() => { setGroupFilter(""); setSlotFilter(""); }}
            >
              전체
            </Button>
            {availableFilters.map((gf) => (
              <Button
                key={gf}
                size="sm"
                variant={groupFilter === gf ? "default" : "outline"}
                onClick={() => { setGroupFilter(gf); setSlotFilter(""); }}
              >
                {gf}
              </Button>
            ))}
          </div>
        )}

        {/* 시간대 필터 */}
        {filteredSlots.length > 0 && (
          <select
            value={slotFilter}
            onChange={(e) => setSlotFilter(e.target.value)}
            className="h-9 px-2 border rounded text-sm"
          >
            <option value="">전체 시간대</option>
            {filteredSlots.map((s) => (
              <option key={s.id} value={s.id}>
                {formatTime(s.time)} {s.label} ({s.direction === "pickup" ? "등원" : "하원"})
              </option>
            ))}
          </select>
        )}

        {/* 나이별 색상 범례 */}
        <div className="flex items-center gap-3 ml-auto">
          <span className="text-xs text-slate-400">나이:</span>
          <span className="text-xs font-bold text-pink-700">5세</span>
          <span className="text-xs font-bold text-sky-700">6세</span>
          <span className="text-xs font-bold text-emerald-700">7세</span>
          <span className="text-xs font-bold text-slate-600">기타</span>
        </div>
      </div>

      {/* 데이터 없음 */}
      {filteredGroups.length === 0 && !loading && (
        <p className="text-sm text-slate-400 py-8 text-center">
          {allGroups.length === 0
            ? "배정된 학생이 없습니다."
            : "현재 시간 이후 예정된 승하차가 없습니다."}
        </p>
      )}

      {/* 시간대별 → 호차별 카드 */}
      <div className="space-y-4">
        {filteredGroups.map((tg) => (
          <div key={`${tg.slotTime}-${tg.direction}`}>
            {/* 시간대 헤더 */}
            <div className="flex items-center gap-3 mb-2">
              <span className="text-lg font-bold text-slate-700">
                {formatTime(tg.slotTime)}
              </span>
              <span
                className={`text-base font-bold px-3 py-0.5 rounded-full ${
                  tg.direction === "pickup"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-orange-100 text-orange-700"
                }`}
              >
                {DIR_LABEL[tg.direction]}
              </span>
              {tg.slotLabel && (
                <span className="text-base text-slate-500">{tg.slotLabel}</span>
              )}
              <div className="flex-1 border-t border-slate-200" />
            </div>

            {/* 호차별 모니터링 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {tg.cards
                .filter((c) => !slotFilter || c.bus_time_slot_id === slotFilter)
                .map((card) => (
                <MonitorBusCard
                  key={`${card.bus_time_slot_id}-${card.bus_number_id}`}
                  card={card}
                  color={busColorMap.get(card.bus_label) ?? BUS_CARD_COLORS[0]}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 미배정 학생 카드 */}
      {unassignedStudents.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-lg font-bold text-slate-700">미배정 학생</span>
            <div className="flex-1 border-t border-slate-200" />
          </div>
          <UnassignedCard students={unassignedStudents} />
        </div>
      )}
    </div>
  );
}
