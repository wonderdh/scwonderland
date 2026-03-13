# 버스 시스템 Supabase Realtime 적용 가이드

## 현재 상태

버스 모니터링 컴포넌트 3개에서 30초 setInterval 폴링을 제거한 상태.
수동 새로고침 버튼은 유지.

| 컴포넌트 | 경로 | 역할 |
|---|---|---|
| `BusStaffMonitor` | `app/(bus)/bus/components/` | 승하차 직원용 (탑승/하차 처리) |
| `BusMonitoringDashboard` | `app/(admin)/admin/bus/components/` | 관리자 모니터링 (읽기 전용) |
| `BusMonitorClient` | `app/(monitor)/bus-monitor/` | TV 모니터 전용 (읽기 전용) |

## Supabase Realtime 개요

Supabase Realtime은 PostgreSQL의 변경사항을 WebSocket으로 클라이언트에 푸시한다.

### 채널 타입

1. **Postgres Changes** — 테이블 INSERT/UPDATE/DELETE 감지
2. **Broadcast** — 클라이언트 간 메시지 전송
3. **Presence** — 접속 상태 공유

버스 시스템에는 **Postgres Changes**가 적합하다.

## 관련 테이블

```
bus_daily_records      — 일일 탑승/하차 기록 (boarded_at, checked_at)
bus_change_requests    — 당일 변경 요청 (승인 시 manifest 변경)
```

## 적용 방법

### 1. Supabase 대시보드에서 Realtime 활성화

`bus_daily_records` 테이블의 Realtime을 활성화한다:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE bus_daily_records;
```

### 2. 클라이언트 훅 구현

```typescript
// lib/hooks/use-bus-realtime.ts
"use client";

import { useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

export function useBusRealtime(
  date: string,
  direction: "pickup" | "dropoff",
  onUpdate: () => void
) {
  useEffect(() => {
    const supabase = createBrowserClient();

    const channel = supabase
      .channel(`bus-${date}-${direction}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bus_daily_records",
          filter: `date=eq.${date}`,
        },
        () => {
          // 변경 감지 시 데이터 새로고침
          onUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [date, direction, onUpdate]);
}
```

### 3. 컴포넌트 적용 예시

```typescript
// BusStaffMonitor.tsx 에서
import { useBusRealtime } from "@/lib/hooks/use-bus-realtime";

export function BusStaffMonitor({ busNumberId, staffProfileId }) {
  // ... 기존 state, load 함수

  // Realtime 구독 — 다른 기기에서 변경 시 자동 갱신
  useBusRealtime(date, direction, load);

  // ... 나머지 UI
}
```

### 4. RLS 확인

Realtime은 RLS 정책을 따른다. `bus_daily_records`에 SELECT 권한이 필요:

```sql
-- 인증된 사용자는 bus_daily_records 조회 가능 (이미 설정되어 있을 수 있음)
CREATE POLICY "bus_daily_records_select"
  ON bus_daily_records FOR SELECT
  TO authenticated
  USING (true);
```

## 주의사항

- Realtime 이벤트에는 변경된 행의 데이터가 포함되지만, manifest는 여러 테이블 JOIN 결과이므로 **이벤트를 트리거로 사용하고 전체 데이터를 다시 fetch**하는 패턴이 적합하다.
- `filter`를 사용해 해당 날짜의 변경만 수신한다 (불필요한 이벤트 방지).
- 디바운스를 적용해 짧은 시간 내 여러 변경이 발생해도 fetch는 한 번만 실행한다:

```typescript
import { useRef } from "react";

function useDebouncedCallback(fn: () => void, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  return () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(fn, delay);
  };
}

// 사용
const debouncedLoad = useDebouncedCallback(load, 500);
useBusRealtime(date, direction, debouncedLoad);
```

- Supabase 무료 플랜: 동시 Realtime 연결 200개 제한.
- 연결이 끊어지면 Supabase 클라이언트가 자동 재연결을 시도한다.
