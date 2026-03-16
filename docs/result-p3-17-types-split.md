# P3-17 작업 결과: lib/types 분리 (database.ts → database.ts + api.ts)

> 작업일: 2026-03-16
> 커밋: `refactor(P3-17): lib/types/database.ts → database.ts + api.ts 분리`
> 빌드 상태: ✅ TypeScript 오류 없음 (55개 페이지 정상 생성)

---

## 1. 왜 이 작업을 했나

### 분리 전 상태

`lib/types/database.ts` 단일 파일 **680줄**에 성격이 다른 두 종류의 타입이 뒤섞여 있었습니다.

| 종류 | 설명 | 예시 |
|------|------|------|
| **DB Row 타입** | 테이블 컬럼과 1:1 대응 | `BusNumber`, `Textbook`, `ClassSchedule` |
| **API 응답 타입** | 여러 테이블 조인·집계 결과 | `ClassWithDetails`, `BusManifestEntry`, `DropoffExportData` |

이로 인해 세 가지 문제가 있었습니다.

**문제 1 — 파일이 너무 커서 찾기 어려움**
680줄 파일에서 원하는 타입을 찾으려면 항상 스크롤이 필요했습니다.

**문제 2 — DB 스키마 변경의 영향 범위 불명확**
DB 테이블 컬럼이 바뀌면 어느 타입을 수정해야 하는지, 어느 타입은 DB와 무관하게 독립적으로 변경되는지 파일 구조만 봐서는 알 수 없었습니다.

**문제 3 — API 응답 구조 변경 시 찾기 어려움**
서버 액션의 반환 타입을 바꿀 때 680줄 파일 전체를 훑어야 했습니다.

---

## 2. 무엇을 했나

### 파일 구조 변화

```
분리 전
lib/types/
  database.ts   (680줄) — DB Row + API 응답 타입 혼재
  index.ts               — database.ts 전체 re-export

분리 후
lib/types/
  database.ts   (157줄) — 순수 DB Row 타입만
  api.ts        (533줄) — 조인·집계·서버 액션 응답 타입
  index.ts      ( 60줄) — 두 파일의 모든 타입 named re-export
```

**기존 `import { ... } from "@/lib/types"` 경로는 변경 없음 — 프로젝트 전체 어느 파일도 수정 불필요.**

---

## 3. 분리 기준

### `database.ts`에 남긴 타입 (순수 DB Row)

DB 테이블 컬럼을 그대로 반영한 타입. 조인 필드 없음, 집계 필드 없음.

| 타입 | 대응 테이블 |
|------|------------|
| `ReportCard` | `report_cards` |
| `ReportCardListItem` | `report_cards` (부분 필드) |
| `LearningRecord` | `learning_records` |
| `BusNumber` | `bus_numbers` |
| `BusTimeSlot` | `bus_time_slots` |
| `AcademyPeriod` | `academy_periods` |
| `BusCheckRecord` | `bus_check_records` |
| `BusStopDayAssignment` | `bus_stop_day_assignments` |
| `BusStop` | `bus_stops` |
| `BusStopSchedule` | `bus_stop_schedules` |
| `AfterschoolEnrollment` | `afterschool_enrollments` |
| `ClassSchedule` | `class_schedules` |
| `Textbook` | `textbooks` |

**총 13개 타입, 157줄**

---

### `api.ts`로 이동한 타입 (조인·집계·복합)

DB 컬럼 외에 조인값·집계값·선택적 추가 필드가 하나라도 포함된 타입.

#### Admin 응답 타입

| 타입 | 이동 이유 |
|------|----------|
| `UserWithProfile` | profiles + students/teachers 조인 결과 |
| `DashboardStats` | 집계값 (`studentCount`, `classCount` 등) |
| `ClassTeacherInfo` | class_teachers + teachers 조인 |
| `ClassWithDetails` | classes + teachers 배열 + student_count 집계 |
| `ClassStudentRow` | class_students + students 조인 |
| `ClassTextbookProgressRow` | 진도 조인 결과 |
| `AdminStudentClassItem` | classes + teachers 조인 |

#### Academy 응답 타입

| 타입 | 이동 이유 |
|------|----------|
| `StudentProfile` | profiles + students 조인 |
| `StudentClassItem` | classes + teachers 조인 |
| `TeacherProfile` | profiles + teachers 조인 |
| `TeacherClassWithStudents` | classes + students 배열 조인 |
| `ReportCardStatus` | students + report_cards 조인 + 계산 필드 |
| `TeacherClassTextbook` | class_textbooks + textbooks 조인 |
| `StudentTextbookItem` | 다중 테이블 조인 + 상태 계산 |

#### 출결 타입

| 타입 | 이동 이유 |
|------|----------|
| `AttendanceRecord` | DB Row지만 `class_name?` 조인 필드 포함 |
| `AttendanceStats` | 집계값 (`present`, `absent`, `late` 등) |

#### 공지/숙제 타입

| 타입 | 이동 이유 |
|------|----------|
| `ClassNotice` | DB Row지만 `author_name?`, `attachment_count?` 포함 |
| `ClassNoticeAttachment` | ClassNotice와 세트 |
| `AcademyNotice` | DB Row지만 `image_count?`, `attachment_count?` 포함 |
| `AcademyNoticeAttachment` | AcademyNotice와 세트 |
| `Notice` | DB Row지만 공지 그룹 응답 타입으로 통일 |
| `NoticeAttachment` | Notice와 세트 |
| `HomeworkAssignment` | DB Row지만 `class_name?`, `submission_count?` 포함 |
| `HomeworkSubmission` | DB Row지만 `student_name?`, `files?` 포함 |
| `HomeworkSubmissionFile` | HomeworkSubmission과 세트 |

