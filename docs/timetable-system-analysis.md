# 시간표 시스템 분석

## 1. DB 스키마 및 테이블 관계

### 핵심 테이블

```
academy_periods (교시)
    │
    │  1:N
    ▼
class_schedules (수업 배정) ─── 시간표의 핵심 테이블
    │         │         │
    │ FK      │ FK      │ FK (nullable)
    ▼         ▼         ▼
classes    profiles   textbooks
(반)      (교사)      (교재)
```

### `academy_periods` — 교시 정보

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID PK | 교시 ID |
| `name` | TEXT NOT NULL | 교시 이름 (예: "1교시", "2교시") |
| `start_time` | TIME NOT NULL | 시작 시간 |
| `end_time` | TIME NOT NULL | 종료 시간 |
| `has_pickup` | BOOLEAN DEFAULT false | 등원 버스 운행 여부 |
| `has_dropoff` | BOOLEAN DEFAULT false | 하원 버스 운행 여부 |
| `group_label` | TEXT CHECK ('유치부' \| '방과후' \| '오후반') | 그룹 구분 |
| `is_active` | BOOLEAN DEFAULT true | 활성 여부 (삭제 시 false) |

- **RLS:** 인증된 사용자 읽기 가능, admin만 CRUD
- **정의:** `docs/migrations/bus-system.sql`

### `class_schedules` — 수업 배정 (시간표 셀)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID PK | 배정 ID |
| `class_id` | UUID FK → classes(id) ON DELETE CASCADE | 반 |
| `academy_period_id` | UUID FK → academy_periods(id) ON DELETE RESTRICT | 교시 |
| `day_of_week` | INT CHECK (1~5) | 요일 (1=월 ~ 5=금) |
| `teacher_profile_id` | UUID FK → profiles(id) ON DELETE CASCADE | 담당 교사 (nullable) |
| `label` | TEXT | 과목명 (nullable, 예: "Science", "Math") |
| `textbook_id` | UUID FK → textbooks(id) ON DELETE SET NULL | 교재 (nullable, 후에 추가됨) |

- **UNIQUE 제약:** `(class_id, academy_period_id, day_of_week)` — 한 반의 한 교시, 한 요일에 하나의 배정만 가능
- **인덱스:** `class_id`, `academy_period_id`, `teacher_profile_id`, `day_of_week` 각각
- **RLS:** 인증된 사용자 읽기 가능, admin만 CRUD
- **정의:** `docs/migrations/class-schedules.sql`

### 관련 테이블

| 테이블 | 관계 | 역할 |
|--------|------|------|
| `classes` | class_schedules.class_id → classes.id | 반 이름, group_label |
| `profiles` | class_schedules.teacher_profile_id → profiles.id | 사용자 (role, deleted_at) |
| `teachers` | teachers.profile_id = profiles.id | 교사 상세 (name, teacher_type) |
| `textbooks` | class_schedules.textbook_id → textbooks.id | 교재 (title, series) |
| `class_students` | class_students.class_id → classes.id | 학생-반 매핑 (학생 시간표용) |

### ER 다이어그램

```
┌──────────────────┐     ┌─────────────────────┐     ┌──────────────┐
│ academy_periods  │     │   class_schedules    │     │   classes     │
├──────────────────┤     ├─────────────────────┤     ├──────────────┤
│ id (PK)          │◄────│ academy_period_id FK │     │ id (PK)      │
│ name             │     │ class_id FK  ────────┼────►│ name         │
│ start_time       │     │ teacher_profile_id FK│     │ group_label  │
│ end_time         │     │ day_of_week          │     └──────────────┘
│ group_label      │     │ label                │
│ is_active        │     │ textbook_id FK ──────┼────►┌──────────────┐
└──────────────────┘     └──────────────────────┘     │  textbooks   │
                                │                     ├──────────────┤
                                │ FK                  │ id (PK)      │
                                ▼                     │ title        │
                         ┌──────────────┐             │ series       │
                         │  profiles    │             └──────────────┘
                         ├──────────────┤
                         │ id (PK)      │
                         │ role         │◄────┐
                         │ deleted_at   │     │
                         └──────────────┘     │
                                │             │
                                │ 1:1         │
                                ▼             │
                         ┌──────────────┐     │
                         │  teachers    │     │
                         ├──────────────┤     │
                         │ profile_id FK├─────┘
                         │ name         │
                         │ teacher_type │ (korean | native)
                         └──────────────┘
```

