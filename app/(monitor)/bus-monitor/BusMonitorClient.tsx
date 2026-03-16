"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import type { BusManifestGroup, BusTimeSlot } from "@/lib/types";
import { getDailyBusManifest } from "@/app/(admin)/admin/actions";
import { formatTime } from "@/lib/bus/utils";
import { MonitorBusCard, BUS_CARD_COLORS } from "@/components/bus/MonitorBusCard";

const DIR_LABEL = { pickup: "등원", dropoff: "하원" } as const;
const DAY_LABELS = ["월", "화", "수", "목", "금"] as const;

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
  }, [busTimeSlots, loadData]);

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
  const busColorMap = useMemo(() => {
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
  }, [allGroups]);

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
                  variant="monitor"
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
