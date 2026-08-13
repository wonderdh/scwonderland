# Raz 책 목록 + 학생별 읽음 체크 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** raz-plus.com 책 2,572권 카탈로그 + 학생별 읽음 체크(학생 본인·교사·admin)를 기존 academy/admin 포털에 추가한다.

**Architecture:** `raz_books`(정적 카탈로그) + `raz_read_logs`(읽음 = 행 존재) 테이블, `raz-covers` public 버킷. books는 서버에서 `unstable_cache`로 1회 로드 후 client props로 전달, 필터·검색은 전부 클라이언트 메모리. 토글은 Server Action insert/delete + `useOptimistic`. 공용 presentational 컴포넌트는 `src/components/reading/`, 데이터 로딩은 각 포털(academy/actions.ts, admin/actions/raz-actions.ts)이 자기 컨벤션대로.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase(RLS + Storage), sharp(일회성 이미지 변환), node:test

**Spec:** `docs/superpowers/specs/2026-08-13-raz-reading-design.md`

## Global Constraints

- Server Action은 mutation 전 인증 검증 (`verifyAdmin` 또는 academy 컨벤션 `createClient()` + `hasUserRole`). CLAUDE.md 규칙.
- FK 컨벤션: `student_id → public.students(id)`, actor 컬럼 `marked_by → public.profiles(id)`. (`supabase/AGENTS.md`)
- academy 코드는 `(admin)/admin/actions/`의 verify 헬퍼·`(admin)/admin/_components/**` import 금지. (`src/app/academy/AGENTS.md`)
- anon 권한 없음 — 새 테이블도 `revoke all ... from anon` + authenticated 정책만.
- PostgREST `max_rows=1000`: 1,000행 초과 가능한 select는 반드시 range 페이지네이션 (`fetchAllRows` 헬퍼).
- 마이그레이션 후 `pnpm db:types` (원격) 또는 `pnpm db:types:local` (로컬) → `src/lib/types/database.generated.ts` 재생성, 같이 커밋.
- 원본 데이터: `D:\Projects\raz-kids\resourcelist.json` + `D:\Projects\raz-kids\images\{id}.png` (2,572개).
- 민감값(.env) 커밋 금지. 스크립트는 `node --env-file=.env.local`로 실행.

---

### Task 1: DB 마이그레이션 (테이블 + RLS + 버킷) + 타입 재생성

**Files:**
- Create: `supabase/migrations/20260813000000_raz_reading.sql`
- Regenerate: `src/lib/types/database.generated.ts`

**Interfaces:**
- Consumes: 기존 `public.students`, `public.profiles`, `private.get_my_role()`, `public.user_role` enum
- Produces: `public.raz_books`, `public.raz_read_logs` 테이블, `raz-covers` public 버킷, `Database["public"]["Tables"]["raz_books"|"raz_read_logs"]` 타입

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- Raz 책 목록 + 학생별 읽음 체크
-- 설계: docs/superpowers/specs/2026-08-13-raz-reading-design.md

create table public.raz_books (
  id          int primary key,          -- raz 고유 id. 표지 URL(covers/{id}.webp) 조합에도 사용
  title       text not null,
  level       text not null,            -- aa~Z2 (29개)
  level_order int not null,             -- aa=0, A=1, ..., Z=26, Z1=27, Z2=28
  grade       text,
  lexile      text,                     -- 원문 "440L", "BR70L"
  lexile_num  int,                      -- "BR70L"→-70, "440L"→440
  genre       text,
  genre2      text,
  multilevel  boolean not null default false
);

comment on table public.raz_books is 'raz-plus.com 책 카탈로그 (정적 데이터, service role 스크립트로만 적재)';

create table public.raz_read_logs (
  student_id uuid not null references public.students(id) on delete cascade,
  book_id    int  not null references public.raz_books(id),
  read_at    timestamptz not null default now(),
  marked_by  uuid references public.profiles(id),  -- actor: 학생 본인·교사·admin
  primary key (student_id, book_id)
);

comment on table public.raz_read_logs is '읽음 = 행 존재. 체크 insert / 해제 delete (update 없음).';

create index raz_read_logs_book_id_idx on public.raz_read_logs (book_id);

alter table public.raz_books enable row level security;
alter table public.raz_read_logs enable row level security;

revoke all on public.raz_books from anon;
revoke all on public.raz_read_logs from anon;

-- books: authenticated 전체 select. 쓰기 정책 없음 (적재는 service role).
create policy "raz_books_authenticated_select" on public.raz_books
  for select to authenticated using (true);

-- read_logs: 본인 또는 teacher/admin. update 정책 없음.
create policy "raz_read_logs_select" on public.raz_read_logs
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or (select private.get_my_role()) = any (
      array['admin'::public.user_role, 'teacher'::public.user_role]
    )
  );

create policy "raz_read_logs_insert" on public.raz_read_logs
  for insert to authenticated
  with check (
    (
      student_id = (select auth.uid())
      or (select private.get_my_role()) = any (
        array['admin'::public.user_role, 'teacher'::public.user_role]
      )
    )
    and marked_by = (select auth.uid())
  );

create policy "raz_read_logs_delete" on public.raz_read_logs
  for delete to authenticated
  using (
    student_id = (select auth.uid())
    or (select private.get_my_role()) = any (
      array['admin'::public.user_role, 'teacher'::public.user_role]
    )
  );

-- 표지 버킷: public read. 업로드는 service role 스크립트로만 — 쓰기 정책 없음.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('raz-covers', 'raz-covers', true, 5242880, array['image/webp'])
on conflict (id) do nothing;

-- ROLLBACK:
-- BEGIN;
-- DROP TABLE IF EXISTS public.raz_read_logs;
-- DROP TABLE IF EXISTS public.raz_books;
-- DROP POLICY 는 테이블 drop 으로 함께 제거. 버킷은 콘솔에서 수동 정리.
-- COMMIT;
```

- [ ] **Step 2: 적용**

로컬 스택 사용 시: `pnpm supabase migration up` (안 뜨면 `pnpm supabase db reset`).
원격 적용 시: `pnpm supabase db push`.
Expected: 에러 없이 적용.

- [ ] **Step 3: 타입 재생성 + 타입체크**

Run: `pnpm db:types` (로컬 스택이면 `pnpm db:types:local`), 이어서 `pnpm type-check`
Expected: `database.generated.ts`에 `raz_books`, `raz_read_logs` 등장, tsc 통과.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260813000000_raz_reading.sql src/lib/types/database.generated.ts
git commit -m "feat(raz): raz_books/raz_read_logs 테이블 + RLS + raz-covers 버킷"
```

