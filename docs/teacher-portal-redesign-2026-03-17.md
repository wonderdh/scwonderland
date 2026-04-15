# 교사 포털 기능 구조 재설계 계획

> 작성일: 2026-03-17
> 목적: eSmart Campus 매뉴얼의 선생님 관리사이트·학생관리·반관리·학습관리를 참고하여
>       SC Wonderland 교사 포털의 기능 구조를 재설계

---

## 1. 현황 분석 — 현재 교사 포털의 문제

### 1.1 현재 메뉴 구조 (한국인 교사 기준)

| 탭 | 경로 | 상태 |
|----|------|------|
| 담당 반 | `/academy/teacher` | 프로필 + 담당 반 목록만 (대시보드 없음) |
| 시간표 | `/academy/teacher/timetable` | 읽기 전용 ✅ |
| 공지사항 | `/academy/teacher/notices` | 작성/수정/삭제 ✅ |
| 반 관리 | `/academy/teacher/classes` | 학생 명단 조회만 (한국인만) |
| 교재 | `/academy/teacher/textbooks` | 진도 조회/업데이트 ✅ |
| 출결 | `/academy/teacher/attendance` | 일일 출결 기록 ✅ |
| 숙제 | `/academy/teacher/homework` | 출제/검토 ✅ |
| 승하차 | `/academy/teacher/bus` | 읽기 전용 (한국인만) |

### 1.2 핵심 문제점

1. **대시보드 없음** — "담당 반" 탭이 홈인데 요약 정보가 없음. 오늘 할 일, 미처리 항목을 한눈에 볼 수 없음.
2. **학생관리 탭 없음** — 담당 반 학생을 개인별로 들여다볼 수 있는 페이지가 없음. 교재 진도, 출결, 학습 기록을 한 학생에 대해 종합적으로 볼 수 없음.
3. **학습관리 탭 없음** — `learning_records` 입력이 관리자 전용. 교사가 시험 점수·테스트 결과를 직접 입력할 수 없음. 반별 학습 현황 리포트도 없음.
4. **반 관리가 단순 명단** — 반별 출결 요약, 숙제 현황, 교재 진도 요약이 없음.

---

## 2. 목표 구조 — eSmart Campus 참고 + SC Wonderland 맞춤

### 2.1 새 메뉴 구조 (한국인 교사)

```
/academy/teacher/
├── (홈)            대시보드       ← 전면 개편
├── students/       학생 관리      ← 신규
├── classes/        반 관리        ← 기존 → 강화
├── learning/       학습 관리      ← 신규
├── notices/        공지사항       ← 유지
├── textbooks/      교재           ← 유지
├── attendance/     출결           ← 유지
├── homework/       숙제           ← 유지
├── timetable/      시간표         ← 유지
└── bus/            승하차         ← 유지 (한국인만)
```

### 2.2 원어민 교사 메뉴 — 변경 없음

```
My Classes / Textbooks / Attendance / Homework / Report Cards / Timetable
```

원어민 교사는 학생관리·반관리·학습관리 기능 접근 없음 (기존 유지).

---

## 3. 기능별 상세 설계

---

### [T-1] 대시보드 (홈) 전면 개편

**현황:** 프로필 카드 + 담당 반 카드 목록만 존재

**목표:** 교사가 로그인하면 오늘 해야 할 일과 반별 현황을 한눈에 파악

**추가 위젯:**

| 위젯 | 데이터 출처 | 비고 |
|------|-----------|------|
| 오늘 수업 반 목록 | `class_schedules` | 요일별 담당 반 |
| 출결 미입력 반 알림 | `attendance` LEFT JOIN | 오늘 날짜 기준 |
| 미채점 숙제 건수 | `homework_submissions WHERE status='submitted'` | 클릭 시 해당 탭 이동 |
| 이번 달 학습 기록 입력 건수 | `learning_records WHERE author_id=me` | 간단 카운터 |
| 빠른 액션 버튼 | — | 출결 입력, 숙제 출제 바로가기 |

**신규 Server Action:**
- `getTeacherDashboardSummary(teacherProfileId)` → `verifyAuthenticated`
  ```
  반환: {
    todayClasses: ClassInfo[],           // 오늘 수업 반
    attendanceMissing: ClassInfo[],      // 출결 미입력 반
    pendingReviews: number,              // 미채점 숙제 수
    monthlyLearningCount: number         // 이번 달 학습 기록 입력 건수
  }
  ```

