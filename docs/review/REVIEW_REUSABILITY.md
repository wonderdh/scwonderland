# 재사용성 & 단순화 리뷰

> 대상: `src/app/(admin)/admin/actions/*` (20+ 파일), `src/components/*`, `src/lib/*`, `src/app/academy/*`, `src/app/(monitor)/*`, `supabase/migrations/*`
> 작성일: 2026-05-19
> 작성자: code-simplifier (read-only review)

---

## 1. 요약

### Top 10 추출/리팩토링 후보 (ROI 높은 순)

| # | 후보 | 위치 | 영향 |
|---|------|------|------|
| 1 | **`withAdminAction` / `withTeacherAction` mutation wrapper** (auth + revalidate + logger + error map) | 새 `src/lib/server/with-action.ts` | 23 파일, ~150회 반복 boilerplate 제거 |
| 2 | **`ActionResult<T>` 통일 마이그레이션 가속** (이미 `src/lib/types/server-action.ts` 정의됨 — 실제 4개 파일만 import) | 25 파일의 `Promise<{ error?: string }>` (107회) | 호출자 분기 통일 |
| 3 | **`GROUP_LABEL_TO_TYPE` / `GROUP_TYPE_TO_LABEL` 중복 정의** | `src/lib/constants/class.ts` ↔ `src/lib/server/domain-helpers.ts` 양쪽에 동일 정의 | 한 곳으로 통합 |
| 4 | **`Array.isArray(x) ? x[0] : x` (Supabase 관계 쿼리 unwrap) 헬퍼** | 53회 inline 반복 (21 파일) | `unwrapRelation(x)` 유틸 |
| 5 | **`formData.get("foo") as string`.trim() 패턴** | 56회 (7 파일, `notice/publisher/series/textbook/user/weekly-sentence/homework-unit-actions`) | `parseFormString(formData, "foo", { required, normalizeWhitespace })` |
| 6 | **`new Date().toISOString()` updated_at 직접 작성** | 197회 — DB trigger `tg_set_updated_at` 가 publishers/series 등에는 이미 있음 | trigger 일괄 적용 후 client-side 제거 |
| 7 | **월/연도 → `startDate` / `endDate` 계산** | `attendance-actions.ts:33-39`, `:291-295` (동일 로직 2회) + 다른 액션도 유사 | `getYearMonthRangeKst(year, month)` → `date-kst.ts` |
| 8 | **NULL/whitespace 정규화** `name?.trim().replace(/\s+/g, " ") ?? ""` | `publisher-actions.ts:91,128`, `series-actions.ts:171,219` (4회 동일) | `normalizeName(raw)` helper |
| 9 | **`onConflict: "student_id,attendance_date"` upsert 반복** | `attendance-actions.ts:81,267,346` (3회 동일) — `bulkRecordAttendance` 와 `recordAttendance` 가 거의 동일한 로직 | `upsertAttendance(rows)` 내부 헬퍼 |
| 10 | **`error.code === "23505" || error.message.includes("unique")`** 중복 정의 | `publisher-actions.ts:109,157`, `series-actions.ts:200,280` (4회) | `isPgUniqueViolation(error)` helper |

### Top 5 dead code / 미사용

| # | 항목 | 위치 | 비고 |
|---|------|------|------|
| 1 | **`ConfirmDialog.danger` prop** | `src/components/overlays/ConfirmDialog.tsx:17` | `variant="danger"` 와 완전 중복; `danger` 사용처 0건 — 주석에 "Kept optional so existing callers using `variant` still work" 라고 명시되어 있으나, 모든 callsite (25곳) 가 이미 `variant` 만 사용 |
| 2 | **`getNoticeWithAttachments` 의 `images: []`, `attachments: []` 빈 배열 리턴** | `notice-actions.ts:36-52` | 첨부 기능 없음 — 타입에 `never[]` 로 박혀 있어 dead shape |
| 3 | **`getClassLinkedCounts` 의 `homeworkCount: 0`, `noticeCount: 0`** | `class-actions.ts:505-516` | 항상 하드코딩 0 리턴 |
| 4 | **`AdminStudentClassItem.student_number: null`** | 여러 `class-actions.ts` 리턴 (`:277,341,627`) | student_number 컬럼 미사용 — 타입에서 제거 가능 |
| 5 | **`StudentSelectedView` / `StudentGroupedList` 등의 `english_name` 폴백 chain `??`** | 17회 반복 — `formatStudentName` 유틸 미사용 | dead-pattern: 유틸 있는데 적용 안 됨 |

---

## 2. 서버 액션 boilerplate 패턴

### 2.1 mutation 액션 표준 패턴 (~150회 반복)

