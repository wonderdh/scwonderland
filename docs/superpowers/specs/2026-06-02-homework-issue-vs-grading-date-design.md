# 숙제 제출일/검사일 분리 + 휴원일 부여 유지 — 설계

작성일: 2026-06-02

## 문제

`getUnitSchedule`(순수 함수, `src/lib/utils/homework-schedule.ts`)는 unit 을
**검사일(grading date)** 기준으로만 계산해 반환한다. 내부적으로 부여일(issue)도
들고 있지만 버린다.

또한 현재는 **학원 휴원일(`academy_closed_days`)** 과 **책별 예외일(`skip_dates`)**
을 하나의 `skipDates` 로 합쳐서 호출부에서 넘기고, 부여일 수집과 검사일 계산
**양쪽**에서 제외한다.

실제 운영은 다르다:

- 학원 휴원일(쉬는날)에도 **숙제(제출)는 그대로 나간다**. 단지 그날 **검사를
  안 할 뿐**이다. 검사는 다음 등원일로 미뤄진다.
- 현재 로직은 휴원일에 부여 자체를 건너뛰어, 쉬는날이 끼면 unit 이 통째로
  하나씩 밀리거나(F7 collapse) 사라진다.

## 원하는 동작

1. **휴원일(closedDates)**: 제출은 나가고(부여일 수집에 **포함**), 검사일 계산에서만
   제외 → 검사는 다음 등원일로 미뤄짐.
2. **책별 예외일(skipDates)**: 그 책 자체가 쉬는 날. 부여·검사 **양쪽에서 제외**
   (현행 유지).
3. unit 1개 = 부여일(제출일) 1개로 **1:1 고정**. 검사일은 파생값이라 여러 unit 이
   같은 검사일에 몰려도 허용한다(한 검사일에 여러 unit 검사).
4. unit 마다 **제출일(issue)** 과 **검사일(grading)** 을 둘 다 데이터로 보유.
   - 그리드 셀: **검사일만** 표시(현행 유지, 시각 변화 없음).
   - 리스트뷰(부여/수정 모달의 일정 미리보기, 교사뷰 미리보기): **제출 → 검사**
     두 컬럼으로 표시.

## 알고리즘 변경 (`getUnitSchedule`)

### 시그너처

`skipDates` 하나를 두 개로 분리한다.

```ts
getUnitSchedule(params: {
  startDate: string;
  startUnit: number;
  totalUnits: number;
  homeworkDays: number[];
  meetDays: number[];
  skipDates: string[];    // 책별 예외일 — 부여·검사 양쪽 제외 (현행 의미)
  closedDates: string[];  // 학원 휴원일 — 검사일 계산에서만 제외, 부여는 진행 (신규)
  fromDate?: string;
  toDate?: string;
}): UnitAssignment[]
```

`UnitAssignment` 에 `issueDate` 추가:

```ts
export type UnitAssignment = {
  date: string;       // 검사일 (grading)
  unit: number;
  issueDate: string;  // 제출일 (issue) — 신규
};
```

### 로직

- **부여일 수집(`collectIssueDays`)**: `hwSet.has(wd) && !skipSet.has(cur)`
  — `closedDates` 는 검사하지 않음(휴원일에도 제출은 나감).
- **검사일 후보(`nextMeetDay`)**: `meetSet.has(wd) && !skipSet.has(cur) && !closedSet.has(cur)`
  — 휴원일·책예외일 모두 검사일에서 제외.
- **collapse 제거**: 검사일별로 "가장 늦은 부여만 남기던" `eventByGrading` Map 을
  없애고, 부여일마다 이벤트 `{issue, grading}` 를 **모두** 유지(검사일 중복 허용).
- **정렬/앵커**: 이벤트를 부여일 오름차순으로 정렬(= unit 순서. grading 은 issue 에
  대해 단조 비감소이므로 검사일 정렬과 동일). `anchorIdx` = 검사일이 `startDate`
  이상인 첫 이벤트 → 그게 `startUnit`. `unit_k = startUnit + (k - anchorIdx)`,
  `1..totalUnits` 범위만 emit. 반환은 `{ date: grading, unit, issueDate: issue }`.
