# SC Wonderland — 미완료 작업 목록

> 최종 업데이트: 2026-03-16
> P0~P1 전체, P2 일부, P3 일부 완료. 아래는 아직 구현하지 않은 항목.

---

## P0 — 즉시 수정

### P0-3. `bus_stop_day_assignments.direction` null 정책 명확화

**파일:** `app/(admin)/admin/actions/bus-actions.ts`

**문제:**
`bus_stop_day_assignments.direction` 컬럼의 타입이 `"pickup" | "dropoff" | null`인데, `buildStopToBusMaps()` 함수는 `.eq("direction", direction)`으로 조회한다. `direction = null`인 레코드가 있을 경우 쿼리에서 누락된다.

**해결 방안 (결정 필요):**
- **A) null 레코드를 허용하지 않는다면:** DB 레벨에서 `direction NOT NULL` 제약 추가 (마이그레이션)
- **B) null이 "양방향 공통" 의미라면:** 쿼리를 `or(direction.eq.pickup,direction.is.null)` 형태로 수정

**현재 상태:** 실제 DB에 null 레코드 삽입 경로 없음. 런타임 버그 없음. 정책 결정 후 처리.

---

## P1 — 단기 개선

### P1-9. 공지사항 Storage 헬퍼 공통 추출

**파일:**
- `app/(admin)/admin/actions/notice-actions.ts` → `uploadNoticeFile()`
- `app/(admin)/admin/actions/class-notice-actions.ts` → `uploadClassNoticeFile()`
- `app/(admin)/admin/actions/academy-notice-actions.ts` → `uploadFile()`

**현재 상태:**
세 파일이 거의 동일한 Storage 업로드/삭제 헬퍼를 각자 구현.

**개선 방향:**
`lib/supabase/notice-helpers.ts` 파일을 만들어 공통 로직 추출. 난이도: **중**

---

## P2 — 중기 리팩토링

### P2-11. 공지사항 3개 Action 파일 통합

**파일:** `notice-actions.ts`, `class-notice-actions.ts`, `academy-notice-actions.ts`

세 파일이 완전히 동일한 CRUD 패턴을 반복 (~45개 함수 → ~25개로 축소 가능).

**주의:** 서버 액션은 직접 호출만 가능하므로 thin-wrapper 구조 필요. 난이도: **대**

---

### P2-15. 원어민 교사 UI Context Provider 패턴 도입

**현재 상태:**
각 컴포넌트에서 `isNativeTeacher ? label.en : label.ko` 분기가 산발적.

**개선 방향:**
`TeacherLabelContext` Provider → `useTeacherLabel('className')` 훅으로 통합. 분기 코드 ~50% 감소. 난이도: **중**

---

## P3 — 장기

### P3-16. 출결 ↔ 버스 연동 로직 DB 트리거 이전

**현재:** `attendance-actions.ts`의 `recordAttendance()`에서 결석 시 `bus_change_requests` 자동 생성/삭제

**개선 방향:** Supabase DB 트리거로 이전 (애플리케이션 레이어 책임 분리)

---

### P3-17. `lib/types/database.ts` vs `api.ts` 분리

DB Row 타입과 조인/API 응답 타입이 한 파일에 혼재.

---

### P3-18. 사용자 목록 조회 헬퍼 `lib/supabase/user-helpers.ts` 추출

`profiles + deleted_at IS NULL` 필터 패턴이 여러 action 파일에서 반복.

---

### P3-20. 반 색상 직접 지정 UI

현재 `CLASS_COLOR_PALETTE`로 자동 순환 배정. 관리자가 반 생성/수정 시 색상 직접 선택 불가.

---

## 완료된 항목 (참고)

| 항목 | 커밋 |
|------|------|
| P0-1: 출결 취소 시 버스 변경 요청 정리 | 기존 구현 ✅ |
| P0-2: deleteUserById student cleanup | 9623084 |
| P0-4: StudentBusTab formatTime import | 9623084 |
| P1-1: ConfirmDialog 공용 컴포넌트 + 전면 적용 | 9623084, 8992a35 |
| P1-2: z-index 정리 | 9623084 |
| P1-4: removeStudentFromClass afterschool cleanup | 9623084 |
| P1-7: 파일 업로드 toast.error | 807412a |
| P1-10: 학생/반/교재 삭제 경고 카운트 | 807412a |
| P2-12: QueryTabNav 공용 컴포넌트 | 807412a |
| P2-13: textbook/afterschool/bus 타입 → lib/types | 807412a, 1585729 |
| P2-14: Admin 대시보드 오늘의 현황 | 807412a |
| P3-19: BusStaffMonitor 터치 타겟 size-11 | 807412a |
| "use server" export type 전면 해소 | 1585729 |