20여 파일에서 다음과 거의 동일한 구조가 반복된다.

```ts
// notice-actions.ts:54-89 (representative)
export async function createNotice(formData: FormData)
  : Promise<{ error?: string; id?: string }> {
  const auth = await verifyAdmin();                       // ← (1)
  if ("error" in auth) return { error: auth.error };      // ← (2)
  const title = (formData.get("title") as string)?.trim();// ← (3) parsing
  if (!title) return { error: "제목을 입력해 주세요." };  // ← (4) validation
  const supabase = createAdminClient();                   // ← (5)
  const { data, error } = await supabase.from(...).insert(...).select("id").single();
  if (error) {                                            // ← (6) error map
    logger.error("[createNotice]", error.message);
    return { error: error.message };
  }
  revalidatePath(REVALIDATE_PATH);                        // ← (7) revalidate
  return { id: data.id };
}
```

`(1)`/`(2)`/`(5)`/`(6)`/`(7)` 은 거의 동일. `(3)`/`(4)` 만 도메인별.

**측정**:
- `verifyAdmin()` 호출: **115회 / 22 파일** (`auth-helpers.ts:38` 외)
- `if ("error" in auth) return` 가드: **161회 / 23 파일**
- `revalidatePath(...)`: **80회 / 16 파일**
- `createAdminClient()`: **178회 / 27 파일**
- `logger.error/warn/info`: **197회 / 24 파일**
- `Promise<{ error?: string ... }>` 시그니처: **107회 / 25 파일**

### 2.2 제안 — `withAdminAction` wrapper (신규 파일 `src/lib/server/with-action.ts`)

```ts
// 시그니처 예시 — 실제 구현은 별도 plan
export type ActionContext = {
  supabase: AdminClient;
  userId: string;
};

export function withAdminAction<TArgs extends unknown[], TData>(
  options: { name: string; revalidate?: string | string[] },
  fn: (ctx: ActionContext, ...args: TArgs) => Promise<ActionResult<TData>>
): (...args: TArgs) => Promise<ActionResult<TData>>;

// 사용 예
export const createNotice = withAdminAction(
  { name: "createNotice", revalidate: "/admin/notices" },
  async ({ supabase, userId }, formData: FormData) => {
    const title = parseFormString(formData, "title", { required: true });
    if (!title.ok) return fail(title.error);
    const { data, error } = await supabase.from("notices").insert({ ... }).single();
    if (error) return fail(error.message);
    return ok({ id: data.id });
  }
);
```

**기대 효과**:
- 22 파일 평균 30% 축소 (auth 가드 + revalidate + logger 한 줄씩 사라짐)
- 작성 누락 방지: revalidate 빼먹는 사고 (`reservation-actions.ts:1` 만 `revalidatePath` 1회, mutation 다수 누락 의심) 일괄 보장
- 로깅 정책 일원화 (현재 일부는 `logger.error("[name]", err.message)`, 일부는 `logger.error("[name] xxx]", ...)` 등 prefix 표기 비균질)

### 2.3 `report-actions.ts` `@auth-skip` 3건 — 부분 헬퍼 적용 가능

3건 모두 `getUser` + `getUserRoles` + `teacher_type === "native"` + 담당반/소유권 패턴을 수동 검증.

- `:92` — 담당반 membership 수동 검증
- `:189` — `teacher_id === user.id` 수동 검증
- `:241` — `row.student_profile_id === user.id` 소유권 수동 검증

**제안**: `verifyNativeTeacherForStudent(studentProfileId)`, `verifyReportOwnership(reportCardId)` 두 헬퍼를 `auth-helpers.ts` 에 추가. wrapper 까지 갈 필요 없는 OneShot 케이스.

---

## 3. 함수 / 유틸 추출 후보

### 3.1 Supabase 관계 쿼리 unwrap — 신규 `src/lib/utils/supabase-relation.ts`

`Array.isArray(x) ? x[0] : x` 패턴이 **inline 53회 / 21 파일**.

대표 위치:
- `class-actions.ts:140` `const period = Array.isArray(c.period) ? c.period[0] : c.period;`
- `class-actions.ts:191`, `:245` 동일
- `report-actions.ts:367` `m.classes as unknown as { name: string; group_type: string } | null;` (다른 변형)
- `weekly-sentence-actions.ts:3` (3회 in 1 file)
- `bus/master-actions.ts:10` (10회)
- `bus/change-actions.ts:8` (8회)
- `bus/board-actions.ts:3` (3회)

**제안**:
```ts
// src/lib/utils/supabase-relation.ts
export function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
```