- **`startDate` 의미 불변**: 여전히 `startUnit` 의 **검사일**(meet/비휴원/비예외).
  한 검사일에 여러 unit 이 몰리면 그중 **가장 먼저 부여된 unit** 이 `startUnit`.
- 기존 진단 로그(`gradingDayFor` null, `anchorIdx===0 && startUnit>1`)는 유지.

## 영향 파일

### 1. `src/lib/utils/homework-schedule.ts`
- `UnitAssignment` 에 `issueDate` 추가.
- `getUnitSchedule` 시그너처에 `closedDates` 추가, 위 로직 반영(부여 수집에서
  closed 미제외, 검사 후보에서 closed 제외, collapse 제거, issueDate 반환).
- `isValidGradingDate` 는 이미 `closedDates`/`skipDates` 를 분리해 받으므로 변경 없음.

### 2. `src/app/(admin)/admin/actions/homework-unit-actions.ts` (호출 3곳)
- `listClassUnitProgressDetailed` / `listSeriesLevelProgress` /
  `listUnitProgressByStudent` 에서 `skipDates: [...b.skip_dates, ...closedDates]`
  병합을 제거하고 `skipDates: b.skip_dates`, `closedDates` 를 분리 전달.
- unit→검사일 맵을 unit→`{grading, issue}` 로 확장(또는 issue 맵 추가).
- `StudentTextbookUnits.units` 항목에 `submitDate: string | null`(=issueDate) 추가,
  조립부에서 `expectedDate=grading`, `submitDate=issue` 로 채움.

### 3. `src/app/(admin)/admin/homework/_components/HomeworkSchedulePreview.tsx`
- `getUnitSchedule` 호출에 `closedDates` 분리 전달(현재 합쳐진 `skipDates` 1개만 받음
  → prop 에 `closedDates` 추가).
- 행을 **제출 → 검사** 두 컬럼으로 렌더.
- `key={r.date}` → `key={r.unit}` (검사일 중복 시 key 충돌 해결).

### 4. `src/app/(admin)/admin/homework/_components/AssignClassHomeworkModal.tsx`,
### `EditClassHomeworkModal.tsx`
- `Array.from(new Set([...skipDates, ...closedDates]))` 병합 제거.
- `HomeworkSchedulePreview` 에 `skipDates`, `closedDates` 를 **각각** 전달.

### 5. `src/app/academy/teacher/homework/_components/TeacherTextbooksClient.tsx`
- `getUnitSchedule({ ..., skipDates: closedDates })` →
  `skipDates: assignment.skip_dates ?? []`, `closedDates: closedDates`.
- 미리보기 리스트를 **제출 → 검사** 두 컬럼으로 표시(리스트뷰 일관성).

### 6. `src/components/homework/UnitProgressGrid.tsx`
- 시각 변화 없음. units 항목 타입에 `submitDate?: string | null` 추가(렌더는 무시).
- 소비처(`BoardStudentList`, `ClassUnitProgressList`, `StudentRow`,
  `academy/student/homework/page.tsx`)는 타입만 통과하면 됨(추가 필드는 optional).

## 엣지 케이스

- 휴원일이 부여 요일과 겹침 → 제출 발생(정상).
- 휴원일이 등원(검사 후보)일과 겹침 → 검사일이 다음 등원일로 이동.
- 부여일 A·B 가 같은 검사일로 모임 → unit 2개 모두 그 검사일에 emit(허용).
- 책별 예외일은 부여·검사 양쪽에서 제외(현행과 동일).

## 테스트

- `getUnitSchedule` 순수 함수 단위 테스트(있으면 확장, 없으면 신규):
  - 휴원일에 부여 유지 + 검사일 다음 등원일 이동.
  - 한 검사일에 여러 unit collapse 없이 모두 emit.
  - 책별 예외일은 부여·검사 둘 다 제외.
  - `issueDate` 정확성, `startUnit` 앵커(검사일 startDate).
- `pnpm type-check` 통과(시그너처/타입 변경 전파 확인).

## 비범위 (이번 변경 안 함)

- 그리드 셀 시각 변경(검사일 단일 표시 유지).
- `startDate` 를 검사일이 아닌 다른 기준으로 바꾸는 것.
- DB 스키마 변경(컬럼 추가/마이그레이션 없음 — 전부 파생 계산).
