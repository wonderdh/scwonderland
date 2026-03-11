# Academy Portal Implementation Roadmap

> **작성일**: 2026-03-11
> **현재 상태**: Admin 161개 Server Action 완성, Bus 포털 완성

---

## 현재 구현 현황

### Student Portal (6/9)

| 기능 | 상태 | 경로 |
|------|------|------|
| 프로필·반 조회 | ✅ | `student/page.tsx` |
| 리포트카드 | ✅ | `student/reports/` |
| 교재 | ✅ | `student/textbooks/` |
| 공지 | ✅ | `student/notices/` |
| 숙제 | ✅ | `student/homework/` |
| 승하차 | ✅ | `student/bus/` |
| **시간표 조회** | ❌ | — |
| **출결 조회** | ❌ | — |
| **학습 기록 조회** | ❌ | — |

### Teacher Portal (9/10)

| 기능 | 상태 | 경로 |
|------|------|------|
| 대시보드 | ✅ | `teacher/page.tsx` |
| 반 관리 (Korean) | ✅ | `teacher/classes/` |
| 공지 (Korean) | ✅ | `teacher/notices/` |
| 숙제 | ✅ | `teacher/homework/` |
| 출결 기록 | ✅ | `teacher/attendance/` |
| 리포트카드 (Native) | ✅ | `teacher/reports/` |
| 교재 | ✅ | `teacher/textbooks/` |
| 시간표 | ✅ | `teacher/timetable/` |
| 승하차 | ✅ | `teacher/bus/` |
| **출결 통계 뷰** | ❌ | — |

### Bus Portal — 완성

---

## Task 1 (P0): 학생 시간표 조회

**에이전트**: `academy-portal`
**우선순위**: P0 — UI만 구현, SA 이미 존재

### 기존 Server Action

```typescript
// schedule-actions.ts:333-459
export async function getStudentTimetable(
  studentProfileId: string,
): Promise<StudentTimetableRow[]>

// StudentTimetableRow
{
  academy_period_id: string;
  period_name: string;
  start_time: string;
  end_time: string;
  cells: Record<number, StudentTimetableCell | null>; // key: 요일 1(월)~5(금)
}

// StudentTimetableCell
{
  schedule_id: string;
  class_id: string | null;
  class_name: string | null;
  label: string | null;
  teacher_profile_id: string | null;
  teacher_name: string | null;
  teacher_type: "korean" | "native";
  textbook_id: string | null;
  source: "individual" | "class";
}
```

### 파일 생성/수정

| 파일 | 조치 |
|------|------|
| `student/timetable/page.tsx` | **생성** — Server Component, `getStudentTimetable()` 호출 |
| `student/timetable/StudentTimetableClient.tsx` | **생성** — 5열 그리드 표시 |
| `student/timetable/loading.tsx` | **생성** — 스켈레톤 UI |
| `student/components/StudentNav.tsx` | **수정** — 시간표 탭 추가 |

### UI 세부사항

- **참고 패턴**: `TeacherAcademyTimetable.tsx`의 6열 테이블 (교시 + 월~금)
  - Column 1 (90px): 교시명 + 시간 범위
  - Column 2-6: 월~금 수업 셀
  - 빈 셀: 회색 placeholder ("—")
  - `CLASS_COLOR_PALETTE`로 반 색상 구분
- **StudentNav 추가 항목**: `{ route: '/academy/student/timetable', label: '시간표', gradient: 'teal-500 to cyan-500' }`
- 학생은 읽기 전용 — 편집 UI 불필요

### 의존성

- `getCurrentStudentProfile()` — 학생 프로필 ID 획득
- `getStudentTimetable(profileId)` — 시간표 데이터
- `CLASS_COLOR_PALETTE` from `lib/class-colors.ts` (선택)

---

## Task 2 (P0): 학생 출결 조회

**에이전트**: `academy-portal`
**우선순위**: P0 — UI만 구현, SA 이미 존재

### 기존 Server Action

```typescript
// attendance-actions.ts:8-50
export async function listAttendanceRecords(
  studentProfileId: string,
  year?: number,
  month?: number
): Promise<AttendanceRecord[]>

// attendance-actions.ts:144-172
export async function getAttendanceStats(
  studentProfileId: string,
  year: number,
  month: number
): Promise<AttendanceStats>
// → { total, present, absent, late, excused }
```

### 파일 생성/수정