20+ 파일에서 동일 한 줄 → 함수 호출로 단순화.

### 3.2 KST 월 범위 헬퍼

`attendance-actions.ts:33-39` 와 `:291-295` 에 동일한 로직:

```ts
const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
const endDate = month === 12
  ? `${year + 1}-01-01`
  : `${year}-${String(month + 1).padStart(2, "0")}-01`;
```

**제안**: `date-kst.ts` 에 추가
```ts
export function getKstMonthRange(year: number, month: number)
  : { startDate: string; endDate: string };
```

`weekly-sentence-week.ts`, `homework-schedule.ts` 도 비슷한 패턴 — 검토 권장.

### 3.3 `parseFormString` / `parseFormBoolean` / `parseFormInt`

`formData.get("...") as string` 패턴 — **56회 / 7 파일**.

대표:
- `notice-actions.ts:59` `const title = (formData.get("title") as string)?.trim();`
- `notice-actions.ts:64` `const is_published = formData.get("is_published") === "true";`
- `series-actions.ts:177-181` total_units 파싱 + 검증
- `publisher-actions.ts:90-92` name 정규화 + required check

**제안 시그니처**:
```ts
function parseFormString(fd: FormData, key: string, opts?: {
  required?: boolean;
  normalizeWhitespace?: boolean;
  maxLength?: number;
}): { ok: true; value: string } | { ok: false; error: string };
```

### 3.4 Postgres unique violation 감지 헬퍼

```ts
// publisher-actions.ts:109,157, series-actions.ts:200,280 (4회 동일)
if (error.code === "23505" || error.message.includes("unique")) {
  return { error: `'${name}' 출판사가 이미 존재합니다. ...` };
}
```

**제안**: `src/lib/server/pg-errors.ts`
```ts
export function isPgUniqueViolation(error: { code?: string; message?: string }): boolean;
```

### 3.5 클래스별 학생 수 집계 reducer (`Record<string, number>`)

`class-actions.ts:181-188` 에서 동일한 reduce가 두 번 (members, schedules):

```ts
const studentCountByClass = (members ?? []).reduce((acc, row) => {
  acc[row.class_id] = (acc[row.class_id] ?? 0) + 1;
  return acc;
}, {} as Record<string, number>);
```

`lunch-actions.ts:48-50` 도 동일 패턴 (Map 버전):
```ts
for (const m of memberships ?? []) {
  countMap.set(m.class_id, (countMap.get(m.class_id) ?? 0) + 1);
}
```

**제안**: `src/lib/utils/group-count.ts`
```ts
export function countByKey<T, K extends string>(rows: T[], keyFn: (row: T) => K): Map<K, number>;
```

### 3.6 attendance status validation

`attendance-actions.ts:65,240,325` 에서 동일:
```ts
if (!["present", "absent", "late", "early_leave"].includes(status)) {
  return { error: "올바른 출결 상태를 선택해 주세요." };
}
```

이미 `src/lib/constants/attendance.ts:10` 에 `ATTENDANCE_STATUSES` 가 있는데도 **import 안 함**.

**제안**: `isAttendanceStatus(s)` type guard 를 `attendance.ts` 에 추가하고 모든 액션에서 사용.

### 3.7 `getKindergartenFirstPeriodId` 등 1회 조회 캐시

`class-actions.ts:64-74` — 호출마다 DB 1회. `createClass`, `updateClass` 두 군데서 호출.

**제안**: React `cache()` 로 감싸기 (이미 `auth-helpers.ts` 와 `publisher-actions.ts`, `series-actions.ts:36` 가 사용 중인 패턴).

### 3.8 lunch-actions.ts `revalidatePath` 5중 호출

`setClassLunchGroup` 등 5개 액션이 모두:
```ts
revalidatePath("/admin/lunch");
revalidatePath("/admin/lunch/settings");
revalidatePath("/lunch-monitor");
```

**제안**: `LUNCH_REVALIDATE_PATHS` 상수 + `revalidateMany(paths: string[])` (또는 wrapper 의 `revalidate` 옵션이 배열 지원).

---

## 4. 컴포넌트 추출 후보

### 4.1 `EmptyState` / `LoadingState` / `Spinner` / `ErrorScreen` 미적용 사이트 다수

이미 `src/components/feedback/` 에 4개 존재 (`EmptyState.tsx`, `LoadingState.tsx`, `Spinner.tsx`, `ErrorScreen.tsx`). 그러나 적용은 35 파일 / 97 occurrences 만 — 다수 페이지가 여전히 inline "로딩 중..." `<p>` 또는 빈 `<div>` 사용 추정 (예: `BusMonitorClient.tsx:216` `"로딩..."`, `:239` `"시간대를 선택해주세요."` 등).

