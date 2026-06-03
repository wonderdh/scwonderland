# 방과후 1·2차를 하원 시각으로 판정 — 설계

작성일: 2026-05-29

## 배경 / 문제

방과후(放課後, `group_type='afterschool'`)의 1교시/2교시 구분이 현재 `afterschool_enrollments.academy_period_id`(→ `academy_periods` 중 `group_type='afterschool'` 행)로 판정된다. 그러나 마이그레이션 `20260525000000_refactor_classes_periods_schedules_report_cards.sql`(line 29)이 해당 academy_periods 행을 전부 삭제했고 이후 재생성하지 않았다. 결과:

- `getAfterschoolPeriodIds()`가 `firstPeriodId`/`secondPeriodId` 모두 `null` 반환
- 등록(승하차 자동 연동 포함) 시 `academy_period_id = null` 저장
- 읽을 때 `second_period`가 항상 `false` → **요일별(나이) 현황에서 전원 1교시로 표기**

## 목표

방과후 1·2차 판정을 **수업 시간표(academy_periods)에서 분리**하고, **학생의 하원 시각(dismissal time)** 으로 결정한다. 방과후 시간 자체는 별도 관리하지 않으며 변경 빈도가 거의 없으므로 시각 상수로 고정한다.

- **하원 시각 `15:30` → 방과후 1차(1교시)**
- **하원 시각 `16:20` → 방과후 2차(2교시)**

확인된 도메인 사실: 위 시각대 하원은 (유치부 학생 포함) 방과후를 의미하며, 비(非)방과후 일반 하원과 겹치지 않는다. 따라서 시각만으로 안전하게 판정할 수 있다.

## 현재 데이터 모델 (관련 부분)

- `bus_time_slots(id, label, time TEXT, is_active, ...)` — `time`은 `"HH:MM"` 텍스트(예: `"15:30"`).
- `student_bus_defaults(student_id, day_of_week, bus_time_slot_id, direction, ...)` — 학생·요일별 하원 슬롯(`direction='dropoff'`). 진짜 하원 시각의 출처.
- `afterschool_enrollments(id, class_id, student_id, day_of_week, academy_period_id, created_at)` — 방과후 등록. `academy_period_id`로 1/2차 판정(현재 깨짐).
- `src/lib/bus/afterschool-sync.ts` — `detectAfterschoolSlot(slot)`이 **라벨**(`"방과후1차"`, `"오후반 1차/방과후2차"`)로 1/2차 판정.

### 의존 범위 (academy_period_id)
`afterschool_enrollments.academy_period_id`는 **`afterschool-actions.ts` 내부에서만** 교시 판정에 쓰인다. `schedule-actions.ts`는 `afterschool_enrollments`에서 `(class_id, day_of_week)`만 읽고 academy_period_id는 `class_schedules`에서만 사용한다. 따라서 컬럼 제거의 영향은 `afterschool-actions.ts`에 한정된다.

## 설계

### 1) 시각 기반 판정 (`src/lib/bus/afterschool-sync.ts`)
라벨 상수를 시각 상수로 교체한다.

```ts
export const AFTERSCHOOL_DISMISS_TIME_1 = "15:30" as const; // 방과후 1차
export const AFTERSCHOOL_DISMISS_TIME_2 = "16:20" as const; // 방과후 2차

export function detectAfterschoolSlot(slot: BusTimeSlot | undefined): {
  isAfterschoolSlot: boolean;
  secondPeriod: boolean;
} {
  if (!slot) return { isAfterschoolSlot: false, secondPeriod: false };
  const hhmm = (slot.time ?? "").slice(0, 5); // "15:30:00" 같은 입력도 방어
  const isFirst = hhmm === AFTERSCHOOL_DISMISS_TIME_1;
  const isSecond = hhmm === AFTERSCHOOL_DISMISS_TIME_2;
  return { isAfterschoolSlot: isFirst || isSecond, secondPeriod: isSecond };
}
```

