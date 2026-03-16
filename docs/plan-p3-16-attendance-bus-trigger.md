# P3-16: 출결 ↔ 버스 연동 로직 DB 트리거 이전

> 상태: 미완료 / 난이도: 중
> 관련 파일: `app/(admin)/admin/actions/attendance-actions.ts`

---

## 1. 현재 상황 — 무엇이 문제인가

### 현재 동작

`recordAttendance()` 함수가 출결 저장 후 **버스 변경 요청까지 직접 처리**합니다.

```
recordAttendance(studentId, classId, date, status)
  └─ 1. attendance 테이블 upsert (출결 저장)
  └─ 2. [결석 시] bus_change_requests upsert (pickup + dropoff 2건 자동 생성, approved)
  └─ 2. [결석 취소 시] bus_change_requests delete (자동 생성된 건만 삭제)
```

### 실제 코드 (`attendance-actions.ts:57~117`)

```typescript
export async function recordAttendance(
  studentProfileId, classId, attendanceDate, status, note?
) {
  // 1. 출결 저장
  await supabase.from("attendance").upsert({ ... });

  // 2. 버스 연동 (요일이 월~금인 경우)
  const dayOfWeek = new Date(attendanceDate).getDay();
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    const ABSENT_REASON = "출결 결석 자동 등록";

    if (status === "absent") {
      // bus_change_requests 2건 생성 (pickup, dropoff)
      await supabase.from("bus_change_requests").upsert([
        { ..., direction: "pickup",  change_type: "absent", status: "approved" },
        { ..., direction: "dropoff", change_type: "absent", status: "approved" },
      ], { onConflict: "student_profile_id,request_date,direction" });

    } else {
      // 결석 취소: 자동 생성된 건만 삭제
      await supabase.from("bus_change_requests").delete()
        .eq("change_type", "absent")
        .eq("reason", "출결 결석 자동 등록");
    }
  }
}
```

---

## 2. 문제점

### 책임 분리 위반

`attendance-actions.ts`는 출결 관리가 책임입니다. 그런데 지금은 **버스 변경 요청 로직까지 직접 실행**합니다. 출결 도메인이 버스 도메인의 내부 구현(테이블명, 컬럼명, 상태값)을 알고 있어야 하는 구조입니다.

```
출결 도메인              버스 도메인
┌──────────────────┐    ┌─────────────────────────┐
│ recordAttendance │───▶│ bus_change_requests upsert│
│                  │    │ (change_type: "absent")   │
└──────────────────┘    └─────────────────────────┘
       ↑
  출결 코드가 버스 테이블 구조를 직접 알고 있음
```

### 다른 경로로 출결 변경 시 연동 안 됨

현재 연동 로직은 `recordAttendance()` 함수 안에만 있습니다. 만약 다른 방법으로 `attendance` 테이블이 변경된다면 (직접 DB 조작, 향후 다른 함수 추가 등) 버스 연동이 **무조건 누락**됩니다.

DB 트리거라면 `attendance` 테이블이 어떤 방법으로 변경되든 **자동으로 실행**됩니다.

### 테스트 어려움

출결 저장 테스트 시 버스 테이블도 함께 검증해야 합니다. 두 도메인이 하나의 함수에 결합되어 있어 단위 테스트가 어렵습니다.

---

## 3. 목표 — DB 트리거로 이전

### 트리거 동작 방식

```
attendance 테이블에 INSERT / UPDATE 발생
  └─ after_attendance_change TRIGGER 자동 실행
       └─ NEW.status = 'absent'     → bus_change_requests upsert 2건
       └─ NEW.status != 'absent'    → bus_change_requests delete (absent 자동 생성 건)
```

### 제안하는 트리거 SQL