**제안**: 일괄 grep 후 inline placeholder → `<EmptyState />` 치환. 단순화 + UI 통일.

### 4.2 `ConfirmDialog` 의 `variant`/`danger` 이중 prop

`ConfirmDialog.tsx:11-17`:
```ts
variant?: "danger" | "primary";
danger?: boolean;  // ← variant="danger" 와 완전 중복, "Kept optional" 주석
```

**제안**: `danger` prop 제거 + callsite 일괄 마이그레이션 (현재 25 파일이 import 중이지만 `danger` 직접 사용처는 0건).

### 4.3 도메인별 `ClassPicker` / `StudentPicker` / `TeacherPicker` 중복 의심

- `src/components/forms/SeriesPicker.tsx`, `PublisherPicker.tsx`, `SeriesLevelPicker.tsx` 가 존재 — 하지만
- `BusStudentAssignmentManager.tsx`, `ClassesManager.tsx`, `BulkPasswordResetDialog.tsx`, `AddTeacherForm.tsx`, `AddStudentForm.tsx` 등 학생/교사/반 선택 UI 가 각자 inline 구현

**제안 (Plan 별도)**: 한 번에 추출하기엔 범위가 크므로, 새 기능 추가 시 `StudentPicker` 를 만들어 점진 흡수.

### 4.4 admin & academy 학생 카드 중복

- `StudentGroupedList.tsx`, `StudentSelectedView.tsx`, `StudentRow` (LunchMonitor `:173`), academy/teacher 의 학생 행
- 공통: `korean_name`/`english_name` 표시 + age 배지 + 결석 strikethrough

**제안**: `<StudentNameDisplay student={...} variant="card|row|monitor" />` 추출.
다만 `LunchMonitorClient.tsx:173-237` StudentRow 는 TV-monitor 특화 (3xl + 큰 leader 표시) — 너무 다른 컨텍스트라 공유 부적합. admin 쪽 17개 callsite 만 통합 권장.

### 4.5 `MonitorBusCard` ↔ academy bus 학생 카드

`src/components/bus/MonitorBusCard.tsx` 는 admin & monitor 양쪽에서 사용 중 — **이미 잘 추출됨**. academy/student/bus 의 카드와 share 가능한지 확인 필요 (별도 plan).

### 4.6 `ConfirmDialog` 의 inline 색상 클래스

`ConfirmDialog.tsx:46-51` 의 confirmClass / cancelClass 가 inline string. 동일 톤이 다른 곳에도 — `src/components/ui/button.tsx` variant 시스템을 활용해 inline 클래스를 줄일 수 있음 (단순화).

---

## 5. 안 쓰이는 유틸 / dead code

### 5.1 `ConfirmDialog.danger` prop — 완전 미사용

`ConfirmDialog.tsx:17-18`. 25 callsite 중 `danger` 전달 0건 (모두 `variant="danger"` 또는 default). **제거 가능**.

### 5.2 `getNoticeWithAttachments` 의 빈 배열

`notice-actions.ts:36-52` 의 `images: never[]; attachments: never[]` — 첨부 기능 미구현. 호출자가 사용 안 하면 시그니처 단순화 가능.

### 5.3 `getClassLinkedCounts` 의 미사용 카운터

`class-actions.ts:505-516` — `homeworkCount: 0`, `noticeCount: 0` 하드코딩. UI 가 표시 안 한다면 제거.

### 5.4 `AdminStudentClassItem.student_number`

`class-actions.ts:277,341,627` 등에서 항상 `student_number: null`. 컬럼 자체가 미사용 — 타입 + 리턴에서 제거 권장.

### 5.5 `lib/types/server-action.ts` 가 거의 안 쓰임

`ActionResult<T>` / `ok` / `fail` / `okVoid` 정의는 잘 되어 있으나 — 실제 import 는 **4 파일** (`server-action.ts` 자체 포함). 25 파일이 여전히 `Promise<{ error?: string }>` 사용 중.

**점진 마이그레이션 권장** (`server-action.ts:23` 의 주석도 같은 의도).

### 5.6 `weekly-sentence-actions.ts` try/catch 1건

`Grep` 결과 `try/catch + logger` 가 admin/actions 전체에서 단 1 파일 (`weekly-sentence-actions.ts`). 다른 파일은 supabase error object 검사로 처리 — 일관성 위해 `weekly-sentence-actions.ts` 도 동일 패턴으로 단순화 가능 (또는 wrapper 가 try/catch 흡수).

---

## 6. 타입 / 상수 중복

