# 호차 관리 — 정류장 배정 구조 재설계

## 현재 문제점

현재 `bus_stop_day_assignments` 테이블은 **(정류장, 요일)** 단위로만 호차 배정을 관리함.
실제로는 **요일 × 방향 × 시간대** 조합마다 정류장 배정이 달라야 함.

### 실제 요구사항 예시

| 정류장 | 월 등원 유치부1차 | 월 등원 유치부2차 | 월 하원 유치부 | 화 하원 오후반1차 |
|--------|------------------|------------------|---------------|------------------|
| 트리마제1차 | 1호차 (순서1) | — (미배정) | 3호차 (순서2) | 1호차 (순서1) |
| 그린오피스 | 1호차 (순서2) | 1호차 (순서1) | 1호차 (순서1) | — (미배정) |
| 롯데1차 | — (미배정) | 3호차 (순서1) | 1호차 (순서3) | 3호차 (순서2) |

- 같은 정류장이 요일마다 다른 호차에 배정될 수 있음
- 같은 요일이라도 등원/하원에서 다른 호차에 배정되거나 아예 안 들릴 수 있음
- 같은 요일+방향이라도 시간대(유치부1차, 유치부2차, 오후반1차 등)마다 다를 수 있음
- 호차 내 정류장 순서도 조합마다 독립적

## 현재 DB 구조

```
bus_stops (마스터 목록)
├── id, name, sort_order, is_active, bus_number_id (레거시, nullable)

bus_stop_day_assignments (요일별 배정 — 불충분)
├── id, bus_stop_id FK, bus_number_id FK, day_of_week, sort_order
├── UNIQUE(bus_stop_id, day_of_week)
└── ❌ direction 없음, bus_time_slot_id 없음

bus_stop_schedules (시간 관리 — 이건 이미 올바른 구조)
├── id, bus_stop_id FK, day_of_week, direction, bus_time_slot_id, estimated_time
└── ✅ 요일 × 방향 × 시간대 조합별 시간 관리 가능
```

## 제안: 새 구조

### Option A: bus_stop_day_assignments 확장

```sql
-- 기존 테이블 대체
DROP TABLE bus_stop_day_assignments;

CREATE TABLE bus_stop_day_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_stop_id UUID NOT NULL REFERENCES bus_stops(id) ON DELETE CASCADE,
  bus_number_id UUID NOT NULL REFERENCES bus_numbers(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
  direction TEXT NOT NULL CHECK (direction IN ('pickup', 'dropoff')),
  bus_time_slot_id UUID REFERENCES bus_time_slots(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(bus_stop_id, day_of_week, direction, bus_time_slot_id)
);
```

- **배정 키**: (정류장, 요일, 방향, 시간대) → 호차 + 순서
- bus_time_slot_id = NULL이면 "전체(기본)" 배정 (fallback)
- 특정 시간대에 배정이 없으면 NULL 배정을 fallback으로 사용할지 여부는 정책 결정 필요

### Option B: bus_stop_schedules에 배정 통합

`bus_stop_schedules`가 이미 (정류장, 요일, 방향, 시간대) 키를 가지고 있으므로,
여기에 `bus_number_id`와 `sort_order`를 추가하면 별도 배정 테이블 불필요.

```sql
ALTER TABLE bus_stop_schedules
  ADD COLUMN bus_number_id UUID REFERENCES bus_numbers(id) ON DELETE SET NULL,
  ADD COLUMN sort_order INT NOT NULL DEFAULT 0;
```

- 장점: 테이블 하나로 배정+시간 관리, 구조 단순
- 단점: 시간 없이 배정만 하고 싶을 때 estimated_time이 의미 없는 행 생성

### Option C: 배정과 시간을 완전 분리 유지 (Option A + 기존 bus_stop_schedules)

- `bus_stop_day_assignments`: 배정 (어떤 정류장이 어떤 호차에, 순서)
- `bus_stop_schedules`: 시간 (각 정류장의 예상 도착 시간)
- 두 테이블의 키 구조가 동일: (bus_stop_id, day_of_week, direction, bus_time_slot_id)

## "전체(기본)" 시간대 정책

현재 bus_time_slot_id = NULL을 "전체(기본)"으로 사용 중.

**정책 결정 필요:**
1. **Fallback 방식**: 특정 시간대에 배정 없으면 → "전체" 배정 사용 (현재 시간 조회 방식)
2. **독립 방식**: 각 시간대가 완전 독립, "전체"는 단순히 시간대 미지정 배정
3. **"전체" 제거**: 시간대 선택 필수로 변경, NULL 허용 안 함

## UI 영향

현재 BusNumbersManager 툴바: `[요일] [등원|하원] [시간대]`
→ 이 3개 필터 조합별로 독립적인 정류장 배정+순서+시간 관리

### 데이터 양 예상
- 요일 5 × 방향 2 × 시간대 ~5개 = 최대 50개 조합
- 각 조합별 정류장 배정 ~10개 = 최대 ~500행 (bus_stop_day_assignments)
- 실제로는 모든 조합에 데이터가 있진 않을 것

### "전체 요일 적용" / "전체 시간대 적용" 일괄 복사 기능 필요성
- 월요일 배정을 화~금에 한번에 복사
- 유치부1차 배정을 유치부2차에도 복사
- 이런 편의 기능 없으면 50개 조합 하나씩 설정해야 해서 UX 문제

## 관련 파일

| 파일 | 역할 |
|------|------|
| `lib/types/database.ts` | BusStopDayAssignment 타입 |
| `lib/types/index.ts` | barrel export |
| `app/(admin)/admin/actions/bus-actions.ts` | listBusStopDayAssignments, saveBusStopDayAssignments, listBusStopSchedulesBulk |
| `app/(admin)/admin/actions.ts` | barrel export |
| `app/(admin)/admin/bus/page.tsx` | numbers 탭 데이터 페치 |
| `app/(admin)/admin/bus/components/BusNumbersManager.tsx` | 호차 관리 DnD UI |
| `app/(admin)/admin/bus/components/BusAssignmentManager.tsx` | 학생 배정 UI (bus_stops.bus_number_id 사용 중 — 영향 검토 필요) |

## 미결정 사항

1. **Option A vs B vs C** — 배정 테이블 구조
2. **"전체(기본)" 정책** — fallback vs 독립 vs 제거
3. **일괄 복사 범위** — 요일 복사, 방향 복사, 시간대 복사 중 어디까지
4. **BusAssignmentManager 영향** — 학생 배정 UI도 시간대별 정류장 목록을 참조해야 하는지
5. **bus_stops.bus_number_id 레거시 컬럼** — 제거 여부 (다른 곳에서 아직 참조 중)
