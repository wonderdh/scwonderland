import { formatDateYmdKst, nowKstParts } from "@/lib/utils/date-kst";

/**
 * 오늘의 ISO day. KST 기준.
 * 1=월 ~ 5=금. 토·일은 이번주 금요일로 매핑(5).
 * 서버/클라 어디서 호출해도 동일한 결과.
 */
export function getTodayIsoDayKst(): number {
  const { year, month, day } = nowKstParts();
  const jsDay = new Date(year, month - 1, day).getDay();
  if (jsDay === 0) return 5;
  if (jsDay === 6) return 5;
  return jsDay;
}

/**
 * ISO day(1~5) → 이번주 해당 요일의 KST YYYY-MM-DD.
 * 주말 오늘 기준으로는 지난주 해당 요일 또는 다음주 해당 요일이 될 수 있으나,
 * `getTodayIsoDayKst()`가 주말을 5로 매핑하므로 관심 있는 범위는 이번주 월~금.
 */
export function getDateForIsoDayKst(isoDay: number): string {
  const { year, month, day } = nowKstParts();
  const today = new Date(year, month - 1, day);
  const jsDay = today.getDay();
  const currentIso = jsDay === 0 ? 7 : jsDay;
  const diff = isoDay - currentIso;
  const target = new Date(year, month - 1, day + diff);
  return formatDateYmdKst(target);
}