### 6.1 GROUP_LABEL_TO_TYPE / GROUP_TYPE_TO_LABEL 이중 정의

- `src/lib/constants/class.ts:6-15` — `Record<string, string>` 타입
- `src/lib/server/domain-helpers.ts:5-15` — `as const` 타입

둘 다 같은 값. 11 파일이 사용. **server 쪽 (`as const`) 만 남기고 constants 는 re-export** 하거나 반대로 단일 소스화.

### 6.2 `GROUP_ORDER` 와 위 두 매핑

`class.ts:2` 의 `GROUP_ORDER = ["유치부", "오후반", "방과후"] as const` 는 sort 용. `GROUP_TYPE_TO_LABEL` 의 key 순서와 동기. 한 모듈로 묶는 게 자연스러움.

### 6.3 `WEEKDAY_NAMES_5`, `WEEKDAY_NAMES_7`, `KST_DAY_LABELS`, `DAY_LABELS`

- `src/lib/constants/date.ts:1-13` — `WEEKDAY_NAMES_5`, `WEEKDAY_NAMES_7`
- `src/lib/utils/date-kst.ts:14` — `KST_DAY_LABELS` (0=일 ~ 6=토)
- `src/app/(monitor)/bus-monitor/BusMonitorClient.tsx:13` — `const DAY_LABELS = ["월", "화", "수", "목", "금"] as const;` (file-local 재정의)

`BusMonitorClient` 의 file-local `DAY_LABELS` 는 `WEEKDAY_NAMES_5` 와 완전 동일 — import 로 치환.

### 6.4 `attendance` validStatuses 하드코딩 vs 상수

이미 `ATTENDANCE_STATUSES` 가 `src/lib/constants/attendance.ts:10` 에 있는데 `attendance-actions.ts:65,240,325` 가 `["present", "absent", "late", "early_leave"]` 하드코딩. **상수 import 로 교체**.

### 6.5 `ActionResult` 와 기존 `{ error?: string }` 시그니처 혼재

- `Promise<{ error?: string }>` 매칭 26회 (9 파일)
- 더 광범위한 `{ error?: string` 패턴은 107회 (25 파일)

신규는 `ActionResult<T>` 강제 + 기존 점진 마이그레이션 필요.

### 6.6 `ClassTeacherInfo` 와 `teacher_type: "korean" | "native"` 반복

- `class-actions.ts:39,584`
- `listTeachersForSelect` 의 리턴 타입
- `buildClassTeacherMap` 내부

별도 타입 alias `type TeacherType = "korean" | "native"` 가 어디에도 없음. inline 으로 반복. **`src/lib/types/teacher.ts` 또는 `domain-helpers.ts` 에 추출**.

### 6.7 `student_id` vs `student_profile_id` 이중 명명

`realtime-utils.ts:4-13` 의 코멘트 자체가 설명한다 — shared PK 이후 두 이름이 alias. 그러나 client/server 경계에서 두 이름이 모두 사용되고 `rowStudentId()` 헬퍼가 도와줌. **새 코드는 `student_id` (DB 원본) 만 사용 권장** + 호환 alias 점진 제거.

---

## 7. 명명 / 의도 개선

### 7.1 `handle*` 핸들러 (127회 / 41 파일)

`handleSubmit`, `handleClick`, `handleDelete`, `handleSave`, `handleChange` — React 컴포넌트의 관용 표기라 대부분 OK. 다만 다음은 의미 좁히기 가능:

- `BusMonitorClient.tsx:88` `handleDayChange(newDay)` → OK
- `BusMonitorClient.tsx:96` `handleSlotSelect(slotId)` → OK
- `BusMonitorClient.tsx:100` `handleRefresh()` → OK (관용)

전반적으로 컴포넌트 핸들러는 양호. **`actions/*.ts` 의 `process*` / `do*` 류는 0건** (좋음).

### 7.2 의도 불명 함수명

- `class-actions.ts:77` `resolvePeriodIdForClass` — 이름 OK, 그러나 시그니처가 `groupType` enum 을 string union 으로 강제 cast 받는 점이 불편. `as "kindergarten" | "afternoon" | "afterschool"` cast 가 호출자 2곳에서 반복 (`:368`, `:443`) — 시그니처를 `GroupType` 으로 받으면 cast 불필요.

- `class-actions.ts:18` `buildClassTeacherMap` — OK.

- `class-actions.ts:64` `getKindergartenFirstPeriodId` — OK, 의도 명확.

- `lunch-actions.ts:184` `toBuildInput` — 이름 모호. `mapClassToLunchInput` 정도가 분명함.

- `report-actions.ts:19` `resolveClassStudentId` — OK.

### 7.3 ad-hoc Result 타입 noise

