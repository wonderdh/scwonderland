# P3-16 작업 결과: 출결↔버스 연동 로직 DB 트리거 이전

> 작업일: 2026-03-16
> 커밋: `refactor(P3-16): 출결↔버스 연동 로직을 DB 트리거로 이전`
> 빌드 상태: ✅ TypeScript 오류 없음 (55개 페이지 정상 생성)

---

## 1. 왜 이 작업을 했나

### 작업 전 상태

`recordAttendance()` 함수가 출결 저장 후 **버스 변경 요청 테이블까지 직접 조작**하고 있었습니다.

```
recordAttendance(studentId, classId, date, status)
  └─ 1. attendance 테이블 upsert (출결 저장)
  └─ 2. [status="absent"]    → bus_change_requests upsert 2건 (pickup/dropoff, approved)
  └─ 2. [status!="absent"]   → bus_change_requests delete (자동 생성 건만)
```

이 구조에는 세 가지 문제가 있었습니다.

**문제 1 — 책임 분리 위반**
`attendance-actions.ts`는 출결 관리가 목적입니다. 그런데 버스 테이블명(`bus_change_requests`), 컬럼명(`change_type`, `direction`), 상태값(`"absent"`, `"approved"`)을 직접 알고 있어야 했습니다. 출결 코드가 버스 도메인의 내부 구현에 결합된 상태였습니다.

**문제 2 — 연동 신뢰성 한계**
연동 로직이 `recordAttendance()` 함수 안에만 있었습니다. 향후 다른 경로로 `attendance` 테이블이 변경될 경우 버스 연동이 자동으로 누락됩니다.

**문제 3 — 함수 복잡도 증가**
출결 저장 함수가 26줄의 버스 연동 코드를 포함해 단일 책임 원칙을 위반했습니다.

---

## 2. 무엇을 했나

### DB 트리거 생성

Supabase에 `handle_attendance_bus_sync` 함수와 `after_attendance_bus_sync` 트리거를 생성했습니다.

```sql
CREATE OR REPLACE FUNCTION handle_attendance_bus_sync()
RETURNS TRIGGER AS $$
DECLARE
  v_day integer;
  v_absent_reason text := '출결 결석 자동 등록';
BEGIN
  -- 주말 제외 (0=일, 6=토)
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
EXCEPTION WHEN OTHERS THEN
  -- 버스 연동 오류가 출결 저장 자체를 막지 않도록 silent fail
  RAISE WARNING 'bus sync failed for attendance (%,%): %',
    NEW.student_profile_id, NEW.attendance_date, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER after_attendance_bus_sync
  AFTER INSERT OR UPDATE OF status
  ON attendance
  FOR EACH ROW
  EXECUTE FUNCTION handle_attendance_bus_sync();
```

### `attendance-actions.ts` 코드 정리

버스 연동 블록 26줄을 제거하고 한 줄 주석으로 대체했습니다.

```typescript
// 변경 전 (26줄)
const dateObj = new Date(attendanceDate);
const dayOfWeek = dateObj.getDay();
if (dayOfWeek >= 1 && dayOfWeek <= 5) {
  const ABSENT_REASON = "출결 결석 자동 등록";
  if (status === "absent") {
    await supabase.from("bus_change_requests").upsert([...], {...});
  } else {
    await supabase.from("bus_change_requests").delete()...;
  }
}

// 변경 후 (1줄)
// 버스 연동은 DB 트리거(after_attendance_bus_sync)가 자동 처리
```

---

## 3. 트리거 설계 세부사항

### AFTER INSERT OR UPDATE OF status

- `INSERT`: 처음 출결 기록 생성 시
- `UPDATE OF status`: status 컬럼이 실제로 변경될 때만 실행 (불필요한 트리거 실행 방지)

### SECURITY DEFINER

`bus_change_requests` 테이블에 RLS(Row Level Security) 정책이 적용돼 있습니다. 트리거가 일반 사용자 권한으로 실행되면 RLS에 막혀 INSERT/DELETE가 실패합니다. `SECURITY DEFINER`를 명시해 DB 소유자 권한으로 실행되도록 했습니다.

### EXCEPTION 핸들러 (silent fail)

버스 연동 중 예외가 발생하더라도 출결 저장 자체는 성공해야 합니다. 트리거 내 `EXCEPTION WHEN OTHERS` 블록에서 `RAISE WARNING`으로 로그만 남기고 `RETURN NEW`를 반환해 출결 트랜잭션이 롤백되지 않도록 처리했습니다.

### 주말 제외 로직

`EXTRACT(DOW FROM attendance_date)` 로 요일을 추출합니다.
- 0 = 일요일, 6 = 토요일 → 즉시 `RETURN NEW` (버스 연동 없음)
- 1~5 = 월~금 → 연동 실행

### ON CONFLICT 처리

이미 같은 날짜에 다른 이유로 `bus_change_requests`가 존재할 경우 `ON CONFLICT ... DO UPDATE`로 덮어씁니다. `(student_profile_id, request_date, direction)` 조합이 unique key입니다.

### 결석 취소 시 선택적 삭제

`change_type = 'absent' AND reason = '출결 결석 자동 등록'` 두 조건 모두 충족하는 행만 삭제합니다. 학생이나 관리자가 수동으로 등록한 `change_type="absent"` 행은 삭제되지 않습니다.

---

## 4. 변경된 파일 목록

| 구분 | 내용 |
|------|------|
| **DB 마이그레이션** | `handle_attendance_bus_sync` 함수 + `after_attendance_bus_sync` 트리거 생성 |
| `attendance-actions.ts` | 버스 연동 블록 26줄 제거, 1줄 주석으로 대체 |

**그 외 수정된 파일: 없음** — 기존 출결 관련 컴포넌트와 모든 호출부는 변경 없음.

---

## 5. 기대 효과

| 항목 | 변경 전 | 변경 후 |
|------|--------|--------|
| 책임 분리 | 출결 코드가 버스 테이블 직접 조작 | 각 도메인 완전 독립 |
| 연동 신뢰성 | `recordAttendance()` 경로에서만 작동 | `attendance` 테이블 변경 시 항상 실행 |
| `attendance-actions.ts` 줄 수 | +26줄 버스 로직 | 버스 로직 없음 |
| 버스 로직 변경 시 | 출결 파일 수정 필요 | DB 트리거만 수정 |
| 출결 저장 안정성 | 버스 오류 시 출결도 실패 가능 | EXCEPTION 핸들러로 출결 보호 |

---

## 6. 검증

```bash
$ npm run build
# TypeScript 오류: 0건
# 생성된 페이지: 55개 정상
```

---

## 7. 트리거 확인 방법 (Supabase)

Supabase Dashboard → Database → Functions 에서 `handle_attendance_bus_sync` 함수 확인 가능.
Supabase Dashboard → Database → Triggers 에서 `after_attendance_bus_sync` 트리거 확인 가능.

또는 SQL:

```sql
-- 트리거 확인
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'attendance';

-- 함수 확인
SELECT proname, prosecdef
FROM pg_proc
WHERE proname = 'handle_attendance_bus_sync';
```
