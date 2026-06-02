# 숙제 제출일/검사일 분리 + 휴원일 부여 유지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 학원 휴원일에도 숙제(제출)는 그대로 나가고 검사만 다음 등원일로 미뤄지도록 `getUnitSchedule` 을 고치고, unit 마다 제출일(issue)·검사일(grading)을 둘 다 보유해 리스트뷰에서 "제출 → 검사" 2컬럼으로 보여준다.

**Architecture:** 순수 함수 `getUnitSchedule` 의 `skipDates`(책별 예외일, 부여·검사 양쪽 제외) 와 새 `closedDates`(학원 휴원일, 검사일만 제외) 를 분리하고, "한 검사일당 가장 늦은 부여만 남기던" collapse 를 제거해 unit=제출일 1:1 로 고정한다. 반환값에 `issueDate` 를 추가하고, 호출부(액션 3 + 모달 2 + 교사뷰 1 + 미리보기 1)가 두 인자를 분리 전달하도록 전파한다. DB 스키마 변경 없음(전부 파생 계산).

**Tech Stack:** TypeScript, Next.js 16 App Router, React 19. 테스트는 별도 프레임워크 없이 Node 24 내장 `node --test` + 타입 스트리핑으로 순수 함수를 직접 검증(프로젝트의 `scripts/*.mjs` 관례와 동일).

---

## File Structure

| 파일 | 역할 | 변경 |
|---|---|---|
| `src/lib/utils/homework-schedule.ts` | 순수 스케줄 계산 | 시그너처에 `closedDates` 추가, collapse 제거, `issueDate` 반환 |
| `src/lib/utils/homework-schedule.test.mjs` | 순수 함수 단위 테스트 | **신규** |
| `src/app/(admin)/admin/actions/homework-unit-actions.ts` | 진도 read 액션 3종 | skip/closed 분리 전달, unit 에 `submitDate` 추가 |
| `src/app/(admin)/admin/homework/_components/HomeworkSchedulePreview.tsx` | 부여/수정 모달 미리보기 | `closedDates` prop, 2컬럼 렌더, key 수정 |
| `.../AssignClassHomeworkModal.tsx`, `.../EditClassHomeworkModal.tsx` | 부여/수정 모달 | 병합 제거, 미리보기에 skip/closed 분리 전달 |
| `src/app/academy/teacher/homework/_components/TeacherTextbooksClient.tsx` | 교사 일정 미리보기 | skip/closed 분리, 2컬럼 렌더, key 수정 |
| `src/components/homework/UnitProgressGrid.tsx` | unit 그리드(셀=검사일) | 타입에 `submitDate?` 추가(시각 변화 없음) |

---

### Task 1: 순수 함수 `getUnitSchedule` — closedDates 분리 + issueDate + collapse 제거

**Files:**
- Test: `src/lib/utils/homework-schedule.test.mjs` (Create)
- Modify: `src/lib/utils/homework-schedule.ts` (`UnitAssignment` 타입 73-78, `getUnitSchedule` 158-294)

- [ ] **Step 1: 실패하는 테스트 작성**

Create `src/lib/utils/homework-schedule.test.mjs`:

```js
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
    // 06-03(휴원)에도 제출 발생 → unit 3 생성, 검사는 06-05 로 collapse 되지만 둘 다 유지
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
    skipDates: ["2026-06-03"], // 이 책은 수요일에 쉼 → 제출 자체가 없음
    closedDates: [],
  });
  // 06-03 에는 unit 이 생기지 않고, 같은 검사일에 몰리는 unit 도 없음
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
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test src/lib/utils/homework-schedule.test.mjs`
Expected: FAIL — 현재 함수는 `closedDates` 를 무시하고 `issueDate` 를 반환하지 않으므로 `deepEqual` 불일치(`issueDate` 누락 + 날짜 차이). `MODULE_TYPELESS_PACKAGE_JSON` 경고는 무해(무시).

- [ ] **Step 3: 타입 + 함수 구현**

`src/lib/utils/homework-schedule.ts` 의 `UnitAssignment` (73-78) 를 교체:

```ts
export type UnitAssignment = {
  /** YYYY-MM-DD (KST) — 검사일(grading) */
  date: string;
  /** 1-based unit number */
  unit: number;
  /** YYYY-MM-DD (KST) — 제출일(issue, 숙제 나가는 날) */
  issueDate: string;
};
```

