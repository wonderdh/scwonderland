# 정류장 미배정 검증 (경고 표시 + 저장 차단)

날짜: 2026-06-02
브랜치: `fix/bus-change-split-effects`

## 문제

관리자가 학생의 정류장을 지정할 때(당일변경 / 기본 정류장 변경 / 변경요청 승인·수정), 선택한
정류장이 **해당 요일·시간대에 실제로 운행되지 않는** 정류장이어도 아무 표시 없이 저장된다.
세 화면 모두 정류장 드롭다운을 시간대로 거르지 않고 전체를 노출하며, 선택값에 대한 검증이 없다.
결과적으로 학생이 그 시간대에 버스가 서지 않는 정류장에 배정되어 운행표에서 누락/오배차될 수 있다.

요구사항:
- 선택한 정류장이 해당 요일·시간대에 미배정이면 **시각적으로 경고**한다.
- 미배정인 채로 **임의 저장되지 않도록 저장을 차단**한다.

## 배정 판정 기준 (공통)

"배정됨" = `bus_stop_day_assignments` 에 다음 행이 존재한다:
- `day_of_week = <선택 날짜의 요일>` AND `bus_stop_id = <선택 정류장>` AND
- (`bus_time_slot_id = <선택 시간대>` **또는** `bus_time_slot_id IS NULL`(기본 슬롯))

> 정확한 시간대 매핑 → 시간대 NULL(기본) 매핑까지만 인정한다. `buildStopToBusMaps` 의 `resolve` 가
> 갖는 "임의 slot 폴백"(3순위)은 **사용하지 않는다** — 사용자가 명시한 "해당 시간대" 특정성을
> 유지하기 위함. (이로 인해 운행표 manifest 의 관대한 라우팅과 미세하게 다를 수 있으나, 검증 목적상
> 더 엄격한 쪽이 의도에 부합.)

### 다중 요일 처리
- **당일변경(AdminBusChangeDnD)**: 여러 날짜 선택 가능 → 선택된 날짜들의 **distinct 요일 전체**에 대해
  검증. 한 요일이라도 미배정이면 경고·차단.
- **기본 정류장 변경(StudentBusTab)**: 여러 요일 체크 가능 → 체크된 **모든 요일**에 대해 검증.
- **변경요청 승인·수정(BusChangeRequestsPanel)**: `request_date` 단일 → 그 요일 하나.

### 적용 모드
- **정류장(dropoff, `stop`/`change`) 모드만** 검증한다.
- **픽업(`pickup`/`no_ride`)**: 정류장이 선택사항이고 운행 매핑(`bus_stop_day_assignments`)과 별개
  개념 → 검증 제외.
- **결석(`absent`)**: 정류장 없음 → 검증 제외.
- 시간대(slot) 또는 정류장(stop) 미선택 시: 판정 불가 → 경고 안 띄움(저장 차단도 안 함).

## 아키텍처

### 1) 신규 서버 액션 (read)

`src/app/(admin)/admin/actions/bus/assignment-actions.ts` 에 추가:

```ts
// 주어진 요일들 × 시간대에 대해 "운행되는 정류장 ID" 를 요일별로 반환
export async function listServedStopIds(
  daysOfWeek: number[],
  slotId: string,
): Promise<Record<number, string[]>>;
```

- `_helpers.ts` 에 추가할 공유 strict 판정 로직(아래 ⑤와 동일)을 사용해, `day_of_week IN daysOfWeek`
  행을 1쿼리로 읽고 각 요일별 `bus_time_slot_id = slotId || IS NULL` 인 `bus_stop_id` 집합을 반환.
- 인증: 파일 내 다른 read 액션과 동일한 가드(`verifyTeacherOrAdmin`/`verifyAuthenticated`) 패턴을 따른다.
- `slotId` 빈 문자열이면 `{}` 반환(검증 불가 신호).

### 2) 클라이언트 공통 판정 훅/유틸

세 화면에서 공유하는 작은 클라이언트 유틸 (`src/lib/bus/stop-validation.ts` 신규):

