# SC Wonderland 감사 리포트 개선 결과 (2026-03-12)

## Phase 1: middleware.ts

- **취소**: Next.js 16은 `proxy.ts`를 사용하며 `middleware.ts`와 공존 불가. `proxy.ts`가 이미 올바르게 동작 중이므로 별도 조치 불필요.

## Phase 2: Server Actions 수정

### 2.1 `attendance-actions.ts`
- (B) `listAttendanceRecords`, `getClassAttendanceByDate`, `getAttendanceStats`에 `verifyAuthenticated()` 추가
- (C) `recordAttendance`, `deleteAttendance`에 `revalidatePath("/admin/students")` 추가
- (D) `listAttendanceRecords`에 month(1-12), year(2020-2100) 범위 검증 추가

### 2.2 `class-actions.ts`
- (A) `createClass()`, `updateClass()`에 teacher insert/delete 에러 체크 추가
- (B) 6개 read 함수에 `verifyAdmin()` / `verifyAuthenticated()` 추가
- (C) 5개 mutation에 `revalidatePath("/admin/classes")` 추가

### 2.3 `homework-actions.ts`
- (A) `createHomeworkAssignment()`에 submissions insert 에러 체크 추가
- (B) 4개 read 함수에 `verifyAuthenticated()` 추가
- (C) 모든 mutation에 `revalidatePath("/academy/teacher/homework")`, `revalidatePath("/academy/student/homework")` 추가

### 2.4 `textbook-actions.ts`
- (A) `assignTextbookToClass()`에 progress upsert 에러 체크 추가
- (B) 8개 read 함수에 `verifyAuthenticated()` / `verifyAdmin()` 추가
- (C) 모든 mutation에 `revalidatePath("/admin/textbooks")` 추가

### 2.5 `notice-actions.ts`
- (A) `createNotice()`, `updateNotice()`에 attachment insert 에러 체크 추가
- (B) `listNotices`, `getNoticeWithAttachments`에 `verifyAuthenticated()` 추가
- (C) 모든 mutation에 `revalidatePath("/admin/notices")` 추가

### 2.6 `academy-notice-actions.ts`
- (A) `createAcademyNotice()`, `updateAcademyNotice()`에 attachment insert 에러 체크 추가
- (B) `listAcademyNotices`, `getAcademyNoticeWithAttachments`에 `verifyAuthenticated()` 추가
- (C) 모든 mutation에 `revalidatePath("/admin/academy-notices")` 추가

### 2.7 `class-notice-actions.ts`
- (A) `createClassNotice()`, `updateClassNotice()`에 attachment insert 에러 체크 추가
- (B) `listClassNotices`, `getClassNoticeWithAttachments`, `getMyClassNotices`에 `verifyAuthenticated()` 추가
- (C) 모든 mutation에 `revalidatePath("/admin/class-notices")` 추가

### 2.8 `bus-actions.ts`
- (A) `deleteBusStop()`에 FK cleanup update 에러 체크 추가
- (B) 11개 read 함수에 auth 추가 (`verifyAuthenticated()` / `verifyAdmin()`)
- (C) 모든 mutation에 `revalidatePath("/admin/bus")` 추가
- (D) `upsertBusStopSchedule`에 HH:MM 정규식 검증 추가

### 2.9 `schedule-actions.ts`
- (B) 4개 read 함수에 `verifyAdmin()` / `verifyAuthenticated()` 추가
- (C) 모든 mutation에 `revalidatePath("/admin/timetable")` 추가

### 2.10 나머지 action 파일
- `user-actions.ts`: 9개 mutation에 `revalidatePath("/admin/users")` 추가
- `timetable-actions.ts`: 3개 mutation에 `revalidatePath("/admin/timetable")` 추가
- `afterschool-actions.ts`: 3개 mutation에 `revalidatePath("/admin/afterschool")` 추가
- `report-actions.ts`: 2개 mutation에 `revalidatePath("/academy")` 추가
- `learning-actions.ts`: 3개 mutation에 `revalidatePath("/academy")` 추가

## Phase 3: 컴포넌트 수정

### 3.1 `BusChangeRequestsPanel.tsx`
- `handleApprove()`: `result.error` 체크 후 `toast.error()` 표시
- `handleReject()`: `prompt()` 대신 인라인 textarea + 확인/취소 버튼으로 교체
- 새 state: `rejectingId`, `rejectNote`
- `result.error` 체크 후 `toast.error()` 표시

### 3.2 `BusStaffMonitor.tsx`
- 카운트다운: `useRef` + `countdownRef` 패턴 → `setCountdown(prev => ...)` 함수형 업데이트로 간소화
- 미사용 `useRef` import 제거

### 3.3 `BusAssignmentManager.tsx`
- `handleSaveAll()` 성공 후 `await refreshStops()` 호출 추가

## Verification

- `npm run build`: 성공 (빌드 에러 없음)
- `npm run lint`: 새로운 에러 없음 (기존 경고만 존재)

## 변경 파일 목록 (17개)

| 파일 | 변경 내용 |
|------|----------|
| `attendance-actions.ts` | auth + revalidate + validation |
| `class-actions.ts` | cascade error + auth + revalidate |
| `homework-actions.ts` | cascade error + auth + revalidate |
| `textbook-actions.ts` | cascade error + auth + revalidate |
| `notice-actions.ts` | cascade error + auth + revalidate |
| `academy-notice-actions.ts` | cascade error + auth + revalidate |
| `class-notice-actions.ts` | cascade error + auth + revalidate |
| `bus-actions.ts` | cascade error + auth + revalidate + validation |
| `schedule-actions.ts` | auth + revalidate |
| `user-actions.ts` | revalidate |
| `timetable-actions.ts` | revalidate |
| `afterschool-actions.ts` | revalidate |
| `report-actions.ts` | revalidate |
| `learning-actions.ts` | revalidate |
| `BusChangeRequestsPanel.tsx` | error handling + inline reject UI |
| `BusStaffMonitor.tsx` | countdown fix |
| `BusAssignmentManager.tsx` | refresh stops after save |