| 파일 | 조치 |
|------|------|
| `student/attendance/page.tsx` | **생성** — Server Component |
| `student/attendance/StudentAttendanceClient.tsx` | **생성** — 월별 출결 목록 + 통계 |
| `student/attendance/loading.tsx` | **생성** — 스켈레톤 UI |
| `student/components/StudentNav.tsx` | **수정** — 출결 탭 추가 |

### UI 세부사항

- **참고 패턴**: `TeacherAttendanceClient.tsx`의 STATUS_COLORS
  ```typescript
  const STATUS_COLORS = {
    present: { active: "bg-emerald-500 text-white", idle: "border-emerald-300 text-emerald-700" },
    absent:  { active: "bg-red-500 text-white",     idle: "border-red-300 text-red-700" },
    late:    { active: "bg-amber-500 text-white",    idle: "border-amber-300 text-amber-700" },
    excused: { active: "bg-blue-500 text-white",     idle: "border-blue-300 text-blue-700" },
  };
  ```
- **상단**: 월 선택기 (year/month) + 통계 카드 (출석/결석/지각/조퇴 카운트)
- **하단**: 날짜별 출결 기록 리스트 (상태 배지 + 비고)
- **StudentNav 추가 항목**: `{ route: '/academy/student/attendance', label: '출결', gradient: 'cyan-500 to blue-500' }`
- 학생은 읽기 전용

### 의존성

- `getCurrentStudentProfile()` — 학생 프로필 ID
- `listAttendanceRecords(profileId, year, month)` — 기록
- `getAttendanceStats(profileId, year, month)` — 통계

---

## Task 3 (P1): 학생 학습 기록 조회

**에이전트**: `academy-portal`
**우선순위**: P1 — UI만 구현, SA 이미 존재

### 기존 Server Action

```typescript
// learning-actions.ts:8-25
export async function listLearningRecords(
  studentProfileId: string
): Promise<LearningRecord[]>
```

### 파일 생성/수정

| 파일 | 조치 |
|------|------|
| `student/learning/page.tsx` | **생성** — Server Component |
| `student/learning/StudentLearningClient.tsx` | **생성** — 학습 기록 목록 |
| `student/learning/loading.tsx` | **생성** — 스켈레톤 UI |
| `student/components/StudentNav.tsx` | **수정** — 학습기록 탭 추가 |

### UI 세부사항

- 학습 기록 카드 리스트 (날짜, 과목, 교재, 점수/진도)
- 필터: 과목별, 기간별
- **StudentNav 추가 항목**: `{ route: '/academy/student/learning', label: '학습기록', gradient: 'indigo-500 to purple-500' }`
- 학생은 읽기 전용

### 의존성

- `getCurrentStudentProfile()` — 학생 프로필 ID
- `listLearningRecords(profileId)` — 학습 기록

---

## Task 4 (P1): 교사 출결 통계 뷰

**에이전트**: `academy-portal`
**우선순위**: P1 — SA 1개 추가 필요

### 기존 Server Action

```typescript
// attendance-actions.ts:144-172
export async function getAttendanceStats(
  studentProfileId: string,
  year: number,
  month: number
): Promise<AttendanceStats>

// attendance-actions.ts:106-141
export async function getClassAttendanceByDate(
  classId: string,
  date: string
): Promise<{ studentProfileId: string; status: string | null; note: string | null }[]>
```

### 신규 Server Action

```typescript
// attendance-actions.ts에 추가
export async function getClassAttendanceStats(
  classId: string,
  year: number,
  month: number
): Promise<ClassAttendanceStats>

// ClassAttendanceStats (lib/types/index.ts에 정의)
{
  totalDays: number;
  students: {
    profileId: string;
    name: string;
    present: number;
    absent: number;
    late: number;
    excused: number;
    rate: number; // 출석률 %
  }[];
}
```

### 파일 수정

| 파일 | 조치 |
|------|------|
| `admin/actions/attendance-actions.ts` | **수정** — `getClassAttendanceStats` 추가 |
| `admin/actions.ts` | **수정** — barrel re-export 추가 |
| `lib/types/index.ts` | **수정** — `ClassAttendanceStats` 타입 추가 |
| `teacher/attendance/components/TeacherAttendanceClient.tsx` | **수정** — 통계 탭/뷰 추가 |
| `lib/teacher-labels.ts` | **수정** — `attendanceLabels`에 stats 관련 라벨 추가 |

### UI 세부사항

