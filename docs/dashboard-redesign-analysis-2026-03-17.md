# 학생·교사 대시보드 개선 분석 보고서

> 작성일: 2026-03-17
> 분석 범위: 학생 로그인 홈 화면 + 교사 홈 화면 재설계
> 핵심 관점: Admin에 이미 존재하는 함수/컴포넌트 **재사용 가능 여부** 세밀 검토

---

## 1. 현황 진단

### 1.1 학생 포털 홈 (`/academy/student`)

**현재 코드: `app/(academy)/academy/student/page.tsx`**

```
[로그인 후 화면]
┌────────────────────────────────┐
│  🌈 프로필 배너                  │
│  ○ 학생 이름 (영어명)            │
└────────────────────────────────┘
┌────────────────────────────────┐
│  소속 반                        │
│  │ 반 이름 │ 교사 배지 ...       │
└────────────────────────────────┘
  "정보 수정이 필요하면 관리자에게 문의..."
```

**현재 Nav 순서:**
```
내 정보 | 리포트카드 | 교재 | 공지 | 숙제 | 시간표 | 승하차
```

**문제점:**
- 홈이 단순 프로필 카드 + 반 목록 — 대시보드 기능 전무
- **미제출 숙제 0건인지 3건인지 로그인해도 바로 모름**
- **이번 달 출결 현황 확인 탭 없음** (데이터는 DB에 있음)
- **학습 기록 열람 탭 없음** (데이터는 DB에 있음, `listLearningRecords`도 있음)
- 빠른 액션 없음 — "숙제 제출하러 가기" 버튼 없음

---

### 1.2 교사 포털 홈 (`/academy/teacher`)

**현재 코드: `app/(academy)/academy/teacher/page.tsx`**

```
[로그인 후 화면]
┌─────────────────────────────────────┐
│  🌈 프로필 배너                       │
│  ○ 선생님 이름  │ 반 N개 │ 학생 N명   │
└─────────────────────────────────────┘
  담당 반 카드 목록 (교재, 리포트카드 링크)
```

**현재 Nav (한국인 교사):**
```
담당반 | 시간표 | 공지사항 | 반관리 | 교재 | 출결 | 숙제 | 승하차
```

**문제점:**
- 오늘 수업 반, 출결 미입력 반, 미채점 숙제 수 — 한눈에 볼 수 없음
- 학생 관리 탭 없음, 학습 관리 탭 없음
- 반 관리가 학생 명단 조회만

---

## 2. Admin 기존 함수 재사용 가능 여부 — 완전 분석

아래 표는 **재사용 가능 여부**와 **필요한 변경 사항**을 정리한 것입니다.

### 2.1 출결 관련 (`attendance-actions.ts`)

| 함수 | 현재 권한 | 학생 재사용 가능 | 교사 재사용 가능 | 비고 |
|------|---------|--------------|--------------|------|
| `listAttendanceRecords(studentId, year?, month?)` | `verifyAuthenticated` | ✅ **즉시 재사용** | ✅ | 학생 출결 탭 신규 UI에 바로 사용 |
| `getAttendanceStats(studentId, year, month)` | `verifyAuthenticated` | ✅ **즉시 재사용** | ✅ | 대시보드 "이번달 출석률" 위젯에 재사용 |
| `getClassAttendanceByDate(classId, date)` | `verifyAuthenticated` | ❌ | ✅ 교사 탭에 재사용 | 교사 반 관리 강화에 활용 |
| `recordAttendance()` | `verifyAuthenticated` | ❌ 학생 불필요 | ✅ 이미 사용 중 | 변경 불필요 |

**결론:** 학생 출결 탭 신설 시 `listAttendanceRecords` + `getAttendanceStats` **함수 변경 없이 그대로 사용** 가능.

---

### 2.2 숙제 관련 (`homework-actions.ts`)

