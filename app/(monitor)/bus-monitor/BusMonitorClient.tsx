"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { BusManifestGroup, BusManifestEntry, BusTimeSlot } from "@/lib/types";
import { getAgeColor } from "@/lib/student-age-colors";
import { getDailyBusManifest } from "@/app/(admin)/admin/actions";

const DIR_LABEL = { pickup: "등원", dropoff: "하원" } as const;
const DAY_LABELS = ["월", "화", "수", "목", "금"] as const;
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

/** ISO day (1=Mon ~ 5=Fri) → 금주 해당 요일의 YYYY-MM-DD */
function getDateForIsoDay(isoDay: number): string {
  const now = new Date();
  const currentIso = now.getDay() === 0 ? 7 : now.getDay(); // JS 0=Sun → ISO 7
  const diff = isoDay - currentIso;
  const target = new Date(now);
  target.setDate(now.getDate() + diff);
  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, "0");
  const d = String(target.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 오늘의 ISO day (1~5, 주말이면 금요일=5) */
function getTodayIsoDay(): number {
  const jsDay = new Date().getDay();
  if (jsDay === 0) return 5; // 일요일 → 금요일
  if (jsDay === 6) return 5; // 토요일 → 금요일
  return jsDay;
}

type StopGroup = {
  stopName: string;
  estimatedTime: string | null;
  students: BusManifestEntry[];
};

function groupStudentsByStop(students: BusManifestEntry[]): StopGroup[] {
  const sorted = [...students].sort((a, b) => {
    // 정류장 배치 순서 우선
    const sa = a.bus_stop_sort_order ?? 9999;
    const sb = b.bus_stop_sort_order ?? 9999;
    if (sa !== sb) return sa - sb;
    // fallback: 예상 시간 → 이름순
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

  // 그룹 내 학생: 나이순 → 이름순
  for (const g of groups) {
    g.students.sort((a, b) => {
      const ageA = a.age ?? 99;
      const ageB = b.age ?? 99;
      if (ageA !== ageB) return ageA - ageB;
      return (a.korean_name ?? a.english_name ?? "").localeCompare(b.korean_name ?? b.english_name ?? "");
    });
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
              {student.original_bus_label} → {card.bus_label}
            </span>
          )}
          {student.note && (
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

// 시간대별 그룹
type TimeGroup = {
  slotId: string;
  slotTime: string;
  slotLabel: string;
  direction: "pickup" | "dropoff";
  cards: BusManifestGroup[];
};

function getDefaultSlotId(slots: BusTimeSlot[], direction: "pickup" | "dropoff"): string {
  const dirSlots = slots.filter((s) => s.direction === direction);
  const kindergarten = dirSlots.find((s) => s.label.includes("유치부"));
  return kindergarten?.id ?? dirSlots[0]?.id ?? "";
}

export function BusMonitorClient({
  busTimeSlots,
}: {
  busTimeSlots: BusTimeSlot[];
}) {
  const [direction, setDirection] = useState<"pickup" | "dropoff">("dropoff");
  const [dayOfWeek, setDayOfWeek] = useState<number>(getTodayIsoDay);
  const [allGroups, setAllGroups] = useState<TimeGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [slotFilter, setSlotFilter] = useState<string>("");

  // Race condition 방지
  const loadIdRef = useRef(0);
  // 중복 로드 방지: `${direction}-${dayOfWeek}`
  const loadedKeyRef = useRef("");

  const loadData = useCallback(async (dir: "pickup" | "dropoff", day: number, slotId: string) => {
    const key = `${dir}-${day}`;

    // 이미 같은 direction+day 데이터가 로드되어 있으면 스킵
    if (loadedKeyRef.current === key) return;

    const id = ++loadIdRef.current;
    setLoading(true);

    const date = getDateForIsoDay(day);
    const result = await getDailyBusManifest(date, dir);

    // stale 응답 무시
    if (loadIdRef.current !== id) return;

    const timeMap = new Map<string, TimeGroup>();
    for (const g of result.groups) {
      const mapKey = g.slot_time;
      if (!timeMap.has(mapKey)) {
        timeMap.set(mapKey, {
          slotId: g.bus_time_slot_id,
          slotTime: g.slot_time,
          slotLabel: g.slot_label,
          direction: dir,
          cards: [],
        });
      }
      timeMap.get(mapKey)!.cards.push(g);
    }

    const groups = [...timeMap.values()].sort((a, b) =>
      a.slotTime.localeCompare(b.slotTime)
    );

    loadedKeyRef.current = key;
    setAllGroups(groups);
    setLoading(false);
    setInitialLoaded(true);
  }, []);

  // 초기 로드: mount 시 기본 필터로 1회 자동 로드
  useEffect(() => {
    const defaultSlot = getDefaultSlotId(busTimeSlots, "dropoff");
    setSlotFilter(defaultSlot);
    loadData("dropoff", getTodayIsoDay(), defaultSlot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDirectionChange = (newDir: "pickup" | "dropoff") => {
    if (newDir === direction) return;
    setDirection(newDir);
    setSlotFilter("");
    setAllGroups([]);
    loadedKeyRef.current = "";
  };

  const handleDayChange = (newDay: number) => {
    if (newDay === dayOfWeek) return;
    setDayOfWeek(newDay);
    setSlotFilter("");
    setAllGroups([]);
    loadedKeyRef.current = "";
  };

  const handleSlotSelect = useCallback(async (slotId: string, dir: "pickup" | "dropoff", day: number) => {
    setSlotFilter(slotId);
    await loadData(dir, day, slotId);
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    loadedKeyRef.current = "";
    if (slotFilter) {
      loadData(direction, dayOfWeek, slotFilter);
    }
  }, [slotFilter, direction, dayOfWeek, loadData]);

  // 해당 direction의 시간대 목록
  const directionSlots = busTimeSlots.filter((s) => s.direction === direction);

  // 선택된 시간대의 카드만 필터
  const filteredGroups = allGroups.filter((tg) =>
    tg.cards.some((c) => c.bus_time_slot_id === slotFilter)
  );

  // 호차별 고유 색상 매핑
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

  // 선택된 요일의 날짜 문자열
  const selectedDate = getDateForIsoDay(dayOfWeek);
  const selectedDateObj = new Date(selectedDate);
  const dayNameFull = ["일", "월", "화", "수", "목", "금", "토"][selectedDateObj.getDay()];

  if (!initialLoaded) {
    return (
      <div className="w-full space-y-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-7 w-40 bg-slate-200 rounded" />
          <div className="h-8 w-20 bg-slate-200 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-20 bg-slate-200 rounded" />
          <div className="h-10 w-20 bg-slate-200 rounded" />
        </div>
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-9 w-28 bg-slate-200 rounded" />
          ))}
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
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Row 1: 등원/하원 토글 + 나이 범례 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-2">
          <Button
            size="lg"
            variant={direction === "pickup" ? "default" : "outline"}
            onClick={() => handleDirectionChange("pickup")}
            className="text-lg px-6"
          >
            등원
          </Button>
          <Button
            size="lg"
            variant={direction === "dropoff" ? "default" : "outline"}
            onClick={() => handleDirectionChange("dropoff")}
            className="text-lg px-6"
          >
            하원
          </Button>
        </div>

        {/* 나이별 색상 범례 */}
        <div className="flex items-center gap-3 ml-auto">
          <span className="text-xs text-slate-400">나이:</span>
          <span className="text-xs font-bold text-pink-700">5세</span>
          <span className="text-xs font-bold text-sky-700">6세</span>
          <span className="text-xs font-bold text-emerald-700">7세</span>
          <span className="text-xs font-bold text-slate-600">기타</span>
        </div>
      </div>

      {/* Row 2: 요일 선택 + 날짜 표시 + 새로고침 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1.5">
          {DAY_LABELS.map((label, idx) => {
            const isoDay = idx + 1; // 1=월 ~ 5=금
            return (
              <Button
                key={isoDay}
                size="sm"
                variant={dayOfWeek === isoDay ? "default" : "outline"}
                onClick={() => handleDayChange(isoDay)}
                className="px-3"
              >
                {label}
              </Button>
            );
          })}
        </div>
        <span className="text-sm text-slate-500">
          {selectedDate}({dayNameFull})
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={handleRefresh}
          disabled={loading}
        >
          {loading ? "로딩..." : "🔄"}
        </Button>
      </div>

      {/* Row 3: 시간대 버튼 목록 */}
      <div className="flex gap-2 flex-wrap">
        {directionSlots.map((slot) => (
          <Button
            key={slot.id}
            size="sm"
            variant={slotFilter === slot.id ? "default" : "outline"}
            onClick={() => handleSlotSelect(slot.id, direction, dayOfWeek)}
          >
            {formatTime(slot.time)} {slot.label}
          </Button>
        ))}
        {directionSlots.length === 0 && (
          <p className="text-sm text-slate-400">시간대가 없습니다.</p>
        )}
      </div>

      {/* 데이터 없음 */}
      {!slotFilter && !loading && (
        <p className="text-sm text-slate-400 py-8 text-center">
          시간대를 선택해주세요.
        </p>
      )}

      {slotFilter && filteredGroups.length === 0 && !loading && (
        <p className="text-sm text-slate-400 py-8 text-center">
          {allGroups.length === 0
            ? "배정된 학생이 없습니다."
            : "선택한 시간대에 배정된 학생이 없습니다."}
        </p>
      )}

      {/* 호차별 카드 그리드 */}
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
                .filter((c) => c.bus_time_slot_id === slotFilter)
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
    </div>
  );
}
