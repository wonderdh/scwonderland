# SSR 초기 fetch 패턴

> Next.js 16 App Router에서 페이지의 핵심 데이터를 **서버 컴포넌트(page.tsx)에서 미리 가져와 props로 클라이언트 컴포넌트에 전달**하는 패턴. 클라이언트 mount 시 추가 fetch 없이 첫 렌더부터 완전한 화면을 그린다.
>
> 이번 프로젝트에서는 `bus-monitor`, `lunch-monitor`에 적용되어 있다. 새 페이지를 만들 때나 기존 페이지를 개선할 때 이 문서를 참고할 것.

## 1. 핵심 개념

Next.js App Router의 `page.tsx`는 기본적으로 **서버 컴포넌트**다. 서버 컴포넌트는 다음을 할 수 있다:
- `async` 함수 — top-level await 가능
- DB·외부 API 직접 호출 (Server Action, Supabase admin client 등)
- 브라우저 API 사용 불가 (`useState`, `useEffect`, 이벤트 핸들러 등)

이 능력을 활용해 **데이터를 서버에서 먼저 받아 → HTML과 함께 한 번에 전송**하면, 클라이언트가 받자마자 실제 콘텐츠를 즉시 본다.

반면 클라이언트 컴포넌트(`"use client"` 파일)는 브라우저에서 hydration 후에야 동작 시작. 여기서 `useEffect` + `fetch`를 하면 사용자는 **빈 화면 → JS 로드 → 스켈레톤 → API 호출 → 콘텐츠** 라는 4단계 대기를 겪는다.

## 2. Before / After 비교

### ❌ Before — 클라이언트 측 fetch (안티패턴)

```tsx
// page.tsx — 거의 빈 컨테이너만 SSR
import { ClientOnly } from "./ClientOnly";

export default function Page() {
  return <ClientOnly />;  // 데이터 없이 클라이언트에 위임
}

// ClientOnly.tsx
"use client";
import { useState, useEffect } from "react";
import { fetchData } from "@/app/(admin)/admin/actions";

export function ClientOnly() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData().then((d) => {
      setData(d);
      setLoading(false);
    });
  }, []);

  if (loading) return <Skeleton />;  // 사용자가 이걸 먼저 봄
  return <RealContent data={data} />;  // 그 다음 점프!
}
```

**타임라인 (한국 사용자, Vercel iad1 기준):**
```
   0ms  서버: 빈 HTML 생성 → 전송
 200ms  브라우저: HTML 도착 (빈 페이지)
 500ms  JS bundle 로드 + parse + hydration 완료
 500ms  Skeleton 표시 ← 사용자 첫 인지
 500ms  useEffect 실행 → Server Action 호출 → DB 왕복
1800ms  데이터 도착 → setState → 실제 콘텐츠 렌더
1800ms  Skeleton → 실제 콘텐츠 점프 (CLS 발생)
```

### ✅ After — SSR 초기 fetch (권장 패턴)

```tsx
// page.tsx — 서버에서 데이터까지 가져와서 props로 전달
import { fetchData } from "@/app/(admin)/admin/actions";
import { RealClient } from "./RealClient";

export default async function Page() {
  const data = await fetchData();  // 서버에서 DB 직접 호출
  return <RealClient initialData={data} />;
}

// RealClient.tsx
"use client";
import { useState } from "react";

export function RealClient({ initialData }: { initialData: DataType }) {
  const [data, setData] = useState(initialData);  // 시작부터 채워짐
  // 인터랙션 핸들러, 추가 fetch (refetch 버튼 등) 자유
  return <RealContent data={data} />;
}
```

**타임라인:**
```
   0ms  서버: DB 호출 → 결과 + HTML 같이 생성 → 전송
 280ms  브라우저: HTML 도착 (실제 콘텐츠 이미 박혀있음) ← 사용자가 다 봄
 600ms  JS 로드 + hydration (화면 변화 0, 인터랙션만 활성화)
```

### 체감 차이 정량