| 함수 | 현재 권한 | 학생 재사용 가능 | 교사 재사용 가능 | 비고 |
|------|---------|--------------|--------------|------|
| `getStudentHomework(studentProfileId)` | `verifyAuthenticated` | ✅ **이미 사용 중** | — | 대시보드 미제출 카운트에 재활용 |
| `listHomeworkAssignments(classId)` | `verifyAuthenticated` | ❌ | ✅ 이미 사용 중 | 교사 반 관리 탭에 재사용 |
| `listSubmissions(assignmentId)` | `verifyAuthenticated` | ❌ | ✅ 이미 사용 중 | 변경 불필요 |
| `submitHomework()` | 개별 소유권 검증 | ✅ **이미 사용 중** | — | 변경 불필요 |
| `reviewSubmission()` | 개별 소유권 검증 | ❌ | ✅ 이미 사용 중 | 변경 불필요 |

**결론:** 학생 대시보드에서 `getStudentHomework()` 결과를 `.filter(h => h.submission?.status === 'pending').length`로 미제출 숙제 수를 **계산만 하면 됨** — 신규 함수 불필요.

---

### 2.3 교재/진도 관련 (`textbook-actions.ts` + `academy/actions.ts`)

| 함수 | 위치 | 현재 권한 | 학생 재사용 | 교사 재사용 | 비고 |
|------|------|---------|-----------|-----------|------|
| `getCurrentStudentTextbooks()` | `academy/actions.ts` | `getUser()` 기반 | ✅ **이미 사용 중** | — | 대시보드 교재 진도 위젯 재활용 |
| `listStudentProgress(studentProfileId)` | `textbook-actions.ts` | `verifyAuthenticated` | ✅ 재사용 가능 | ✅ | 교사 학생 관리 상세 페이지에 사용 |
| `getClassTextbookProgress(classId, textbookId)` | `textbook-actions.ts` | `verifyAuthenticated` | ❌ | ✅ **즉시 재사용** | 교사 반 관리 "교재 진도" 탭에 사용 |
| `updateProgress()` | `textbook-actions.ts` | `verifyAuthenticated` | ❌ | ✅ 이미 사용 중 | 변경 불필요 |
| `listClassTextbooks(classId)` | `textbook-actions.ts` | `verifyAuthenticated` | ❌ | ✅ 재사용 가능 | 교사 반 관리 탭에 활용 |

**결론:**
- 학생 대시보드: `getCurrentStudentTextbooks()` 결과(이미 로드됨)를 카드에 요약 표시 → **추가 함수 불필요**
- 교사 반관리 강화: `getClassTextbookProgress()` + `listClassTextbooks()` **그대로 재사용**

---

### 2.4 공지 관련 (`class-notice-actions.ts` + `academy-notice-actions.ts`)

| 함수 | 현재 권한 | 학생 재사용 | 비고 |
|------|---------|-----------|------|
| `getMyClassNotices(studentProfileId)` | `verifyAuthenticated` | ✅ **이미 사용 중** | 대시보드 최신 공지 N건 표시 가능 |
| `listAcademyNotices(false)` | `verifyAuthenticated` | ✅ **이미 사용 중** | 위와 동일 |
| `getClassNoticeWithAttachments()` | `verifyAuthenticated` | ✅ **이미 사용 중** | 변경 불필요 |
| `getAcademyNoticeWithAttachments()` | `verifyAuthenticated` | ✅ **이미 사용 중** | 변경 불필요 |

**결론:** 이미 모두 사용 중. 대시보드에서 **최근 공지 2~3건만 slice** 해서 표시 — 신규 함수 불필요.

---

### 2.5 학습 기록 관련 (`learning-actions.ts`)

| 함수 | 현재 권한 | 학생 재사용 | 교사 재사용 | 비고 |
|------|---------|-----------|-----------|------|
| `listLearningRecords(studentProfileId)` | `verifyAuthenticated` | ✅ **즉시 재사용** | ✅ | 학생 포털 학습 기록 탭에 바로 사용 가능 |
| `createLearningRecord()` | `verifyAuthenticated` | ❌ (학생 입력 불필요) | ✅ **교사 전용 신규 UI** | `author_id` 컬럼 활용 |
| `updateLearningRecord()` | `verifyAuthenticated` | ❌ | ✅ 본인 확인 로직 추가 필요 | `author_id === currentUser.id` 검증 추가 |
| `deleteLearningRecord()` | `verifyAuthenticated` | ❌ | ✅ 본인 확인 로직 추가 필요 | 위와 동일 |