---

### Task 2: 변환 로직 (level_order / lexile_num) — TDD

**Files:**
- Create: `scripts/raz-import/convert.mjs`
- Test: `scripts/raz-import/convert.test.mjs`

**Interfaces:**
- Produces: `levelOrder(level: string): number` (알 수 없는 레벨은 throw), `lexileNum(lexile: string | null | undefined): number | null` — Task 3이 import.

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// scripts/raz-import/convert.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { levelOrder, lexileNum } from "./convert.mjs";

test("levelOrder: aa=0, A=1, Z=26, Z1=27, Z2=28", () => {
  assert.equal(levelOrder("aa"), 0);
  assert.equal(levelOrder("A"), 1);
  assert.equal(levelOrder("B"), 2);
  assert.equal(levelOrder("Z"), 26);
  assert.equal(levelOrder("Z1"), 27);
  assert.equal(levelOrder("Z2"), 28);
});

test("levelOrder: 알 수 없는 레벨은 throw", () => {
  assert.throws(() => levelOrder("z"));   // 소문자 z 는 별개
  assert.throws(() => levelOrder(""));
});

test("lexileNum: 440L→440, BR70L→-70, 빈값→null", () => {
  assert.equal(lexileNum("440L"), 440);
  assert.equal(lexileNum("BR70L"), -70);
  assert.equal(lexileNum("0L"), 0);
  assert.equal(lexileNum(""), null);
  assert.equal(lexileNum(null), null);
  assert.equal(lexileNum(undefined), null);
  assert.equal(lexileNum("N/A"), null);   // 패턴 불일치는 null
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test scripts/raz-import/convert.test.mjs`
Expected: FAIL (`Cannot find module ... convert.mjs`)

- [ ] **Step 3: 구현**

```js
// scripts/raz-import/convert.mjs
// 레벨 순서: aa=0, A=1..Z=26, Z1=27, Z2=28 (총 29개). 문자 정렬 불가(aa가 Z 뒤로 감).
const LEVELS = ["aa", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "Z1", "Z2"];

export function levelOrder(level) {
  const i = LEVELS.indexOf(level);
  if (i === -1) throw new Error(`알 수 없는 레벨: ${JSON.stringify(level)}`);
  return i;
}

// "440L" → 440, "BR70L" → -70 (BR = Beginning Reader, 0 미만). 패턴 불일치 → null.
export function lexileNum(lexile) {
  if (!lexile) return null;
  const m = /^(BR)?(\d+)L$/.exec(String(lexile).trim());
  if (!m) return null;
  const n = Number(m[2]);
  return m[1] ? -n : n;
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test scripts/raz-import/convert.test.mjs`
Expected: PASS (전체 테스트 통과). `pnpm test`도 실행해 기존 테스트에 영향 없는지 확인.

- [ ] **Step 5: Commit**

```bash
git add scripts/raz-import/convert.mjs scripts/raz-import/convert.test.mjs
git commit -m "feat(raz): level_order/lexile_num 변환 로직 + 테스트"
```

---

### Task 3: books 적재 스크립트 작성·실행

**Files:**
- Create: `scripts/raz-import/import-books.mjs`

**Interfaces:**
- Consumes: Task 2의 `levelOrder`, `lexileNum`. Task 1의 `raz_books` 테이블.
- Produces: `raz_books` 2,572행 적재 완료 (재실행 시 upsert로 멱등).

- [ ] **Step 1: 스크립트 작성**

```js
// scripts/raz-import/import-books.mjs
// 일회성: resourcelist.json → raz_books 적재.
// 실행: node --env-file=.env.local scripts/raz-import/import-books.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { levelOrder, lexileNum } from "./convert.mjs";

const SRC = "D:/Projects/raz-kids/resourcelist.json";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요 (--env-file=.env.local)");

const raw = JSON.parse(readFileSync(SRC, "utf8"));
// 필드명이 xlsx 컬럼(id/title/level/grade/lexile/genre/genre2/multilevel)과 다르면 아래 매핑만 수정
const list = Array.isArray(raw) ? raw : raw.books ?? raw.resources;
if (!Array.isArray(list)) throw new Error(`배열을 찾지 못함. 최상위 키: ${Object.keys(raw)}`);

const rows = list.map((r) => ({
  id: Number(r.id),
  title: String(r.title),
  level: String(r.level),
  level_order: levelOrder(String(r.level)),
  grade: r.grade ?? null,
  lexile: r.lexile ?? null,
  lexile_num: lexileNum(r.lexile),
  genre: r.genre ?? null,
  genre2: r.genre2 ?? null,
  multilevel: Boolean(r.multilevel),
}));

// 적재 전 sanity check
console.assert(rows.length === 2572, `행 수 불일치: ${rows.length} (예상 2572)`);
const ids = new Set(rows.map((r) => r.id));
console.assert(ids.size === rows.length, `중복 id 존재: ${rows.length - ids.size}건`);
if (rows.length !== 2572 || ids.size !== rows.length) process.exit(1);

const supabase = createClient(url, key);
for (let i = 0; i < rows.length; i += 500) {
  const batch = rows.slice(i, i + 500);
  const { error } = await supabase.from("raz_books").upsert(batch);
  if (error) {
    console.error(`batch ${i}~${i + batch.length} 실패:`, error.message);
    process.exit(1);
  }
  console.log(`${Math.min(i + 500, rows.length)}/${rows.length}`);
}
console.log("완료");
```

- [ ] **Step 2: 실행 전 원본 필드 확인**

`resourcelist.json`의 첫 항목 키를 확인 (`node -e "const d=JSON.parse(require('fs').readFileSync('D:/Projects/raz-kids/resourcelist.json','utf8')); console.log(Object.keys(Array.isArray(d)?d[0]:d))"`). xlsx 컬럼명과 다르면 Step 1의 매핑 부분만 수정.

- [ ] **Step 3: 실행**

Run: `node --env-file=.env.local scripts/raz-import/import-books.mjs`
Expected: `2572/2572` → `완료`. (로컬 스택 대상이면 `.env.local`의 URL/KEY가 로컬 값인지 확인)

- [ ] **Step 4: 적재 검증**

Supabase에서 `select count(*) from raz_books;` → 2572. `select count(*) from raz_books where lexile is not null and lexile_num is null;` 결과를 확인하고, 0이 아니면 해당 lexile 원문 샘플을 조회해 패턴 불일치(정상적 null)인지 파싱 버그인지 판단.

- [ ] **Step 5: Commit**

```bash
git add scripts/raz-import/import-books.mjs
git commit -m "feat(raz): books 적재 스크립트 (2,572권)"
```

---

### Task 4: 표지 WebP 변환·업로드 스크립트 작성·실행

**Files:**
- Create: `scripts/raz-import/upload-covers.mjs`
- Modify: `package.json` (devDependency `sharp` 추가)

**Interfaces:**
- Consumes: Task 1의 `raz-covers` 버킷. 원본 `D:\Projects\raz-kids\images\{id}.png`.
- Produces: Storage `raz-covers/covers/{id}.webp` 2,572개 (재실행 시 upsert로 멱등).

- [ ] **Step 1: sharp 설치**

Run: `pnpm add -D sharp`
pnpm이 빌드 스크립트를 차단하면 `pnpm approve-builds`에서 sharp 승인 후 재설치.

- [ ] **Step 2: 스크립트 작성**

```js
// scripts/raz-import/upload-covers.mjs
// 일회성: 표지 PNG → WebP q80 변환 → raz-covers 버킷 업로드.
// 실행: node --env-file=.env.local scripts/raz-import/upload-covers.mjs
import { readdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const DIR = "D:/Projects/raz-kids/images";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요 (--env-file=.env.local)");

const supabase = createClient(url, key);
const files = readdirSync(DIR).filter((f) => f.endsWith(".png"));
console.log(`${files.length}개 변환·업로드 시작`);

const failed = [];
let done = 0;
let cursor = 0;
// ponytail: 단순 워커 풀 8개. 더 빠른 게 필요하면 CONCURRENCY 만 올리면 됨.
async function worker() {
  while (cursor < files.length) {
    const file = files[cursor++];
    try {
      const webp = await sharp(path.join(DIR, file)).webp({ quality: 80 }).toBuffer();
      const id = path.basename(file, ".png");
      const { error } = await supabase.storage
        .from("raz-covers")
        .upload(`covers/${id}.webp`, webp, { contentType: "image/webp", upsert: true });
      if (error) throw new Error(error.message);
    } catch (e) {
      failed.push(`${file}: ${e.message}`);
    }
    done++;
    if (done % 200 === 0) console.log(`${done}/${files.length}`);
  }
}
await Promise.all(Array.from({ length: 8 }, worker));

if (failed.length) {
  console.error(`실패 ${failed.length}건:\n${failed.join("\n")}`);
  process.exit(1);  // 재실행하면 upsert 라 성공분은 건너뛰는 효과
}
console.log(`완료: ${done}개`);
```

- [ ] **Step 3: 실행**

Run: `node --env-file=.env.local scripts/raz-import/upload-covers.mjs`
Expected: `완료: 2572개`. 수 분 소요될 수 있음.

- [ ] **Step 4: 업로드 검증**

브라우저에서 `{NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/raz-covers/covers/{임의 id}.webp` 접속 → 표지 이미지 표시. (id는 `select id from raz_books limit 3;`에서)

- [ ] **Step 5: Commit**

```bash
git add scripts/raz-import/upload-covers.mjs package.json pnpm-lock.yaml
git commit -m "feat(raz): 표지 WebP 변환·업로드 스크립트"
```

---

### Task 5: 공용 타입·유틸 (RazBook, cover URL, books 캐시, 집계) — TDD

**Files:**
- Create: `src/lib/types/raz.ts`
- Modify: `src/lib/types/index.ts` (barrel에 `export * from "./raz";` 추가 — 기존 export 나열 방식을 따를 것)
- Create: `src/lib/raz/cover.ts`
- Create: `src/lib/raz/books.server.ts`
- Create: `src/lib/supabase/fetch-all.ts`
- Create: `src/lib/raz/stats.ts`
- Test: `src/lib/raz/stats.test.mjs`

**Interfaces:**
- Consumes: Task 1의 `Database` 타입.
- Produces (이후 모든 태스크가 사용):
  - `RazBook` = `Database["public"]["Tables"]["raz_books"]["Row"]` (`@/lib/types`에서 export)
  - `razCoverUrl(bookId: number): string`
  - `getRazBooks(): Promise<RazBook[]>` — 서버 전용, `unstable_cache` tag `"raz-books"`
  - `fetchAllRows<T>(query: (from: number, to: number) => ...): Promise<T[]>`
  - `aggregateReadingStats(classes, logs, books): ClassReadingStats[]`, 타입 `ReadingStudentStat`, `ClassReadingStats`, `ClassWithStudents`

- [ ] **Step 1: 타입 + cover URL + fetchAllRows 작성**

```ts
// src/lib/types/raz.ts
import type { Database } from "@/lib/types/database.generated";

export type RazBook = Database["public"]["Tables"]["raz_books"]["Row"];
```

```ts
// src/lib/raz/cover.ts
// 표지 URL은 DB에 저장하지 않고 book id 로 조합 (클라이언트에서도 사용 가능).
export function razCoverUrl(bookId: number): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/raz-covers/covers/${bookId}.webp`;
}
```

```ts
// src/lib/supabase/fetch-all.ts
// PostgREST max_rows(1000) 대응: range 페이지네이션으로 전체 행 조회.
// 1,000행을 넘을 수 있는 select 는 반드시 이걸 거칠 것.
export async function fetchAllRows<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await query(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all;
}
```

- [ ] **Step 2: books 서버 캐시 작성**

```ts
// src/lib/raz/books.server.ts
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import type { RazBook } from "@/lib/types";

// 정적 카탈로그 — 무기한 캐시. 재적재 시 revalidateTag("raz-books") 또는 재배포.
// admin client 사용: 유저 무관 공개(authenticated) 데이터라 캐시 공유에 적합.
export const getRazBooks = unstable_cache(
  async (): Promise<RazBook[]> => {
    const admin = createAdminClient();
    return fetchAllRows<RazBook>((from, to) =>
      admin
        .from("raz_books")
        .select("*")
        .order("level_order")
        .order("title")
        .range(from, to),
    );
  },
  ["raz-books"],
  { tags: ["raz-books"] },
);
```

- [ ] **Step 3: 집계 함수의 실패하는 테스트 작성**

```js
// src/lib/raz/stats.test.mjs
// 실행: pnpm test (scripts/test-hooks.mjs 가 @/ alias 를 src/ 로 해석)
import test from "node:test";
import assert from "node:assert/strict";
import { aggregateReadingStats } from "@/lib/raz/stats";

const books = [
  { id: 1, level: "aa", level_order: 0 },
  { id: 2, level: "A", level_order: 1 },
  { id: 3, level: "B", level_order: 2 },
];
const classes = [
  {
    id: "c1",
    name: "1반",
    students: [
      { id: "s1", koreanName: "김철수", englishName: "Chul" },
      { id: "s2", koreanName: "이영희", englishName: null },
    ],
  },
];

test("읽은 권수·최고 레벨·레벨별 카운트 집계", () => {
  const logs = [
    { student_id: "s1", book_id: 1 },
    { student_id: "s1", book_id: 2 },
    { student_id: "s1", book_id: 3 },
  ];
  const [c] = aggregateReadingStats(classes, logs, books);
  const s1 = c.students.find((s) => s.studentId === "s1");
  assert.equal(s1.readCount, 3);
  assert.equal(s1.topLevel, "B");
  assert.deepEqual(s1.levelCounts, { aa: 1, A: 1, B: 1 });
});

test("로그 없는 학생은 0권·topLevel null", () => {
  const [c] = aggregateReadingStats(classes, [], books);
  const s2 = c.students.find((s) => s.studentId === "s2");
  assert.equal(s2.readCount, 0);
  assert.equal(s2.topLevel, null);
  assert.deepEqual(s2.levelCounts, {});
});

test("카탈로그에 없는 book_id 는 무시하되 readCount 에는 포함하지 않음", () => {
  const logs = [{ student_id: "s1", book_id: 999 }];
  const [c] = aggregateReadingStats(classes, logs, books);
  const s1 = c.students.find((s) => s.studentId === "s1");
  assert.equal(s1.readCount, 0);
});
```

- [ ] **Step 4: 실패 확인**

Run: `pnpm test`
Expected: stats.test.mjs FAIL (`Cannot find module ... stats`)

- [ ] **Step 5: 집계 함수 구현**

```ts
// src/lib/raz/stats.ts
// 순수 집계 함수 — 서버·클라 무관, DB 접근 없음.
import type { RazBook } from "@/lib/types";

export interface ReadingStudentStat {
  studentId: string;
  koreanName: string | null;
  englishName: string | null;
  readCount: number;
  topLevel: string | null;               // 읽은 책 중 가장 높은 레벨
  levelCounts: Record<string, number>;   // 레벨별 읽은 권수
}

export interface ClassReadingStats {
  classId: string;
  className: string;
  students: ReadingStudentStat[];
}

export interface ClassWithStudents {
  id: string;
  name: string;
  students: { id: string; koreanName: string | null; englishName: string | null }[];
}

export function aggregateReadingStats(
  classes: ClassWithStudents[],
  logs: { student_id: string; book_id: number }[],
  books: Pick<RazBook, "id" | "level" | "level_order">[],
): ClassReadingStats[] {
  const bookById = new Map(books.map((b) => [b.id, b]));
  const logsByStudent = new Map<string, number[]>();
  for (const log of logs) {
    const arr = logsByStudent.get(log.student_id);
    if (arr) arr.push(log.book_id);
    else logsByStudent.set(log.student_id, [log.book_id]);
  }
  return classes.map((c) => ({
    classId: c.id,
    className: c.name,
    students: c.students.map((s) => {
      const levelCounts: Record<string, number> = {};
      let readCount = 0;
      let top: { level: string; order: number } | null = null;
      for (const bookId of logsByStudent.get(s.id) ?? []) {
        const book = bookById.get(bookId);
        if (!book) continue;  // 카탈로그에 없는 id 는 스킵
        readCount++;
        levelCounts[book.level] = (levelCounts[book.level] ?? 0) + 1;
        if (!top || book.level_order > top.order) top = { level: book.level, order: book.level_order };
      }
      return {
        studentId: s.id,
        koreanName: s.koreanName,
        englishName: s.englishName,
        readCount,
        topLevel: top?.level ?? null,
        levelCounts,
      };
    }),
  }));
}
```

- [ ] **Step 6: 통과 확인**

Run: `pnpm test`, `pnpm type-check`
Expected: 전체 PASS, tsc 통과.

- [ ] **Step 7: Commit**

```bash
git add src/lib/types/raz.ts src/lib/types/index.ts src/lib/raz/ src/lib/supabase/fetch-all.ts
git commit -m "feat(raz): RazBook 타입 + books 캐시 + 읽기 통계 집계 유틸"
```

---

### Task 6: 공용 UI 컴포넌트 (BookGrid, ReadingDashboard)

**Files:**
- Create: `src/components/reading/BookGrid.tsx`
- Create: `src/components/reading/ReadingDashboard.tsx`

**Interfaces:**
- Consumes: `RazBook`, `razCoverUrl`, `ClassReadingStats` (Task 5)
- Produces (각 포털 페이지가 사용):
  - `<BookGrid books readBookIds canToggle toggleAction? />`, `type ToggleReadAction = (bookId: number, read: boolean) => Promise<{ error?: string }>`
  - `<ReadingDashboard stats hrefBase />` — 학생 행 클릭 시 `${hrefBase}/${studentId}` 링크

- [ ] **Step 1: BookGrid 작성**

```tsx
// src/components/reading/BookGrid.tsx
"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { razCoverUrl } from "@/lib/raz/cover";
import type { RazBook } from "@/lib/types";

export type ToggleReadAction = (bookId: number, read: boolean) => Promise<{ error?: string }>;

interface BookGridProps {
  books: RazBook[];          // level_order → title 순 정렬 전제 (getRazBooks 가 보장)
  readBookIds: number[];
  canToggle: boolean;
  toggleAction?: ToggleReadAction;
}

export function BookGrid({ books, readBookIds, canToggle, toggleAction }: BookGridProps) {
  const [level, setLevel] = useState("all");
  const [genre, setGenre] = useState("all");
  const [genre2, setGenre2] = useState("all");
  const [lexMin, setLexMin] = useState("");
  const [lexMax, setLexMax] = useState("");
  const [query, setQuery] = useState("");
  const [readFilter, setReadFilter] = useState<"all" | "read" | "unread">("all");
  const [, startTransition] = useTransition();

  const [optimisticRead, setOptimisticRead] = useOptimistic(
    useMemo(() => new Set(readBookIds), [readBookIds]),
    (prev, action: { bookId: number; read: boolean }) => {
      const next = new Set(prev);
      if (action.read) next.add(action.bookId);
      else next.delete(action.bookId);
      return next;
    },
  );

  // books 가 level_order 순이라 레벨 목록도 자동으로 aa→Z2 순
  const levels = useMemo(() => [...new Set(books.map((b) => b.level))], [books]);
  const genre2List = useMemo(
    () => [...new Set(books.map((b) => b.genre2).filter((g): g is string => g != null))].sort(),
    [books],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = lexMin === "" ? null : Number(lexMin);
    const max = lexMax === "" ? null : Number(lexMax);
    return books.filter((b) => {
      if (level !== "all" && b.level !== level) return false;
      if (genre !== "all" && b.genre !== genre) return false;
      if (genre2 !== "all" && b.genre2 !== genre2) return false;
      if (min != null && (b.lexile_num == null || b.lexile_num < min)) return false;
      if (max != null && (b.lexile_num == null || b.lexile_num > max)) return false;
      if (q && !b.title.toLowerCase().includes(q)) return false;
      if (readFilter === "read" && !optimisticRead.has(b.id)) return false;
      if (readFilter === "unread" && optimisticRead.has(b.id)) return false;
      return true;
    });
  }, [books, level, genre, genre2, lexMin, lexMax, query, readFilter, optimisticRead]);

  function handleToggle(book: RazBook) {
    if (!canToggle || !toggleAction) return;
    const next = !optimisticRead.has(book.id);
    startTransition(async () => {
      setOptimisticRead({ bookId: book.id, read: next });
      const result = await toggleAction(book.id, next);
      if (result?.error) toast.error(result.error);
      // 실패 시 useOptimistic 이 서버 상태(revalidate 결과)로 자동 복원
    });
  }

  if (books.length === 0) {
    return <p className="py-20 text-center text-sm text-muted-foreground">책 데이터가 없습니다.</p>;
  }

  return (
    <div className="space-y-4">
      {/* 진행률 요약 */}
      <p className="text-sm text-slate-600">
        읽음 <span className="font-semibold text-slate-800">{optimisticRead.size}</span> / {books.length}권
        ({Math.round((optimisticRead.size / books.length) * 100)}%)
      </p>

      {/* 필터 — 전부 클라이언트 메모리 처리 */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="제목 검색"
          className="h-9 w-48 rounded-md border border-slate-200 px-3"
        />
        <select value={level} onChange={(e) => setLevel(e.target.value)} className="h-9 rounded-md border border-slate-200 px-2">
          <option value="all">레벨 전체</option>
          {levels.map((lv) => <option key={lv} value={lv}>{lv}</option>)}
        </select>
        <select value={genre} onChange={(e) => setGenre(e.target.value)} className="h-9 rounded-md border border-slate-200 px-2">
          <option value="all">장르 전체</option>
          <option value="Fiction">Fiction</option>
          <option value="Nonfiction">Nonfiction</option>
        </select>
        <select value={genre2} onChange={(e) => setGenre2(e.target.value)} className="h-9 rounded-md border border-slate-200 px-2">
          <option value="all">세부장르 전체</option>
          {genre2List.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <span className="flex items-center gap-1">
          Lexile
          <input type="number" value={lexMin} onChange={(e) => setLexMin(e.target.value)} placeholder="min" className="h-9 w-20 rounded-md border border-slate-200 px-2" />
          ~
          <input type="number" value={lexMax} onChange={(e) => setLexMax(e.target.value)} placeholder="max" className="h-9 w-20 rounded-md border border-slate-200 px-2" />
        </span>
        <select value={readFilter} onChange={(e) => setReadFilter(e.target.value as typeof readFilter)} className="h-9 rounded-md border border-slate-200 px-2">
          <option value="all">전체</option>
          <option value="read">읽은 책만</option>
          <option value="unread">안 읽은 책만</option>
        </select>
        <span className="text-xs text-muted-foreground">{filtered.length}권</span>
      </div>

      {/* 목록 — content-visibility 로 오프스크린 렌더 비용 절감 (가상화 라이브러리 불필요) */}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {filtered.map((book) => {
          const read = optimisticRead.has(book.id);
          return (
            <li
              key={book.id}
              className="rounded-lg border border-slate-200 bg-white p-2 [content-visibility:auto] [contain-intrinsic-size:auto_240px]"
            >
              <button
                type="button"
                onClick={() => handleToggle(book)}
                disabled={!canToggle}
                className="block w-full text-left disabled:cursor-default"
                aria-pressed={read}
              >
                <div className="relative">
                  {/* Supabase Storage 이미지 — next/image 미사용 (원격 최적화 불필요, 190px 원본) */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={razCoverUrl(book.id)}
                    alt={book.title}
                    loading="lazy"
                    className="aspect-[3/4] w-full rounded object-cover bg-slate-100"
                    onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
                  />
                  {read && (
                    <span className="absolute right-1 top-1 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      ✓ 읽음
                    </span>
                  )}
                </div>
                <p className="mt-1.5 line-clamp-2 text-xs font-medium text-slate-800">{book.title}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {book.level}{book.lexile ? ` · ${book.lexile}` : ""}{book.genre ? ` · ${book.genre}` : ""}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: ReadingDashboard 작성**

```tsx
// src/components/reading/ReadingDashboard.tsx
import Link from "next/link";
import type { ClassReadingStats } from "@/lib/raz/stats";

interface ReadingDashboardProps {
  stats: ClassReadingStats[];
  hrefBase: string; // "/academy/teacher/reading" | "/admin/reading"
}

export function ReadingDashboard({ stats, hrefBase }: ReadingDashboardProps) {
  if (stats.length === 0) {
    return <p className="py-20 text-center text-sm text-muted-foreground">표시할 반이 없습니다.</p>;
  }
  return (
    <div className="space-y-6">
      {stats.map((c) => (
        <section key={c.classId} className="rounded-lg border border-slate-200 bg-white">
          <h2 className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800">
            {c.className}
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">학생</th>
                <th className="px-4 py-2 font-medium">읽은 권수</th>
                <th className="px-4 py-2 font-medium">최고 레벨</th>
                <th className="px-4 py-2 font-medium">레벨 분포</th>
              </tr>
            </thead>
            <tbody>
              {c.students.map((s) => (
                <tr key={s.studentId} className="border-t border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`${hrefBase}/${s.studentId}`} className="font-medium text-blue-600 hover:underline">
                      {s.koreanName ?? s.englishName ?? "이름 없음"}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{s.readCount}권</td>
                  <td className="px-4 py-2">{s.topLevel ?? "—"}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {Object.entries(s.levelCounts).map(([lv, n]) => `${lv}(${n})`).join(" ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: 검증**

Run: `pnpm type-check && pnpm lint`
Expected: 통과. (페이지 연결 전이라 렌더 확인은 Task 7에서)

- [ ] **Step 4: Commit**

```bash
git add src/components/reading/
git commit -m "feat(raz): BookGrid·ReadingDashboard 공용 컴포넌트"
```

---

### Task 7: academy server action + 학생 페이지 + StudentNav

**Files:**
- Modify: `src/app/academy/actions.ts` (액션 3개 추가)
- Create: `src/app/academy/student/reading/page.tsx`
- Modify: `src/app/academy/student/_components/StudentNav.tsx` (메뉴 1개 추가)

**Interfaces:**
- Consumes: `getRazBooks`, `BookGrid`, 기존 `getCurrentStudentProfile`, `hasUserRole`
- Produces (Task 8도 사용): `getReadBookIds(studentId): Promise<number[]>`, `toggleRazRead(studentId, bookId, read): Promise<{ error?: string }>`, `getStudentNameForStaff(studentId): Promise<{ korean_name: string | null; english_name: string | null } | null>`

- [ ] **Step 1: actions.ts에 액션 추가**

파일 끝에 추가. 상단 import에 `revalidatePath`(from `next/cache`)와 `fetchAllRows`(from `@/lib/supabase/fetch-all`)를 추가.

```ts
// --- Raz 리딩 ---

/** 대상 학생의 읽은 book_id 목록. 본인 또는 teacher 만. (읽은 책이 1,000권 넘을 수 있어 페이지네이션) */
export async function getReadBookIds(studentId: string): Promise<number[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  if (user.id !== studentId) {
    const isTeacher = await hasUserRole(supabase, user.id, "teacher");
    if (!isTeacher) return [];
  }
  const rows = await fetchAllRows<{ book_id: number }>((from, to) =>
    supabase.from("raz_read_logs").select("book_id").eq("student_id", studentId).range(from, to),
  );
  return rows.map((r) => r.book_id);
}

/** 읽음 토글. 본인 또는 teacher. user-context client 사용 — RLS 가 이중 방어선. */
export async function toggleRazRead(
  studentId: string,
  bookId: number,
  read: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "인증이 필요합니다." };
  if (user.id !== studentId) {
    const isTeacher = await hasUserRole(supabase, user.id, "teacher");
    if (!isTeacher) return { error: "권한이 없습니다." };
  }

  if (read) {
    // 이미 있으면 무시 (update 정책이 없으므로 DO NOTHING 이어야 함)
    const { error } = await supabase
      .from("raz_read_logs")
      .upsert({ student_id: studentId, book_id: bookId, marked_by: user.id }, { ignoreDuplicates: true });
    if (error) return { error: "저장에 실패했습니다." };
  } else {
    const { error } = await supabase
      .from("raz_read_logs")
      .delete()
      .eq("student_id", studentId)
      .eq("book_id", bookId);
    if (error) return { error: "삭제에 실패했습니다." };
  }

  revalidatePath("/academy/student/reading");
  revalidatePath(`/academy/teacher/reading/${studentId}`);
  revalidatePath(`/admin/reading/${studentId}`);
  return {};
}

/** 교사 화면 헤더용 학생 이름. teacher 만. */
export async function getStudentNameForStaff(
  studentId: string,
): Promise<{ korean_name: string | null; english_name: string | null } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const isTeacher = await hasUserRole(supabase, user.id, "teacher");
  if (!isTeacher) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("students")
    .select("korean_name, english_name")
    .eq("id", studentId)
    .single();
  return data ?? null;
}
```

- [ ] **Step 2: 학생 페이지 작성**

```tsx
// src/app/academy/student/reading/page.tsx
import { redirect } from "next/navigation";
import { getCurrentStudentProfile, getReadBookIds, toggleRazRead } from "../../actions";
import { getRazBooks } from "@/lib/raz/books.server";
import { BookGrid } from "@/components/reading/BookGrid";

export default async function StudentReadingPage() {
  const profile = await getCurrentStudentProfile();
  if (!profile) redirect("/login");

  const [books, readBookIds] = await Promise.all([getRazBooks(), getReadBookIds(profile.id)]);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-800">Raz 리딩</h1>
      <BookGrid
        books={books}
        readBookIds={readBookIds}
        canToggle
        toggleAction={toggleRazRead.bind(null, profile.id)}
      />
    </div>
  );
}
```

- [ ] **Step 3: StudentNav 메뉴 추가**

`links` 배열의 "숙제" 항목 뒤에 추가:

```tsx
{
  href: "/academy/student/reading",
  label: "Raz 리딩",
  activeColor: "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md",
  icon: (
    <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
  ),
},
```

- [ ] **Step 4: 검증**

Run: `pnpm type-check && pnpm lint`, 이어서 `pnpm dev` 후 학생 계정으로 `/academy/student/reading` 접속.
Expected: 2,572권 목록·표지 lazy 로드, 필터 즉각 반응, 토글 시 즉시 ✓ 표시 + 새로고침 후 유지.

- [ ] **Step 5: Commit**

```bash
git add src/app/academy/actions.ts src/app/academy/student/reading/ src/app/academy/student/_components/StudentNav.tsx
git commit -m "feat(raz): 학생 리딩 페이지 + 읽음 토글 액션"
```

---

### Task 8: 교사 대시보드 + 학생별 화면 + TeacherNav

**Files:**
- Modify: `src/app/academy/actions.ts` (`getTeacherReadingStats` 추가)
- Create: `src/app/academy/teacher/reading/page.tsx`
- Create: `src/app/academy/teacher/reading/[studentId]/page.tsx`
- Modify: `src/app/academy/teacher/_components/TeacherNav.tsx` (koreanLinks·nativeLinks에 메뉴 추가)

**Interfaces:**
- Consumes: Task 5의 `aggregateReadingStats`·`getRazBooks`·`fetchAllRows`, Task 6의 `ReadingDashboard`·`BookGrid`, Task 7의 `getReadBookIds`·`toggleRazRead`·`getStudentNameForStaff`, 기존 `getTeacherClasses`·`getCurrentTeacherProfile`
- Produces: `getTeacherReadingStats(): Promise<ClassReadingStats[]>`

- [ ] **Step 1: actions.ts에 통계 액션 추가**

상단 import에 `aggregateReadingStats`와 타입(from `@/lib/raz/stats`), `getRazBooks`(from `@/lib/raz/books.server`)를 추가.

```ts
/** 교사 본인 담당 반들의 학생별 읽기 통계. (권한은 getTeacherClasses 가 담당) */
export async function getTeacherReadingStats(): Promise<ClassReadingStats[]> {
  const classes = await getTeacherClasses();
  if (!classes.length) return [];

  const classShapes = classes.map((c) => ({
    id: c.id,
    name: c.name,
    students: c.students
      .filter((s) => s.profile_id !== "")
      .map((s) => ({ id: s.profile_id, koreanName: s.korean_name, englishName: s.english_name })),
  }));
  const studentIds = [...new Set(classShapes.flatMap((c) => c.students.map((s) => s.id)))];
  if (!studentIds.length) return classShapes.map((c) => ({ classId: c.id, className: c.name, students: [] }));

  const admin = createAdminClient();
  const logs = await fetchAllRows<{ student_id: string; book_id: number }>((from, to) =>
    admin.from("raz_read_logs").select("student_id, book_id").in("student_id", studentIds).range(from, to),
  );
  const books = await getRazBooks();
  return aggregateReadingStats(classShapes, logs, books);
}
```

- [ ] **Step 2: 대시보드 페이지 작성**

```tsx
// src/app/academy/teacher/reading/page.tsx
import { redirect } from "next/navigation";
import { getCurrentTeacherProfile, getTeacherReadingStats } from "../../actions";
import { ReadingDashboard } from "@/components/reading/ReadingDashboard";

export default async function TeacherReadingPage() {
  const profile = await getCurrentTeacherProfile();
  if (!profile) redirect("/dashboard");

  const stats = await getTeacherReadingStats();

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-800">Raz 리딩</h1>
      <ReadingDashboard stats={stats} hrefBase="/academy/teacher/reading" />
    </div>
  );
}
```

- [ ] **Step 3: 학생별 화면 작성**

```tsx
// src/app/academy/teacher/reading/[studentId]/page.tsx
import { redirect, notFound } from "next/navigation";
import {
  getCurrentTeacherProfile,
  getReadBookIds,
  getStudentNameForStaff,
  toggleRazRead,
} from "../../../actions";
import { getRazBooks } from "@/lib/raz/books.server";
import { BookGrid } from "@/components/reading/BookGrid";

export default async function TeacherReadingStudentPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const profile = await getCurrentTeacherProfile();
  if (!profile) redirect("/dashboard");

  const [student, books, readBookIds] = await Promise.all([
    getStudentNameForStaff(studentId),
    getRazBooks(),
    getReadBookIds(studentId),
  ]);
  if (!student) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-800">
        Raz 리딩 — {student.korean_name ?? student.english_name ?? "학생"}
      </h1>
      <BookGrid
        books={books}
        readBookIds={readBookIds}
        canToggle
        toggleAction={toggleRazRead.bind(null, studentId)}
      />
    </div>
  );
}
```

- [ ] **Step 4: TeacherNav 메뉴 추가**

`ICONS.textbooks`(책 아이콘) 재사용. `koreanLinks`의 "숙제" 항목 뒤에:

```tsx
{
  href: "/academy/teacher/reading",
  label: "Raz 리딩",
  activeColor: "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md",
  icon: ICONS.textbooks,
},
```

`nativeLinks`의 "Homework" 항목 뒤에:

```tsx
{
  href: "/academy/teacher/reading",
  label: "Raz Reading",
  activeColor: "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md",
  icon: ICONS.textbooks,
},
```

- [ ] **Step 5: 검증**

Run: `pnpm type-check && pnpm lint`, `pnpm dev` 후 교사 계정으로 `/academy/teacher/reading` 접속.
Expected: 담당 반·학생별 권수/최고레벨/분포 표시 → 학생 클릭 → 목록에서 토글 동작. 학생 계정으로 재접속 시 교사가 체크한 책이 반영돼 있음.

- [ ] **Step 6: Commit**

```bash
git add src/app/academy/actions.ts src/app/academy/teacher/reading/ src/app/academy/teacher/_components/TeacherNav.tsx
git commit -m "feat(raz): 교사 리딩 대시보드 + 학생별 체크 화면"
```

---

### Task 9: admin 액션 + 페이지 + admin-nav

**Files:**
- Create: `src/app/(admin)/admin/actions/raz-actions.ts`
- Create: `src/app/(admin)/admin/reading/page.tsx`
- Create: `src/app/(admin)/admin/reading/[studentId]/page.tsx`
- Modify: `src/lib/navigation/admin-nav.ts` ("수업" 그룹에 항목 추가)

**Interfaces:**
- Consumes: `verifyAdmin`(`./auth-helpers`), Task 5·6의 유틸/컴포넌트
- Produces: `getAllReadingStats()`, `getReadBookIdsAsAdmin(studentId)`, `getStudentNameAsAdmin(studentId)`, `toggleRazReadAsAdmin(studentId, bookId, read)`

- [ ] **Step 1: raz-actions.ts 작성**

```ts
// src/app/(admin)/admin/actions/raz-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { verifyAdmin } from "./auth-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getRazBooks } from "@/lib/raz/books.server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { aggregateReadingStats, type ClassReadingStats } from "@/lib/raz/stats";

/** 전체 활성 반의 학생별 읽기 통계 */
export async function getAllReadingStats(): Promise<ClassReadingStats[]> {
  const auth = await verifyAdmin();
  if ("error" in auth) return [];

  const admin = createAdminClient();
  const { data: classes } = await admin
    .from("classes")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  if (!classes?.length) return [];

  const { data: members } = await admin
    .from("class_students")
    .select("class_id, student_id")
    .eq("is_active", true)
    .in("class_id", classes.map((c) => c.id));

  const studentIds = [...new Set((members ?? []).map((m) => m.student_id))];
  const { data: students } = studentIds.length
    ? await admin.from("students").select("id, korean_name, english_name").in("id", studentIds)
    : { data: [] };
  const studentMap = new Map((students ?? []).map((s) => [s.id, s]));

  const logs = studentIds.length
    ? await fetchAllRows<{ student_id: string; book_id: number }>((from, to) =>
        admin.from("raz_read_logs").select("student_id, book_id").in("student_id", studentIds).range(from, to),
      )
    : [];
  const books = await getRazBooks();

  const classShapes = classes.map((c) => ({
    id: c.id,
    name: c.name,
    students: (members ?? [])
      .filter((m) => m.class_id === c.id)
      .map((m) => {
        const s = studentMap.get(m.student_id);
        return {
          id: m.student_id,
          koreanName: s?.korean_name ?? null,
          englishName: s?.english_name ?? null,
        };
      }),
  }));
  return aggregateReadingStats(classShapes, logs, books);
}

/** admin 학생 상세용: 읽은 book_id 목록 */
export async function getReadBookIdsAsAdmin(studentId: string): Promise<number[]> {
  const auth = await verifyAdmin();
  if ("error" in auth) return [];
  const admin = createAdminClient();
  const rows = await fetchAllRows<{ book_id: number }>((from, to) =>
    admin.from("raz_read_logs").select("book_id").eq("student_id", studentId).range(from, to),
  );
  return rows.map((r) => r.book_id);
}

/** admin 학생 상세용: 학생 이름 */
export async function getStudentNameAsAdmin(
  studentId: string,
): Promise<{ korean_name: string | null; english_name: string | null } | null> {
  const auth = await verifyAdmin();
  if ("error" in auth) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("students")
    .select("korean_name, english_name")
    .eq("id", studentId)
    .single();
  return data ?? null;
}

/** admin 읽음 토글. user-context client 사용 — RLS admin 정책 통과 (이중 방어). */
export async function toggleRazReadAsAdmin(
  studentId: string,
  bookId: number,
  read: boolean,
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const supabase = await createClient();
  if (read) {
    const { error } = await supabase
      .from("raz_read_logs")
      .upsert({ student_id: studentId, book_id: bookId, marked_by: auth.userId }, { ignoreDuplicates: true });
    if (error) return { error: "저장에 실패했습니다." };
  } else {
    const { error } = await supabase
      .from("raz_read_logs")
      .delete()
      .eq("student_id", studentId)
      .eq("book_id", bookId);
    if (error) return { error: "삭제에 실패했습니다." };
  }

  revalidatePath("/admin/reading");
  revalidatePath(`/admin/reading/${studentId}`);
  revalidatePath("/academy/student/reading");
  revalidatePath(`/academy/teacher/reading/${studentId}`);
  return {};
}
```

- [ ] **Step 2: admin 페이지 2개 작성**

```tsx
// src/app/(admin)/admin/reading/page.tsx
import { getAllReadingStats } from "../actions/raz-actions";
import { ReadingDashboard } from "@/components/reading/ReadingDashboard";

export default async function AdminReadingPage() {
  const stats = await getAllReadingStats();

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-800">Raz 리딩</h1>
      <ReadingDashboard stats={stats} hrefBase="/admin/reading" />
    </div>
  );
}
```

```tsx
// src/app/(admin)/admin/reading/[studentId]/page.tsx
import { notFound } from "next/navigation";
import {
  getReadBookIdsAsAdmin,
  getStudentNameAsAdmin,
  toggleRazReadAsAdmin,
} from "../../actions/raz-actions";
import { getRazBooks } from "@/lib/raz/books.server";
import { BookGrid } from "@/components/reading/BookGrid";

export default async function AdminReadingStudentPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;

  const [student, books, readBookIds] = await Promise.all([
    getStudentNameAsAdmin(studentId),
    getRazBooks(),
    getReadBookIdsAsAdmin(studentId),
  ]);
  if (!student) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-800">
        Raz 리딩 — {student.korean_name ?? student.english_name ?? "학생"}
      </h1>
      <BookGrid
        books={books}
        readBookIds={readBookIds}
        canToggle
        toggleAction={toggleRazReadAsAdmin.bind(null, studentId)}
      />
    </div>
  );
}
```

주의: 인접 admin 페이지(예: `src/app/(admin)/admin/reports/page.tsx`)의 레이아웃/래퍼 관행을 확인하고 동일하게 맞출 것 (페이지 자체 인증은 (admin) 레이아웃이 담당).

- [ ] **Step 3: admin-nav 항목 추가**

`ADMIN_NAV_GROUPS`의 "수업" 그룹, "숙제" 뒤에:

```ts
{ href: "/admin/reading", label: "Raz 리딩", icon: "book" },
```

- [ ] **Step 4: 검증**

Run: `pnpm type-check && pnpm lint`, `pnpm dev` 후 admin 계정으로 `/admin/reading` 접속.
Expected: 전체 반 통계 → 학생 클릭 → 토글 동작.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(admin)/admin/actions/raz-actions.ts" "src/app/(admin)/admin/reading/" src/lib/navigation/admin-nav.ts
git commit -m "feat(raz): 관리자 리딩 대시보드 + 학생별 체크"
```

---

### Task 10: 최종 검증

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 자동 검증**

Run: `pnpm lint && pnpm type-check && pnpm test && pnpm check:admin-imports && pnpm build`
Expected: 전부 통과.

- [ ] **Step 2: 수동 체크리스트**

`pnpm dev`에서:
1. 학생 계정: `/academy/student/reading` — 목록·필터 즉각 반응, 본인 토글, 새로고침 후 유지, 진행률 표시.
2. 학생 계정: 브라우저 콘솔에서 타 학생 read_logs 조회 시도(`supabase.from("raz_read_logs").select().neq("student_id", 본인id)`) → 0행 (RLS 확인). 또는 SQL로 학생 세션 role 시뮬레이션.
3. 교사 계정: `/academy/teacher/reading` — 담당 반 통계, 학생 상세에서 대신 토글 → 학생 화면에 반영.
4. admin 계정: `/admin/reading` — 전체 반 통계 + 토글.
5. 표지 없는 책(있다면) 카드가 깨지지 않고 제목으로 표시.
6. 모바일 폭(375px)에서 그리드 2열, 필터 줄바꿈 정상.

- [ ] **Step 3: 이상 없으면 완료 보고**

superpowers:verification-before-completion 체크 후 사용자에게 결과 보고.