| | Before (Client fetch) | After (SSR fetch) |
|---|---|---|
| 사용자가 콘텐츠 보는 시점 | ~1800ms | ~280ms |
| LCP 요소 | Skeleton box | 실제 카드 |
| CLS | 0.20 ~ 0.30 (Poor) | 0.00 (Perfect) |
| DB 왕복 | 2 (브라우저↔Vercel↔DB) | 1 (Vercel↔DB) |
| FCP | 빈 화면 | 실 콘텐츠 |

이번 세션의 `bus-monitor` 변경이 정확히 Before → After 이행이었음. 측정 결과 `CLS 0.28 → 0.00`.

## 3. 적용 기준 — 언제 SSR 초기 fetch를 쓸까

### ✅ 적합

- **페이지 진입 시 즉시 보여야 할 데이터** (목록, 상세, 대시보드 통계)
- **DB 조회로 충분한 데이터** (Supabase Server Actions, RPC)
- **요청별 캐싱이 가능하거나 fresh가 필요 없는 영역**
- 사용자별 데이터라도 **layout 레벨에서 인증이 끝난 페이지** (admin/, academy/student/, academy/teacher/)

### ⚠️ 신중히

- **무거운 쿼리** — 페이지 TTFB 길어짐. 인덱스 점검 또는 쿼리 분할
- **자주 바뀌는 데이터** — SSR로 초기 시드만 + 클라이언트에서 realtime/polling 갱신 (bus-monitor가 이 패턴: SSR 초기 + `useBusRealtime` 구독)
- **사용자 인터랙션 후에만 필요한 데이터** — lazy fetch가 더 적절 (모달 열기, 탭 전환 등)
- **인증된 사용자만 접근하는 데이터지만 page에서 인증 다시 검증해야 하는 경우** — layout에서 이미 검증한다면 page에서는 admin client로 직접 호출 가능

### ❌ 부적합

- **순수 인터랙션 컴포넌트** (드롭다운, 폼 자체) — 데이터 없이 인터랙션만이면 클라이언트만 사용
- **third-party API에 의존하고 응답이 매우 느린 영역** — 페이지 로드 자체가 느려짐. 클라이언트에서 lazy + suspense

## 4. 구현 패턴

### 4.1 가장 단순한 형태

```tsx
// page.tsx
export default async function Page() {
  const data = await getData();
  return <Client initialData={data} />;
}
```

### 4.2 병렬 fetch (여러 데이터)

```tsx
// page.tsx
export default async function Page() {
  const [data1, data2, data3] = await Promise.all([
    getData1(),
    getData2(),
    getData3(),
  ]);
  return <Client d1={data1} d2={data2} d3={data3} />;
}
```

`bus-monitor/page.tsx`가 이 패턴 (`listBusTimeSlots()` + `getDailyBusManifest(today)` 병렬).

### 4.3 SSR 초기 + 클라이언트 갱신 (refresh 버튼·realtime)

```tsx
// page.tsx
export default async function Page() {
  const initial = await getData();
  return <Client initialData={initial} />;
}

// Client.tsx
"use client";
export function Client({ initialData }) {
  const [data, setData] = useState(initialData);

  // 사용자가 명시적으로 새로고침 누를 때
  async function refresh() {
    const fresh = await getData();
    setData(fresh);
  }

  // 또는 realtime 구독으로 자동 갱신
  useRealtimeSubscription((event) => {
    setData((prev) => applyEvent(prev, event));
  });

  return <RealContent data={data} onRefresh={refresh} />;
}
```

### 4.4 인증된 page

`(admin)/admin/layout.tsx`이 이미 `verifyAdmin()` 류로 인증·역할 검증 + redirect 처리. 따라서 `(admin)/admin/.../page.tsx`에서는 안심하고 admin client로 직접 fetch 가능.

```tsx
// (admin)/admin/students/page.tsx
import { listAllStudents } from "@/app/(admin)/admin/actions";

export default async function StudentsPage() {
  const students = await listAllStudents();
  return <StudentsClient initialStudents={students} />;
}
```