**⚠ 주의:** `updateLearningRecord` / `deleteLearningRecord` 현재 **author 소유권 검증 없음** → 교사가 타인 기록 수정/삭제 가능. 교사 학습관리 탭 추가 시 **반드시 수정 필요**.

**결론:**
- 학생 포털: `listLearningRecords()` 함수 변경 없이 그대로 사용
- 교사 포털: `createLearningRecord()`에 `author_id` 자동 설정 로직 추가 + `update/delete`에 소유권 검증 추가 필요

---

### 2.6 리포트카드 관련 (`report-actions.ts`)

| 함수 | 권한 | 학생 재사용 | 비고 |
|------|------|-----------|------|
| `listReportCardsByStudent()` | RLS 기반 (학생 본인) | ✅ **이미 사용 중** | 변경 불필요 |
| `getReportCard()` | RLS 기반 | ✅ **이미 사용 중** | 변경 불필요 |
| `updateReportCardReply()` | 본인 확인 | ✅ **이미 사용 중** | 변경 불필요 |

**결론:** 완전히 정상 사용 중. 대시보드에서 최신 리포트카드 유무만 표시 가능.

---

### 2.7 스케줄/시간표 관련 (`schedule-actions.ts`)

```typescript
// schedule-actions.ts 주요 함수
getClassSchedulesByTeacher(teacherProfileId)  // 교사 담당 반 시간표
getStudentSchedules(studentProfileId)          // 학생 시간표
```

| 함수 | 권한 | 재사용 | 비고 |
|------|------|-------|------|
| `getStudentSchedules(studentProfileId)` | `verifyAuthenticated` | ✅ 학생 시간표 탭에 사용 중 | 대시보드 "오늘 수업" 표시 가능 |
| `getClassSchedulesByTeacher(teacherId)` | `verifyAuthenticated` | ✅ 교사 대시보드 | 오늘 요일 필터로 "오늘 수업" 표시 |

---

### 2.8 Admin `dashboard-actions.ts` — 학생/교사 포털 재사용 불가

```typescript
getTodayStats()    // verifyAdmin — 재사용 불가
getDashboardStats() // verifyAdmin — 재사용 불가
```

**결론:** 두 함수 모두 `verifyAdmin`으로 잠겨 있어 학생/교사에서 직접 사용 불가. 새 함수 작성 필요.

---

## 3. 재사용 가능 컴포넌트

### 3.1 즉시 재사용 가능

| 컴포넌트 | 경로 | 교사/학생 포털 활용 |
|---------|------|-----------------|
| `ReportCardReadView` | `admin/students/components/` | 학생 리포트카드 페이지에서 **이미 사용 중** |
| `FileList` | `components/FileList.tsx` | 공지 첨부파일 표시에 **이미 사용 중** |
| `AudioRecorder` | `components/AudioRecorder.tsx` | 학생 숙제 제출에 **이미 사용 중** |
| `LoadingState` | `components/LoadingState.tsx` | **이미 사용 중** |
| `Spinner` | `components/Spinner.tsx` | **이미 사용 중** |

### 3.2 신규 생성 필요 (재사용 가능하도록 설계)

| 컴포넌트 | 위치 (권고) | 용도 | 재사용처 |
|---------|-----------|------|---------|
| `AttendanceStatusBadge` | `components/` | 출결 상태(출석/결석/지각) 뱃지 | 학생 출결 탭 + 교사 반 관리 탭 |
| `StarBadge` | `components/` | ★★☆ 점수 시각화 | 학생 학습 기록 탭 + 교사 학습 관리 |
| `TextbookProgressBar` | `components/` | 교재 진도 막대 | 학생 대시보드 + 교사 반 관리 |

---

## 4. 학생 대시보드 개선 설계

### 4.1 목표 홈 화면 구성