`createClass` 의 리턴이 `Promise<{ error?: string; id?: string }>` — discriminated union 아니라서 호출자가 `if (result.error)` 와 `result.id` 두 번 검사. `ActionResult<{ id: string }>` 로 통일하면 분기 1회.

### 7.4 `dashboard-actions.ts` 등 작은 파일의 일관성

(파일 본문 미확인) `verifyAdmin()` 2회 호출 — 한 파일에 2액션. Wrapper 도입 시 자연스럽게 일관화됨.

---

## 8. 단순화 가능한 추상화

### 8.1 `bulkRecordAttendance` ↔ `recordAttendance` ↔ `bulkReserveAttendance` 3중 구현

`attendance-actions.ts:55, :227, :315` — 세 액션이 거의 동일한 upsert 로직 (`onConflict: "student_id,attendance_date"`). 차이는:

| | recordAttendance | bulkRecordAttendance | bulkReserveAttendance |
|---|---|---|---|
| 입력 | 단건 | 다건 (다 학생/다 날짜) | 단일 학생 + 다 날짜 |
| auth | teacher/admin | admin | admin |
| 부가 동작 | revalidate students | revalidate attendance + m/attendance | + bus_change_requests 연동 |

**제안**: 내부 `_upsertAttendanceRows(rows, ctx)` 헬퍼로 추출 + 각 export 는 입력 변환만. 약 50줄 단순화.

### 8.2 `class-actions.ts`: `createClass` 와 `updateClass` 의 days/period 정규화

`:359-372` 와 `:435-447` 가 거의 동일 (14줄 × 2):

```ts
const groupType = toGroupType(groupLabel ?? null);
const isKindergarten = (groupType ?? "kindergarten") === "kindergarten";
const finalDays = isKindergarten
  ? [1, 2, 3, 4, 5]
  : (daysOfWeek && daysOfWeek.length > 0 ? [...daysOfWeek].sort() : null);
if (!finalDays || finalDays.length === 0) return { error: "..." };
const resolvedPeriodId = await resolvePeriodIdForClass(supabase, ...);
```

**제안**: `normalizeClassDaysAndPeriod(supabase, { groupLabel, daysOfWeek, periodId })` 헬퍼.

### 8.3 `class-actions.ts`: `teacherProfileIds` → `teacher_ids` 변환 중복

`:387-396` (createClass) 와 `:478-488` (updateClass) — 동일 로직 11줄 × 2:
```ts
const teacherRows = await Promise.all(teacherProfileIds.map(id => getTeacherRecordByProfileId(supabase, id)));
const teacherIds = teacherRows.filter(Boolean).map(r => r!.id);
if (teacherIds.length) {
  const { error } = await supabase.from("class_teachers").insert(...);
  if (error) return { error: error.message };
}
```

**제안**: `syncClassTeachers(supabase, classId, teacherProfileIds)` 헬퍼. update 쪽은 `delete().eq("class_id", classId)` 가 선행하므로 옵션으로 처리.

### 8.4 `series-actions.ts` `createSeries` ↔ `updateSeries` form 파싱 중복

`:170-189` (create) 와 `:218-238` (update) 가 거의 동일 — name 정규화, publisher_id, total_units, cover 처리, is_active 처리. **insert vs update 만 다름**.

**제안**: `parseSeriesFormData(formData)` 헬퍼 + upsert payload 빌더.

### 8.5 `publisher-actions.ts` `createPublisher` ↔ `updatePublisher` 동일

`:84-117` 와 `:120-165` — name 파싱, URL 정규화, is_active, unique error 처리 모두 동일. **약 35줄 × 2 → 1 헬퍼**.

### 8.6 `domain-helpers.ts` 의 `getStudentsByIds` / `getTeachersByIds` 거의 동일

`:112-138`. 차이는 테이블명 + select 컬럼만. 제네릭화 가능하나, **2개뿐이므로 over-engineering 위험** — 그대로 둘 것을 권장.

### 8.7 `getLunchSchedule` 의 `toBuildInput`

`lunch-actions.ts:184-194` 의 inline closure — `studentsByClass`, `absentIds` 클로저 캡처 + 변환. 12줄. 인라인 그대로 두는 게 가독성에 더 나음 (closure 변수 노출 안 시키는 게 핵심). **단순화 불필요**.

### 8.8 `BusMonitorClient.tsx` 의 `loadedKeyRef` 캐시 로직

`:67-94` 의 race condition + 중복 로드 방지 패턴 — 잘 구현돼 있으나 복잡. `useSWR` 또는 `react-query` 도입을 고려할 가치 (별도 plan, 현 시점 단순화는 아님).

