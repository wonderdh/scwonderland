# Supabase Realtime 가이드

> SC Wonderland 승하차 모니터링 시스템에 Supabase Realtime 도입을 위한 상세 설명서

---

## 1. Supabase Realtime이란?

### 한 줄 요약
**데이터베이스 변경사항을 서버가 클라이언트에 즉시 "밀어주는(push)" 기술.**

### 현재 방식: 폴링(Polling)

```
클라이언트                          서버 (Supabase)
   │                                    │
   │──── "데이터 줬어?" ──────────────→│  (30초마다 반복)
   │←─── "여기 있어" ─────────────────│
   │                                    │
   │   ... 30초 대기 (변경 있어도 모름) ... │
   │                                    │
   │──── "데이터 줬어?" ──────────────→│
   │←─── "여기 있어" ─────────────────│
```

**문제점:**
- 30초 동안 변경사항을 모름 (승하차 기록이 실시간이 아님)
- 변경이 없어도 매번 서버에 요청 → 불필요한 서버 부하
- 여러 사용자가 동시에 작업하면 서로의 변경을 30초 뒤에나 알 수 있음

### Realtime 방식: WebSocket 구독

```
클라이언트                          서버 (Supabase)
   │                                    │
   │════ WebSocket 연결 ═══════════════│  (한 번 연결, 계속 열려있음)
   │                                    │
   │                    DB에 INSERT 발생 │
   │←─── "새 데이터야!" ──────────────│  ← 서버가 즉시 알려줌
   │                                    │
   │                    DB에 UPDATE 발생 │
   │←─── "변경됐어!" ─────────────────│  ← 서버가 즉시 알려줌
   │                                    │
   │                    DB에 DELETE 발생 │
   │←─── "삭제됐어!" ─────────────────│  ← 서버가 즉시 알려줌
```

**장점:**
- 변경 즉시 (1초 이내) 모든 연결된 클라이언트에 전달
- 변경 없으면 통신 없음 → 서버 부하 최소화
- 여러 사용자가 동시에 같은 데이터를 보며 작업 가능

---

## 2. Supabase Realtime의 3가지 기능

Supabase Realtime은 3가지 기능을 제공합니다:

### 2-1. Postgres Changes (DB 변경 감지) ← 우리가 사용할 것

데이터베이스 테이블의 INSERT, UPDATE, DELETE를 실시간으로 감지합니다.

```typescript
// 예시: bus_check_records 테이블의 변경을 실시간으로 받기
const channel = supabase
  .channel("bus-check-changes")     // 채널 이름 (자유롭게)
  .on(
    "postgres_changes",             // Postgres Changes 기능 사용
    {
      event: "*",                   // INSERT, UPDATE, DELETE 모두 감지
      schema: "public",             // public 스키마
      table: "bus_check_records",   // 감시할 테이블
      filter: `check_date=eq.2026-03-09`,  // 선택적 필터
    },
    (payload) => {
      // payload.eventType: "INSERT" | "UPDATE" | "DELETE"
      // payload.new: 변경 후 데이터 (INSERT/UPDATE)
      // payload.old: 변경 전 데이터 (UPDATE/DELETE)
      console.log("변경 감지:", payload);
    }
  )
  .subscribe();  // 구독 시작
```

### 2-2. Broadcast (메시지 브로드캐스트)

클라이언트 간 직접 메시지를 보냅니다 (DB 거치지 않음). 채팅, 커서 위치 공유 등에 사용.

```typescript
// 예시: 다른 사용자에게 알림 보내기
channel.send({
  type: "broadcast",
  event: "notification",
  payload: { message: "3호차 출발!" },
});
```

### 2-3. Presence (접속 상태 관리)

누가 지금 온라인인지 추적합니다. "현재 접속 중인 사용자" 표시에 사용.

```typescript
// 예시: 현재 모니터링 중인 담당자 표시
channel.track({
  user_id: "staff-123",
  name: "김담당",
  online_at: new Date().toISOString(),
});
```

---

## 3. 현재 SC Wonderland 승하차 시스템 분석

### 현재 구조