```
/academy/student  (현재: 프로필 + 반 목록만)

┌──────────────────────────────────────────┐
│  🌈 배너 + 프로필 카드 (현재 유지)          │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│  📊 요약 위젯 (4개)                        │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ │
│  │미제출   │ │이번달  │ │진행중  │ │새공지   │ │
│  │숙제 N건 │ │출석률% │ │교재 N권│ │N건     │ │
│  └────────┘ └────────┘ └────────┘ └────────┘ │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│  📚 소속 반 + 담당 교사 (현재 유지)         │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│  📋 최근 공지 3건 (바로가기 링크)           │
└──────────────────────────────────────────┘
```

### 4.2 위젯별 데이터 출처 (모두 기존 함수 재사용)

| 위젯 | 함수 | 변경 필요 |
|------|------|---------|
| 미제출 숙제 N건 | `getStudentHomework(id)` → filter `status==='pending'` | **없음** — 계산만 |
| 이번달 출석률 | `getAttendanceStats(id, year, month)` | **없음** — 직접 재사용 |
| 진행 중 교재 N권 | `getCurrentStudentTextbooks()` → filter `status==='in_progress'` | **없음** — 계산만 |
| 새 공지 N건 | `getMyClassNotices(id)` + `listAcademyNotices(false)` → 최근 7일 filter | **없음** — 계산만 |

**→ 대시보드 위젯 4개 모두 기존 함수 재사용, 신규 Server Action 불필요.**

단, 페이지에서 5개 함수를 동시에 `Promise.all` 호출하므로 **`getStudentDashboardSummary()`** 하나로 묶는 것을 권고:

```typescript
// academy/actions.ts에 추가
export async function getStudentDashboardSummary(studentProfileId: string) {
  // 내부적으로 기존 함수 5개를 Promise.all로 묶음
  // → 페이지 로딩 병렬화 + 코드 단순화
}
```

### 4.3 신규 탭 추가

| 탭 | 경로 | 사용할 기존 함수 | 신규 함수 |
|----|------|--------------|---------|
| **출결** (신규) | `/academy/student/attendance` | `listAttendanceRecords()` + `getAttendanceStats()` | 없음 |
| **학습 기록** (신규) | `/academy/student/learning` | `listLearningRecords()` | 없음 |

### 4.4 StudentNav 변경

**변경 전:**
```
내 정보 | 리포트카드 | 교재 | 공지 | 숙제 | 시간표 | 승하차
```

**변경 후:**
```
홈 | 교재 | 공지 | 숙제 | 출결 | 학습기록 | 리포트카드 | 시간표 | 승하차
```

- "내 정보" → "홈" (대시보드로 개편)
- "출결" 신규 추가
- "학습기록" 신규 추가
- "리포트카드" 뒤로 이동 (덜 자주 접근)

---

## 5. 교사 대시보드 개선 설계 (기존 계획과 통합)

### 5.1 목표 홈 화면 구성

```
/academy/teacher  (현재: 프로필 + 담당 반 카드만)

┌──────────────────────────────────────────────┐
│  🌈 배너 + 프로필 카드 (현재 유지)              │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  📅 오늘 수업 반                               │
│  반 이름 | 교시 시간 | 학생 수                  │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  ⚠ 오늘 출결 미입력 반 (알림)                   │
│  [출결 입력하러 가기] 버튼                       │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  📊 요약 위젯 (3개)                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │미채점 숙제│ │이번달 학습│ │담당 반 수 │      │
│  │   N건    │ │기록 N건  │ │   N개    │      │
│  └──────────┘ └──────────┘ └──────────┘      │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  🏫 담당 반 목록 (기존 유지 + 상세 링크 강화)    │
└──────────────────────────────────────────────┘
```

### 5.2 교사 대시보드 위젯별 데이터 출처

| 위젯 | 함수 | 변경 필요 |
|------|------|---------|
| 오늘 수업 반 | `getClassSchedulesByTeacher(teacherId)` → 오늘 요일 filter | **없음** — 계산만 |
| 출결 미입력 반 | `getTeacherClasses()` + `getClassAttendanceByDate(classId, today)` → 없는 반 필터 | **없음** — 두 기존 함수 조합 |
| 미채점 숙제 | `listHomeworkAssignments(classId)` → 각 반 합산 + `listSubmissions()` filter `status==='submitted'` | **없음** — 조합만 |
| 이번달 학습기록 입력 건수 | `listLearningRecords()` → `author_id === me` + 이번달 filter | **없음** — 계산만 |

