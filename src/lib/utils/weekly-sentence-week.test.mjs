import test from "node:test";
import assert from "node:assert/strict";
import { getCurrentSunday, computeAutoWeekNumber } from "./weekly-sentence-week.ts";

// 2026-06: 07(일) 08(월) 10(수) 13(토) 14(일). 2026-05-31(일), 2025-12-28(일).

test("일요일 입력은 그 일요일을 그대로 반환 (회귀: UTC 서버에서 한 주 전 반환 버그)", () => {
  assert.equal(getCurrentSunday("2026-06-14"), "2026-06-14");
  assert.equal(getCurrentSunday("2026-06-07"), "2026-06-07");
});

test("주중/주말 입력은 해당 주 일요일로 내림", () => {
  assert.equal(getCurrentSunday("2026-06-08"), "2026-06-07"); // 월
  assert.equal(getCurrentSunday("2026-06-10"), "2026-06-07"); // 수
  assert.equal(getCurrentSunday("2026-06-13"), "2026-06-07"); // 토
});

test("월 경계를 넘는 일요일 계산", () => {
  assert.equal(getCurrentSunday("2026-06-01"), "2026-05-31"); // 월 → 전월 일요일
});

test("연 경계를 넘는 일요일 계산", () => {
  assert.equal(getCurrentSunday("2026-01-01"), "2025-12-28"); // 목 → 전년 일요일
});

test("computeAutoWeekNumber: 기준 주 이전이면 baseWeek 유지, 이후는 주 단위 +1", () => {
  assert.equal(computeAutoWeekNumber(3, "2026-06-07", "2026-06-05"), 3); // 이전
  assert.equal(computeAutoWeekNumber(3, "2026-06-07", "2026-06-07"), 3); // 같은 주
  assert.equal(computeAutoWeekNumber(3, "2026-06-07", "2026-06-14"), 4); // 1주 후
  assert.equal(computeAutoWeekNumber(3, "2026-06-07", "2026-06-21"), 5); // 2주 후
});

test("computeAutoWeekNumber: 48주 순환", () => {
  // baseWeek 48 에서 1주 후 → 49 가 아니라 1 로 순환
  assert.equal(computeAutoWeekNumber(48, "2026-06-07", "2026-06-14"), 1);
});