```
3개의 모니터링 컴포넌트가 각각 독립적으로 폴링:

┌─────────────────────┐
│ BusStaffMonitor     │ ←── 버스 담당자가 사용 (탑승/하차 체크)
│ 30초 폴링           │     위치: /bus
│ 카운트다운 타이머     │
└─────────┬───────────┘
          │
          ▼  getDailyBusManifest() 호출 (30초마다)
┌─────────────────────┐
│ Supabase DB         │
│ bus_check_records   │
│ student_bus_defaults│
│ bus_change_requests │
└─────────────────────┘
          ▲  getDailyBusManifest() 호출 (30초마다)
          │
┌─────────┴───────────┐
│ BusMonitorClient    │ ←── 모니터 화면 (승하차 전체 현황)
│ 30초 폴링           │     위치: /bus-monitor
│ 카운트다운 타이머     │
└─────────────────────┘

┌─────────────────────┐
│ BusDashboard        │ ←── 관리자용 (수동 새로고침)
│ 폴링 없음            │     위치: /admin/bus
│ 수동 새로고침만       │
└─────────────────────┘
```

### 구체적인 문제 시나리오

**시나리오: 등원 시간 (오전 8:30)**

1. **담당자 A**가 BusStaffMonitor에서 학생 "김철수" 탑승 체크
2. DB에 `bus_check_records` INSERT 발생
3. **모니터 화면** (BusMonitorClient)은 다음 폴링까지 **최대 30초** 동안 이 변경을 모름
4. **관리자**가 BusDashboard를 보고 있으면, 수동 새로고침하기 전까지 **영원히** 변경을 모름

**Realtime 적용 후:**

1. 담당자 A가 학생 "김철수" 탑승 체크
2. DB에 INSERT 발생
3. Supabase가 **즉시** 모든 구독 클라이언트에 알림
4. 모니터 화면과 관리자 대시보드 모두 **1초 이내** 업데이트

### 현재 코드의 폴링 로직

```typescript
// BusStaffMonitor.tsx (lines 322-326)
useEffect(() => {
  load();  // 초기 로딩
  const interval = setInterval(() => load(), REFRESH_INTERVAL * 1000);  // 30초마다
  return () => clearInterval(interval);
}, [load]);

// 별도의 카운트다운 타이머 (lines 328-335)
useEffect(() => {
  const timer = setInterval(() => {
    countdownRef.current -= 1;
    if (countdownRef.current < 0) countdownRef.current = REFRESH_INTERVAL;
    setCountdown(countdownRef.current);
  }, 1000);
  return () => clearInterval(timer);
}, []);
```

**이 코드의 문제:**
- `setInterval`과 카운트다운 타이머가 별도로 돌아서 동기화 안 됨
- 데이터 fetch가 오래 걸리면 카운트다운이 0인데 아직 로딩 중인 상황
- `load` 콜백이 재생성되면 interval도 재생성 → 폴링 간격 불규칙

---

## 4. Realtime 적용 설계

### 4-1. 감시 대상 테이블

| 테이블 | 감시 이벤트 | 용도 |
|--------|-----------|------|
| `bus_check_records` | INSERT, UPDATE, DELETE | 탑승/하차 체크 실시간 반영 |
| `bus_change_requests` | INSERT, UPDATE | 변경요청 상태 실시간 반영 |

### 4-2. 구현 방식: Hybrid (Realtime + 폴링 백업)

Realtime만 사용하면 WebSocket 연결이 끊어졌을 때 데이터를 놓칠 수 있습니다.
**Realtime을 주로 사용하되, 긴 간격(2-5분)의 백업 폴링을 유지합니다.**

```
[Realtime 연결]
     │
     ├── 정상: 변경 즉시 수신 → UI 업데이트
     │
     ├── 연결 끊김 감지 → 즉시 전체 데이터 재로드 + 재연결 시도
     │
     └── 백업 폴링 (2분마다) → 혹시 놓친 변경 보정
```

### 4-3. 커스텀 훅 설계