`getCurrentStudentProfile()` 류는 이미 server-side 인증을 포함하므로 (academy)/academy/student 계열도 동일하게 적용 가능.

## 5. SearchParams를 받는 page

URL 쿼리 파라미터(`?date=2026-04-27`)를 fetch 입력으로 사용:

```tsx
// page.tsx
type SearchParams = Promise<{ date?: string }>;

export default async function Page({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { date } = await searchParams;
  const data = await getData(date);
  return <Client initialData={data} />;
}
```

`lunch-monitor/page.tsx`가 이 패턴.

## 6. 측정 — 효과 검증

### Chrome DevTools MCP

```
1. /browse 또는 mcp__plugin_chrome-devtools-mcp_chrome-devtools__navigate_page
2. performance_start_trace { autoStop: true, reload: true }
3. 결과의 LCP, CLS, TTFB, render delay 비교
```

bus-monitor 변경 전후 비교:
- LCP element: Button(Skeleton 안의 버튼) → 실제 카드
- CLS: 0.28 → 0.00
- Render delay: 91% → 거의 0%

### 빌드에서 확인

```
npm run build
```

`(site)/program/*` 같은 정적 사전렌더 페이지는 `○ Static`으로 표시. 동적 렌더는 `ƒ Dynamic`. SSR 초기 fetch가 들어간 페이지는 보통 `ƒ Dynamic`.

## 7. 본 프로젝트 적용 가이드

### 적용 완료
- `src/app/(monitor)/bus-monitor/page.tsx` — `listBusTimeSlots` + `getDailyBusManifest` 병렬 SSR
- `src/app/(monitor)/lunch-monitor/page.tsx` — `getLunchSchedule` SSR

### 적용 후보
새 페이지 작성 시 항상 SSR 초기 fetch를 우선 고려. 기존 페이지 중 다음 신호가 보이면 변환 검토:
- `"use client"` 파일에서 `useEffect`로 Server Action 호출
- `setLoading(true/false)` + Skeleton 패턴
- 측정 결과 LCP element가 Skeleton/Button임

### 변환 절차

1. 기존 클라이언트 컴포넌트의 `useEffect` fetch 코드 분석
2. `page.tsx`를 `async` 서버 컴포넌트로 만들고 같은 fetch 호출
3. 결과를 `initialXxx` props로 클라이언트 컴포넌트에 전달
4. 클라이언트는 `useState(initialXxx)` 초기값으로 사용
5. mount 시 useEffect fetch 제거. 사용자 액션(refetch 버튼, 탭 전환) 시점의 fetch는 유지
6. Skeleton 분기 제거 — props로 데이터가 항상 있음
7. 빌드 + 페이지 측정으로 LCP/CLS 개선 확인

### 안티패턴 — 피할 것

- ❌ 클라이언트 mount 시 fetch (스켈레톤 → 점프)
- ❌ Skeleton과 실제 콘텐츠 사이즈 불일치 (CLS 발생)
- ❌ layout에서 이미 인증한 페이지에서 page가 다시 인증 (이중 fetch)
- ❌ `useEffect(() => router.refresh(), [...])` 같은 무한 갱신
- ❌ 모든 데이터를 page에 몰아넣어 TTFB가 2초 넘게 길어짐 — 이때는 페이지 분할 또는 Suspense + streaming 고려

## 8. 참고

- Next.js 공식: [Server Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- 본 프로젝트 적용 사례:
  - `src/app/(monitor)/bus-monitor/page.tsx` — 병렬 fetch + 클라이언트에 props 전달
  - `src/app/(monitor)/bus-monitor/BusMonitorClient.tsx` — `initialIsoDay`, `initialGroups` props 수신
  - `src/lib/bus/monitor-date.ts` — 서버·클라 공용 KST 요일 유틸 (hydration mismatch 방지)
- `.claude/routes/bus-monitor.md` — 데이터 흐름 상세
- `.claude/rules/patterns.md` — 인증·날짜·HTML escape 등 관련 패턴
