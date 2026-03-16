# SC Wonderland — 미완료 작업 목록

> 기준일: 2026-03-16
> 이 문서는 `docs/analysis/2026-03-16-full-project-analysis.md` 분석 결과 중 아직 구현되지 않은 항목을 정리한 것입니다.

---

## P0 — 즉시 수정 (버그 / 데이터 무결성)

### P0-3. `bus_stop_day_assignments.direction` null 정책 명확화

**파일:** `app/(admin)/admin/actions/bus-actions.ts`

**문제:**
`bus_stop_day_assignments.direction` 컬럼의 타입이 `"pickup" | "dropoff" | null`인데, `buildStopToBusMaps()` 함수는 `.eq("direction", direction)`으로 조회한다. `direction = null`인 레코드가 있을 경우 쿼리에서 누락된다.

```typescript
// bus-actions.ts — buildStopToBusMaps()
const { data, error } = await supabase
  .from("bus_stop_day_assignments")
  .select("bus_stop_id, bus_number_id, bus_time_slot_id, sort_order")
  .eq("day_of_week", dayOfWeek)
  .eq("direction", direction); // ← direction=null 레코드 누락 가능
```

**해결 방안 (둘 중 선택):**
- **A) null 레코드를 허용하지 않는다면:** DB 레벨에서 `direction NOT NULL` 제약 추가 (마이그레이션)
- **B) null이 "양방향 공통" 의미라면:** 쿼리를 `or(direction.eq.pickup,direction.is.null)` 형태로 수정

**현재 판단:** 실제 DB에 null 레코드가 삽입되는 경로가 없어 당장 런타임 버그는 없음. 정책 결정 후 처리.

---

## P1 — 단기 개선 (UX / 코드 품질)

### P1-7. 파일 업로드 크기 초과 시 toast 피드백 통일

**파일:**
- `app/(admin)/admin/notices/components/NoticesManager.tsx`
- `app/(admin)/admin/classes/components/ClassNoticesManager.tsx`
- `app/(admin)/admin/notices/components/AcademyNoticesManager.tsx`

**현재 상태:**
`NoticesManager.tsx`의 `handleImageSelect` / `handleFileSelect`에서 파일 필터링 시 `setError()`로 메시지를 표시하고 있으나, `sonner` toast가 아닌 인라인 에러 문자열이라 일관성 없음.

```typescript
// 현재 (NoticesManager.tsx ~line 301)
if (valid.length < files.length) {
  setError("일부 이미지가 형식 또는 크기 제한으로 제외되었습니다.");
}
```

**개선 방향:**
- `toast.error("이미지 크기 초과: 최대 10MB / 허용 형식: JPG, PNG, WebP")`로 교체
- class-notice, academy-notice 컴포넌트도 동일하게 처리

---

### P1-9. 공지사항 Storage 헬퍼 공통 추출

**파일:**
- `app/(admin)/admin/actions/notice-actions.ts` → `uploadNoticeFile()`
- `app/(admin)/admin/actions/class-notice-actions.ts` → `uploadClassNoticeFile()`
- `app/(admin)/admin/actions/academy-notice-actions.ts` → `uploadFile()`

**현재 상태:**
세 파일 모두 거의 동일한 Storage 업로드/삭제 헬퍼를 각자 구현하고 있음.

```typescript
// 세 파일에서 반복되는 패턴
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
// ... 동일한 로직
```

**개선 방향:**
`lib/supabase/notice-helpers.ts` 파일을 만들어 공통 로직을 추출하고, 세 action 파일은 이를 import해서 사용.

```typescript
// lib/supabase/notice-helpers.ts (신규)
export async function uploadNoticeAttachment(
  file: File,
  bucket: string,
  folder: string,
  fileType: "image" | "attachment"
): Promise<{ url: string; storagePath: string } | { error: string }>
```

---

### P1-10. 삭제 경고 — 학생 / 반 / 교재에도 연관 데이터 수 표시

**현재 상태:**
교사 삭제 시에만 `getTeacherAssignmentCounts()`로 배정 건수를 미리 조회하여 경고 다이얼로그에 표시.

```typescript
// user-actions.ts — 교사 전용
export async function getTeacherAssignmentCounts(userId: string)
  : Promise<{ classCount: number; scheduleCount: number }>
```

**미구현 엔티티:**

| 삭제 대상 | 연관 데이터 | 필요 함수 |
|----------|-----------|---------|
| 학생 | 출결 기록, 버스 기본값, 교재 진도 | `getStudentLinkedCounts(studentId)` |
| 반 | 학생 소속 수, 숙제 수, 공지 수 | `getClassLinkedCounts(classId)` |
| 교재 | 학생 진도 기록 수, 수업 배정 수 | `getTextbookLinkedCounts(textbookId)` |

**구현 방향:**
각 엔티티별 `get*LinkedCounts()` 함수를 action 파일에 추가하고, 삭제 버튼 클릭 시 카운트를 조회하여 `ConfirmDialog`의 `description`에 포함시킴.

```tsx
// 예시 UX
<ConfirmDialog
  title="학생 삭제"
  description="출결 기록 12건, 교재 진도 3개 항목이 함께 삭제됩니다."
  confirmLabel="삭제"
  ...
/>
```