**→ `getTeacherDashboardSummary(teacherProfileId)` 하나로 묶는 신규 함수 1개 필요** (내부적으로 기존 함수 조합).

### 5.3 교사 신규 탭과 기존 함수 재사용

#### [T-2] 학생 관리 탭

| 기능 | 재사용 함수 | 변경 필요 |
|------|-----------|---------|
| 담당 반 학생 목록 | `getTeacherClasses()` (이미 있음) | **없음** |
| 학생 상세 — 교재 진도 | `listStudentProgress(studentProfileId)` → `textbook-actions.ts` | **없음** — 직접 재사용 |
| 학생 상세 — 최근 출결 5회 | `listAttendanceRecords(studentProfileId)` → `attendance-actions.ts` | **없음** — 직접 재사용 |
| 학생 상세 — 학습 기록 5건 | `listLearningRecords(studentProfileId)` → `learning-actions.ts` | **없음** — 직접 재사용 |
| 학생 상세 — 미제출 숙제 | `getStudentHomework(studentProfileId)` → `homework-actions.ts` | **없음** — 직접 재사용 |

**→ 학생 관리 탭 전체를 기존 함수만으로 구현 가능. 신규 Server Action: `getTeacherStudentDetail()` (담당 반 소속 검증 포함) 1개만 필요.**

#### [T-3] 반 관리 강화 탭

| 탭 | 재사용 함수 | 변경 필요 |
|----|-----------|---------|
| 학생 명단 | `getTeacherClasses()` (현재 사용 중) | **없음** |
| 출결 현황 | `getClassAttendanceByDate(classId, date)` + `listAttendanceRecords()` 조합 | **없음** |
| 숙제 현황 | `listHomeworkAssignments(classId)` + `listSubmissions(assignmentId)` 조합 | **없음** |
| 교재 진도 | `listClassTextbooks(classId)` + `getClassTextbookProgress(classId, textbookId)` | **없음** |

**→ 반 관리 탭 강화도 기존 함수만으로 구현 가능. 신규 함수 3개 (`getClassAttendanceSummary`, `getClassHomeworkSummary`, `getClassTextbookSummary`)는 기존 함수를 조합한 집계 함수.**

#### [T-4] 학습 관리 탭

| 기능 | 재사용 함수 | 변경 필요 |
|------|-----------|---------|
| 반별 학습 기록 조회 | `listLearningRecords(studentProfileId)` 반복 호출 | **없음** (집계 함수는 신규) |
| 기록 입력 | `createLearningRecord()` — `author_id` 자동 주입 | **author_id 자동 주입 로직 추가** |
| 기록 수정 | `updateLearningRecord()` | **소유권 검증 로직 추가 필요** |
| 기록 삭제 | `deleteLearningRecord()` | **소유권 검증 로직 추가 필요** |

---

## 6. 변경이 반드시 필요한 기존 함수

### ⚠ 수정 필요 함수 목록

| 함수 | 파일 | 현재 문제 | 필요한 변경 |
|------|------|---------|-----------|
| `updateLearningRecord(recordId, ...)` | `learning-actions.ts` | `author_id` 소유권 검증 없음 | 기록의 `author_id === currentUser.id` 검증 추가 |
| `deleteLearningRecord(recordId)` | `learning-actions.ts` | `author_id` 소유권 검증 없음 | 기록의 `author_id === currentUser.id` 검증 추가 |

**현재 상태:** 인증된 사용자라면 누구나 타인의 학습 기록을 수정/삭제 가능 (보안 허점). 교사 학습 관리 탭 추가 전에 **반드시 수정**해야 함.

---

## 7. 신규 Server Actions 최종 목록

아래는 **진짜로 새로 작성해야 하는** 함수만 정리 (기존 함수 조합/집계 용도).

### 학생 포털

