# SC Wonderland — 작업 보고서

> 작업일: 2026-03-16 (세션 2)
> 커밋 범위: `f8665ac` ~ `71ce96c`

---

## 작업 요약 (4건)

| # | 항목 | 커밋 | 분류 |
|---|------|------|------|
| 1 | P2-15: 원어민 교사 UI Context Provider 도입 | `f8665ac` | 리팩토링 |
| 2 | P3-20: 반 색상 직접 지정 UI | `f160b2c` | 신규 기능 |
| 3 | P1-9: 공지사항 Storage 헬퍼 공통화 | `a71355c` | 리팩토링 |
| 4 | P0-3: direction NOT NULL 제약 + 타입 수정 | `71ce96c` | 버그 예방 |

---

## 1. P2-15 — 원어민 교사 UI Context Provider

### 문제

교사 포털(`/academy/teacher/`)은 한국인/원어민 교사에 따라 UI 언어가 달라집니다. 기존에는 `teacher_type` 값을 얻기 위해 **레이아웃과 각 페이지가 각자 DB를 조회**하고, 클라이언트 컴포넌트에는 **prop으로 내려줬습니다(prop drilling)**.

```
layout.tsx       → DB 조회 (teacherType)
reports/page.tsx → DB 조회 (teacherType) ← 중복
  └─ <TeacherReportClient teacherType={...} /> ← prop drilling
```

### 해결

React Context를 도입해 레이아웃에서 한 번만 조회하고, 하위 클라이언트 컴포넌트가 `useTeacherType()` 훅으로 바로 접근합니다.

### 변경 파일

**신규 생성:** `app/(academy)/academy/teacher/components/TeacherTypeContext.tsx`

```tsx
"use client";
const TeacherTypeContext = createContext<TeacherType>("korean");

export function TeacherTypeProvider({ teacherType, children }) {
  return <TeacherTypeContext.Provider value={teacherType}>{children}</TeacherTypeContext.Provider>;
}
export function useTeacherType(): TeacherType {
  return useContext(TeacherTypeContext);
}
```

**수정 — `teacher/layout.tsx`:**
`children`을 `<TeacherTypeProvider>`로 감쌈.

**수정 — `TeacherReportClient.tsx`, `TeacherTextbookClient.tsx`:**
`teacherType` prop 제거 → `const teacherType = useTeacherType()` 한 줄로 대체.

**수정 — `reports/page.tsx`, `textbooks/page.tsx`:**
클라이언트 컴포넌트에 `teacherType` prop 전달 코드 제거.

### 효과

- `teacher_type` DB 조회 경로 단일화 (layout에서만)
- 클라이언트 컴포넌트의 prop drilling 완전 제거
- 향후 teacher 하위 컴포넌트 추가 시 `useTeacherType()` 한 줄로 접근 가능

---

## 2. P3-20 — 반 색상 직접 지정 UI

### 문제

반(Class)의 배경색이 `CLASS_COLOR_PALETTE` 배열에서 **인덱스(순서)로 자동 배정**되어 관리자가 색상을 직접 고를 수 없었습니다. 또한 팔레트 정의가 두 개의 파일에 각각 복사되어 있었습니다.

### 해결

#### DB 마이그레이션
`classes` 테이블에 `color_index INTEGER DEFAULT NULL` 컬럼 추가:
```sql
ALTER TABLE classes ADD COLUMN IF NOT EXISTS color_index INTEGER DEFAULT NULL;
```
- `NULL` = 자동 배정 (기존 동작 유지), 숫자 = 관리자 지정 색상 인덱스

#### 공통 팔레트 파일 `lib/class-colors.ts` 신규 생성
```typescript
export const CLASS_COLOR_PALETTE = [
  { bg: "bg-blue-100",    text: "text-blue-800",    border: "border-blue-300"    },
  { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300" },
  // ... 총 8색
];

export function getClassColor(colorIndex: number | null, fallbackIndex: number) {
  const idx = colorIndex ?? fallbackIndex;
  return CLASS_COLOR_PALETTE[idx % CLASS_COLOR_PALETTE.length];
}
```

#### 타입 수정 — `lib/types/database.ts`
`ClassWithDetails`에 `color_index: number | null` 추가.

#### 서버 액션 수정 — `class-actions.ts`
- `createClass()`, `updateClass()`: `colorIndex?: number | null` 파라미터 추가, DB insert/update에 반영
- `listClassesWithDetails()`, `getClassWithStudents()`: 반환 객체에 `color_index` 매핑

#### UI 수정 — `ClassesManager.tsx`
반 생성 모달(`AddClassModal`)과 수정 모달(`EditClassModal`)에 **색상 스와치 선택기** 추가:

```
[ ● ● ● ● ● ● ● ●  자동 ]
  각 색상 원을 클릭 → color_index 설정
  "자동" 클릭 → color_index = null (순서 자동 배정으로 복귀)
```

#### 기존 뷰 통합
`TeacherAcademyTimetable.tsx`, `TeacherTimetableTab.tsx`의 로컬 `CLASS_COLOR_PALETTE` 정의 제거 → `@/lib/class-colors` import로 교체.

---

## 3. P1-9 — 공지사항 Storage 헬퍼 공통화

### 문제