- 기존 `TeacherAttendanceClient.tsx`에 탭 추가: 기록 | 통계
- **통계 뷰**:
  - 반 선택 드롭다운 + 월 선택기
  - 학생별 출석률 막대그래프 or 테이블
  - 전체 출석률 서머리 카드
- **teacher-labels.ts 추가 라벨**:
  ```typescript
  // attendanceLabels 확장
  statsTab: { korean: "통계", native: "Statistics" },
  attendanceRate: { korean: "출석률", native: "Attendance Rate" },
  totalDays: { korean: "수업일수", native: "Total Days" },
  ```

### 의존성

- `getTeacherClasses()` — 교사 담당 반 목록
- `getClassAttendanceStats(classId, year, month)` — 신규 SA
- `attendanceLabels` — 이중언어 라벨

---

## Task 5 (P2): 대시보드 개선

**에이전트**: `academy-portal`
**우선순위**: P2 — SA 2개 추가

### 신규 Server Action

```typescript
// academy/actions.ts 또는 별도 dashboard-actions.ts

export async function getStudentDashboardSummary(
  studentProfileId: string
): Promise<StudentDashboardSummary>

// StudentDashboardSummary
{
  attendanceRate: number;          // 이번 달 출석률 %
  pendingHomework: number;         // 미제출 숙제 수
  recentNotices: { id: string; title: string; date: string }[];  // 최근 3개
  latestReportCard: { id: string; date: string; summary: string } | null;
}

export async function getTeacherDashboardSummary(
  teacherProfileId: string
): Promise<TeacherDashboardSummary>

// TeacherDashboardSummary
{
  classCount: number;
  totalStudents: number;
  todayAttendance: { present: number; total: number };
  pendingHomework: number;         // 미채점 숙제 수
  recentNotices: { id: string; title: string; date: string }[];
}
```

### 파일 수정

| 파일 | 조치 |
|------|------|
| `admin/actions/` (또는 academy 전용) | **수정** — 대시보드 SA 추가 |
| `admin/actions.ts` | **수정** — barrel re-export |
| `lib/types/index.ts` | **수정** — Summary 타입 추가 |
| `student/page.tsx` | **수정** — 위젯 카드 추가 |
| `teacher/page.tsx` | **수정** — 위젯 카드 추가 |

### UI 세부사항

- **학생 대시보드 위젯**:
  - 출석률 도넛/원형 표시 (이번 달)
  - 미제출 숙제 카운트 (빨간 배지)
  - 최근 공지 3건 리스트
  - 최신 리포트카드 미리보기
- **교사 대시보드 위젯**:
  - 오늘 출석 현황 (present/total)
  - 미채점 숙제 카운트
  - 최근 공지 3건
  - 기존 반 목록·학생 목록 유지

---

## 실행 순서

```
Phase 1 (P0) — 병렬 실행 가능
├── Task 1: 학생 시간표 조회 (UI only, SA 존재)
└── Task 2: 학생 출결 조회 (UI only, SA 존재)

Phase 2 (P1) — Phase 1 완료 후
├── Task 3: 학생 학습 기록 조회 (UI only, SA 존재)
└── Task 4: 교사 출결 통계 뷰 (SA 1개 추가 + UI)

Phase 3 (P2) — Phase 2 완료 후
└── Task 5: 대시보드 개선 (SA 2개 추가 + UI 수정)
```

### StudentNav 최종 상태 (9개 탭)

| # | Route | Label | Phase |
|---|-------|-------|-------|
| 1 | `/academy/student` | 내 정보 | 기존 |
| 2 | `/academy/student/reports` | 리포트카드 | 기존 |
| 3 | `/academy/student/textbooks` | 교재 | 기존 |
| 4 | `/academy/student/notices` | 공지 | 기존 |
| 5 | `/academy/student/homework` | 숙제 | 기존 |
| 6 | `/academy/student/bus` | 승하차 | 기존 |
| 7 | `/academy/student/timetable` | 시간표 | Phase 1 |
| 8 | `/academy/student/attendance` | 출결 | Phase 1 |
| 9 | `/academy/student/learning` | 학습기록 | Phase 2 |

### 총 작업량 요약

| 항목 | 수량 |
|------|------|
| 신규 Server Action | 3개 (`getClassAttendanceStats`, `getStudentDashboardSummary`, `getTeacherDashboardSummary`) |
| 신규 페이지 | 3개 (시간표, 출결, 학습기록) |
| 신규 클라이언트 컴포넌트 | 3개 |
| 수정 파일 | ~10개 (Nav, 대시보드, actions, types, labels) |