---

## 2. 전체 시간표 (관리자 그룹 시간표)

### 진입점

`/admin/timetable?tab=kindergarten|afternoon|afterschool`

### 데이터 로드 흐름

```
[Admin Timetable Page] (Server Component)
    │
    │  getGroupTimetableGrid(groupLabel)
    │
    ▼
[schedule-actions.ts] (Server Action)
    │
    │  1단계: academy_periods 조회
    │    → WHERE group_label = '유치부' AND is_active = true
    │    → ORDER BY start_time
    │
    │  2단계: classes 조회
    │    → WHERE group_label = '유치부'
    │    → ORDER BY name
    │
    │  3단계: class_schedules 조회
    │    → WHERE academy_period_id IN (1단계 period IDs)
    │    → SELECT id, class_id, academy_period_id, day_of_week,
    │           teacher_profile_id, label, textbook_id
    │
    │  4단계: 관련 교사 조회 (schedules에서 추출한 teacher IDs)
    │    → teachers 테이블에서 profile_id, name, teacher_type
    │
    │  5단계: 전체 활성 교사 목록 (드롭다운용)
    │    → profiles WHERE role='teacher' AND deleted_at IS NULL
    │    → teachers WHERE profile_id IN (활성 프로필 IDs)
    │
    │  6단계: 전체 활성 교재 목록 (드롭다운용)
    │    → textbooks WHERE is_active = true
    │
    │  7단계: 셀 맵 구성
    │    → key: `${classId}_${periodId}_${dayOfWeek}`
    │    → value: { scheduleId, label, teacherId, teacherName, teacherType, textbookId }
    │
    ▼
[GroupTimetableData] 반환
```

### `GroupTimetableData` 타입 (schedule-actions.ts:14)

```typescript
type GroupTimetableData = {
  periods: { id, name, start_time, end_time }[];    // 해당 그룹의 교시 목록
  classes: { id, name }[];                           // 해당 그룹의 반 목록
  cells: Record<string, {                            // key: `${classId}_${periodId}_${day}`
    scheduleId: string;
    label: string | null;
    teacherId: string | null;
    teacherName: string | null;
    teacherType: "korean" | "native";
    textbookId: string | null;
  }>;
  teachers: { id, name, teacher_type }[];            // 드롭다운용 전체 교사
  textbooks: { id, title, series }[];                // 드롭다운용 전체 교재
};
```

### UI 구조 (GroupTimetableGrid.tsx)

```
┌─────────────────────────────────────────────────────────┐
│  [툴바] 선생님 ▼  과목 ▼  교재 ▼        [전체해제] [저장 N건] │
├─────────────────────────────────────────────────────────┤
│  [범례] ■ Stacey  ■ Joy  ■ Joyce  ■ Julie  ...        │
├─────────────────────────────────────────────────────────┤
│  테이블:                                                │
│  ┌──────┬──────────┬──────────┬──────────┐             │
│  │ 교시  │ Tweety   │ Snoopy   │ Neptune  │ ...        │
│  ├──────┼──────────┼──────────┼──────────┤             │
│  │1교시  │ 월: Stacey│ 월: Joy  │ 월: 빈칸 │             │
│  │9:00~ │ 화: Stacey│ 화: Joy  │ 화: 빈칸 │             │
│  │9:50  │ 수: Joyce │ 수: Julie│ 수: 빈칸 │             │
│  │      │ 목: Joyce │ 목: Julie│ 목: 빈칸 │             │
│  │      │ 금: 빈칸  │ 금: 빈칸 │ 금: 빈칸 │             │
│  └──────┴──────────┴──────────┴──────────┘             │
└─────────────────────────────────────────────────────────┘
```

