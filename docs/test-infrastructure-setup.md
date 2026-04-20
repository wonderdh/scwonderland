# 테스트 인프라 도입 가이드

> Week 4 플랜 6.2 항목. 패키지 설치 + CI 설정 필요라 사용자가 직접 수행.

## 1. Jest 단위 테스트

### 설치
```bash
npm install --save-dev jest @types/jest ts-jest \
  @testing-library/react @testing-library/jest-dom \
  jest-environment-jsdom
```

### `jest.config.ts` (프로젝트 루트)
```ts
import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  setupFilesAfterEach: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
  testPathIgnorePatterns: ["/node_modules/", "/.next/", "/e2e/"],
};

export default config;
```

### `jest.setup.ts`
```ts
import "@testing-library/jest-dom";
```

### `package.json` 스크립트 추가
```json
"test": "jest",
"test:watch": "jest --watch"
```

### 우선 작성 대상 3개

#### a) `src/lib/utils/date-kst.test.ts`
```ts
import { todayKst, formatDateKst, nowKstParts } from "./date-kst";

describe("date-kst", () => {
  it("todayKst returns YYYY-MM-DD in KST", () => {
    const result = todayKst();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("handles midnight KST boundary correctly", () => {
    // KST = UTC+9. UTC 14:30 = KST 23:30 (same day). UTC 15:30 = KST 00:30 (next day).
    // 실제로는 jest에서 Date mock 필요 (jest.useFakeTimers + setSystemTime)
  });

  it("nowKstParts returns year/month/day", () => {
    const { year, month, day } = nowKstParts();
    expect(year).toBeGreaterThan(2020);
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
  });
});
```

#### b) `src/lib/utils/student-sort.test.ts`
```ts
import { sortStudentsByAgeAndName } from "./student-sort";

describe("sortStudentsByAgeAndName", () => {
  it("sorts by age ascending, then name", () => {
    const input = [
      { age: 7, korean_name: "김철수", english_name: null },
      { age: 5, korean_name: "이영희", english_name: null },
      { age: 6, korean_name: "박민수", english_name: null },
      { age: 5, korean_name: "김수진", english_name: null },
    ];
    const sorted = sortStudentsByAgeAndName(input);
    expect(sorted.map((s) => s.korean_name)).toEqual([
      "김수진", "이영희", "박민수", "김철수",
    ]);
  });

  it("handles null age as 99 (last)", () => {
    const input = [
      { age: null, korean_name: "A", english_name: null },
      { age: 7, korean_name: "B", english_name: null },
    ];
    const sorted = sortStudentsByAgeAndName(input);
    expect(sorted[0].korean_name).toBe("B");
  });
});
```

#### c) `src/app/(admin)/admin/actions/schedule-actions.test.ts` — integration
Supabase 테스트 DB 필요. 프로젝트에 마련되면 작성.

## 2. Playwright E2E

### 설치
```bash
npm install --save-dev @playwright/test
npx playwright install --with-deps chromium
```

### `playwright.config.ts`
```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

### `package.json` 스크립트
```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

### E2E 2개 시나리오

#### a) `e2e/student-homework.spec.ts` — 학생 로그인 → 숙제 제출
```ts
import { test, expect } from "@playwright/test";

test("학생이 숙제를 제출하고 토스트를 본다", async ({ page }) => {
  await page.goto("/academy/login");
  await page.fill('input[name="email"]', process.env.TEST_STUDENT_ID!);
  await page.fill('input[name="password"]', process.env.TEST_STUDENT_PW!);
  await page.click('button[type="submit"]');

  await page.waitForURL("/academy/student");
  await page.click("text=숙제");
  await page.click("text=숙제 제출");

  await page.fill("textarea", "테스트 답변");
  await page.click("text=제출");

  await expect(page.locator("text=제출되었습니다")).toBeVisible();
});
```

#### b) `e2e/admin-student-flow.spec.ts` — 관리자 학생 추가 → 반 배정 → 시간표
(긴 플로우라 별도 작성 필요)

## 3. CI 연결 (6.4 관련)

`.github/workflows/ci.yml`:
```yaml
name: CI
on: [pull_request, push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm test
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
        env:
          TEST_STUDENT_ID: ${{ secrets.TEST_STUDENT_ID }}
          TEST_STUDENT_PW: ${{ secrets.TEST_STUDENT_PW }}
```

## 4. 기존 프로젝트에 맞춘 주의사항

- Supabase는 테스트용 staging 프로젝트 별도 생성 권장 (prod 오염 방지)
- `.env.test`에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` 등 staging 값 분리
- Playwright는 테스트 계정 시딩 스크립트 필요 (신규 학생/교사/관리자 계정 + 리셋 용)
- CI 첫 실행 전까지는 로컬에서 `npm test && npm run test:e2e`가 통과해야 함
