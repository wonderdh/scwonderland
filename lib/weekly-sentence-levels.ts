/**
 * 주간 문장 레벨 상수.
 * XLSX 시트(유아반/1년차/2년차/3년차)와 1:1 매핑.
 * 팝업 UI + 관리자 페이지에서 공유.
 */
export const WEEKLY_SENTENCE_LEVELS = [
  { level: 1, label: "유아반", subLabel: "5-6세", color: "bg-rose-100 text-rose-800" },
  { level: 2, label: "1년차", subLabel: "기초", color: "bg-amber-100 text-amber-800" },
  { level: 3, label: "2년차", subLabel: "중급", color: "bg-emerald-100 text-emerald-800" },
  { level: 4, label: "3년차", subLabel: "상급", color: "bg-sky-100 text-sky-800" },
] as const;

/** XLSX 시트명 → level 매핑 (서버에서 bulk import 시 사용) */
export const SHEET_LEVEL_MAP: Record<string, number> = {
  "유아반 (5-6세)": 1,
  "1년차 (기초)": 2,
  "2년차 (중급)": 3,
  "3년차 (상급)": 4,
};