| 함수 | 위치 | 역할 | 내부 사용 기존 함수 |
|------|------|------|----------------|
| `getStudentDashboardSummary(studentId)` | `academy/actions.ts` | 홈 위젯 데이터 일괄 수집 | `getStudentHomework` + `getAttendanceStats` + `getCurrentStudentTextbooks` + `getMyClassNotices` + `listAcademyNotices` |

### 교사 포털

| 함수 | 위치 | 역할 | 내부 사용 기존 함수 |
|------|------|------|----------------|
| `getTeacherDashboardSummary(teacherId)` | `academy/actions.ts` | 교사 홈 위젯 | `getTeacherClasses` + `getClassAttendanceByDate` + `listHomeworkAssignments` + `listLearningRecords` |
| `getTeacherStudentDetail(teacherId, studentId)` | `academy/actions.ts` | 학생 상세 + 반 소속 검증 | `listStudentProgress` + `listAttendanceRecords` + `listLearningRecords` + `getStudentHomework` |
| `getClassAttendanceSummary(classId, yearMonth)` | `academy/actions.ts` | 반별 출결 요약 | `listAttendanceRecords` |
| `getClassHomeworkSummary(classId)` | `academy/actions.ts` | 반별 숙제 현황 | `listHomeworkAssignments` + `listSubmissions` |
| `getClassTextbookSummary(classId)` | `academy/actions.ts` | 반별 교재 진도 | `listClassTextbooks` + `getClassTextbookProgress` |
| `getClassLearningRecords(classId, teacherId)` | `academy/actions.ts` | 반별 학습 기록 | `getTeacherClasses` 소속 검증 + `listLearningRecords` |

**총계: 신규 Server Action 7개** (모두 기존 함수 조합, DB 직접 접근 최소화)

---

## 8. 신규 UI 파일 목록

### 학생 포털

| 파일 | 상태 | 설명 |
|------|------|------|
| `app/(academy)/academy/student/page.tsx` | **수정** | 홈 대시보드로 개편 |
| `app/(academy)/academy/student/components/StudentNav.tsx` | **수정** | 탭 2개 추가 |
| `app/(academy)/academy/student/attendance/page.tsx` | **신규** | 출결 확인 페이지 |
| `app/(academy)/academy/student/attendance/StudentAttendanceClient.tsx` | **신규** | 월별 출결 + 통계 |
| `app/(academy)/academy/student/learning/page.tsx` | **신규** | 학습 기록 열람 |
| `app/(academy)/academy/student/learning/StudentLearningClient.tsx` | **신규** | 기록 목록 + 별점 |
| `app/(academy)/academy/student/components/StudentDashboardSummary.tsx` | **신규** | 4개 요약 위젯 |

### 교사 포털

| 파일 | 상태 | 설명 |
|------|------|------|
| `app/(academy)/academy/teacher/page.tsx` | **수정** | 대시보드 위젯 추가 |
| `app/(academy)/academy/teacher/components/TeacherNav.tsx` | **수정** | 탭 2개 추가 |
| `app/(academy)/academy/teacher/components/TeacherDashboardSummary.tsx` | **신규** | 교사 요약 위젯 |
| `app/(academy)/academy/teacher/students/page.tsx` | **신규** | 학생 관리 목록 |
| `app/(academy)/academy/teacher/students/[studentId]/page.tsx` | **신규** | 학생 상세 |
| `app/(academy)/academy/teacher/students/components/TeacherStudentList.tsx` | **신규** | 학생 목록 UI |
| `app/(academy)/academy/teacher/students/components/TeacherStudentDetail.tsx` | **신규** | 학생 상세 UI |
| `app/(academy)/academy/teacher/learning/page.tsx` | **신규** | 학습 관리 |
| `app/(academy)/academy/teacher/learning/components/TeacherLearningClient.tsx` | **신규** | 학습 기록 CRUD |
| `app/(academy)/academy/teacher/classes/page.tsx` | **수정** | 탭 UI로 강화 |
| `app/(academy)/academy/teacher/classes/components/ClassAttendanceSummary.tsx` | **신규** | 반별 출결 탭 |
| `app/(academy)/academy/teacher/classes/components/ClassHomeworkSummary.tsx` | **신규** | 반별 숙제 탭 |
| `app/(academy)/academy/teacher/classes/components/ClassTextbookSummary.tsx` | **신규** | 반별 교재 탭 |