#### 버스 응답 타입

| 타입 | 이동 이유 |
|------|----------|
| `StudentBusDefault` | DB Row지만 조인 필드 다수 (`bus_stop_name?`, `bus_label?` 등) |
| `BusChangeRequest` | DB Row지만 조인 필드 다수 (`new_bus_label?`, `korean_name?` 등) |
| `BusManifestEntry` | 다중 테이블 조인 + `is_changed`, `is_absent` 계산 필드 |
| `BusManifestGroup` | 그룹화된 복합 구조 |
| `NoRideEntry` | 조인 결과 |
| `AfterSchoolBusEntry` | 조인 결과 |
| `BusStaffProfile` | bus_staff + profiles 조인 |
| `BusDefaultAssignment` | student_bus_defaults + 정류장/시간대 조인 |
| `DayEnrollment` | 헬퍼 타입 (AfterschoolStudentEnrollment 구성 요소) |
| `AfterschoolStudentEnrollment` | students + afterschool_enrollments 조인 + days 배열 |
| `DropoffExportRow` | 다중 테이블 조인 (수출 전용) |
| `DropoffExportData` | 수출 전용 복합 응답 구조 |

#### 시간표 응답 타입

| 타입 | 이동 이유 |
|------|----------|
| `ClassScheduleWithDetails` | class_schedules + periods + teachers 조인 |
| `StudentTimetableCell` | 다중 조인 + `source` 계산 필드 |
| `StudentTimetableRow` | 시간표 행 구조 (academy_periods + cells 맵) |

#### 교재 응답 타입

| 타입 | 이동 이유 |
|------|----------|
| `ClassTextbook` | class_textbooks + textbooks 조인 |
| `StudentTextbookProgress` | student_textbook_progress + textbooks 조인 + 진도 계산 |

**총 39개 타입, 533줄**

---

## 4. index.ts 구조 — re-export 방식

`export * from "./database"` 대신 **명시적 named re-export** 방식을 채택했습니다.

```typescript
// lib/types/index.ts
export type {
  ReportCard,
  ReportCardListItem,
  LearningRecord,
  BusNumber,
  BusTimeSlot,
  // ... 13개
} from "./database";

export type {
  UserWithProfile,
  DashboardStats,
  ClassWithDetails,
  BusManifestEntry,
  // ... 39개
} from "./api";
```

**`export *` 대신 명시적 named export를 쓴 이유:**
- 어떤 타입이 어느 파일에서 오는지 index.ts 한 곳에서 명확하게 파악 가능
- 불의의 이름 충돌(두 파일에 같은 이름이 생기는 경우) 방지
- IDE에서 타입 출처 추적이 더 명확함

---

## 5. 특이사항 — DropoffExportData의 인라인 import

`api.ts`의 `DropoffExportData` 타입이 `BusTimeSlot`과 `BusNumber`를 내부에서 참조해야 하는데, 이 두 타입은 `database.ts`에 있습니다. 같은 `lib/types/` 폴더 내에서 상호 import를 피하기 위해 **인라인 타입 import** 문법을 사용했습니다.

```typescript
// api.ts
export type DropoffExportData = {
  rows: DropoffExportRow[];
  unassigned: { ... }[];
  slots: import("./database").BusTimeSlot[];      // ← 인라인 타입 import
  busNumbers: import("./database").BusNumber[];   // ← 인라인 타입 import
  afterschoolEnrollments: { profile_id: string; day: number }[];
};
```

**대안으로 고려할 수 있는 방법:**
- `api.ts` 상단에 `import type { BusTimeSlot, BusNumber } from "./database"` 명시적 import — 더 깔끔하지만 파일 간 의존성이 생김
- 현재 인라인 방식도 TypeScript에서 유효하며 빌드 정상 통과

---

## 6. 변경된 파일 목록

| 파일 | 변경 전 | 변경 후 |
|------|--------|--------|
| `lib/types/database.ts` | 680줄 (혼재) | **157줄** (순수 DB Row만) |
| `lib/types/api.ts` | 없음 | **533줄** (신규 생성) |
| `lib/types/index.ts` | 1줄 (`export * from "./database"`) | **60줄** (두 파일 named re-export) |

**그 외 수정된 파일: 없음** (기존 `@/lib/types` import 경로 전부 그대로 동작)

---

## 7. 검증

```bash
$ npm run build
# TypeScript 오류: 0건
# 생성된 페이지: 55개 정상
```

---

## 8. 향후 타입 추가 가이드

새 타입을 추가할 때 어느 파일에 넣을지 판단 기준:

```
새 타입이 특정 DB 테이블의 컬럼만 담고 있다
  → database.ts

새 타입이 여러 테이블 조인, 집계값, 선택적(?) 조인 필드를 포함한다
  → api.ts

어느 쪽인지 판단이 어렵다
  → 선택적 필드(?)가 하나라도 있으면 api.ts
```

새 타입을 추가했으면 **반드시 `index.ts`의 해당 블록에도 추가**해야 `@/lib/types`에서 import 가능합니다.