### 8.9 `BusMonitorClient.tsx` 의 `useEffect` mount-only 자정 경계 체크

`:165-174` — `// eslint-disable-next-line react-hooks/exhaustive-deps` 와 빈 deps. 명확한 의도지만 disable 이 코드 스멜. `useEffectEvent` (실험 API) 또는 `dayOfWeek === initialIsoDay` 조건이 의도와 맞는지 한 번 점검.

### 8.10 `report-actions.ts` 의 3중 `getUser + roles + teacher check` 패턴

`:99-143`, `:194-224`, `:248-268` 의 native-teacher 권한 검증이 거의 동일 로직 (담당반/소유권만 다름).

**제안**: `verifyNativeTeacherForStudent(studentProfileId)` (returns `{ ok, teacher, isAdmin } | { ok: false, error }`).

---

## 9. 우선순위 표 (ROI Top 20)

ROI = (영향 범위) × (단순화 정도) / (구현 비용).

| Rank | 항목 | 영향(파일/회) | 구현 비용 | 추천 |
|------|------|---|---|---|
| 1 | `withAdminAction` wrapper (auth+revalidate+log+error) | 22 파일 / ~150회 | 中 | Plan 별도, 새 액션부터 점진 적용 |
| 2 | `GROUP_LABEL_TO_TYPE` / `GROUP_TYPE_TO_LABEL` 통합 | 11 파일 | 低 | 즉시 |
| 3 | `unwrapRelation(x)` 유틸 추출 | 21 파일 / 53회 | 低 | 즉시 |
| 4 | `BusMonitorClient.DAY_LABELS` → `WEEKDAY_NAMES_5` import | 1 파일 | 低 | 즉시 |
| 5 | `attendance` validStatuses 하드코딩 → `ATTENDANCE_STATUSES` import | 1 파일 / 3회 | 低 | 즉시 |
| 6 | `ActionResult<T>` 마이그레이션 (신규 액션 강제) | 25 파일 | 中 | 가이드라인 + 점진 |
| 7 | `parseFormString` / `parseFormBoolean` / `parseFormInt` 헬퍼 | 7 파일 / 56회 | 低 | 즉시 |
| 8 | `isPgUniqueViolation(error)` 헬퍼 | 2 파일 / 4회 | 低 | 즉시 |
| 9 | `getKstMonthRange(year, month)` → `date-kst.ts` | 1+ 파일 / 2회 + 잠재 | 低 | 즉시 |
| 10 | `class-actions.ts` createClass/updateClass days+period 정규화 헬퍼 | 1 파일 | 低 | 즉시 |
| 11 | `class-actions.ts` `syncClassTeachers` 헬퍼 | 1 파일 | 低 | 즉시 |
| 12 | `series-actions.ts` / `publisher-actions.ts` `parseSeriesForm` / `parsePublisherForm` | 2 파일 / 70+줄 | 低 | 즉시 |
| 13 | `attendance-actions.ts` `_upsertAttendanceRows` 내부 헬퍼 | 1 파일 / 3회 | 低 | 즉시 |
| 14 | `ConfirmDialog.danger` prop 제거 | 1 파일 (사용처 0) | 低 | 즉시 |
| 15 | `report-actions.ts` `verifyNativeTeacherForStudent` 헬퍼 | 1 파일 / 3회 | 中 | Plan 후 즉시 |
| 16 | `countByKey<T,K>` 유틸 | 2+ 파일 | 低 | 즉시 |
| 17 | `lunch-actions.ts` `LUNCH_REVALIDATE_PATHS` 상수 + revalidateMany | 1 파일 / 5회 | 低 | 즉시 |
| 18 | `formatStudentName` 미적용 사이트 일괄 치환 | 17+ 회 | 低 | 즉시 |
| 19 | `student_number: null` dead field 제거 (`AdminStudentClassItem`) | 1 파일 / 3회 | 低 | 즉시 |
| 20 | `getNoticeWithAttachments` 의 `images/attachments` dead shape 제거 | 1 파일 | 低 | 즉시 |

### 즉시 가능 (低 비용 + 안전)

`#2, #3, #4, #5, #7, #8, #9, #14, #16, #18, #19, #20` 은 **모두 behavior-preserving** + 단일 export 영향 — 일괄 PR 가능.

### Plan 별도 필요

- `#1 withAdminAction` — 시그니처 설계 + 점진 마이그레이션 계획 필요 (Plan 1)
- `#6 ActionResult<T>` — 호출자(컴포넌트) 일괄 갱신 필요 (Plan 2)
- `#13 verifyNativeTeacherForStudent` — 권한 정책 표 정리가 선행 (Plan 3)