공지사항 3종 서버 액션 파일(`notice-actions.ts`, `class-notice-actions.ts`, `academy-notice-actions.ts`)의 Storage 업로드/삭제 헬퍼가 **각자 별도로 구현**되어 있었습니다.

- `class-notice-actions.ts`, `academy-notice-actions.ts`는 이미 `lib/supabase/storage.ts`의 공통 유틸을 사용 중
- `notice-actions.ts`만 **인라인 상수 + 인라인 헬퍼**로 구현되어 있어 일관성 깨짐

### 변경 내용 — `notice-actions.ts`

**제거된 코드 (45줄 → 인라인 상수/헬퍼 전체 삭제):**
```typescript
const NOTICE_BUCKET = "notice-files";
const ALLOWED_IMAGE_TYPES = ["image/jpeg", ...];
const ALLOWED_FILE_TYPES = ["application/pdf", ...];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_FILE_SIZE = 20 * 1024 * 1024;

async function uploadNoticeFile(...) { /* 40줄의 인라인 구현 */ }
async function deleteNoticeFile(...) { /* URL 파싱 직접 구현 */ }
```

**추가된 코드 (공통 유틸 import):**
```typescript
import {
  STORAGE_BUCKETS,
  generateStoragePath,
  extractStoragePath,
  validateFile,
} from "@/lib/supabase/storage";

const BUCKET = STORAGE_BUCKETS.NOTICE_FILES;
```

이후 `uploadNoticeFile()`, `deleteNoticeFile()`는 동일한 인터페이스를 유지하되 내부 구현이 공통 유틸로 교체됨. 호출 코드(`createNotice`, `updateNotice`, `deleteNotice`)는 **변경 없음**.

### 효과

- 3개 공지 액션 파일이 모두 동일한 Storage 유틸 패턴 사용
- 파일 검증 규칙 변경 시 `lib/supabase/storage.ts` 한 곳만 수정하면 됨

---

## 4. P0-3 — direction NOT NULL 제약 추가

### 문제

`bus_stop_day_assignments.direction` 컬럼의 DB 타입과 TypeScript 타입이 `"pickup" | "dropoff" | null`이었는데, `buildStopToBusMaps()` 함수는 `.eq("direction", direction)`으로 조회합니다.

만약 `direction = NULL`인 레코드가 존재하면 `.eq("direction", ...)` 쿼리에서 **자동으로 누락**되어 해당 정류장이 버스 배정에서 사라지는 버그가 발생할 수 있었습니다.

### 조사 결과

```sql
SELECT COUNT(*) FROM bus_stop_day_assignments WHERE direction IS NULL;
-- 결과: 0
```

DB에 null 레코드가 없고, null을 삽입하는 코드 경로도 존재하지 않음. → **Option A** (NOT NULL 제약 추가) 선택.

### 변경 내용

**DB 마이그레이션:**
```sql
ALTER TABLE bus_stop_day_assignments
  ALTER COLUMN direction SET NOT NULL;
```

**TypeScript 타입 수정 — `lib/types/database.ts`:**
```typescript
// Before
export type BusStopDayAssignment = {
  direction: "pickup" | "dropoff" | null;  // null 허용
  ...
};

// After
export type BusStopDayAssignment = {
  direction: "pickup" | "dropoff";  // NOT NULL
  ...
};
```

### 효과

- DB 레벨에서 null 삽입 차단 → 런타임 버그 가능성 원천 차단
- TypeScript 타입이 DB 스키마와 정확히 일치
- `buildStopToBusMaps()` 등 모든 direction 쿼리의 신뢰성 보장

---

## 변경 파일 전체 목록

| 파일 | 작업 | 항목 |
|------|------|------|
| `components/TeacherTypeContext.tsx` (신규) | Context + hook 정의 | P2-15 |
| `teacher/layout.tsx` | Provider 추가 | P2-15 |
| `teacher/components/TeacherReportClient.tsx` | prop → hook | P2-15 |
| `teacher/components/TeacherTextbookClient.tsx` | prop → hook | P2-15 |
| `teacher/reports/page.tsx` | prop 전달 제거 | P2-15 |
| `teacher/textbooks/page.tsx` | prop 전달 제거 | P2-15 |
| `lib/class-colors.ts` (신규) | 공통 팔레트 + getClassColor | P3-20 |
| `lib/types/database.ts` | ClassWithDetails color_index 추가, BusStopDayAssignment null 제거 | P3-20, P0-3 |
| `admin/actions/class-actions.ts` | colorIndex 파라미터 추가 | P3-20 |
| `admin/classes/components/ClassesManager.tsx` | 색상 선택 UI 추가 | P3-20 |
| `academy/teacher/timetable/TeacherAcademyTimetable.tsx` | 공통 팔레트 import | P3-20 |
| `admin/teachers/components/TeacherTimetableTab.tsx` | 공통 팔레트 import | P3-20 |
| `admin/actions/notice-actions.ts` | 인라인 헬퍼 → 공통 storage 유틸 | P1-9 |
| `docs/p2-15-teacher-type-context.md` (신규) | P2-15 상세 문서 | - |
| DB: `classes.color_index` (마이그레이션) | 컬럼 추가 | P3-20 |
| DB: `bus_stop_day_assignments.direction` (마이그레이션) | NOT NULL 제약 추가 | P0-3 |
