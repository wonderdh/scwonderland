# Next.js 16 Cache Components 도입 가이드

> Week 4 플랜 2.4 항목. 실제 적용은 전체 페이지 회귀 테스트 필수라 보류.

## 왜

`listBusNumbers`, `listBusTimeSlots`, `listAcademyPeriods`, `listTextbooks`처럼 **마스터 데이터**(CUD가 드물고 앱 전역에서 매 요청마다 읽기만 하는 데이터)를 매번 DB 조회하는 건 낭비. Next.js 16 Cache Components로 per-deploy 캐시 + tag 기반 무효화 도입 가능.

## 활성화

```ts
// next.config.ts
const nextConfig: NextConfig = {
  cacheComponents: true,
  // ...
};
```

**주의:** 이 플래그 활성화 시 모든 페이지가 Partial Prerendering 모드로 전환. `cookies()`/`headers()`/`searchParams` 등 runtime API를 직접 쓰는 Server Component는 반드시 `<Suspense>` 경계 안에 있어야 함. 없으면 빌드 시 prerendering 실패.

## 대상 액션 변환 예시

### Before
```ts
export async function listBusTimeSlots(): Promise<BusTimeSlot[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("bus_time_slots")
    .select("*")
    .order("time");
  return data ?? [];
}
```

### After
```ts
import { cacheLife, cacheTag } from "next/cache";

export async function listBusTimeSlots(): Promise<BusTimeSlot[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("bus-master");

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("bus_time_slots")
    .select("*")
    .order("time");
  return data ?? [];
}
```

### 무효화 (mutation action 내부)

```ts
import { revalidateTag } from "next/cache";

export async function createBusTimeSlot(...) {
  // ... insert
  revalidateTag("bus-master");
  return {};
}
```

`updateBusTimeSlot`, `deleteBusTimeSlot`, `createBusNumber`, `deleteBusNumber` 등 마스터 데이터를 수정하는 모든 액션에 동일 처리.

## 같이 태그 묶을 것

| Tag | 커버 액션 |
|-----|----------|
| `bus-master` | listBusNumbers, listBusTimeSlots, listBusStops (같이 쓰이는 편) |
| `textbook-master` | listTextbooks |
| `timetable-master` | listAcademyPeriods |

## 롤아웃 순서 (권장)

1. staging 환경에 `cacheComponents: true` 먼저 적용, 빌드 에러 확인
2. 에러가 난 페이지에 `<Suspense>` 경계 추가 (Week 2에서 학생 대시보드만 처리됨 — 나머지 필요)
3. 마스터 데이터 4개 액션에 `"use cache"` + `cacheTag` 추가
4. 해당 데이터를 수정하는 mutation action에 `revalidateTag` 추가
5. `EXPLAIN ANALYZE`로 실제 쿼리 감소 확인 (동일 데이터 반복 조회가 cache hit 되는지)

## 관련 현재 상태

- `next.config.ts`에 `cacheComponents` 플래그 **없음**
- `'use cache'` 지시문을 쓰는 파일 **없음**
- Suspense 경계 확장은 Week 2 1.3에서 학생 대시보드만 처리 (교사/관리자 dashboard 남음)
