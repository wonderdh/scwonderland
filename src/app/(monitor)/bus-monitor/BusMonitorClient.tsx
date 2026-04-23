"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import type { BusManifestGroup, BusTimeSlot } from "@/lib/types";
import { getDailyBusManifest } from "@/app/(admin)/admin/actions";
import { formatTime } from "@/lib/bus/utils";
import { MonitorBusCard, BUS_CARD_COLORS } from "@/components/bus/MonitorBusCard";
import { useBusRealtime } from "@/lib/hooks/use-bus-realtime";
import { applyCheckRecord, applyChangeRequest } from "@/lib/bus/realtime-utils";
import { getDateForIsoDayKst, getTodayIsoDayKst } from "@/lib/bus/monitor-date";

const DAY_LABELS = ["월", "화", "수", "목", "금"] as const;

// 시간대별 그룹
type TimeGroup = {
  slotId: string;
  slotTime: string;
  slotLabel: string;
  cards: BusManifestGroup[];
};

function buildTimeGroups(rawGroups: BusManifestGroup[]): TimeGroup[] {
  const timeMap = new Map<string, TimeGroup>();
  for (const g of rawGroups) {
    const mapKey = g.slot_time;
    if (!timeMap.has(mapKey)) {
      timeMap.set(mapKey, {
        slotId: g.bus_time_slot_id,
        slotTime: g.slot_time,
        slotLabel: g.slot_label,
        cards: [],
      });
    }
    timeMap.get(mapKey)!.cards.push(g);
  }
  return [...timeMap.values()].sort((a, b) =>
    a.slotTime.localeCompare(b.slotTime)
  );
}

function getDefaultSlotId(slots: BusTimeSlot[]): string {
  const kindergarten = slots.find((s) => s.label.includes("유치부"));
  return kindergarten?.id ?? slots[0]?.id ?? "";
}

export function BusMonitorClient({
  busTimeSlots,
  initialIsoDay,
  initialGroups,
}: {
  busTimeSlots: BusTimeSlot[];
  initialIsoDay: number;
  initialGroups: BusManifestGroup[];
}) {
  const [dayOfWeek, setDayOfWeek] = useState<number>(initialIsoDay);
  const [allGroups, setAllGroups] = useState<TimeGroup[]>(() =>
    buildTimeGroups(initialGroups)
  );
  const [loading, setLoading] = useState(false);
  const [slotFilter, setSlotFilter] = useState<string>(() =>
    getDefaultSlotId(busTimeSlots)
  );

  // Race condition 방지
  const loadIdRef = useRef(0);
  // 중복 로드 방지 — 초기 데이터는 이미 채워져 있으므로 오늘 키로 초기화
  const loadedKeyRef = useRef<string>(`${initialIsoDay}`);

  const loadData = useCallback(async (day: number) => {
    const key = `${day}`;

    if (loadedKeyRef.current === key) return;

    const id = ++loadIdRef.current;
    setLoading(true);

    const date = getDateForIsoDayKst(day);
    const result = await getDailyBusManifest(date);

    if (loadIdRef.current !== id) return;

    loadedKeyRef.current = key;
    setAllGroups(buildTimeGroups(result.groups));
    setLoading(false);
  }, []);

  const handleDayChange = (newDay: number) => {
    if (newDay === dayOfWeek) return;
    setDayOfWeek(newDay);
    setAllGroups([]);
    loadedKeyRef.current = "";
    loadData(newDay);
  };

  const handleSlotSelect = useCallback((slotId: string) => {
    setSlotFilter(slotId);
  }, []);

  const handleRefresh = useCallback(() => {
    loadedKeyRef.current = "";
    loadData(dayOfWeek);
  }, [dayOfWeek, loadData]);

  // Realtime: 오늘 요일 탭에서만 활성화
  const todayIsoDay = getTodayIsoDayKst();
  const todayDate = getDateForIsoDayKst(todayIsoDay);
  const isViewingToday = dayOfWeek === todayIsoDay;

  const reloadToday = useCallback(() => {
    loadedKeyRef.current = "";
    loadData(dayOfWeek);
  }, [dayOfWeek, loadData]);

  useBusRealtime(todayDate, {
    onCheckRecord: (event, row) => {
      if (!isViewingToday) return;
      if (!row.student_profile_id) { reloadToday(); return; }
      setAllGroups((prev) =>
        prev.map((tg) => ({
          ...tg,
          cards: applyCheckRecord(tg.cards, event, row),
        }))
      );
    },
    onChangeRequest: (event, row) => {
      if (!isViewingToday) return;
      if (!row.student_profile_id || event === "DELETE" || row.change_type === "change") { reloadToday(); return; }
      setAllGroups((prev) =>
        prev.map((tg) => {
          const newCards = tg.cards.map((card) => {
            const result = applyChangeRequest([card], [], event, row);
            return { ...card, students: result.groups[0].students };
          });
          return { ...tg, cards: newCards };
        })
      );
    },
  }, { enabled: isViewingToday });

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

  // 선택된 요일의 날짜 문자열 (KST)
  const selectedDate = getDateForIsoDayKst(dayOfWeek);
  const dayNameFull = DAY_LABELS[dayOfWeek - 1] ?? "";

  // Hydration 이후 실제 오늘 isoDay가 바뀌었다면(자정 경계) 최신화
  useEffect(() => {
    const currentToday = getTodayIsoDayKst();
    if (currentToday !== initialIsoDay && dayOfWeek === initialIsoDay) {
      setDayOfWeek(currentToday);
      loadedKeyRef.current = "";
      loadData(currentToday);
    }
    // deps 고의로 비움 — mount 시 1회만 체크
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full space-y-4">
      {/* Row 1: 나이 범례 */}
      <div className="flex items-center gap-3 flex-wrap">
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
            const isoDay = idx + 1;
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
        {busTimeSlots.map((slot) => (
          <Button
            key={slot.id}
            size="sm"
            variant={slotFilter === slot.id ? "default" : "outline"}
            onClick={() => handleSlotSelect(slot.id)}
          >
            {formatTime(slot.time)} {slot.label}
          </Button>
        ))}
        {busTimeSlots.length === 0 && (
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
          <div key={tg.slotTime}>
            {/* 시간대 헤더 */}
            <div className="flex items-center gap-3 mb-2">
              <span className="text-lg font-bold text-slate-700">
                {formatTime(tg.slotTime)}
              </span>
              <span className="text-base font-bold px-3 py-0.5 rounded-full bg-orange-100 text-orange-700">
                하원
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