---

## 9. DB 변경 사항

**없음.** 모든 필요 데이터는 기존 테이블에 존재:

| 필요 기능 | 테이블 | 컬럼 |
|---------|-------|------|
| 학생 출결 확인 | `attendance` | `student_profile_id, attendance_date, status` |
| 학생 학습 기록 열람 | `learning_records` | `student_profile_id, author_id, category, score, max_score` |
| 교사 작성 기록 구분 | `learning_records` | `author_id` ← 이미 존재, 활용만 필요 |
| 별점 계산 | `learning_records` | `score, max_score` → 동적 계산 |

---

## 10. 구현 우선순위 및 순서

```
Phase 1 (즉시 가능, DB 변경 없음, 기존 함수만 활용):
─────────────────────────────────────────────
1. learning-actions.ts — update/delete 소유권 검증 추가 (보안, 5분 작업)
2. 학생 포털 출결 탭 신규 (listAttendanceRecords + getAttendanceStats 재사용)
3. 학생 포털 학습 기록 탭 신규 (listLearningRecords 재사용)
4. 학생 포털 홈 대시보드 위젯 추가 (기존 함수 5개 조합)
5. StudentNav 탭 순서 + 신규 탭 추가

Phase 2 (교사 포털 기능 확장):
─────────────────────────────────────────────
6. 교사 학습 관리 탭 신규 (학생 입력 금지, 교사 본인만)
7. 교사 학생 관리 탭 신규 (기존 함수 조합)
8. 교사 반 관리 탭 강화 (출결/숙제/교재 탭 분리)

Phase 3 (교사 대시보드):
─────────────────────────────────────────────
9. 교사 포털 홈 대시보드 위젯 추가 (Phase 2 완료 후)
10. TeacherNav 변경 (학생관리, 학습관리 탭 추가)
```

---

## 11. 핵심 결론 요약

| 항목 | 학생 포털 | 교사 포털 |
|------|---------|---------|
| **재사용 가능 함수** | 8개 (변경 없이 즉시) | 12개 (변경 없이 즉시) |
| **수정 필요 기존 함수** | 0개 | 2개 (소유권 검증) |
| **신규 Server Action** | 1개 (집계 함수) | 6개 (집계/조합 함수) |
| **신규 UI 파일** | 5개 | 10개 |
| **DB 변경** | 없음 | 없음 |
| **난이도** | 낮음 | 중간 |

**핵심 인사이트:**
> Admin 폴더에 이미 구현된 함수들이 대부분 `verifyAuthenticated`로 보호되어 있어, 학생/교사 포털에서 **직접 import하여 재사용 가능**. 새로 작성할 Server Action은 대부분 기존 함수를 `Promise.all`로 묶은 **집계/요약 함수**가 전부.

---

## 12. 검증 체크리스트

### 학생 대시보드
- [ ] 로그인 후 미제출 숙제 카운트 표시 정확성 확인
- [ ] 이번달 출석률 `getAttendanceStats()` 값과 일치 확인
- [ ] 출결 탭 — 월 선택 시 해당 월 기록 필터링 확인
- [ ] 학습 기록 탭 — 본인 기록만 표시 확인 (타 학생 열람 불가)

### 교사 대시보드
- [ ] 오늘 수업 반 — 현재 요일 기준 정확성 확인
- [ ] 출결 미입력 반 — 오늘 날짜 기준 정확성 확인
- [ ] 학생 관리 탭 — 담당 반 외 학생 URL 직접 접근 시 권한 오류 확인

### 학습 관리 (교사) — 보안 핵심
- [ ] `updateLearningRecord` — 타인 작성 기록 수정 시 오류 반환 확인
- [ ] `deleteLearningRecord` — 타인 작성 기록 삭제 시 오류 반환 확인
- [ ] `createLearningRecord` — `author_id`가 현재 교사 ID로 저장 확인
- [ ] 담당 반 외 학생에게 학습 기록 생성 시 오류 반환 확인