```ts
// servedByDay: listServedStopIds 결과, days: 검증 대상 요일들
export function findUnassignedDays(
  servedByDay: Record<number, string[]>,
  days: number[],
  stopId: string,
): number[]; // 미배정인 요일 목록 (비면 OK)
```

- 빈 결과/빈 stopId/빈 days → `[]`(검증 통과).
- 화면은 `unassignedDays.length > 0` 이면 경고 + 저장 차단.

### 3) 화면별 통합

각 화면은:
1. (요일들, slotId) 변경 시 `listServedStopIds` 호출 → `servedByDay` state 보관.
2. `findUnassignedDays(...)` 로 미배정 여부 계산(파생값).
3. 미배정이면 정류장 선택 영역 하단에 경고 + 저장 버튼 `disabled`.

- **AdminBusChangeDnD**: 기존 student/date effect 와 별개로 `(distinct 요일, slotId)` 변경 시
  served 집합을 받는다. `stopMode === "stop"` 일 때만 검증.
- **StudentBusTab**: EditPanel 의 `(checkedDays, editSlotId, editStopId)` 기준으로 검증.
- **BusChangeRequestsPanel**: RequestCard 편집의 `(request_date 요일, editSlotId, editStopId)`,
  `editStopMode === "stop"` 일 때만.

### 4) 경고 UI

정류장 선택 컨트롤 바로 아래, 빨간 텍스트 한 줄:

> ⚠ 이 정류장은 {요일목록} {시간대명}에 배정된 버스가 없습니다.

- 다중 요일이면 미배정 요일만 나열(예: "화·목").
- 저장/승인/수정 버튼 `disabled`(이미 `saving`/`actionLoading` 과 함께 OR 조건).

### 5) 서버 가드 (방어선)

클라이언트 우회 저장을 막기 위해 mutation 액션에도 동일 strict 판정을 추가, 위반 시 `{ error }` 반환:
- `createAdminBusChange`, `bulkCreateBusChanges` (change_type === "change" 且 stop 지정 시)
- `upsertStudentBusDefault` (stop 지정 시)
- `approveChangeRequest` (changeType === "change" 且 newBusStopId 지정 시)

판정은 ②와 동일 기준을 서버에서 재계산(이미 `buildStopToBusMaps` 가 같은 테이블을 읽으므로, strict
버전 판정 함수를 `_helpers.ts` 에 추가해 액션·신규 read 액션이 공유).

## 데이터 흐름

```
(요일들, slotId) 선택
   ↓ listServedStopIds(days, slotId)
servedByDay: { 1: [stopId...], 3: [...] }
   ↓ findUnassignedDays(servedByDay, days, stopId)
unassignedDays: [3]  →  경고 표시 + 저장 차단
   ↓ (사용자가 유효 정류장으로 변경) → [] → 저장 가능
   ↓ 저장 시 서버 액션이 strict 판정 재확인 (방어선)
```

## 테스트 (수동 확인 항목)

1. 당일변경: 월요일에 배정된 정류장을 선택 → 경고 없음, 저장 가능.
2. 당일변경: 해당 시간대 미배정 정류장 선택 → 경고 표시 + 저장 버튼 비활성.
3. 당일변경 다중 날짜(월·화): 한 요일만 미배정 → 그 요일 명시 경고 + 차단.
4. 픽업/결석 모드: 검증 안 함(경고 없음).
5. 기본 정류장 변경: 체크된 요일 중 하나라도 미배정 → 차단.
6. 승인 패널: change 승인 시 미배정 정류장 → 차단.
7. 서버 가드: 클라이언트 우회(직접 액션 호출)로 미배정 stop 저장 시도 → `{ error }`.

## 범위 밖 (YAGNI)
- 드롭다운에서 미배정 정류장 숨기기(사용자가 "표시"를 원함, 숨김 아님).
- 날짜별(요일 아닌) 정류장 오버라이드 — 데이터 모델에 없음.
- 픽업 정류장 운행 검증.