- **행:** 교시 (period) — 시간 표시
- **열:** 반 (class) — 반 이름 헤더
- **셀 내부:** 5개 요일 (월~금) 세로 배치, 같은 교사+과목이 연속이면 병합 (mergeConsecutiveDays)
- **편집 패턴:** 툴바에서 교사/과목/교재 선택 → 셀 클릭으로 토글 → 저장 버튼으로 일괄 upsert

### 저장 로직

```
pendingChanges: Map<string, PendingCell>
  key: `${classId}|${periodId}|${day}` (pipe 구분자)
  value: { teacherId, label, textbookId }

저장 버튼 클릭 시:
  for (각 pending change)
    → addSingleClassSchedule(classId, periodId, day, teacherId, label, textbookId)
    → Supabase upsert (ON CONFLICT class_id, academy_period_id, day_of_week)
```

### 색상 시스템

**TEACHER_COLOR_PALETTE** (12색, -200 계열):
- 교사 이름순 정렬 → 팔레트 인덱스 할당
- `buildTeacherColorMap(sortedTeachers)` → `Map<teacherId, { bg, text }>`
- 예: `bg-blue-200 text-blue-800`, `bg-emerald-200 text-emerald-800`, ...

---

## 3. 교사 개인 시간표 (관리자 뷰)

### 진입점

`/admin/teachers?selected={id}&tab=timetable`

### 데이터 로드 흐름

```
[Teachers Page] (Server Component)
    │
    │  selectedUser && currentTab === "timetable" 일 때:
    │
    │  Promise.all([
    │    getGroupTimetableGrid("유치부"),
    │    getGroupTimetableGrid("오후반"),
    │    getGroupTimetableGrid("방과후"),
    │  ])
    │
    ▼
[TeacherTimetableTab] (Client Component)
    │
    │  allGroupData = { "유치부": data, "오후반": data, "방과후": data }
    │
    │  buildTeacherDaySchedule(data, teacherProfileId)
    │    → 전체 셀(cells)에서 이 교사의 배정만 필터링
    │    → Map<periodId, Map<dayOfWeek, className>>
    │
    ▼
  읽기 전용 시간표 렌더링
```

### 데이터 필터링 로직 (buildTeacherDaySchedule)

```typescript
// 그룹의 모든 셀을 순회하면서 해당 교사 배정만 추출
for (각 period) {
  for (각 class) {
    for (day = 1 to 5) {
      key = `${classId}_${periodId}_${day}`
      cell = cells[key]
      if (cell.teacherId === teacherProfileId) {
        dayMap[day] = className  // 같은 슬롯 복수 반이면 " / "로 연결
      }
    }
  }
}
```

### 사용하는 테이블 (간접 조회)

`getGroupTimetableGrid()`를 3번 호출하므로 전체 시간표와 동일한 테이블 접근:

| 단계 | 테이블 | 용도 |
|------|--------|------|
| 1 | `academy_periods` | 교시 목록 (그룹별) |
| 2 | `classes` | 반 목록 (그룹별) |
| 3 | `class_schedules` | 수업 배정 전체 |
| 4 | `teachers` | 배정된 교사 정보 |
| 5 | `profiles` | 활성 교사 필터 (deleted_at IS NULL) |
| 6 | `textbooks` | 교재 목록 (여기서는 미사용) |

→ 클라이언트에서 `cells`를 순회하며 `teacherId === teacherProfileId`인 셀만 추출

### UI 구조 (TeacherTimetableTab.tsx)