---

## 10. 부록 — AGENTS.md 와 코드의 괴리

### 10.1 `verifyAdmin` 의 cache() 가 잘못 적용된 사례 없음

`auth-helpers.ts` 의 3 함수 모두 React `cache()` 정상 사용. AGENTS 규약 충족.

### 10.2 `// @auth-skip` 주석은 `report-actions.ts:92,189,241` 3건만 — 규약 준수

다른 mutation 액션은 모두 `verifyAdmin()` / `verifyTeacherOrAdmin()` 호출 첫 줄.

### 10.3 FK 컨벤션 (supabase/AGENTS.md "FK 컨벤션") 위반 없음 확인

`lunch_supervision.sql` 의 `leader_student_id → students(id)`, `first_class_id → classes(id)`, `created_by → profiles(id)` 모두 컨벤션 일치.

### 10.4 admin actions 파일 외부에서 `verifyAdmin` import 흔적

`Grep` 결과 `verifyAdmin()` 호출은 `admin/actions/` 외부에서 발견되지 않음 — AGENTS 규약 ("`(academy)` / `(bus)` 의 actions 는 별도") 준수.

### 10.5 마이그레이션 SQL 보일러플레이트

- RLS enable: 32회 / 7 파일 (테이블별 1회씩 정상)
- `CREATE POLICY`: 143회 / 11 파일
- `tg_set_updated_at` trigger: 7 파일에 적용 (baseline + 6 후속 마이그) — 그러나 client 코드에서 여전히 `updated_at: new Date().toISOString()` 197회. **DB trigger 가 있는 테이블은 client-side updated_at 제거 가능** (regression risk 낮음, but 검증 필요).

특히 `publishers` (trigger 있음, `publisher-actions.ts:143,175` 에서 client-side 도 설정), `series` (trigger 있음, `series-actions.ts:266` 등 client-side 도 설정) 가 명확한 중복.

**제안**: 어떤 테이블이 trigger 를 갖는지 한 표로 정리 (`docs/db-triggers.md` 또는 SQL 주석 파싱) + client-side `updated_at` 일괄 제거.

---

## 11. 단순화 시 주의사항

### 11.1 보존해야 할 추상화

- `domain-helpers.ts` 의 `getStudentRecordByProfileId` / `ensureStudentRecord` — orphan profile 자동 복구 로직 (`:74-97`). 비즈니스 의미 있음. 단순화 금지.
- `realtime-utils.ts` 의 `applyCheckRecord` / `applyChangeRequest` — Postgres CDC 페이로드 변환. 알고리즘 정확성 중요. 단순화 금지.
- `lunch/rotation.ts` 의 `computeLunchDaySchedule` — anchor 회전 알고리즘. 단순화 금지.
- `use-bus-realtime.ts:30` 의 `Math.random()` topic suffix — StrictMode 회피용. 코멘트와 함께 보존.
- `BusMonitorClient.tsx:67-94` 의 race-condition guard — 보존.

### 11.2 단순화하면 안 되는 명명

- `formatStudentName(student, options)` — 시그니처가 잘 설계됨. `preferEnglish` 옵션 그대로 유지.
- `sortStudentsByAgeAndName` — generic 시그니처 (`T extends ...`) 적절.

### 11.3 함부로 합치면 안 되는 곳

- `LunchMonitorClient` 의 `StudentRow` — TV monitor 전용 (3xl font, leader 강조). admin StudentRow 와 분리 유지.
- `MonitorBusCard` (이미 잘 공유 중) — 추가 분기 늘리지 말 것.

---

## 12. 권장 다음 단계

1. **즉시 실행 PR 1**: Top 20 의 `#2/3/4/5/14/19/20` (dead code + 단순 중복 제거) — 100줄 미만, behavior-preserving.
2. **즉시 실행 PR 2**: `#7/8/9/16` 유틸 추출 + 사용처 치환 — 약 200줄 변경.
3. **Plan 1**: `withAdminAction` wrapper 설계 + 한 도메인 (예: `notice-actions.ts`) 파일럿.
4. **Plan 2**: `ActionResult<T>` 마이그레이션 가이드 작성 + 신규 액션 lint rule (eslint-plugin-local).
5. **Plan 3**: `report-actions.ts` `@auth-skip` 3건의 권한 헬퍼화 (`verifyNativeTeacher*`).
6. **Plan 4**: DB trigger 있는 테이블의 client-side `updated_at` 제거 (regression risk 검증 후).

---

*— 본 리뷰는 코드 수정 없이 read-only 분석. 모든 제안은 별도 PR 으로 진행 권장.*