```typescript
// hooks/useBusRealtimeMonitor.ts (개념 설계)

import { useEffect, useRef, useCallback, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { getDailyBusManifest } from "@/app/(admin)/admin/actions";
import type { BusManifestGroup, NoRideEntry } from "@/lib/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

const BACKUP_INTERVAL = 120_000; // 2분 (백업 폴링)

type UseBusRealtimeOptions = {
  date: string;
  direction: "pickup" | "dropoff";
  enabled?: boolean;
};

export function useBusRealtimeMonitor({
  date,
  direction,
  enabled = true,
}: UseBusRealtimeOptions) {
  const [groups, setGroups] = useState<BusManifestGroup[]>([]);
  const [noRides, setNoRides] = useState<NoRideEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // 전체 데이터 로드 (초기 + 백업 폴링)
  const loadAll = useCallback(async () => {
    setLoading(true);
    const result = await getDailyBusManifest(date, direction);
    setGroups(result.groups);
    setNoRides(result.noRides);
    setLoading(false);
  }, [date, direction]);

  useEffect(() => {
    if (!enabled) return;

    // 1. 초기 데이터 로드
    loadAll();

    // 2. Supabase Realtime 구독
    const supabase = createBrowserClient();
    const channel = supabase
      .channel(`bus-monitor-${date}-${direction}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bus_check_records",
          filter: `check_date=eq.${date}`,
        },
        (payload) => {
          // 변경이 감지되면 전체 데이터 재로드
          // (부분 업데이트도 가능하지만, 전체 로드가 더 안전)
          loadAll();
        }
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
        if (status === "CHANNEL_ERROR") {
          // 연결 에러 시 전체 재로드
          loadAll();
        }
      });

    channelRef.current = channel;

    // 3. 백업 폴링 (Realtime 놓침 방지)
    const backupInterval = setInterval(loadAll, BACKUP_INTERVAL);

    // 4. Cleanup
    return () => {
      clearInterval(backupInterval);
      channel.unsubscribe();
    };
  }, [date, direction, enabled, loadAll]);

  return { groups, noRides, loading, connected, refresh: loadAll };
}
```

### 4-4. 컴포넌트 적용 예시

**Before (현재 - 30초 폴링):**
```typescript
// BusStaffMonitor.tsx
const [groups, setGroups] = useState<BusManifestGroup[]>([]);
const [loading, setLoading] = useState(true);

const load = useCallback(async () => {
  setLoading(true);
  const result = await getDailyBusManifest(currentDate, direction);
  setGroups(result.groups.filter(/* ... */));
  setLoading(false);
}, [direction, busNumberId]);

useEffect(() => {
  load();
  const interval = setInterval(() => load(), 30_000);
  return () => clearInterval(interval);
}, [load]);
```

**After (Realtime):**
```typescript
// BusStaffMonitor.tsx
const { groups: allGroups, loading, connected, refresh } =
  useBusRealtimeMonitor({
    date: currentDate,
    direction,
  });

// 내 호차만 필터링
const groups = useMemo(
  () => allGroups.filter((g) => g.bus_number_id === busNumberId),
  [allGroups, busNumberId]
);

// connected 상태로 연결 상태 표시 가능
// refresh()로 수동 새로고침 가능
```

---

## 5. Supabase Realtime 설정 방법

### 5-1. Supabase 대시보드 설정

Realtime은 테이블별로 활성화해야 합니다:

1. Supabase Dashboard → **Database** → **Replication** 메뉴
2. `bus_check_records` 테이블에서 **Realtime** 토글 ON
3. `bus_change_requests` 테이블에서 **Realtime** 토글 ON

또는 SQL로:
```sql
-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE bus_check_records;
ALTER PUBLICATION supabase_realtime ADD TABLE bus_change_requests;
```

### 5-2. RLS (Row Level Security) 고려사항

Realtime은 RLS 정책을 따릅니다.
- **anon key**로 연결하면 RLS에 의해 필터링됨
- 모니터링 데이터는 인증된 사용자만 볼 수 있어야 하므로, RLS 정책이 필요

```sql
-- bus_check_records에 대한 RLS 정책 예시
-- 인증된 사용자는 모든 체크 기록을 볼 수 있음
CREATE POLICY "authenticated_can_view_bus_checks"
  ON bus_check_records
  FOR SELECT
  TO authenticated
  USING (true);
```

### 5-3. 클라이언트 설정

현재 프로젝트의 Browser Client (`lib/supabase/client.ts`)가 이미 있으므로,
별도의 설정 없이 바로 Realtime을 사용할 수 있습니다:

```typescript
import { createBrowserClient } from "@supabase/ssr";

// 이미 존재하는 클라이언트로 Realtime 사용 가능
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 바로 채널 구독 가능
const channel = supabase.channel("my-channel");
```

---

## 6. Realtime의 데이터 흐름

### 전체 데이터 재로드 방식 (추천, 단순하고 안전)

```
DB 변경 발생
    │
    ▼
Supabase가 WebSocket으로 알림 전송
    │
    ▼
클라이언트가 알림 수신
    │
    ▼
getDailyBusManifest() 전체 재호출  ← 기존 Server Action 그대로 사용
    │
    ▼
상태 업데이트 → UI 리렌더링
```

**장점:** 기존 Server Action 로직을 수정할 필요 없음, 데이터 정합성 보장
**단점:** 매 변경마다 전체 데이터를 가져옴 (그러나 승하차 데이터 양은 적어서 문제 없음)

### 부분 업데이트 방식 (고급, 성능 최적화)

```
DB 변경 발생
    │
    ▼
