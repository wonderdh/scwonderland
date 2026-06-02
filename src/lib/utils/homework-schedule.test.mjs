import test from "node:test";
import assert from "node:assert/strict";
import { getUnitSchedule } from "./homework-schedule.ts";

// 요일: 1=월 3=수 5=금. 2026-06: 01(월) 03(수) 05(금) 08(월) 10(수) 12(금).

test("휴원일에도 제출은 나가고 검사만 다음 등원일로 미뤄진다", () => {
  const r = getUnitSchedule({
    startDate: "2026-06-01",
    startUnit: 1,
    totalUnits: 4,
    homeworkDays: [1, 3, 5],
    meetDays: [1, 3, 5],
    skipDates: [],
    closedDates: ["2026-06-03"], // 수요일 휴원
  });
  assert.deepEqual(r, [
    { unit: 1, date: "2026-06-01", issueDate: "2026-05-29" },
    { unit: 2, date: "2026-06-05", issueDate: "2026-06-01" },
    { unit: 3, date: "2026-06-05", issueDate: "2026-06-03" },
    { unit: 4, date: "2026-06-08", issueDate: "2026-06-05" },
  ]);
});

test("한 검사일에 여러 unit 이 collapse 없이 모두 emit 된다", () => {
  const r = getUnitSchedule({
    startDate: "2026-06-01",
    startUnit: 1,
    totalUnits: 4,
    homeworkDays: [1, 3, 5],
    meetDays: [1, 3, 5],
    skipDates: [],
    closedDates: ["2026-06-03"],
  });
  const onJun5 = r.filter((x) => x.date === "2026-06-05");
  assert.equal(onJun5.length, 2);
  assert.deepEqual(
    onJun5.map((x) => x.unit).sort((a, b) => a - b),
    [2, 3]
  );
});

test("책별 예외일(skipDates)은 부여·검사 양쪽에서 제외된다", () => {
  const r = getUnitSchedule({
    startDate: "2026-06-01",
    startUnit: 1,
    totalUnits: 4,
    homeworkDays: [1, 3, 5],
    meetDays: [1, 3, 5],
    skipDates: ["2026-06-03"],
    closedDates: [],
  });
  assert.equal(
    r.some((x) => x.issueDate === "2026-06-03"),
    false
  );
  assert.deepEqual(r, [
    { unit: 1, date: "2026-06-01", issueDate: "2026-05-29" },
    { unit: 2, date: "2026-06-05", issueDate: "2026-06-01" },
    { unit: 3, date: "2026-06-08", issueDate: "2026-06-05" },
    { unit: 4, date: "2026-06-10", issueDate: "2026-06-08" },
  ]);
});

test("closedDates 미지정 시 기존 동작과 호환(전부 정상 등원)", () => {
  const r = getUnitSchedule({
    startDate: "2026-06-01",
    startUnit: 1,
    totalUnits: 3,
    homeworkDays: [1, 3, 5],
    meetDays: [1, 3, 5],
    skipDates: [],
  });
  assert.deepEqual(r, [
    { unit: 1, date: "2026-06-01", issueDate: "2026-05-29" },
    { unit: 2, date: "2026-06-03", issueDate: "2026-06-01" },
    { unit: 3, date: "2026-06-05", issueDate: "2026-06-03" },
  ]);
});