```sql
-- 함수 정의
CREATE OR REPLACE FUNCTION handle_attendance_bus_sync()
RETURNS TRIGGER AS $$
DECLARE
  v_day integer;
  v_absent_reason text := '출결 결석 자동 등록';
BEGIN
  -- 주말 제외
  v_day := EXTRACT(DOW FROM NEW.attendance_date::date);
  IF v_day = 0 OR v_day = 6 THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'absent' THEN
    -- 결석: pickup + dropoff 변경 요청 자동 생성
    INSERT INTO bus_change_requests (
      student_profile_id, request_date, direction,
      change_type, status, reason,
      new_bus_time_slot_id, new_bus_number_id, new_bus_stop_id
    )
    VALUES
      (NEW.student_profile_id, NEW.attendance_date, 'pickup',
       'absent', 'approved', v_absent_reason, null, null, null),
      (NEW.student_profile_id, NEW.attendance_date, 'dropoff',
       'absent', 'approved', v_absent_reason, null, null, null)
    ON CONFLICT (student_profile_id, request_date, direction)
    DO UPDATE SET
      change_type = 'absent',
      status = 'approved',
      reason = v_absent_reason,
      new_bus_time_slot_id = null,
      new_bus_number_id = null,
      new_bus_stop_id = null;

  ELSE
    -- 결석 취소: 자동 생성된 absent 건만 삭제
    DELETE FROM bus_change_requests
    WHERE student_profile_id = NEW.student_profile_id
      AND request_date = NEW.attendance_date
      AND change_type = 'absent'
      AND reason = v_absent_reason;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거 등록
CREATE TRIGGER after_attendance_bus_sync
  AFTER INSERT OR UPDATE OF status
  ON attendance
  FOR EACH ROW
  EXECUTE FUNCTION handle_attendance_bus_sync();
```

### 애플리케이션 코드 변경

트리거 이전 후 `recordAttendance()` 에서 버스 연동 코드 블록 제거:

```typescript
// 제거할 블록 (lines 91~113)
const dateObj = new Date(attendanceDate);
const dayOfWeek = dateObj.getDay();
if (dayOfWeek >= 1 && dayOfWeek <= 5) {
  const ABSENT_REASON = "출결 결석 자동 등록";
  if (status === "absent") {
    await supabase.from("bus_change_requests").upsert(...);
  } else {
    await supabase.from("bus_change_requests").delete()...;
  }
}
```

---

## 4. 주의사항

### SECURITY DEFINER

`bus_change_requests` 테이블에 RLS가 걸려 있을 경우, 트리거 함수에 `SECURITY DEFINER`가 필요합니다. 이 경우 함수가 DB 소유자 권한으로 실행됩니다.

### 트리거 실행 순서

트리거는 `AFTER INSERT OR UPDATE OF status`로 설정합니다. `UPDATE OF status`는 status 컬럼이 실제로 변경될 때만 실행되도록 최적화합니다.

### 롤백 고려

DB 트리거 중 오류가 발생하면 attendance INSERT/UPDATE 자체가 롤백됩니다. 트리거 내부에서 예외를 catch해 silent fail 처리할지, 아니면 전체 롤백을 허용할지 결정해야 합니다.

```sql
-- Silent fail 옵션 (트리거 오류가 출결 저장에 영향 안 주도록)
BEGIN
  ...
EXCEPTION WHEN OTHERS THEN
  -- 로그만 남기고 진행
  RAISE WARNING 'bus sync failed: %', SQLERRM;
  RETURN NEW;
END;
```

### 마이그레이션 순서

1. 트리거 생성 (Supabase MCP `apply_migration`)
2. `recordAttendance()` 코드에서 버스 연동 블록 제거
3. 테스트: 출결 결석 → `bus_change_requests` 자동 생성 확인
4. 테스트: 결석 취소 → `bus_change_requests` 자동 삭제 확인

---

## 5. 기대 효과

| 항목 | 현재 | 트리거 이전 후 |
|------|------|-------------|
| 책임 분리 | attendance 코드가 버스 로직 포함 | 각 도메인 독립 |
| 연동 신뢰성 | recordAttendance 경로에서만 작동 | attendance 테이블 변경 시 항상 작동 |
| 코드 라인 | attendance-actions.ts +23줄 | -23줄 |
| 유지보수 | 버스 로직 변경 시 출결 파일 수정 필요 | DB 트리거만 수정 |