```
┌───────────────────────────────────────┐
│  [유치부 시간표] [오후반 시간표] [방과후 시간표] │ ← 그룹 전환 탭
├───────────────────────────────────────┤
│  ┌──────┬─────┬─────┬─────┬─────┬─────┐
│  │ 교시  │  월  │  화  │  수  │  목  │  금  │
│  ├──────┼─────┼─────┼─────┼─────┼─────┤
│  │1교시  │Tweety│  —  │Snoopy│  —  │  —  │
│  │9:00~ │     │     │     │     │     │
│  ├──────┼─────┼─────┼─────┼─────┼─────┤
│  │2교시  │  —  │Tweety│  —  │Neptune│ —  │
│  │10:00~│     │     │     │     │     │
│  └──────┴─────┴─────┴─────┴─────┴─────┘
└───────────────────────────────────────┘
```

- **행:** 교시 (period) + 시간
- **열:** 요일 (월~금)
- **셀:** 배정된 반 이름 (복수 반이면 "반A / 반B")
- **읽기 전용** — 편집 불가

### 색상 시스템

**CLASS_COLOR_PALETTE** (12색, -100 계열):
- 반 이름순 정렬 → 팔레트 인덱스 할당
- `buildClassColorMap(classes)` → `Map<className, { bg, text }>`
- 예: `bg-blue-100 text-blue-800`, `bg-emerald-100 text-emerald-800`, ...

---

## 4. 교사 포털 시간표 (Academy)

### 진입점

`/academy/teacher/timetable`

### 데이터 로드 흐름

```
[Timetable Page] (Server Component)
    │
    │  1. getCurrentTeacherProfile()
    │    → 현재 로그인 교사의 teacher_type 조회
    │
    │  2. Promise.all([
    │       getGroupTimetableGrid("유치부"),
    │       getGroupTimetableGrid("오후반"),
    │       getGroupTimetableGrid("방과후"),
    │     ])
    │
    ▼
[TeacherAcademyTimetable] (Client Component)
    │
    │  props: teacherProfileId, teacherType, allGroupData
    │
    │  buildTeacherDaySchedule() — TeacherTimetableTab과 동일 로직
    │
    ▼
  읽기 전용 시간표 (teacher_type에 따라 한국어/영어 UI)
```

### 관리자 뷰와의 차이점

| 항목 | 관리자 (TeacherTimetableTab) | 포털 (TeacherAcademyTimetable) |
|------|------------------------------|-------------------------------|
| 위치 | `/admin/teachers?tab=timetable` | `/academy/teacher/timetable` |
| 인증 | admin role | teacher role (본인 시간표만) |
| 언어 | 항상 한국어 | teacher_type에 따라 분기 |
| 탭 라벨 | "유치부 시간표" / "오후반 시간표" / "방과후 시간표" | Korean: 동일 / Native: "Kindergarten" / "Afternoon" / "After School" |
| 요일 헤더 | "월 화 수 목 금" | Korean: 동일 / Native: "Mon Tue Wed Thu Fri" |
| 모바일 | 기본 | `overflow-x-auto` + `minWidth: 360px` |

---

## 5. 학생 시간표 (관리자 뷰)

### 진입점

`/admin/students?selected={id}&tab=timetable`

### 데이터 로드 흐름

```
[StudentTimetableTab] (Client Component)
    │
    │  getStudentTimetable(studentProfileId)
    │
    ▼
[schedule-actions.ts]
    │
    │  1단계: class_students 조회
    │    → WHERE student_profile_id = {id}
    │    → 학생이 속한 class_id 목록 추출
    │
    │  2단계: classes 조회
    │    → WHERE id IN (소속 반 IDs)
    │    → Map<classId, className>
    │
    │  3단계: class_schedules 조회
    │    → WHERE class_id IN (소속 반 IDs)
    │
    │  4단계: academy_periods + teachers 병렬 조회
    │    → periods: IN (schedule에서 추출한 period IDs), is_active=true
    │    → teachers: IN (schedule에서 추출한 teacher IDs)
    │
    │  5단계: StudentTimetableRow[] 구성
    │    → 각 period별로 day 1~5에 해당 학생의 반 수업 매핑
    │
    ▼
[StudentTimetableRow[]] 반환
```