`getUnitSchedule` 의 params 타입(158-170)에서 `skipDates: string[];` 아래에 한 줄 추가:

```ts
  skipDates: string[];
  /** 학원 휴원일 (0=일~6=토 아님, YYYY-MM-DD). 검사일에서만 제외; 부여(제출)는 진행. */
  closedDates?: string[];
```

destructure(171-180)에 `closedDates,` 추가:

```ts
  const {
    startDate,
    startUnit,
    totalUnits,
    homeworkDays,
    meetDays,
    skipDates,
    closedDates,
    fromDate,
    toDate,
  } = params;
```

`skipSet` 선언(194) 아래에 한 줄 추가:

```ts
  const skipSet = new Set(skipDates ?? []);
  const closedSet = new Set(closedDates ?? []);
```

`nextMeetDay` 의 조건(204)을 교체 — 검사 후보일에서 휴원일도 제외:

```ts
      if (meetSet.has(wd) && !skipSet.has(cur) && !closedSet.has(cur)) return cur;
```

(참고: `collectIssueDays`(229-243)는 그대로 둔다 — 이미 `hwSet`/`skipSet` 만 보고 `closedSet` 은 안 보므로 휴원일에도 제출이 나간다.)

collapse 블록(255-262)을 교체 — Map 대신 배열로 모든 부여 유지:

```ts
  // 부여일 → 검사일 이벤트. 한 검사일에 여러 부여가 모여도 모두 유지(collapse 안 함).
  // unit = 제출일 1:1. issueDays 는 이미 오름차순이지만 안전하게 정렬.
  const events: { issue: string; grading: string }[] = [];
  for (const issue of issueDays) {
    const grading = gradingDayFor(issue);
    if (grading) events.push({ issue, grading });
  }
  events.sort(
    (a, b) => ymdCompare(a.issue, b.issue) || ymdCompare(a.grading, b.grading)
  );
```

emit 루프(283-290)를 교체 — `issueDate` 포함:

```ts
  for (let k = 0; k < events.length; k++) {
    const unit = startUnit + (k - anchorIdx);
    if (unit < 1 || unit > totalUnits) continue;
    const date = events[k].grading;
    // F15: toDate 초과 시 종료 (events 는 부여일=검사일 오름차순).
    if (toDate && ymdCompare(date, toDate) > 0) break;
    if (inRange(date)) result.push({ date, unit, issueDate: events[k].issue });
  }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test src/lib/utils/homework-schedule.test.mjs`
Expected: PASS — `tests 4 / pass 4 / fail 0`.

- [ ] **Step 5: 타입체크**

Run: `pnpm type-check`
Expected: 통과. (`closedDates` 는 optional 이라 기존 호출부 4곳은 그대로 컴파일; `issueDate` 는 추가 필드라 `.date`/`.unit` 만 읽던 호출부 영향 없음.)

- [ ] **Step 6: 커밋**

```bash
git add src/lib/utils/homework-schedule.ts src/lib/utils/homework-schedule.test.mjs
git commit -m "feat(homework-schedule): closedDates 분리 + issueDate 반환 + collapse 제거"
```

---

### Task 2: read 액션 3종 — skip/closed 분리 + submitDate 추가

**Files:**
- Modify: `src/app/(admin)/admin/actions/homework-unit-actions.ts`
  - 타입 `StudentTextbookUnits.units` (37-43)
  - `listClassUnitProgressDetailed` (242-356)
  - `listSeriesLevelProgress` (464-560)
  - `listUnitProgressByStudent` (687-741)

- [ ] **Step 1: units 타입에 submitDate 추가**

`StudentTextbookUnits.units` (37-43) 의 항목에 `submitDate` 추가:

```ts
  units: Array<{
    unitNumber: number;
    status: UnitStatus;
    expectedDate: string | null;
    /** 제출일(issue, 숙제 나가는 날). 검사일=expectedDate. */
    submitDate: string | null;
    completedAt: string | null;
    note: string | null;
  }>;
```

- [ ] **Step 2: `listClassUnitProgressDetailed` 수정**

`expectedByBook` 선언(242)을 교체:

```ts
  const expectedByBook = new Map<string, Map<number, { grading: string; issue: string }>>();
```

`getUnitSchedule` 호출(260-267)의 `skipDates:` 줄을 교체:

```ts
    const schedule = getUnitSchedule({
      startDate: b.start_date,
      startUnit: b.start_unit,
      totalUnits: b.total_units,
      homeworkDays: b.homework_days,
      meetDays,
      skipDates: b.skip_dates,
      closedDates,
    });
```

맵 채우기(268-270)를 교체:

```ts
    const m = new Map<number, { grading: string; issue: string }>();
    for (const s of schedule) m.set(s.unit, { grading: s.date, issue: s.issueDate });
    expectedByBook.set(b.chbId, m);
```

조립부 unit 매핑(332-342)을 교체:

```ts
      const units = Array.from({ length: unitsCount }, (_, i) => {
        const unitNumber = i + 1;
        const status = m?.get(unitNumber) ?? ("pending" as UnitStatus);
        const e = exp?.get(unitNumber);
        return {
          unitNumber,
          status,
          expectedDate: e?.grading ?? null,
          submitDate: e?.issue ?? null,
          completedAt: null,
          note: null,
        };
      });
```

- [ ] **Step 3: `listSeriesLevelProgress` 수정**

`expectedByBook` 선언(464)을 교체:

```ts
  const expectedByBook = new Map<string, Map<number, { grading: string; issue: string }>>();
```

`getUnitSchedule` 호출(477-484)의 `skipDates:` 줄을 교체:

```ts
    const schedule = getUnitSchedule({
      startDate: b.start_date,
      startUnit: b.start_unit,
      totalUnits: b.total_units,
      homeworkDays: b.homework_days,
      meetDays,
      skipDates: b.skip_dates,
      closedDates,
    });
```

맵 채우기(485-487)를 교체:

```ts
    const m = new Map<number, { grading: string; issue: string }>();
    for (const s of schedule) m.set(s.unit, { grading: s.date, issue: s.issueDate });
    expectedByBook.set(b.chbId, m);
```

units 매핑(551-560)을 교체:

```ts
    const units = Array.from({ length: Math.max(0, b.total_units) }, (_, i) => {
      const unitNumber = i + 1;
      const e = exp?.get(unitNumber);
      return {
        unitNumber,
        status: statusByUnit.get(unitNumber) ?? ("pending" as UnitStatus),
        expectedDate: e?.grading ?? null,
        submitDate: e?.issue ?? null,
        completedAt: null,
        note: null,
      };
    });
```

- [ ] **Step 4: `listUnitProgressByStudent` 수정**

`expectedByUnit` 선언(687)을 교체:

```ts
    const expectedByUnit = new Map<number, { grading: string; issue: string }>();
```

`getUnitSchedule` 호출 + 루프(697-706)를 교체:

```ts
        for (const s of getUnitSchedule({
          startDate,
          startUnit,
          totalUnits,
          homeworkDays,
          meetDays,
          skipDates,
          closedDates,
        })) {
          expectedByUnit.set(s.unit, { grading: s.date, issue: s.issueDate });
        }
```

units 매핑(732-741)을 교체:

```ts
    const units = Array.from({ length: unitsCount }, (_, i) => {
      const unitNumber = i + 1;
      const e = expectedByUnit.get(unitNumber);
      return {
        unitNumber,
        status: statusByUnit.get(unitNumber) ?? ("pending" as UnitStatus),
        expectedDate: e?.grading ?? null,
        submitDate: e?.issue ?? null,
        completedAt: null,
        note: null,
      };
    });
```

- [ ] **Step 5: 타입체크**

Run: `pnpm type-check`
Expected: 통과.

- [ ] **Step 6: 커밋**

```bash
git add src/app/\(admin\)/admin/actions/homework-unit-actions.ts
git commit -m "feat(homework-actions): skip/closed 분리 전달 + unit submitDate 추가"
```

---

### Task 3: `HomeworkSchedulePreview` — closedDates prop + 2컬럼 + key 수정

**Files:**
- Modify: `src/app/(admin)/admin/homework/_components/HomeworkSchedulePreview.tsx` (Props 24-38, 호출 71-78, 렌더 130-159)

- [ ] **Step 1: Props 에 closedDates 추가**

`Props` 의 `skipDates` 설명(34-35) 아래에 추가:

```ts
  /** 책별 예외일(skip) — 부여·검사 양쪽 제외. */
  skipDates: string[];
  /** 학원 공통 휴원일 — 검사일만 제외, 제출은 나감. */
  closedDates: string[];
```

함수 시그너처 destructure(44-52)에 `closedDates,` 추가:

```ts
export function HomeworkSchedulePreview({
  startDate,
  startUnit,
  totalUnits,
  homeworkDays,
  meetDays,
  skipDates,
  closedDates,
  limit = 8,
}: Props) {
```

- [ ] **Step 2: getUnitSchedule 호출에 closedDates 전달**

`getUnitSchedule` 호출(71-78)을 교체:

```ts
    return getUnitSchedule({
      startDate,
      startUnit,
      totalUnits,
      homeworkDays,
      meetDays,
      skipDates,
      closedDates,
    })
      .filter((r) => r.date >= startDate)
      .slice(0, limit);
```

`useMemo` 의존성 배열(81-91)에 `closedDates` 추가:

```ts
  }, [
    startDate,
    startDateMalformed,
    startUnitInvalid,
    startUnit,
    totalUnits,
    homeworkDays,
    meetDays,
    skipDates,
    closedDates,
    limit,
  ]);
```

- [ ] **Step 3: 렌더를 2컬럼(제출 → 검사) + key=unit 로 교체**

`return (` 블록(130-159)을 교체:

```tsx
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2">
      <p className="px-1.5 pb-1 text-[10px] text-slate-400">제출일 → 검사일</p>
      <ul className="divide-y divide-slate-100">
        {rows.map((r, i) => (
          <li
            key={r.unit}
            className="flex items-center justify-between px-1.5 py-1 text-xs"
          >
            <span className="flex items-center gap-1">
              <span className="tabular-nums text-slate-500">
                {formatPreviewDate(r.issueDate)}
              </span>
              <span className="text-slate-300">→</span>
              <span
                className={
                  i === 0
                    ? "font-semibold text-slate-900 tabular-nums"
                    : "text-slate-600 tabular-nums"
                }
              >
                {formatPreviewDate(r.date)}
              </span>
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
```

- [ ] **Step 4: 타입체크**

Run: `pnpm type-check`
Expected: 실패 — `HomeworkSchedulePreview` 를 쓰는 두 모달이 `closedDates` prop 을 아직 안 넘김. (Task 4 에서 해결.)

- [ ] **Step 5: 커밋**

```bash
git add src/app/\(admin\)/admin/homework/_components/HomeworkSchedulePreview.tsx
git commit -m "feat(homework-preview): 제출/검사 2컬럼 + closedDates prop + key 수정"
```

---

### Task 4: 부여/수정 모달 — 병합 제거 + skip/closed 분리 전달

**Files:**
- Modify: `src/app/(admin)/admin/homework/_components/AssignClassHomeworkModal.tsx` (63-66, 274-281)
- Modify: `src/app/(admin)/admin/homework/_components/EditClassHomeworkModal.tsx` (63-66, 282-289)

- [ ] **Step 1: Assign 모달 — previewSkipDates 제거**

`AssignClassHomeworkModal.tsx` 의 `previewSkipDates` useMemo(63-66)를 통째로 삭제:

```ts
  const previewSkipDates = useMemo(
    () => Array.from(new Set([...skipDates, ...closedDates])),
    [skipDates, closedDates]
  );
```

- [ ] **Step 2: Assign 모달 — 미리보기 prop 분리**

`<HomeworkSchedulePreview ...>` (274-281)의 `skipDates={previewSkipDates}` 를 교체:

```tsx
            <HomeworkSchedulePreview
              startDate={startDate}
              startUnit={startUnitNum}
              totalUnits={maxUnit}
              homeworkDays={homeworkDays}
              meetDays={meetDays}
              skipDates={skipDates}
              closedDates={closedDates}
            />
```

- [ ] **Step 3: Edit 모달 — previewSkipDates 제거**

`EditClassHomeworkModal.tsx` 의 `previewSkipDates` useMemo(63-66)를 통째로 삭제(위와 동일 블록).

- [ ] **Step 4: Edit 모달 — 미리보기 prop 분리**

`<HomeworkSchedulePreview ...>` (282-289)의 `skipDates={previewSkipDates}` 를 교체:

```tsx
            <HomeworkSchedulePreview
              startDate={startDate}
              startUnit={startUnitNum}
              totalUnits={maxUnit}
              homeworkDays={homeworkDays}
              meetDays={meetDays}
              skipDates={skipDates}
              closedDates={closedDates}
            />
```

- [ ] **Step 5: 타입체크 + lint(미사용 import 확인)**

