// Standalone verification for src/lib/utils/homework-schedule.ts
// (no test framework in the repo — inline replica of the algorithm + isValidGradingDate)
// Run: node scripts/verify-homework-schedule.mjs
//
// Tests (PR1 + PR2 + PR3):
//   PR1
//     1) F4 guard: invalid startUnit (0, -3, NaN, 1.5) → empty result
//     2) Regression: Joy/Joyce 나기창 C-02 (startDate=2026-05-27, startUnit=15, MWF, total=20)
//        → unit 15 graded on 2026-05-27, unit 14 → 5/25, unit 16 → 5/29
//     3) isValidGradingDate: weekend / not_meet_day / closed_day / skip_day / ok
//     4) Meet-day-only check (부여=월·수, 수업=월·수·금 → 검사=수·금, 월 없음)
//   PR2
//     5) F6 dynamic MAX_ITER: totalUnits=200 + homeworkDays=[1] (월만) → 모든 unit 1..200 cover
//     6) F7 collision dedupe: hwDays=[1,3] + meetDays=[5] → 같은 검사일에 1 unit (마지막 issue 가 winner)
//   PR3
//     7) F14 ymdToKstWeekday throws on malformed input
//     8) F15 toDate early-break: 좁은 윈도우 → 결과 cut off

// ── inline replica of homework-schedule.ts (lock-step with TS file) ──
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function ymdToKstWeekday(ymd) {
  if (!YMD_RE.test(ymd)) {
    throw new Error(`[ymdToKstWeekday] invalid YMD format: ${JSON.stringify(ymd)}`);
  }
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
  // F6: dynamic MAX_ITER
  const MAX_ITER = Math.max(730, (totalUnits + 2) * 14);
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
  // F7: dedupe by grading day, keep LAST issue
  const eventByGrading = new Map();
  for (const issue of issueDays) {
    const grading = gradingDayFor(issue);
    if (grading) eventByGrading.set(grading, { issue, grading });
  }
  const events = [...eventByGrading.values()].sort((a, b) => ymdCompare(a.grading, b.grading));
  if (events.length === 0) return result;
  const anchorIdx = events.findIndex(e => ymdCompare(e.grading, startDate) >= 0);
  if (anchorIdx === -1) return result;
  for (let k = 0; k < events.length; k++) {
    const unit = startUnit + (k - anchorIdx);
    if (unit < 1 || unit > totalUnits) continue;
    const date = events[k].grading;
    // F15: toDate early-break
    if (toDate && ymdCompare(date, toDate) > 0) break;
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

console.log("\n[1] PR1 — getUnitSchedule F4 invalid startUnit guard");
{
  const common = { startDate: "2026-05-27", totalUnits: 20, homeworkDays: [1, 3, 5], meetDays: [1, 3, 5], skipDates: [] };
  for (const bad of [0, -3, NaN, 1.5]) {
    const out = getUnitSchedule({ ...common, startUnit: bad });
    assert(`startUnit=${String(bad)} → empty`, out.length === 0, `got ${out.length} entries`);
  }
  const ok = getUnitSchedule({ ...common, startUnit: 15 });
  assert(`startUnit=15 → non-empty schedule`, ok.length > 0);
}

console.log("\n[2] PR1 — Regression Joy/Joyce 나기창 C-02");
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

console.log("\n[3] PR1 — User rule (부여=월·수 / 수업=월·수·금 → 검사일=수·금)");
{
  const sched = getUnitSchedule({
    startDate: "2026-05-22",
    startUnit: 4,
    totalUnits: 10,
    homeworkDays: [1, 3],
    meetDays: [1, 3, 5],
    skipDates: [],
  });
  const dows = new Set(sched.map((s) => ymdToKstWeekday(s.date)));
  assert(`검사일 요일 ⊆ {수(3), 금(5)} (월요일 없음)`, !dows.has(1) && dows.has(3) && dows.has(5), `dows=${[...dows].join(",")}`);
}

console.log("\n[4] PR1 — isValidGradingDate reason 매핑");
{
  const meet = [1, 3, 5];
  const r1 = isValidGradingDate("2026-05-30", meet, [], []);
  assert(`Saturday → weekend`, !r1.ok && r1.reason === "weekend");
  const r2 = isValidGradingDate("2026-05-26", meet, [], []);
  assert(`Tuesday with MWF → not_meet_day`, !r2.ok && r2.reason === "not_meet_day");
  const r3 = isValidGradingDate("2026-05-27", meet, ["2026-05-27"], []);
  assert(`Wed in closedDates → closed_day`, !r3.ok && r3.reason === "closed_day");
  const r4 = isValidGradingDate("2026-05-29", meet, [], ["2026-05-29"]);
  assert(`Fri in skipDates → skip_day`, !r4.ok && r4.reason === "skip_day");
  const r5 = isValidGradingDate("2026-05-25", meet, [], []);
  assert(`Mon valid → ok`, r5.ok === true);
  const r6 = isValidGradingDate("2026-05-26", [], [], []);
  assert(`empty meetDays → ok`, r6.ok === true);
}

console.log("\n[5] PR2 — F6 dynamic MAX_ITER (totalUnits=200, hwDays=[1] only)");
{
  const sched = getUnitSchedule({
    startDate: "2026-05-25", // 월요일
    startUnit: 100,
    totalUnits: 200,
    homeworkDays: [1],
    meetDays: [1, 3, 5],
    skipDates: [],
  });
  const m = new Map(sched.map((s) => [s.unit, s.date]));
  assert(`unit 1 included`, m.has(1), `total entries: ${sched.length}`);
  assert(`unit 200 included`, m.has(200));
  assert(`unit 100 anchor at startDate`, (() => {
    // Mon 부여 → 다음 등원(Wed). 따라서 startDate=Mon, 그 Mon 의 grading=Wed.
    // backward 한 칸: prev Mon → Wed prev. anchor 는 startDate(Mon) 이상 grading 의 첫 이벤트.
    // 결국 unit 100 의 grading 은 5/27(수) (다음 등원).
    return m.get(100) === "2026-05-27";
  })(), `unit 100 expected 2026-05-27, got ${m.get(100)}`);
}

console.log("\n[6] PR2 — F7 collision dedupe (hwDays=[1,3] meetDays=[5])");
{
  const sched = getUnitSchedule({
    startDate: "2026-05-29", // 금요일
    startUnit: 1,
    totalUnits: 10,
    homeworkDays: [1, 3],
    meetDays: [5],
    skipDates: [],
  });
  const dates = sched.map((s) => s.date);
  const uniqueDates = new Set(dates);
  assert(`결과의 모든 date 가 unique (collision dedupe)`, dates.length === uniqueDates.size,
    `dates=${dates.length} unique=${uniqueDates.size}`);
  // 같은 금요일에 collapse 된 Mon/Wed 중 Wed(나중) 이 winner — unit 1 의 검사일은 5/29 (그 주의 금).
  assert(`unit 1 → 2026-05-29 (Wed 부여분이 winner)`,
    sched.find((s) => s.unit === 1)?.date === "2026-05-29",
    `got ${sched.find((s) => s.unit === 1)?.date}`);
}

console.log("\n[7] PR3 — F14 ymdToKstWeekday throws on malformed");
{
  let threw1 = false;
  try { ymdToKstWeekday(""); } catch { threw1 = true; }
  assert(`empty string → throw`, threw1);
  let threw2 = false;
  try { ymdToKstWeekday("2026/05/27"); } catch { threw2 = true; }
  assert(`wrong separator → throw`, threw2);
  let threw3 = false;
  try { ymdToKstWeekday("2026-5-27"); } catch { threw3 = true; }
  assert(`unpadded → throw`, threw3);
  // valid case should NOT throw
  let threw4 = false;
  try { ymdToKstWeekday("2026-05-27"); } catch { threw4 = true; }
  assert(`valid YYYY-MM-DD → no throw`, !threw4);
}

console.log("\n[8] PR3 — F15 toDate early-break");
{
  const all = getUnitSchedule({
    startDate: "2026-05-27",
    startUnit: 15,
    totalUnits: 20,
    homeworkDays: [1, 3, 5],
    meetDays: [1, 3, 5],
    skipDates: [],
  });
  const bounded = getUnitSchedule({
    startDate: "2026-05-27",
    startUnit: 15,
    totalUnits: 20,
    homeworkDays: [1, 3, 5],
    meetDays: [1, 3, 5],
    skipDates: [],
    toDate: "2026-05-29",
  });
  assert(`전체보다 좁은 결과`, bounded.length < all.length);
  assert(`toDate 초과 entry 없음`, bounded.every((r) => r.date <= "2026-05-29"));
  assert(`anchor unit 15 포함`, bounded.some((r) => r.unit === 15));
}

console.log("\n────────────────────────────────────────");
console.log(`Total: ${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