호출부(`StudentBusTab.tsx`, `AdminBusChangeDnD.tsx`)는 반환 형태가 동일하므로 흐름 변경 없음. 단, `AdminBusChangeDnD.tsx`에서 라벨로 슬롯 id를 찾던 부분(`label === "방과후1차"` 등)이 있으면 시각 기준으로 함께 정리한다.

### 2) `afterschool_enrollments`에 `second_period` 컬럼 도입 (academy_periods 분리)
- 새 마이그레이션: `supabase/migrations/<ts>_afterschool_second_period.sql`
  1. `ALTER TABLE afterschool_enrollments ADD COLUMN second_period boolean NOT NULL DEFAULT false;`
  2. **백필** — 하원 슬롯에서 정확히 복구:
     ```sql
     UPDATE afterschool_enrollments ae
     SET second_period = true
     FROM student_bus_defaults sbd
     JOIN bus_time_slots bts ON bts.id = sbd.bus_time_slot_id
     WHERE sbd.student_id = ae.student_id
       AND sbd.day_of_week = ae.day_of_week
       AND sbd.direction = 'dropoff'
       AND substring(bts.time from 1 for 5) = '16:20';
     ```
  3. 중복 정리 후 UNIQUE 제약 교체:
     - 기존 `afterschool_enrollments_unique (class_id, student_id, day_of_week, academy_period_id)` 제거
     - (안전) `(class_id, student_id, day_of_week)` 중복 행 dedup
     - `ADD CONSTRAINT afterschool_enrollments_unique UNIQUE (class_id, student_id, day_of_week);`
  4. `academy_period_id` 컬럼 및 FK 제거:
     - `DROP CONSTRAINT afterschool_enrollments_academy_period_id_fkey;`
     - `ALTER TABLE afterschool_enrollments DROP COLUMN academy_period_id;`
- `pnpm db:types`(또는 `db:types:local`)로 타입 재생성.

### 3) 서버 액션 수정 (`src/app/(admin)/admin/actions/afterschool-actions.ts`)
- `getAfterschoolPeriodIds()` **삭제**.
- `enrollStudent(..., secondPeriod)`: `academy_period_id` 매핑 제거, `second_period: secondPeriod` 저장.
- `bulkUpdateEnrollmentDays()`: `d.second_period`를 컬럼에 직접 저장.
- `updateAfterschoolSecondPeriod()`: `second_period` 컬럼 UPDATE로 변경.
- `getAfterschoolEnrollments()`, `getStudentAfterschoolDetail()`: `academy_period_id` 비교 대신 `second_period` 컬럼을 그대로 읽음.

### 4) 표시
`AfterschoolPageClient.tsx`(요일별 나이)는 이미 `days[].second_period`로 1교시/1·2교시를 분리 렌더하므로 **변경 없음**. 데이터가 올바르게 채워지면 정상 표기된다.

## 엣지 케이스

- 하원 슬롯이 없는 방과후 등록 행 → 백필에서 매칭 안 됨 → `second_period=false`(1차)로 남음. 합리적 기본값.
- `bus_time_slots.time` 포맷 불일치(`"15:30"` vs `"15:30:00"`) → `slice(0,5)` / `substring(...,1,5)`로 정규화.
- 15:30/16:20 시각이 향후 바뀌면 상수 1곳만 수정.

## 범위 밖 (Out of scope)

- `academy_periods`의 오후반/유치부 교시 관리 로직.
- 승하차/버스 UI 자체의 기능 변경(판정 내부 로직만 교체).
- 방과후 시간을 admin UI에서 설정 가능하게 만드는 것(현재 상수 고정으로 충분).

## 검증

- `pnpm type-check` 통과.
- 수정 파일 ESLint 통과.
- 로컬 DB: 마이그레이션 적용 후 16:20 하원 학생이 요일별(나이) 탭에서 `1·2교시`로 표시되는지 확인.
- 승하차에서 슬롯을 15:30↔16:20로 바꾸면 방과후 1↔2차가 반영되는지 확인.