**영향 파일:**
- `app/(academy)/academy/teacher/page.tsx` — 전면 개편
- `app/(academy)/academy/teacher/components/TeacherDashboardSummary.tsx` — 신규
- `app/(academy)/academy/actions.ts` — `getTeacherDashboardSummary()` 추가

---

### [T-2] 학생 관리 (신규)

**현황:** 없음. 학생을 개인별로 조회하는 교사 UI 전무.

**목표:** 담당 반 학생 전체를 목록으로 보고, 학생 개인 페이지에서 종합 정보 열람

**라우트:**
```
/academy/teacher/students/
├── page.tsx                 # 담당 반 학생 전체 목록 (반 필터 포함)
└── [studentId]/
    └── page.tsx             # 학생 개인 요약 (읽기 전용)
```

**학생 목록 페이지 (`/students`):**
- 반 선택 필터 (담당 반만)
- 학생 카드/행: 이름(나이 색상), 반, 교재 진도, 최근 출결 상태
- 정렬: 나이순 → 이름순 (기존 규칙 유지)

**학생 상세 페이지 (`/students/[studentId]`):**
- 기본 정보: 이름, 반, 나이
- 교재 진도 요약 (배정 교재 + 완료 단원)
- 최근 출결 5회 (날짜, 상태)
- 최근 학습 기록 5건 (날짜, 카테고리, 점수)
- 미제출 숙제 목록
- ※ 읽기 전용 — 수정은 각 전용 탭에서

**신규 Server Action:**
- `getTeacherStudentList(teacherProfileId, classId?)` → `verifyAuthenticated`
- `getTeacherStudentDetail(teacherProfileId, studentProfileId)` → `verifyAuthenticated` (담당 반 소속 검증)

**영향 파일:**
- `app/(academy)/academy/teacher/students/page.tsx` — 신규
- `app/(academy)/academy/teacher/students/[studentId]/page.tsx` — 신규
- `app/(academy)/academy/teacher/students/components/TeacherStudentList.tsx` — 신규
- `app/(academy)/academy/teacher/students/components/TeacherStudentDetail.tsx` — 신규
- `app/(academy)/academy/actions.ts` — 2개 함수 추가

---

### [T-3] 반 관리 강화

**현황:** 학생 명단 조회만 (한국인 교사 전용)

**목표:** 반 단위 현황 요약 — 출결, 숙제, 교재 진도를 반별로 한눈에

**강화 내용:**

| 기존 | 추가 |
|------|------|
| 학생 명단 조회 | 이번 달 출결 현황 요약 (출석률 %) |
| — | 현재 진행 중 숙제 + 제출률 |
| — | 배정 교재별 평균 진도 |

**반 상세 탭 구조 (기존 단일 화면 → 탭 분리):**
```
반 상세 (/academy/teacher/classes?classId=xxx)
├── 학생 명단    (기존 유지)
├── 출결 현황   (이번 달 출석률 테이블, 학생별 결석/지각 횟수)
├── 숙제 현황   (과제별 제출률, 미제출 학생 표시)
└── 교재 진도   (배정 교재별 학생별 진도 바, 평균 대비)
```

**신규 Server Action:**
- `getClassAttendanceSummary(classId, yearMonth)` → `verifyAuthenticated`
- `getClassHomeworkSummary(classId)` → `verifyAuthenticated`
- `getClassTextbookSummary(classId)` → `verifyAuthenticated`

**영향 파일:**
- `app/(academy)/academy/teacher/classes/page.tsx` — 탭 UI로 개편
- `app/(academy)/academy/teacher/classes/components/ClassAttendanceSummary.tsx` — 신규
- `app/(academy)/academy/teacher/classes/components/ClassHomeworkSummary.tsx` — 신규
- `app/(academy)/academy/teacher/classes/components/ClassTextbookSummary.tsx` — 신규
- `app/(academy)/academy/actions.ts` — 3개 함수 추가

---

### [T-4] 학습 관리 (신규)

**현황:** `learning_records` 입력/조회가 **관리자 전용**. 교사 포털에서 완전히 접근 불가.

