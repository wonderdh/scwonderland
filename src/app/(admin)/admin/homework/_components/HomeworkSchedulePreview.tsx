"use client";

import { useMemo } from "react";
import {
  YMD_RE,
  getUnitSchedule,
  ymdToKstWeekday,
} from "@/lib/utils/homework-schedule";

const WD_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const MONTH_LABELS = [
  "1월", "2월", "3월", "4월", "5월", "6월",
  "7월", "8월", "9월", "10월", "11월", "12월",
];

/** F14: malformed ymd 에 silent NaN/undefined 출력 방지. */
function formatPreviewDate(ymd: string): string {
  if (!YMD_RE.test(ymd)) return ymd; // 비정상 입력은 원문 표시 — silent "undefined" 회피
  const [, m, d] = ymd.split("-").map(Number);
  const wd = ymdToKstWeekday(ymd);
  return `${MONTH_LABELS[m - 1]} ${d}일 (${WD_LABELS[wd]})`;
}

type Props = {
  /** 검사일 (이 날 채점하는 unit = startUnit). */
  startDate: string;
  /** 위 검사일에 채점하는 unit. */
  startUnit: number;
  totalUnits: number;
  /** 숙제 부여 요일 (0=일~6=토). */
  homeworkDays: number[];
  /** 반 수업(=등원) 요일 (0=일~6=토). 채점일 계산 기준. */
  meetDays: number[];
  /** 예외일(책별 skip + 학원 공통 쉬는날 합집합). */
  skipDates: string[];
  /** 미리보기에 보여줄 최대 행 수 (기본 8). */
  limit?: number;
};

/**
 * 입력값(검사일·unit·요일)으로 실제 unit↔채점일 매핑을 미리 보여준다.
 * `getUnitSchedule` 와 동일 로직이라 저장 후 화면과 일치한다.
 */
export function HomeworkSchedulePreview({
  startDate,
  startUnit,
  totalUnits,
  homeworkDays,
  meetDays,
  skipDates,
  limit = 8,
}: Props) {
  // F12: startUnit 이 invalid 면 silent fallback 대신 명시적 안내. F14: malformed startDate 도 차단.
  const startUnitInvalid =
    !Number.isInteger(startUnit) || startUnit < 1;
  const startDateMalformed = !!startDate && !YMD_RE.test(startDate);

  const rows = useMemo(() => {
    if (
      !startDate ||
      startDateMalformed ||
      startUnitInvalid ||
      homeworkDays.length === 0 ||
      meetDays.length === 0 ||
      totalUnits <= 0
    ) {
      return [];
    }
    const wd = ymdToKstWeekday(startDate);
    if (wd === 0 || wd === 6) return []; // 주말 검사일 무효
    return getUnitSchedule({
      startDate,
      startUnit,
      totalUnits,
      homeworkDays,
      meetDays,
      skipDates,
    })
      .filter((r) => r.date >= startDate)
      .slice(0, limit);
  }, [
    startDate,
    startDateMalformed,
    startUnitInvalid,
    startUnit,
    totalUnits,
    homeworkDays,
    meetDays,
    skipDates,
    limit,
  ]);

  if (homeworkDays.length === 0 || meetDays.length === 0) {
    return (
      <p className="text-xs text-amber-600">
        {meetDays.length === 0
          ? "반 수업 요일 정보가 없어 미리보기를 만들 수 없습니다."
          : "숙제 부여 요일을 1개 이상 선택하면 미리보기가 표시됩니다."}
      </p>
    );
  }
  if (!startDate) {
    return <p className="text-xs text-slate-400">검사일을 선택하면 미리보기가 표시됩니다.</p>;
  }
  if (startDateMalformed) {
    return <p className="text-xs text-amber-600">검사일 형식이 올바르지 않습니다.</p>;
  }
  if (startUnitInvalid) {
    return (
      <p className="text-xs text-amber-600">
        검사 unit 을 1 이상의 정수로 입력하면 미리보기가 표시됩니다.
      </p>
    );
  }
  if (totalUnits <= 0) {
    return (
      <p className="text-xs text-amber-600">
        총 unit 수가 확정되지 않아 미리보기를 만들 수 없습니다.
      </p>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="text-xs text-amber-600">
        해당 입력으로 계산되는 채점 일정이 없습니다. (검사일/요일을 확인하세요)
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2">
      <ul className="divide-y divide-slate-100">
        {rows.map((r, i) => (
          <li
            key={r.date}
            className="flex items-center justify-between px-1.5 py-1 text-xs"
          >
            <span className={i === 0 ? "font-semibold text-slate-900" : "text-slate-600"}>
              {formatPreviewDate(r.date)}
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className={`inline-flex h-5 min-w-[44px] items-center justify-center rounded-full px-2 font-semibold ${
                  i === 0
                    ? "bg-orange-500 text-white"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                unit {r.unit}
              </span>
              {i === 0 && (
                <span className="text-[10px] font-medium text-orange-600">← 검사일</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