### 사용하는 테이블

| 단계 | 테이블 | 조회 조건 | 가져오는 데이터 |
|------|--------|-----------|---------------|
| 1 | `class_students` | student_profile_id = ? | class_id 목록 |
| 2 | `classes` | id IN (소속 반 IDs) | id, name |
| 3 | `class_schedules` | class_id IN (소속 반 IDs) | 전체 배정 정보 |
| 4a | `academy_periods` | id IN (사용된 period IDs) + is_active=true | id, name, start_time, end_time |
| 4b | `teachers` | profile_id IN (교사 IDs) | profile_id, name, teacher_type |

### `StudentTimetableRow` 타입

```typescript
type StudentTimetableRow = {
  academy_period_id: string;
  period_name: string;
  start_time: string;
  end_time: string;
  cells: Record<number, StudentTimetableCell | null>; // day 1~5
};

type StudentTimetableCell = {
  class_id: string;
  class_name: string;
  label: string | null;
  teacher_name: string | null;
  teacher_type: "korean" | "native";
};
```

---

## 6. Server Actions 정리

### schedule-actions.ts (수업 배정)

| 함수 | 용도 | 호출 위치 |
|------|------|----------|
| `getGroupTimetableGrid(groupLabel)` | 그룹별 시간표 전체 데이터 | Admin timetable page, Teachers page (timetable 탭), Academy teacher timetable |
| `addSingleClassSchedule(...)` | 단일 셀 upsert | GroupTimetableGrid (저장 시) |
| `addClassScheduleBatch(...)` | 여러 요일 일괄 삽입 | ClassScheduleManager |
| `listClassSchedules(classId)` | 반별 수업 시간표 조회 | ClassScheduleManager |
| `deleteClassSchedule(scheduleId)` | 배정 삭제 (hard delete) | GroupTimetableGrid |
| `getStudentTimetable(studentProfileId)` | 학생 통합 시간표 | StudentTimetableTab |

### timetable-actions.ts (교시 관리)

| 함수 | 용도 |
|------|------|
| `listAcademyPeriods()` | 전체 활성 교시 목록 |
| `createAcademyPeriod(...)` | 교시 생성 |
| `updateAcademyPeriod(...)` | 교시 수정 |
| `deleteAcademyPeriod(id)` | 교시 삭제 (soft delete: is_active=false) |

---

## 7. 파일 위치 요약

| 파일 | 역할 |
|------|------|
| `app/(admin)/admin/actions/schedule-actions.ts` | 수업 배정 Server Actions + `GroupTimetableData` 타입 |
| `app/(admin)/admin/actions/timetable-actions.ts` | 교시(academy_periods) CRUD |
| `app/(admin)/admin/timetable/page.tsx` | 관리자 시간표 페이지 (탭 4개) |
| `app/(admin)/admin/timetable/components/GroupTimetableGrid.tsx` | 그룹 시간표 편집 그리드 |
| `app/(admin)/admin/timetable/components/TimetableManager.tsx` | 교시 관리 UI |
| `app/(admin)/admin/teachers/components/TeacherTimetableTab.tsx` | 교사 개인 시간표 (관리자 뷰, 읽기 전용) |
| `app/(admin)/admin/students/components/StudentTimetableTab.tsx` | 학생 시간표 (관리자 뷰, 읽기 전용) |
| `app/(academy)/academy/teacher/timetable/page.tsx` | 교사 포털 시간표 페이지 |
| `app/(academy)/academy/teacher/timetable/TeacherAcademyTimetable.tsx` | 교사 포털 시간표 컴포넌트 |
| `lib/types/database.ts` | ClassSchedule, StudentTimetableRow 등 타입 |
| `lib/teacher-labels.ts` | 한국어/영어 시간표 라벨 |
| `docs/migrations/class-schedules.sql` | class_schedules 테이블 DDL |
| `docs/migrations/bus-system.sql` | academy_periods 테이블 DDL |
