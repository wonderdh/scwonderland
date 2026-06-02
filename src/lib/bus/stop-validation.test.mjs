import test from "node:test";
import assert from "node:assert/strict";
import { dowFromYmd, findUnassignedDays, formatWeekdayList } from "./stop-validation.ts";

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
