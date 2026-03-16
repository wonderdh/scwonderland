# P3-17: lib/types/database.ts vs api.ts 분리

> 상태: 미완료 / 난이도: 소
> 관련 파일: `lib/types/database.ts`, `lib/types/index.ts`

---

## 1. 현재 상황 — 무엇이 문제인가

### 파일 현황

`lib/types/database.ts`는 현재 **680줄**이며, 두 가지 성격이 다른 타입이 섞여 있습니다.

```
lib/types/
  database.ts   (680줄) — DB Row 타입 + 조인/API 응답 타입이 혼재
  index.ts               — database.ts에서 전부 re-export
```

### 두 타입의 차이

#### DB Row 타입 (테이블 구조 그대로)

DB 테이블의 컬럼을 그대로 반영한 타입. 테이블 스키마가 바뀌면 이 타입도 바뀝니다.

```typescript
// DB 테이블 컬럼을 그대로 반영
export type BusNumber = {
  id: string;
  label: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AttendanceRecord = {
  id: string;
  student_profile_id: string;
  class_id: string;
  attendance_date: string;
  status: "present" | "absent" | "late" | "excused";
  note: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
};
```

#### API / 조인 응답 타입 (서버 액션이 가공해서 반환하는 타입)

여러 테이블을 조인하거나, 서버 액션이 추가 데이터를 붙여서 반환하는 복합 타입. DB 컬럼과 1:1 대응하지 않습니다.

```typescript
// 여러 테이블 조인 결과
export type BusManifestEntry = {
  student_profile_id: string;
  korean_name: string | null;       // students 테이블
  english_name: string | null;      // students 테이블
  age: number | null;               // students 테이블
  is_changed: boolean;              // bus_change_requests 계산값
  is_absent?: boolean;              // bus_change_requests 계산값
  estimated_time?: string | null;   // bus_stop_schedules 조인값
  bus_stop_name?: string | null;    // bus_stops 조인값
  boarded_at?: string | null;       // bus_check_records 조인값
};

// 서버 액션 전용 응답 타입
export type ClassWithDetails = {
  id: string;
  name: string;
  group_label: "유치부" | "방과후" | "오후반" | null;
  color_index: number | null;
  teachers: ClassTeacherInfo[];  // ← 조인된 배열 (DB에는 별도 테이블)
  student_count: number;         // ← 집계값
  created_at: string;
  updated_at: string;
};

// 수출 전용 복합 타입
export type DropoffExportData = {
  rows: DropoffExportRow[];
  unassigned: { day: number; profile_id: string; ... }[];
  slots: BusTimeSlot[];
  busNumbers: BusNumber[];
  afterschoolEnrollments: { profile_id: string; day: number }[];
};
```

---

## 2. 현재 파일에서 각 타입의 분류

**680줄 중 분류:**

| 타입 이름 | 종류 | 분량 |
|----------|------|------|
| `UserWithProfile` | API 응답 | DB 없음, 조인 |
| `DashboardStats` | API 응답 | DB 없음, 집계 |
| `ReportCard` | DB Row | `report_cards` 테이블 |
| `ClassWithDetails` | API 응답 | classes + 조인 |
| `ClassStudentRow` | API 응답 | 조인 |
| `StudentProfile` | API 응답 | 조인 |
| `TeacherProfile` | API 응답 | 조인 |
| `AttendanceRecord` | DB Row + API | class_name 추가 필드 있음 |
| `BusNumber`, `BusTimeSlot` | DB Row | 순수 DB Row |
| `BusManifestEntry` | API 응답 | 다중 테이블 조인 |
| `BusManifestGroup` | API 응답 | 계산된 그룹 구조 |
| `BusStopDayAssignment` | DB Row | 순수 DB Row |
| `ClassNotice` | DB Row + API | author_name, attachment_count 추가 |
| `Textbook` | DB Row | 순수 DB Row |
| `DropoffExportData` | API 응답 | 수출 전용 복합 타입 |
| ... | ... | ... |

---

## 3. 목표 구조