**목표:** 교사가 담당 반 학생의 학습 기록(시험 점수, 평가, 메모)을 직접 입력하고 반별 현황을 조회

**라우트:**
```
/academy/teacher/learning/
└── page.tsx     # 반 선택 → 학습 기록 목록 + 입력
```

**페이지 구성:**
1. **반 선택** — 담당 반 탭 or 드롭다운
2. **학습 기록 목록** (선택 반 기준)
   - 날짜, 학생 이름, 카테고리, 제목, 점수(별점 포함)
   - 카테고리 필터: 전체 / test / assessment / note / level_change
3. **기록 입력** (교사 본인이 author로 저장)
   - 학생 선택 (담당 반 학생만)
   - 날짜, 카테고리, 제목, 내용, 점수/만점
   - 점수 입력 시 별점 미리보기 (★★★)
4. **기록 수정/삭제** (본인이 작성한 것만)

**별점 계산 규칙 (eSmart Campus 방식):**
```
score/max_score × 100
100%      → ★★★
67~99%    → ★★☆
33~66%    → ★☆☆
0~32%     → ☆☆☆
```

**신규 Server Action:**
- `getClassLearningRecords(classId, teacherProfileId, filter?)` → `verifyAuthenticated` (담당 반 검증)
- `createTeacherLearningRecord(formData)` → `verifyAuthenticated` (author_id = 교사 본인)
- `updateTeacherLearningRecord(recordId, formData)` → `verifyAuthenticated` (본인 작성 확인)
- `deleteTeacherLearningRecord(recordId)` → `verifyAuthenticated` (본인 작성 확인)

**영향 파일:**
- `app/(academy)/academy/teacher/learning/page.tsx` — 신규
- `app/(academy)/academy/teacher/learning/components/TeacherLearningClient.tsx` — 신규
- `app/(admin)/admin/actions/learning-actions.ts` — 기존 함수에 author 권한 체크 추가
- `app/(academy)/academy/actions.ts` — 클래스별 조회 함수 추가
- `lib/ui/teacher-labels.ts` — `learningLabels` 추가 (한국어만, 원어민 미제공)

---

## 4. DB 변경 사항

**변경 없음.** 기존 테이블 구조 그대로 사용.

- `learning_records.author_id` 이미 존재 → 교사 작성 여부 판별 가능
- 별점은 `score/max_score`에서 동적 계산 (컬럼 추가 불필요)

---

## 5. 네비게이션 변경

### 변경 전 (TeacherNav.tsx — 한국인 교사)
```
담당반 | 시간표 | 공지사항 | 반관리 | 교재 | 출결 | 숙제 | 승하차
```

### 변경 후 (한국인 교사)
```
홈 | 학생관리 | 반관리 | 학습관리 | 공지사항 | 교재 | 출결 | 숙제 | 시간표 | 승하차
```

**변경 포인트:**
- "담당 반" → "홈" (아이콘 변경)
- "학생 관리" 신규 추가 (2번째)
- "반 관리" 3번째로 이동 (강화)
- "학습 관리" 신규 추가 (4번째)

### 원어민 교사 — 변경 없음
```
My Classes | Textbooks | Attendance | Homework | Report Cards | Timetable
```

---

## 6. 신규 컴포넌트 목록

| 컴포넌트 | 경로 | 용도 |
|---------|------|------|
| `TeacherDashboardSummary` | `teacher/components/` | 홈 요약 위젯 |
| `TeacherStudentList` | `teacher/students/components/` | 학생 목록 |
| `TeacherStudentDetail` | `teacher/students/components/` | 학생 상세 |
| `ClassAttendanceSummary` | `teacher/classes/components/` | 반별 출결 요약 탭 |
| `ClassHomeworkSummary` | `teacher/classes/components/` | 반별 숙제 현황 탭 |
| `ClassTextbookSummary` | `teacher/classes/components/` | 반별 교재 진도 탭 |
| `TeacherLearningClient` | `teacher/learning/components/` | 학습 기록 관리 |

---

## 7. 신규 Server Actions 목록