Supabase가 변경된 ROW 데이터를 WebSocket으로 전송
    │
    ▼
클라이언트가 payload.new / payload.old 확인
    │
    ▼
해당 학생의 상태만 클라이언트 state에서 직접 업데이트
    │
    ▼
UI 리렌더링 (최소 범위)
```

```typescript
// 부분 업데이트 예시
.on("postgres_changes", { event: "UPDATE", table: "bus_check_records" },
  (payload) => {
    const updated = payload.new;
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        students: g.students.map((s) =>
          s.student_profile_id === updated.student_profile_id
            ? { ...s, boarded_at: updated.boarded_at, checked_at: updated.checked_at }
            : s
        ),
      }))
    );
  }
)
```

**장점:** 네트워크 요청 없이 즉시 업데이트, 최소 리렌더링
**단점:** 클라이언트 상태와 서버 상태가 어긋날 가능성, 구현 복잡도 증가

---

## 7. 폴링 vs Realtime 비교표

| 항목 | 현재 (폴링) | Realtime |
|------|-----------|----------|
| **반응 속도** | 최대 30초 지연 | 1초 이내 |
| **서버 부하** | 30초마다 전체 조회 (변경 없어도) | 변경 시에만 알림 |
| **네트워크 사용** | 높음 (반복 요청) | 낮음 (WebSocket 유지) |
| **다중 사용자 동기화** | 30초 불일치 가능 | 즉시 동기화 |
| **오프라인 대응** | 폴링 실패 → 30초 무응답 | 연결 끊김 감지 → 즉시 재연결 시도 |
| **구현 복잡도** | 낮음 (setInterval) | 중간 (채널 관리, cleanup) |
| **Supabase 비용** | API 호출 수 증가 | Realtime 연결 수 기준 (무료 200개) |

---

## 8. Supabase 요금 관련

### 무료 플랜 (Free Plan)
- Realtime 동시 연결: **200개**
- Realtime 메시지: **200만 개/월**

### SC Wonderland 예상 사용량
- 동시 접속: 버스 담당자 5-10명 + 관리자 1-2명 + 모니터 1-2대 = **최대 15개 연결**
- 일일 메시지: 학생 100명 × 2(탑승+하차) × 2(INSERT+UPDATE) = **~400 메시지/일**
- 월간: 400 × 22(등원일) = **~8,800 메시지/월**

→ **무료 플랜으로 충분합니다.**

---

## 9. 주의사항 & 모범 사례

### Cleanup 필수
```typescript
// useEffect에서 반드시 unsubscribe
useEffect(() => {
  const channel = supabase.channel("my-channel").subscribe();
  return () => {
    channel.unsubscribe();  // 메모리 누수 방지
  };
}, []);
```

### 채널 이름 규칙
```typescript
// 날짜+방향별로 고유 채널 → 불필요한 알림 차단
const channelName = `bus-${date}-${direction}`;
```

### 연결 상태 모니터링
```typescript
channel.subscribe((status) => {
  switch (status) {
    case "SUBSCRIBED":    // 정상 연결
      setConnected(true);
      break;
    case "CHANNEL_ERROR": // 에러 발생
    case "TIMED_OUT":     // 타임아웃
    case "CLOSED":        // 연결 종료
      setConnected(false);
      loadAll();          // 전체 데이터 재로드
      break;
  }
});
```

### Optimistic UI와의 조합
```
사용자가 "탑승 체크" 클릭
    │
    ├── 1) 즉시 UI 업데이트 (Optimistic)
    │
    ├── 2) Server Action 호출 → DB INSERT
    │
    ├── 3) Supabase Realtime이 INSERT 감지 → 알림 전송
    │
    └── 4) 다른 클라이언트들이 알림 수신 → UI 업데이트
         (본인은 이미 Optimistic으로 업데이트했으므로 무시하거나 확인용)
```

---

## 10. 요약

| 질문 | 답변 |
|------|------|
| **뭔가요?** | DB 변경을 실시간으로 클라이언트에 밀어주는 WebSocket 기반 기술 |
| **왜 필요?** | 현재 30초 폴링 → 승하차 상태가 최대 30초 늦게 보임 |
| **어디에 적용?** | BusStaffMonitor, BusDashboard, BusMonitorClient |
| **어떻게?** | `supabase.channel().on("postgres_changes", ...).subscribe()` |
| **비용?** | 무료 플랜으로 충분 (200 동시연결, 200만 메시지/월) |
| **위험?** | WebSocket 끊김 대비 백업 폴링 필요, cleanup 필수 |