```
lib/types/
  database.ts   (~300줄) — 순수 DB Row 타입만
  api.ts        (~400줄) — 조인/집계/서버 액션 응답 타입
  index.ts               — 두 파일에서 모두 re-export (기존 import 경로 불변)
```

### `database.ts`에 남길 타입

DB 테이블 컬럼과 1:1 대응하는 순수 Row 타입:

```typescript
// 예시
export type ReportCard = { id, student_profile_id, year, month, author_id, content, reply, created_at, updated_at };
export type BusNumber = { id, label, is_active, created_at, updated_at };
export type BusTimeSlot = { id, direction, label, time, is_active, ... };
export type AcademyPeriod = { ... };
export type BusCheckRecord = { ... };
export type BusStopDayAssignment = { ... };
export type BusStop = { ... };
export type Textbook = { ... };
export type AfterschoolEnrollment = { ... };
export type ClassSchedule = { ... };
export type LearningRecord = { ... };
```

### `api.ts`로 옮길 타입

서버 액션이 조인·가공해서 반환하는 복합 타입:

```typescript
// 예시
export type UserWithProfile = { ... };          // 다중 테이블 조인
export type DashboardStats = { ... };           // 집계
export type ClassWithDetails = { ... };         // classes + teachers 조인 + student_count 집계
export type BusManifestEntry = { ... };         // 다중 테이블 조인 + 계산 필드
export type BusManifestGroup = { ... };         // 그룹화된 응답
export type DropoffExportData = { ... };        // 수출 전용 복합 구조
export type ClassTextbook = { ... };            // class_textbooks + textbooks 조인
export type StudentTextbookProgress = { ... };  // 여러 테이블 조인
// ...
```

### `index.ts` 변경 (최소 수정)

```typescript
// 현재
export * from "./database";

// 변경 후
export * from "./database";
export * from "./api";
```

**모든 기존 import 경로(`@/lib/types`)는 그대로 유지됩니다.**

---

## 4. 경계가 애매한 타입들

일부 타입은 DB Row이지만 선택적(`?`) 조인 필드가 붙어 있습니다:

```typescript
// ClassNotice: DB Row이지만 author_name, attachment_count는 조인/집계값
export type ClassNotice = {
  id: string;           // DB 컬럼
  class_id: string;     // DB 컬럼
  author_id: string;    // DB 컬럼
  title: string;        // DB 컬럼
  is_pinned: boolean;   // DB 컬럼
  author_name?: string; // ← 조인값 (선택적)
  attachment_count?: number; // ← 집계값 (선택적)
};
```

**판단 기준:** 선택적(`?`) 조인 필드가 있는 타입은 `api.ts`로 분류합니다. 완전 순수한 DB Row만 `database.ts`에 남깁니다.

---

## 5. 작업 절차

1. `lib/types/api.ts` 파일 생성
   - `database.ts`에서 조인/집계 타입 잘라내기

2. `lib/types/database.ts`
   - 순수 DB Row 타입만 남기기

3. `lib/types/index.ts`
   - `export * from "./api"` 추가

4. `npm run build`로 누락된 re-export 없는지 확인
   - 모든 기존 `import type { ... } from "@/lib/types"` 경로는 변경 불필요

---

## 6. 기대 효과

| 항목 | 현재 | 분리 후 |
|------|------|--------|
| database.ts 줄 수 | 680줄 | ~300줄 |
| 타입 찾기 난이도 | 혼재 → 스크롤 많음 | 명확한 분리 |
| DB 스키마 변경 영향 범위 | 전체 파일 수정 | database.ts만 수정 |
| API 응답 구조 변경 영향 범위 | 전체 파일 수정 | api.ts만 수정 |
| 기존 import 경로 변경 | — | 변경 없음 |

---

## 7. 리스크

**낮음.** 이 작업은 순수한 파일 분리로, 런타임 동작에 영향 없습니다.
- `index.ts`가 두 파일을 모두 re-export하므로 기존 import는 전부 그대로 작동
- 유일한 위험: 분리 중 실수로 타입을 빠뜨리거나 중복 정의 → `npm run build`로 즉시 감지 가능