Run: `pnpm type-check && pnpm lint`
Expected: 통과. (`useMemo` 가 두 모달에서 다른 곳에도 쓰이므로 import 는 그대로 유지됨 — lint 의 no-unused 경고 없음.)

- [ ] **Step 6: 커밋**

```bash
git add src/app/\(admin\)/admin/homework/_components/AssignClassHomeworkModal.tsx src/app/\(admin\)/admin/homework/_components/EditClassHomeworkModal.tsx
git commit -m "feat(homework-modals): 미리보기에 skip/closed 분리 전달"
```

---

### Task 5: 교사뷰 — skip/closed 분리 + 2컬럼 미리보기 + key 수정

**Files:**
- Modify: `src/app/academy/teacher/homework/_components/TeacherTextbooksClient.tsx` (호출 70-78, 렌더 189-198)

- [ ] **Step 1: getUnitSchedule 호출 분리**

`getUnitSchedule` 호출(70-77)을 교체 — 교사뷰는 책별 skip 을 관리하지 않으므로 `skipDates: []`, 휴원일은 `closedDates` 로:

```ts
    return getUnitSchedule({
      startDate,
      startUnit: assignment.start_unit ?? 1,
      totalUnits,
      homeworkDays,
      meetDays,
      skipDates: [], // 교사뷰는 책별 예외일 미관리(현행과 동일)
      closedDates,
    }).slice(0, 7);
```

- [ ] **Step 2: 미리보기 리스트를 2컬럼 + key=unit 로 교체**

`preview.map(...)` (190-197)를 교체:

```tsx
                {preview.map((p) => (
                  <li key={p.unit} className="text-xs text-slate-700">
                    제출 {formatPreviewDate(p.issueDate)} → 검사{" "}
                    {formatPreviewDate(p.date)}{" "}
                    <span className="font-semibold text-blue-700">U{p.unit}</span>
                  </li>
                ))}
```

- [ ] **Step 3: 타입체크**

Run: `pnpm type-check`
Expected: 통과.

- [ ] **Step 4: 커밋**

```bash
git add src/app/academy/teacher/homework/_components/TeacherTextbooksClient.tsx
git commit -m "feat(teacher-homework): 제출/검사 2컬럼 미리보기 + skip/closed 분리"
```

---

### Task 6: 그리드 타입 보강 + 전체 검증

**Files:**
- Modify: `src/components/homework/UnitProgressGrid.tsx` (`UnitGridUnit` 22-28)

- [ ] **Step 1: UnitGridUnit 에 submitDate(optional) 추가**

`UnitGridUnit` (22-28)에 한 줄 추가 — 시각 변화 없음, 액션 데이터와 타입 정합성 확보:

```ts
export type UnitGridUnit = {
  unitNumber: number;
  status: UnitStatus;
  expectedDate: string | null;
  /** 제출일(issue). 그리드 셀은 검사일만 표시하므로 렌더에는 미사용. */
  submitDate?: string | null;
  completedAt: string | null;
  note: string | null;
};
```

- [ ] **Step 2: 순수 함수 테스트 재실행**

Run: `node --test src/lib/utils/homework-schedule.test.mjs`
Expected: PASS (`pass 4 / fail 0`).

- [ ] **Step 3: 타입체크 + lint**

Run: `pnpm type-check && pnpm lint`
Expected: 모두 통과.

- [ ] **Step 4: 프로덕션 빌드(회귀 방지)**

Run: `pnpm build`
Expected: 빌드 성공.

- [ ] **Step 5: 커밋**

```bash
git add src/components/homework/UnitProgressGrid.tsx
git commit -m "chore(homework-grid): UnitGridUnit 에 submitDate(optional) 추가"
```

---

## 수동 확인 (실행 후)

- `/admin/homework` → 반 선택 → 책 부여/수정 모달: 미리보기가 "제출일 → 검사일" 2컬럼으로 뜨고, 휴원일이 낀 주에 제출은 유지되며 검사일만 다음 등원일로 밀리는지.
- 학원 휴원일(`/admin/closed-days` 등)에 날짜를 넣고 진도 그리드의 검사일이 그 날을 건너뛰는지(셀은 검사일 단일 표시 유지).
- 같은 검사일에 unit 2개가 몰리는 케이스에서 둘 다 보이는지(이전엔 하나 사라짐).

## 비범위

- 그리드 셀 시각 변경(검사일 단일 유지).
- `startDate` 기준 변경, DB 스키마/마이그레이션.