---

## P2 — 중기 리팩토링

### P2-11. 공지사항 3개 Action 파일 통합

**파일:** `notice-actions.ts`, `class-notice-actions.ts`, `academy-notice-actions.ts`

세 파일이 완전히 동일한 CRUD 패턴을 반복 (각 ~15개 함수, 합계 ~45개 함수). 팩토리 패턴 또는 테이블명을 파라미터로 받는 공통 함수로 통합하면 ~25개 함수로 줄일 수 있음.

난이도: **대** (주의: 서버 액션은 직접 호출만 가능하므로 팩토리가 아닌 thin-wrapper 구조 사용 필요)

---

### P2-12. `TabNav` 공용 컴포넌트화

**파일:**
- `app/(academy)/academy/student/components/StudentNav.tsx`
- `app/(academy)/academy/teacher/components/TeacherNav.tsx`
- `app/(admin)/admin/students/components/StudentTabNav.tsx`
- `app/(admin)/admin/teachers/components/TeacherTabNav.tsx`

모두 `activeTab → href` 매핑의 동일한 구조. `components/TabNav.tsx`로 통합 가능.

난이도: **중**

---

### P2-13. `textbook-actions.ts` 내부 타입 → `lib/types/` 이전

**문제:**
`Textbook`, `ClassTextbook`, `StudentTextbookProgress` 타입이 `textbook-actions.ts` 내부에만 정의되어 있음.
Server Action 파일에서 `export type` 사용 시 빌드 이슈 가능성 있음.

**개선 방향:**
`lib/types/index.ts`로 타입 이전 후 `textbook-actions.ts`에서 import.

난이도: **중**

---

### P2-14. Admin 대시보드 "오늘의 현황" 섹션 추가

**파일:** `app/(admin)/admin/dashboard/` 또는 `app/(admin)/admin/page.tsx`

**현재 상태:** 숫자 통계 카드만 표시 (학생 수, 교사 수 등 정적 수치).

**개선 방향:**
- 오늘의 버스 탑승 현황 요약 + 링크
- 미처리 버스 변경 요청 수 (badge)
- 이번 주 결석 학생 수
- 최근 공지사항 3건

난이도: **중**

---

### P2-15. 원어민 교사 UI Context Provider 패턴 도입

**현재 상태:**
`teacher-labels.ts` 9개 라벨 세트로 관리하지만, 각 컴포넌트에서 `isNativeTeacher ? label.en : label.ko` 분기가 산발적으로 존재.

**개선 방향:**
`TeacherLabelContext` Provider를 `academy/layout.tsx` 레벨에서 제공하면, 각 컴포넌트는 `useTeacherLabel('className')` 훅 하나로 처리 가능. 분기 코드 약 50% 감소 예상.

난이도: **중**

---

## P3 — 장기

### P3-16. 출결 ↔ 버스 연동 로직 DB 트리거 이전

**현재 위치:** `attendance-actions.ts` 내 `recordAttendance()` 함수에서 결석 시 `bus_change_requests` 자동 생성

**문제:**
- 비즈니스 로직이 애플리케이션 레이어에 혼재 (책임 분리 위반)
- 출결 직접 수정 시 (관리자 DB 직접 수정 등) 버스 변경 요청이 생성되지 않음

**개선 방향:**
Supabase DB 트리거로 이전 (`attendance` INSERT/UPDATE on status='absent' → `bus_change_requests` upsert)

---

### P3-17. `lib/types/database.ts` vs `api.ts` 분리

DB Row 타입과 조인/API 응답 타입이 `database.ts` 한 파일에 혼재. DB Row는 `database.ts`, 조인 결과/응답 타입은 `api.ts`로 분리.

---

### P3-18. 사용자 목록 조회 헬퍼 `lib/supabase/user-helpers.ts` 추출

`profiles + deleted_at IS NULL` 필터 패턴이 여러 action 파일에서 반복. 공통 헬퍼로 추출.

---

### P3-19. 버스 앱 터치 타겟 확대 (PWA 접근성)

**파일:** `app/(bus)/bus/` 컴포넌트들

탑승/하차 체크박스가 `h-4 w-4` (약 16px) — iOS HIG 최소 44pt 미달.
버스 앱은 모바일 전용 PWA이므로 `h-6 w-6` 이상으로 확대 또는 행 전체를 탭 영역으로 변경 필요.

---

### P3-20. 반 색상 직접 지정 UI

현재 반 배경색이 `CLASS_COLOR_PALETTE`로 자동 순환 배정됨. 관리자가 반 생성/수정 시 색상을 직접 선택할 수 있는 컬러 피커 UI 추가 필요.

---

## 구현 우선순위 요약

```
P0-3  →  DB 정책 결정 후 처리 (런타임 버그 없음)
P1-7  →  작업량 小, UX 일관성 개선
P1-9  →  작업량 中, 중복 제거
P1-10 →  작업량 中, 데이터 안전성 개선 (임팩트 高)
P2-13 →  작업량 小, 타입 안정성 개선
P2-14 →  작업량 中, 운영 편의성
P2-11 →  작업량 大, 신중하게 진행
P2-12 →  작업량 中
P2-15 →  작업량 中
P3-*  →  장기 계획
```
