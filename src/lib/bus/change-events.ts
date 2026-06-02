/**
 * 같은 페이지에 떨어져 렌더되는 버스 변경 UI 간 "변경 발생" 신호용 경량 이벤트 버스.
 *
 * realtime(`use-bus-realtime`) 이 못 붙거나(미구독 날짜·publication 미설정 등)
 * 받지 못하는 경우에도, admin 폼/패널에서 변경을 만들면 즉시 같은 탭의
 * `DailyBusChanges` 등을 refetch 시키기 위한 fallback. realtime 을 대체하지 않고 보완한다.
 */
const BUS_CHANGE_MUTATED = "bus-change:mutated";

/** 변경 요청 생성/승인/거절 등 mutation 직후 호출. */
export function emitBusChangeMutated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BUS_CHANGE_MUTATED));
}

/** mutation 신호 구독. 반환된 함수로 해제. */
export function onBusChangeMutated(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(BUS_CHANGE_MUTATED, callback);
  return () => window.removeEventListener(BUS_CHANGE_MUTATED, callback);
}
