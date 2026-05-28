// Standalone verification for src/lib/utils/homework-schedule.ts
// (no test framework in the repo — inline replica of the algorithm + isValidGradingDate)
// Run: node scripts/verify-homework-schedule.mjs
//
// Tests:
//   1) F4 guard: invalid startUnit (0, -3, NaN, 1.5) → empty result
//   2) Regression: Joy/Joyce 나기창 C-02 (startDate=2026-05-27, startUnit=15, MWF, total=20)
//      → unit 15 graded on 2026-05-27, unit 14 → 5/25, unit 16 → 5/29
//   3) isValidGradingDate: weekend / not_meet_day / closed_day / skip_day / ok
//   4) Meet-day-only check (matches user rule: 부여=월·수, 수업=월·수·금 → 검사=수·금)

// ── inline replica of homework-schedule.ts (kept in lock-step with the TS file) ──
function ymdToKstWeekday(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
function nextDay(s) {
  const [y, m, d] = s.split("-").map(Number);
  const n = new Date(Date.UTC(y, m - 1, d + 1));
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}-${String(n.getUTCDate()).padStart(2, "0")}`;
}
function prevDay(s) {
  const [y, m, d] = s.split("-").map(Number);
  const p = new Date(Date.UTC(y, m - 1, d - 1));
  return `${p.getUTCFullYear()}-${String(p.getUTCMonth() + 1).padStart(2, "0")}-${String(p.getUTCDate()).padStart(2, "0")}`;
}
function ymdCompare(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function isValidGradingDate(date, meetDays, closedDates, skipDates) {
  const wd = ymdToKstWeekday(date);
  if (wd === 0 || wd === 6) return { ok: false, reason: "weekend" };
  if (meetDays.length > 0 && !meetDays.includes(wd)) {
    return { ok: false, reason: "not_meet_day" };
  }
  if (closedDates.includes(date)) return { ok: false, reason: "closed_day" };
  if (skipDates.includes(date)) return { ok: false, reason: "skip_day" };
  return { ok: true };
}

function getUnitSchedule({ startDate, startUnit, totalUnits, homeworkDays, meetDays, skipDates, fromDate, toDate }) {
  const result = [];
  if (!startDate || !homeworkDays?.length || !meetDays?.length) return result;
  if (!Number.isInteger(startUnit) || startUnit < 1 || startUnit > totalUnits) return result;
  const hwSet = new Set(homeworkDays);
  const meetSet = new Set(meetDays);
  const skipSet = new Set(skipDates ?? []);
  const MAX_ITER = 730;
  function nextMeetDay(f) {
    let cur = f;
    for (let i = 0; i < MAX_ITER; i++) {
      const wd = ymdToKstWeekday(cur);
      if (meetSet.has(wd) && !skipSet.has(cur)) return cur;
      cur = nextDay(cur);
    }
    return null;
  }
  function gradingDayFor(iss) {
    return nextMeetDay(nextDay(iss));
  }
  function inRange(date) {
    return (!fromDate || ymdCompare(date, fromDate) >= 0) && (!toDate || ymdCompare(date, toDate) <= 0);
  }
  function collectIssueDays(f, dir, max) {
    const days = [];
    let cur = f;
    for (let i = 0; i < MAX_ITER && days.length < max; i++) {
      const wd = ymdToKstWeekday(cur);
      if (hwSet.has(wd) && !skipSet.has(cur)) days.push(cur);
      cur = dir > 0 ? nextDay(cur) : prevDay(cur);
    }
    return days;
  }
  const maxNeeded = totalUnits + 2;
  const backward = collectIssueDays(prevDay(startDate), -1, maxNeeded);
  const forward = collectIssueDays(startDate, 1, maxNeeded);
  const issueDays = [...backward.reverse(), ...forward];
  const events = issueDays
    .map((issue) => ({ issue, grading: gradingDayFor(issue) }))
    .filter((e) => e.grading !== null);
  if (events.length === 0) return result;
  const anchorIdx = events.findIndex((e) => ymdCompare(e.grading, startDate) >= 0);
  if (anchorIdx === -1) return result;
  for (let k = 0; k < events.length; k++) {
    const unit = startUnit + (k - anchorIdx);
    if (unit < 1 || unit > totalUnits) continue;
    const date = events[k].grading;
    if (inRange(date)) result.push({ date, unit });
  }
  result.sort((a, b) => a.unit - b.unit);
  return result;
}

// ── test harness ──
let pass = 0;
let fail = 0;
function assert(name, cond, detail) {
  if (cond) {
    pass++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } else {
    fail++;
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    if (detail) console.log(`      ${detail}`);
  }
}

console.log("\n[1] getUnitSchedule — F4 invalid startUnit guard");
{
  const common = { startDate: "2026-05-27", totalUnits: 20, homeworkDays: [1, 3, 5], meetDays: [1, 3, 5], skipDates: [] };
  for (const bad of [0, -3, NaN, 1.5]) {
    const out = getUnitSchedule({ ...common, startUnit: bad });
    assert(`startUnit=${String(bad)} → empty`, out.length === 0, `got ${out.length} entries`);
  }
  // sanity: valid startUnit still works
  const ok = getUnitSchedule({ ...common, startUnit: 15 });
  assert(`startUnit=15 → non-empty schedule`, ok.length > 0);
}

console.log("\n[2] Regression — Joy/Joyce 나기창 C-02");
{
  const sched = getUnitSchedule({
    startDate: "2026-05-27",
    startUnit: 15,
    totalUnits: 20,
    homeworkDays: [1, 3, 5],
    meetDays: [1, 3, 5],
    skipDates: [],
  });
  const m = new Map(sched.map((s) => [s.unit, s.date]));
  assert(`unit 15 → 2026-05-27 (수)`, m.get(15) === "2026-05-27", `got ${m.get(15)}`);
  assert(`unit 14 → 2026-05-25 (월)`, m.get(14) === "2026-05-25", `got ${m.get(14)}`);
  assert(`unit 16 → 2026-05-29 (금)`, m.get(16) === "2026-05-29", `got ${m.get(16)}`);
}

console.log("\n[3] User rule — 부여=월·수 / 수업=월·수·금 → 검사일=수·금 (월 없음)");
{
  const sched = getUnitSchedule({
    startDate: "2026-05-22",
    startUnit: 4,
    totalUnits: 10,
    homeworkDays: [1, 3], // 월·수 부여
    meetDays: [1, 3, 5], // 월·수·금 등원
    skipDates: [],
  });
  const dows = new Set(sched.map((s) => ymdToKstWeekday(s.date)));
  assert(`검사일 요일 ⊆ {수(3), 금(5)} (월요일 없음)`, !dows.has(1) && dows.has(3) && dows.has(5), `dows=${[...dows].join(",")}`);
}

console.log("\n[4] isValidGradingDate — reason 매핑");
{
  const meet = [1, 3, 5]; // 월·수·금
  const closed = ["2026-05-27"];
  const skip = ["2026-05-29"];
  // 토요일
  const r1 = isValidGradingDate("2026-05-30", meet, [], []);
  assert(`Saturday → weekend`, !r1.ok && r1.reason === "weekend");
  // 화요일 (비-meet-day)
  const r2 = isValidGradingDate("2026-05-26", meet, [], []);
  assert(`Tuesday with MWF meetDays → not_meet_day`, !r2.ok && r2.reason === "not_meet_day");
  // closed_day 우선순위 (meet-day지만 closed)
  const r3 = isValidGradingDate("2026-05-27", meet, closed, []);
  assert(`Wed in closedDates → closed_day`, !r3.ok && r3.reason === "closed_day");
  // skip_day (meet-day + 아니고 closed_day도 아닌데 skipDates 포함)
  const r4 = isValidGradingDate("2026-05-29", meet, [], skip);
  assert(`Fri in skipDates → skip_day`, !r4.ok && r4.reason === "skip_day");
  // ok
  const r5 = isValidGradingDate("2026-05-25", meet, [], []);
  assert(`Mon valid → ok`, r5.ok === true);
  // meetDays 빈 배열 → 정보 없음으로 통과
  const r6 = isValidGradingDate("2026-05-26", [], [], []);
  assert(`empty meetDays → ok (caller responsibility)`, r6.ok === true);
}

console.log("\n────────────────────────────────────────");
console.log(`Total: ${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