| 함수 | 위치 | 권한 |
|------|------|------|
| `getTeacherDashboardSummary(teacherProfileId)` | `academy/actions.ts` | verifyAuthenticated |
| `getTeacherStudentList(teacherProfileId, classId?)` | `academy/actions.ts` | verifyAuthenticated |
| `getTeacherStudentDetail(teacherProfileId, studentProfileId)` | `academy/actions.ts` | verifyAuthenticated (반 소속 검증) |
| `getClassAttendanceSummary(classId, yearMonth)` | `academy/actions.ts` | verifyAuthenticated |
| `getClassHomeworkSummary(classId)` | `academy/actions.ts` | verifyAuthenticated |
| `getClassTextbookSummary(classId)` | `academy/actions.ts` | verifyAuthenticated |
| `getClassLearningRecords(classId, teacherProfileId, filter?)` | `academy/actions.ts` | verifyAuthenticated |
| `createTeacherLearningRecord(formData)` | `learning-actions.ts` | verifyAuthenticated |
| `updateTeacherLearningRecord(recordId, formData)` | `learning-actions.ts` | verifyAuthenticated |
| `deleteTeacherLearningRecord(recordId)` | `learning-actions.ts` | verifyAuthenticated |

---

## 8. 핵심 파일 목록

### 수정 파일
- `app/(academy)/academy/teacher/page.tsx` — 대시보드 개편
- `app/(academy)/academy/teacher/components/TeacherNav.tsx` — 메뉴 추가
- `app/(academy)/academy/teacher/classes/page.tsx` — 탭 UI로 강화
- `app/(admin)/admin/actions/learning-actions.ts` — 교사 입력 허용
- `app/(academy)/academy/actions.ts` — 함수 다수 추가
- `lib/ui/teacher-labels.ts` — `learningLabels` 추가

### 신규 파일
- `app/(academy)/academy/teacher/students/page.tsx`
- `app/(academy)/academy/teacher/students/[studentId]/page.tsx`
- `app/(academy)/academy/teacher/students/components/TeacherStudentList.tsx`
- `app/(academy)/academy/teacher/students/components/TeacherStudentDetail.tsx`
- `app/(academy)/academy/teacher/learning/page.tsx`
- `app/(academy)/academy/teacher/learning/components/TeacherLearningClient.tsx`
- `app/(academy)/academy/teacher/classes/components/ClassAttendanceSummary.tsx`
- `app/(academy)/academy/teacher/classes/components/ClassHomeworkSummary.tsx`
- `app/(academy)/academy/teacher/classes/components/ClassTextbookSummary.tsx`
- `app/(academy)/academy/teacher/components/TeacherDashboardSummary.tsx`

---

## 9. 구현 순서 권고

```
1단계: [T-4] 학습 관리 신규 탭 (DB 변경 없음, 가장 독립적)
        → learning-actions.ts 권한 수정 + 교사 UI 신규 생성

2단계: [T-2] 학생 관리 신규 탭
        → academy/actions.ts 함수 추가 + 라우트 신규 생성

3단계: [T-3] 반 관리 강화 (탭 분리)
        → 기존 classes/page.tsx 탭 UI 개편 + 요약 컴포넌트 추가

4단계: [T-1] 대시보드 개편
        → 3단계까지 완료 후 데이터 통합 위젯 구성
```

---

## 10. 검증 체크리스트

### [T-1] 대시보드
- [ ] 로그인 후 오늘 수업 반 표시 확인
- [ ] 출결 미입력 반 알림 표시 확인
- [ ] 미채점 숙제 클릭 시 숙제 탭 이동 확인

### [T-2] 학생 관리
- [ ] 담당 반 학생만 목록에 표시 확인 (타 반 학생 노출 X)
- [ ] 학생 상세 클릭 시 교재·출결·학습기록 요약 표시 확인
- [ ] 타 교사 담당 학생 URL 직접 접근 시 권한 오류 확인

### [T-3] 반 관리
- [ ] 반 탭 클릭 시 출결 요약, 숙제 현황, 교재 진도 탭 표시 확인
- [ ] 이번 달 출석률 계산 정확성 확인

### [T-4] 학습 관리
- [ ] 교사가 직접 학습 기록 입력 후 저장 확인
- [ ] author_id = 교사 본인으로 저장 확인
- [ ] 타인 작성 기록 수정/삭제 불가 확인
- [ ] 점수 입력 시 별점 계산 정확성 확인 (100점 = ★★★)
- [ ] 담당 반 외 학생 기록 조회 불가 확인
