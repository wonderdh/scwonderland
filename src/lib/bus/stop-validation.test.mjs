import test from "node:test";
import assert from "node:assert/strict";
import { dowFromYmd, findUnassignedDays, formatWeekdayList, pickServedBus, busRouteStops, inferRouteBus, toServedStopIds } from "./stop-validation.ts";

// 2026-06: 01(월=1) 02(화=2) 06(토=6) 07(일=7)
test("dowFromYmd: ISO 요일(1=월~7=일) 반환", () => {
  assert.equal(dowFromYmd("2026-06-01"), 1); // 월
  assert.equal(dowFromYmd("2026-06-02"), 2); // 화
  assert.equal(dowFromYmd("2026-06-06"), 6); // 토
  assert.equal(dowFromYmd("2026-06-07"), 7); // 일(0→7)
});

test("findUnassignedDays: 배정된 요일은 통과, 미배정 요일만 반환", () => {
  const served = { 1: ["s1", "s2"], 2: ["s2"] };
  // 월(1): s1 배정됨 → 통과
  assert.deepEqual(findUnassignedDays(served, [1], "s1"), []);
  // 화(2): s1 미배정 → [2]
  assert.deepEqual(findUnassignedDays(served, [2], "s1"), [2]);
  // 월·화 동시: 화만 미배정
  assert.deepEqual(findUnassignedDays(served, [1, 2], "s1"), [2]);
});

test("findUnassignedDays: stopId 비면 검증 안 함", () => {
  assert.deepEqual(findUnassignedDays({ 1: [] }, [1], ""), []);
});

test("findUnassignedDays: 미조회 요일은 판정 보류(통과)", () => {
  // servedByDay에 키 없음(slot 미선택/미로드) → 경고 안 띄움
  assert.deepEqual(findUnassignedDays({}, [1, 2], "s1"), []);
});

test("findUnassignedDays: 중복 요일 제거", () => {
  assert.deepEqual(findUnassignedDays({ 2: ["x"] }, [2, 2, 2], "s1"), [2]);
});

test("formatWeekdayList: 요일 번호 → 라벨", () => {
  assert.equal(formatWeekdayList([2, 4]), "화·목");
  assert.equal(formatWeekdayList([5, 1, 3]), "월·수·금"); // 정렬
});

test("pickServedBus: 1대 자동, 공유 정류장은 선택 필수, 요청 호차는 운행 호차여야", () => {
  assert.ok("error" in pickServedBus(undefined));
  assert.ok("error" in pickServedBus([]));
  assert.deepEqual(pickServedBus(["b1"]), { busId: "b1" });
  assert.deepEqual(pickServedBus(["b1"], "b1"), { busId: "b1" });
  assert.ok("error" in pickServedBus(["b1"], "b2"));
  assert.ok("error" in pickServedBus(["b1", "b2"]));
  assert.deepEqual(pickServedBus(["b1", "b2"], "b2"), { busId: "b2" });
});

test("busRouteStops: 선택 호차가 모든 요일에 운행하는 정류장만, 노선 순서(동순위 이름순)", () => {
  const r = (day_of_week, bus_number_id, bus_stop_id, sort_order) => ({ day_of_week, bus_number_id, bus_stop_id, stop_name: bus_stop_id, sort_order });
  const rows = [
    r(1, "b1", "c", 0), r(1, "b1", "b", 1), r(1, "b1", "a", 1), r(1, "b2", "z", 0),
    r(2, "b1", "a", 5), r(2, "b1", "c", 9),
  ];
  assert.deepEqual(busRouteStops(rows, "b1", [1]).map((s) => s.id), ["c", "a", "b"]);
  // 화요일엔 b 미운행 → 제외. 순서는 가장 이른 요일(월) 기준
  assert.deepEqual(busRouteStops(rows, "b1", [2, 1]).map((s) => s.id), ["c", "a"]);
  assert.deepEqual(busRouteStops(rows, "b2", [1, 2]), []);
  assert.deepEqual(busRouteStops(rows, "", [1]), []);
});

test("inferRouteBus: 호차 미지정 + 운행 호차 1대면 그 호차, 아니면 그대로", () => {
  const r = (day_of_week, bus_number_id, bus_stop_id) => ({ day_of_week, bus_number_id, bus_stop_id, stop_name: bus_stop_id, sort_order: 0 });
  const rows = [r(1, "b1", "s"), r(2, "b1", "s"), r(1, "b2", "s"), r(1, "b2", "t")];
  assert.equal(inferRouteBus(rows, "", "s", [1, 2]), "b1"); // b2 는 화 미운행
  assert.equal(inferRouteBus(rows, "", "s", [1]), ""); // 공유 → 추측 안 함
  assert.equal(inferRouteBus(rows, "bx", "s", [1]), "bx");
  assert.equal(inferRouteBus(rows, "", "", [1]), "");
});

test("toServedStopIds: 요일 → 정류장 ID 목록", () => {
  assert.deepEqual(toServedStopIds({ 1: { a: ["b1"], c: ["b1", "b2"] }, 2: {} }), { 1: ["a", "c"], 2: [] });
});
