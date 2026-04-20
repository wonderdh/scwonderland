# 관측·분석 도입 (Sentry + Vercel Analytics)

> 작성: Week 3 작업 중 생성. 실제 설치는 외부 계정/DSN 필요해서 사용자가 직접 수행.

## 1. Sentry

### 설치
```bash
npm install --save @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

위저드가 자동 생성:
- `sentry.client.config.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`
- `next.config.ts` 업데이트 (Sentry webpack plugin)

### 환경변수 (.env.local + Vercel dashboard)
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_AUTH_TOKEN` (소스맵 업로드용, CI 전용)

### 트랜잭션 마킹 대상 (핵심 액션)
Week 3 플랜 6.1 기준으로 다음 Server Action에 트랜잭션 스팬 추가 권장:
- `upsertReportCard` (`src/app/(admin)/admin/actions/report-actions.ts`)
- `bulkRecordAttendance` (`src/app/(admin)/admin/actions/attendance-actions.ts`)
- `getDailyBusManifest` (`src/app/(admin)/admin/actions/bus-actions.ts`)

예시:
```ts
import * as Sentry from "@sentry/nextjs";

export async function bulkRecordAttendance(records) {
  return Sentry.startSpan({ name: "bulkRecordAttendance", op: "server.action" }, async () => {
    // 기존 로직
  });
}
```

## 2. Vercel Analytics + Speed Insights

### 설치
```bash
npm install --save @vercel/analytics @vercel/speed-insights
```

### 적용 (`src/app/layout.tsx`)
```tsx
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

### Vercel dashboard
- Project → Analytics 탭 활성화
- Speed Insights는 자동. 평균 30일 데이터 수집 후 Lighthouse 점수 트렌드 확인.

## 3. 검증

- Sentry: 의도적으로 `throw new Error("sentry-test")` 배포 → Sentry Issues에 포착되는지
- Analytics: `/admin` 진입 후 Vercel Analytics dashboard에 pageview 카운트 증가 확인
- Speed Insights: 배포 후 48시간 뒤 Core Web Vitals 집계 확인
