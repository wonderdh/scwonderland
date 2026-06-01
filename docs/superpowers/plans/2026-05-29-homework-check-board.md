# 숙제 검사 보드 (시리즈·레벨) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 반(class)으로 진입을 강제하던 숙제 검사를, 물리적 책 더미와 동일한 "시리즈 → 레벨 → (반 무관) 영어이름 학생 리스트 → 전체 유닛 그리드" 흐름의 보드로 바꾼다(기존 반 단위 체크는 보조로 유지).

**Architecture:** 신규 read 액션 `listSeriesLevelProgress(seriesId, level?)` 하나만 추가하고(시리즈·레벨 칩 데이터·저장은 기존 `listSeries`/`listLevelsBySeries`/`bulkMarkUnits` 재사용), 보드 UI는 데이터·편집 상태를 담는 `useHomeworkBoard` 훅 + 표현 컴포넌트(`BoardStudentList`)로 구성한다. 셀 렌더링은 기존 `UnitProgressGrid`를 그대로 재사용한다. 모바일은 아코디언, PC는 2-pane을 Tailwind 반응형으로 분기한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Supabase(admin client), sonner(toast). 테스트 프레임워크 없음 → 각 태스크 검증 = `pnpm type-check` + `pnpm lint` + 수동 시나리오.

**검증 기준 표기:** 이 계획의 "테스트"는 (a) `pnpm type-check` exit 0, (b) `pnpm lint` exit 0, (c) `pnpm dev` 로 띄워 명시된 수동 시나리오 확인이다. 새 테스트 러너는 도입하지 않는다(사용자 결정).

**참고한 기존 파일(읽고 패턴 맞출 것):**
- `src/app/(admin)/admin/actions/homework-unit-actions.ts` — `listClassUnitProgressDetailed`(106–345), `bulkMarkUnits`(579–678), `getAbsentStudentIds`(681–700). 신규 액션은 `listClassUnitProgressDetailed` 구조를 cross-class 로 확장한 것.
- `src/lib/utils/homework-schedule.ts` — `getUnitSchedule`, `isValidGradingDate`.
- `src/components/homework/UnitProgressGrid.tsx` — 셀 그리드(재사용). `UnitGridTextbook`/`UnitGridUnit` 타입.
- `src/components/homework/ClassUnitProgressList.tsx` — 펜딩/저장 상태 머신(46–147). `useHomeworkBoard` 가 이 로직을 본뜬다.
- `src/app/(admin)/m/homework/_components/MobileHomeworkClient.tsx` — `handleSaveUnits`(263–305), 칩 UI 패턴.
- `src/app/(admin)/admin/actions.ts` — barrel(신규 export 추가 위치).

**프로젝트 규칙(필수 준수):**
- `src/app/(admin)/admin/actions/AGENTS.md`: mutation 첫 줄 `verifyAdmin`/`verifyTeacherOrAdmin`. read 액션은 `verifyAuthenticated` 또는 `verifyTeacherOrAdmin`. 파일 1개 = 도메인 1개. 컴포넌트/클라이언트 import 금지.
- FK 컨벤션: 학생=`students(id)`, 교사=`teachers(id)`. 이 작업은 새 테이블/FK 없음(read 전용 + 기존 mutation).

---

## Task 1: 신규 read 액션 `listSeriesLevelProgress` + 타입

**Files:**
- Modify: `src/app/(admin)/admin/actions/homework-unit-actions.ts` (타입은 24–70 근처에 추가, 함수는 `listClassUnitProgressDetailed` 바로 뒤 345행 이후에 추가)
- Modify: `src/app/(admin)/admin/actions.ts:242-258` (barrel export 추가)

- [ ] **Step 1: 반환 타입 추가**

`homework-unit-actions.ts` 의 `ClassUnitProgressDetailed` 타입(64–70) 정의 **바로 아래**에 다음을 추가:

```ts
/** 보드(시리즈·레벨)용 학생 1명 + 그 시리즈·레벨에 해당하는 책들. */
export type BoardStudent = {
  id: string;                 // students.id (= profiles.id)
  korean_name: string | null;
  english_name: string | null;
  className: string;          // 영어이름 중복 구분용. 여러 반이면 " · " 로 join.
};

export type SeriesLevelProgress = {
  students: BoardStudent[];   // english_name 가나다(알파벳)순 정렬
  byStudent: Record<string, StudentTextbookUnits[]>;
  error?: string;
};
```

- [ ] **Step 2: 함수 구현**

`listClassUnitProgressDetailed` 함수(345행 끝, `}` 다음)에 이어서 추가. `listClassUnitProgressDetailed` 의 책-스케줄·progress 조립 로직을 cross-class 로 일반화한 것이다. 핵심 차이: ① 시작점이 `homework_books`(series+level) → `class_homework_books`(여러 반), ② meetDays 를 반별 맵으로 계산(`listUnitProgressByStudent` 의 `meetDaysByClass` 패턴, 384–403행 참고), ③ 학생에 `className` 부여 + english_name 정렬.

```ts
export async function listSeriesLevelProgress(
  seriesId: string,
  level?: string
): Promise<SeriesLevelProgress> {
  const auth = await verifyTeacherOrAdmin();
  if ("error" in auth) return { students: [], byStudent: {}, error: auth.error };

  const supabase = createAdminClient();

  // 1. series + (선택) level 에 해당하는 homework_books id 들
  let hbQuery = supabase
    .from("homework_books")
    .select("id, level, series_rel:series_id(name, total_units, cover_image_url)")
    .eq("series_id", seriesId);
  if (level !== undefined) hbQuery = hbQuery.eq("level", level);
  const { data: hbRows, error: hbErr } = await hbQuery;
  if (hbErr) {
    logger.error("[listSeriesLevelProgress hb]", hbErr.message);
    return { students: [], byStudent: {}, error: hbErr.message };
  }
  const homeworkBookIds = (hbRows ?? []).map((r) => r.id as string);
  if (homeworkBookIds.length === 0) return { students: [], byStudent: {} };

  // 2. 이 책들이 부여된 모든 반의 class_homework_books
  const { data: chbRows, error: chbErr } = await supabase
    .from("class_homework_books")
    .select(
      "id, class_id, textbook_id, start_date, homework_days, skip_dates, start_unit, classes!inner(name), homework_books!inner(title, level, series_rel:series_id(name, total_units, cover_image_url))"
    )
    .in("textbook_id", homeworkBookIds);
  if (chbErr) {
    logger.error("[listSeriesLevelProgress chb]", chbErr.message);
    return { students: [], byStudent: {}, error: chbErr.message };
  }

  type BookMeta = {
    chbId: string;
    classId: string;
    className: string;
    title: string;
    series_name: string | null;
    level: string | null;
    cover_image_url: string | null;
    total_units: number;
    start_date: string | null;
    homework_days: number[];
    skip_dates: string[];
    start_unit: number;
  };
  const books: BookMeta[] = (chbRows ?? []).map((row) => {
    const hb = Array.isArray(row.homework_books) ? row.homework_books[0] : row.homework_books;
    const seriesRel = hb?.series_rel
      ? Array.isArray(hb.series_rel) ? hb.series_rel[0] : hb.series_rel
      : null;
    const cls = Array.isArray(row.classes) ? row.classes[0] : row.classes;
    const days = Array.from(
      new Set(((row.homework_days as number[] | null | undefined) ?? []) as number[])
    ).sort((a, b) => a - b);
    const skips = Array.from(
      new Set(((row.skip_dates as string[] | null | undefined) ?? []) as string[])
    ).sort();
    return {
      chbId: row.id as string,
      classId: row.class_id as string,
      className: (cls as { name?: string } | null)?.name ?? "",
      title: hb?.title ?? "",
      series_name: seriesRel?.name ?? null,
      level: hb?.level ?? null,
      cover_image_url: seriesRel?.cover_image_url ?? null,
      total_units: seriesRel?.total_units ?? 0,
      start_date: (row.start_date as string | null) ?? null,
      homework_days: days,
      skip_dates: skips,
      start_unit: (row.start_unit as number | null) ?? 1,
    };
  });
  if (books.length === 0) return { students: [], byStudent: {} };

  // 3. 반별 등원일(meetDays) 맵 (채점일 계산용) — listUnitProgressByStudent 패턴
  const classIds = Array.from(new Set(books.map((b) => b.classId)));
  const meetDaysByClass = new Map<string, number[]>();
  {
    const { data: scheduleRows, error: scheduleErr } = await supabase
      .from("class_schedules")
      .select("class_id, day_of_week")
      .in("class_id", classIds);
    if (scheduleErr) logger.error("[listSeriesLevelProgress schedules]", scheduleErr.message);
    for (const r of scheduleRows ?? []) {
      const cid = r.class_id as string;
      const arr = meetDaysByClass.get(cid) ?? [];
      arr.push(r.day_of_week as number);
      meetDaysByClass.set(cid, arr);
    }
    for (const [k, v] of meetDaysByClass) {
      meetDaysByClass.set(k, Array.from(new Set(v)).sort((a, b) => a - b));
    }
  }

  const closedDates = await getClosedDates(supabase);

  // 4. 책별 unit→채점일 맵 (listClassUnitProgressDetailed 226–257 와 동일, meetDays 만 반별)
  const expectedByBook = new Map<string, Map<number, string>>();
  for (const b of books) {
    const meetDays = meetDaysByClass.get(b.classId) ?? [];
    if (!b.start_date || b.homework_days.length === 0 || meetDays.length === 0 || b.total_units <= 0)
      continue;
    const gv = isValidGradingDate(b.start_date, meetDays, closedDates, b.skip_dates);
    if (!gv.ok) {
      logger.warn(
        "[listSeriesLevelProgress]",
        `invalid grading date chb=${b.chbId} date=${b.start_date} reason=${gv.reason}`
      );
      continue;
    }
    const schedule = getUnitSchedule({
      startDate: b.start_date,
      startUnit: b.start_unit,
      totalUnits: b.total_units,
      homeworkDays: b.homework_days,
      meetDays,
      skipDates: Array.from(new Set([...b.skip_dates, ...closedDates])),
    });
    const m = new Map<number, string>();
    for (const s of schedule) m.set(s.unit, s.date);
    expectedByBook.set(b.chbId, m);
  }

  // 5. 이 책들의 student_homework_books + 학생 + progress
  const chbIds = books.map((b) => b.chbId);
  const { data: shbRows, error: shbErr } = await supabase
    .from("student_homework_books")
    .select(
      "id, class_homework_book_id, class_students!inner(student_id, students!inner(id, korean_name, english_name)), student_homework_progress(unit_number, status)"
    )
    .in("class_homework_book_id", chbIds);
  if (shbErr) {
    logger.error("[listSeriesLevelProgress shb]", shbErr.message);
    return { students: [], byStudent: {}, error: shbErr.message };
  }

  const bookByChb = new Map(books.map((b) => [b.chbId, b]));
  const studentMeta = new Map<string, BoardStudent>();
  const classNamesByStudent = new Map<string, Set<string>>();
  const byStudent: Record<string, StudentTextbookUnits[]> = {};

  for (const shb of shbRows ?? []) {
    const chbId = shb.class_homework_book_id as string;
    const b = bookByChb.get(chbId);
    if (!b) continue;
    const cs = Array.isArray(shb.class_students) ? shb.class_students[0] : shb.class_students;
    const stu = cs?.students
      ? Array.isArray(cs.students) ? cs.students[0] : cs.students
      : null;
    const studentId = (stu as { id?: string } | null)?.id;
    if (!studentId) continue;

    if (!studentMeta.has(studentId)) {
      studentMeta.set(studentId, {
        id: studentId,
        korean_name: (stu as { korean_name?: string | null }).korean_name ?? null,
        english_name: (stu as { english_name?: string | null }).english_name ?? null,
        className: "",
      });
    }
    const cn = classNamesByStudent.get(studentId) ?? new Set<string>();
    if (b.className) cn.add(b.className);
    classNamesByStudent.set(studentId, cn);

    // progress map
    const statusByUnit = new Map<number, UnitStatus>();
    const progress = Array.isArray(shb.student_homework_progress)
      ? shb.student_homework_progress
      : shb.student_homework_progress
        ? [shb.student_homework_progress]
        : [];
    for (const p of progress) {
      const status = (p as { status: string }).status;
      const unit = (p as { unit_number: number }).unit_number;
      if (typeof unit === "number" && isUnitStatus(status)) statusByUnit.set(unit, status);
    }

    const exp = expectedByBook.get(chbId);
    const hasSchedule =
      !!b.start_date && b.homework_days.length > 0 && (meetDaysByClass.get(b.classId)?.length ?? 0) > 0;
    const units = Array.from({ length: Math.max(0, b.total_units) }, (_, i) => {
      const unitNumber = i + 1;
      return {
        unitNumber,
        status: statusByUnit.get(unitNumber) ?? ("pending" as UnitStatus),
        expectedDate: exp?.get(unitNumber) ?? null,
        completedAt: null,
        note: null,
      };
    });

    const tbEntry: StudentTextbookUnits = {
      id: b.chbId,
      title: b.title,
      series_name: b.series_name,
      level: b.level,
      cover_image_url: b.cover_image_url,
      total_units: b.total_units,
      source: "class",
      hasSchedule,
      homeworkDays: b.homework_days,
      units,
    };
    (byStudent[studentId] ??= []).push(tbEntry);
  }

  // 6. className 합치기 + english_name 정렬
  for (const [studentId, meta] of studentMeta) {
    meta.className = Array.from(classNamesByStudent.get(studentId) ?? []).sort().join(" · ");
  }
  const students = Array.from(studentMeta.values()).sort((a, b) => {
    const ae = (a.english_name ?? "").toLowerCase();
    const be = (b.english_name ?? "").toLowerCase();
    if (ae && be && ae !== be) return ae.localeCompare(be);
    if (ae !== be) return ae ? -1 : 1; // 영어이름 있는 쪽 먼저
    return (a.korean_name ?? "").localeCompare(b.korean_name ?? "", "ko");
  });

  return { students, byStudent };
}
```

- [ ] **Step 3: barrel export 추가**

`src/app/(admin)/admin/actions.ts` 의 homework-unit-actions export 블록(242–250)에 `listSeriesLevelProgress` 를, 타입 블록(252–258)에 `SeriesLevelProgress`, `BoardStudent` 를 추가:

```ts
export {
  listUnitProgressByStudent,
  listUnitProgressByClass,
  listClassUnitProgressDetailed,
  listSeriesLevelProgress,
  markUnit,
  bulkMarkUnits,
  clearUnit,
  getAbsentStudentIds,
} from "./actions/homework-unit-actions";

export type {
  UnitStatus,
  StudentTextbookUnits,
  StudentUnitProgressData,
  ClassUnitOverview,
  ClassUnitProgressDetailed,
  BoardStudent,
  SeriesLevelProgress,
} from "./actions/homework-unit-actions";
```

- [ ] **Step 4: 검증**

Run: `pnpm type-check`
Expected: exit 0, 에러 없음.

Run: `pnpm lint`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(admin)/admin/actions/homework-unit-actions.ts" "src/app/(admin)/admin/actions.ts"
git commit -m "feat(homework): 시리즈·레벨 cross-class 진도 조회 액션 추가"
```

---

## Task 2: 보드 상태 훅 `useHomeworkBoard`

데이터 로드 + 시리즈/레벨/검색/선택 학생 상태 + 낙관적 편집 + 저장을 한 곳에 둔다. `ClassUnitProgressList`(46–147)의 펜딩맵·저장 그룹화와, `MobileHomeworkClient.handleSaveUnits`(263–305)의 저장·낙관적 갱신을 본뜬다.

**Files:**
- Create: `src/components/homework/useHomeworkBoard.ts`

- [ ] **Step 1: 훅 작성**

```ts
"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  listSeriesLevelProgress,
  bulkMarkUnits,
  getAbsentStudentIds,
} from "@/app/(admin)/admin/actions";
import type {
  BoardStudent,
  StudentTextbookUnits,
  UnitStatus,
  SeriesLevelProgress,
} from "@/app/(admin)/admin/actions";

const NEXT_STATUS: Record<UnitStatus, UnitStatus> = {
  pending: "completed",
  completed: "missed",
  missed: "pending",
};

/** key = `${studentId}:${textbookId}:${unitNumber}` */
type PendingKey = string;

export type UseHomeworkBoard = {
  seriesId: string | null;
  level: string | null;
  search: string;
  students: BoardStudent[];
  byStudent: Record<string, StudentTextbookUnits[]>;
  filteredStudents: BoardStudent[];
  absentStudentIds: ReadonlySet<string>;
  pendingCount: number;
  isLoading: boolean;
  isSaving: boolean;
  selectStpoint: (seriesId: string | null, level: string | null) => void;
  setSearch: (q: string) => void;
  unitClick: (studentId: string, textbookId: string, unitNumber: number) => void;
  dirtyNumbers: (studentId: string, textbookId: string) => Set<number>;
  save: () => Promise<void>;
  cancel: () => void;
};

export function useHomeworkBoard(todayKst: string): UseHomeworkBoard {
  const [seriesId, setSeriesId] = useState<string | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [data, setData] = useState<SeriesLevelProgress>({ students: [], byStudent: {} });
  const [local, setLocal] = useState<Record<string, StudentTextbookUnits[]>>({});
  const [pending, setPending] = useState<Map<PendingKey, UnitStatus>>(new Map());
  const [absentStudentIds, setAbsent] = useState<ReadonlySet<string>>(new Set());
  const [isLoading, startLoad] = useTransition();
  const [isSaving, setIsSaving] = useState(false);

  // 시리즈/레벨 바뀌면 데이터 재로드 + 편집상태 초기화
  useEffect(() => {
    if (!seriesId) {
      setData({ students: [], byStudent: {} });
      setLocal({});
      setPending(new Map());
      return;
    }
    startLoad(async () => {
      const [next, absentResult] = await Promise.all([
        listSeriesLevelProgress(seriesId, level ?? undefined),
        getAbsentStudentIds(todayKst),
      ]);
      if (next.error) toast.error(next.error);
      setData(next);
      setLocal(next.byStudent);
      setPending(new Map());
      setAbsent(new Set(absentResult.studentIds));
    });
  }, [seriesId, level, todayKst]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.students;
    return data.students.filter((s) => {
      const hay = `${s.english_name ?? ""} ${s.korean_name ?? ""} ${s.className}`.toLowerCase();
      return hay.includes(q);
    });
  }, [data.students, search]);

  const selectStpoint = useCallback((sid: string | null, lv: string | null) => {
    setSeriesId(sid);
    setLevel(lv);
    setSearch("");
  }, []);

  const unitClick = useCallback(
    (studentId: string, textbookId: string, unitNumber: number) => {
      if (absentStudentIds.has(studentId)) {
        toast.warning("결석 학생입니다. 저장 시 자동 제외됩니다.");
      }
      setLocal((prev) => {
        const list = prev[studentId];
        if (!list) return prev;
        const cur = list.find((t) => t.id === textbookId)?.units.find((u) => u.unitNumber === unitNumber);
        if (!cur) return prev;
        const nextStatus = NEXT_STATUS[cur.status];
        // pending map 갱신
        setPending((pm) => {
          const nm = new Map(pm);
          const key = `${studentId}:${textbookId}:${unitNumber}`;
          const original = data.byStudent[studentId]
            ?.find((t) => t.id === textbookId)
            ?.units.find((u) => u.unitNumber === unitNumber);
          if (original && original.status === nextStatus) nm.delete(key);
          else nm.set(key, nextStatus);
          return nm;
        });
        return {
          ...prev,
          [studentId]: list.map((t) =>
            t.id !== textbookId
              ? t
              : {
                  ...t,
                  units: t.units.map((u) =>
                    u.unitNumber !== unitNumber ? u : { ...u, status: nextStatus }
                  ),
                }
          ),
        };
      });
    },
    [absentStudentIds, data.byStudent]
  );

  const dirtyNumbers = useCallback(
    (studentId: string, textbookId: string) =>
      new Set(
        [...pending.keys()]
          .filter((k) => k.startsWith(`${studentId}:${textbookId}:`))
          .map((k) => Number(k.split(":")[2]))
      ),
    [pending]
  );

  const cancel = useCallback(() => {
    setLocal(data.byStudent);
    setPending(new Map());
  }, [data.byStudent]);

  const save = useCallback(async () => {
    if (pending.size === 0 || isSaving) return;
    const records: { studentId: string; textbookId: string; unitNumber: number; status: UnitStatus }[] = [];
    for (const [key, status] of pending) {
      const i1 = key.indexOf(":");
      const i2 = key.indexOf(":", i1 + 1);
      records.push({
        studentId: key.slice(0, i1),
        textbookId: key.slice(i1 + 1, i2),
        unitNumber: Number(key.slice(i2 + 1)),
        status,
      });
    }
    setIsSaving(true);
    try {
      const result = await bulkMarkUnits(records, { excludeAbsentOn: todayKst });
      if (result.error) {
        toast.error(result.error);
        setLocal(data.byStudent); // 롤백
        return;
      }
      const parts = [`저장 ${result.saved}건`];
      if (result.skippedAbsent > 0) parts.push(`결석자 ${result.skippedAbsent}건 제외`);
      toast.success(parts.join(" · "));
      // 저장 성공분을 baseline 에 반영
      setData((prev) => ({ ...prev, byStudent: local }));
      setPending(new Map());
    } finally {
      setIsSaving(false);
    }
  }, [pending, isSaving, todayKst, data.byStudent, local]);

  return {
    seriesId,
    level,
    search,
    students: data.students,
    byStudent: local,
    filteredStudents,
    absentStudentIds,
    pendingCount: pending.size,
    isLoading,
    isSaving,
    selectStpoint,
    setSearch,
    unitClick,
    dirtyNumbers,
    save,
    cancel,
  };
}
```

> 주: 위에서 `selectStpoint` 는 오타가 아니라 "select start point(시리즈·레벨 시작점 선택)"의 축약이다. 헷갈리면 `selectScope` 로 바꾸되 Task 4 의 호출부도 함께 바꿀 것. (한 군데서만 정의·사용하므로 일관만 유지하면 됨.)

- [ ] **Step 2: 검증**

Run: `pnpm type-check` — Expected: exit 0.
Run: `pnpm lint` — Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/homework/useHomeworkBoard.ts
git commit -m "feat(homework): 보드 상태 훅 useHomeworkBoard"
```

---

## Task 3: 학생 리스트/그리드 컴포넌트 `BoardStudentList`

선택된 시리즈·레벨의 학생들을 영어이름 카드로 보여주고, 펼치면 `UnitProgressGrid` 로 전체 유닛을 체크한다. 모바일=아코디언, PC=2-pane 은 Task 4 에서 분기하므로 여기서는 **재사용 가능한 표현 단위**(학생 카드 1개 + 그 학생의 그리드들)를 만든다.

**Files:**
- Create: `src/components/homework/BoardStudentList.tsx`

- [ ] **Step 1: 보조 함수 — 오늘치 유닛/진도 요약**

먼저 같은 파일 상단에 순수 헬퍼를 둔다(테스트 용이성 위해 export):

```ts
"use client";

import { useState } from "react";
import { UnitProgressGrid } from "@/components/homework/UnitProgressGrid";
import { todayKst } from "@/lib/utils/date-kst";
import type { BoardStudent, StudentTextbookUnits, UnitStatus } from "@/app/(admin)/admin/actions";

/** 학생의 책들에서 오늘(todayKst) 채점 예정 유닛 번호 1개(가장 이른 책 기준). 없으면 null. */
export function deriveTodayUnit(books: StudentTextbookUnits[], today: string): number | null {
  for (const b of books) {
    const hit = b.units.find((u) => u.expectedDate === today && u.status === "pending");
    if (hit) return hit.unitNumber;
  }
  return null;
}

/** 학생의 책들 합산 완료/전체 유닛 수. */
export function deriveProgress(books: StudentTextbookUnits[]): { completed: number; total: number } {
  let completed = 0;
  let total = 0;
  for (const b of books) {
    total += b.total_units;
    completed += b.units.filter((u) => u.status === "completed").length;
  }
  return { completed, total };
}
```

- [ ] **Step 2: 카드 컴포넌트**

이어서 같은 파일에:

```ts
type CardProps = {
  student: BoardStudent;
  books: StudentTextbookUnits[];
  isAbsent: boolean;
  expanded: boolean;
  onToggle: () => void;
  editable: boolean;
  onUnitClick: (textbookId: string, unitNumber: number) => void;
  dirtyNumbers: (textbookId: string) => Set<number>;
};

export function BoardStudentCard({
  student,
  books,
  isAbsent,
  expanded,
  onToggle,
  editable,
  onUnitClick,
  dirtyNumbers,
}: CardProps) {
  const today = todayKst();
  const todayUnit = deriveTodayUnit(books, today);
  const { completed, total } = deriveProgress(books);
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const displayName = student.english_name ?? student.korean_name ?? student.id.slice(0, 6);

  return (
    <section
      className={`rounded-xl border shadow-sm overflow-hidden ${isAbsent ? "border-slate-200 bg-slate-100/70" : "border-slate-200 bg-white"}`}
    >
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isAbsent ? "bg-slate-100 hover:bg-slate-150" : "bg-slate-50/60 hover:bg-slate-100"}`}
      >
        <span className={`text-slate-500 transition-transform shrink-0 ${expanded ? "rotate-90" : ""}`}>▶</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-semibold truncate ${isAbsent ? "text-slate-500" : "text-slate-900"}`}>
              {displayName}
            </p>
            {student.korean_name && student.english_name && (
              <span className="text-xs font-normal text-slate-400 truncate">{student.korean_name}</span>
            )}
            <span className="text-[11px] text-slate-400 shrink-0">· {student.className}</span>
            {isAbsent && (
              <span className="inline-flex items-center rounded-full bg-slate-300 px-2 py-0.5 text-[11px] font-semibold text-slate-600 shrink-0">
                결석
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[11px] font-medium text-amber-700 shrink-0">
              {todayUnit !== null ? `오늘 U${todayUnit}` : "오늘 없음"}
            </span>
            <span className="h-1.5 flex-1 max-w-[120px] rounded-full bg-slate-200 overflow-hidden">
              <span className="block h-full bg-emerald-500" style={{ width: `${pct}%` }} />
            </span>
            <span className="text-[11px] text-slate-500 tabular-nums shrink-0">{completed}/{total}</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="p-3 space-y-3">
          {books.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400">부여된 책이 없습니다.</p>
          ) : (
            books.map((tb) => (
              <UnitProgressGrid
                key={tb.id}
                textbook={tb}
                units={tb.units}
                editable={editable && !isAbsent}
                dirtyNumbers={dirtyNumbers(tb.id)}
                onUnitClick={
                  editable && !isAbsent ? (unitNumber) => onUnitClick(tb.id, unitNumber) : undefined
                }
              />
            ))
          )}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: 검증**

Run: `pnpm type-check` — Expected: exit 0. (`UnitStatus` import 가 unused 면 제거.)
Run: `pnpm lint` — Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/homework/BoardStudentList.tsx
git commit -m "feat(homework): 보드 학생 카드/그리드 컴포넌트"
```

---

## Task 4: 보드 본체 `HomeworkBoard` (시리즈·레벨 칩 + 검색 + 모바일 아코디언 / PC 2-pane)

**Files:**
- Create: `src/components/homework/HomeworkBoard.tsx`

- [ ] **Step 1: props + 칩 데이터 타입**

칩 데이터는 페이지에서 prefetch 해 내려준다(서버액션 `listSeries` + `listLevelsBySeries` 결과를 가공). 보드는 그걸 받아 표시만 한다.

```ts
"use client";

import { useState } from "react";
import { useHomeworkBoard } from "@/components/homework/useHomeworkBoard";
import { BoardStudentCard } from "@/components/homework/BoardStudentList";

export type BoardSeriesOption = { id: string; name: string };
export type BoardLevelsBySeries = Record<string, string[]>; // seriesId → distinct levels (sorted)

type Props = {
  seriesOptions: BoardSeriesOption[];
  levelsBySeries: BoardLevelsBySeries;
  todayKst: string;
};

export function HomeworkBoard({ seriesOptions, levelsBySeries, todayKst }: Props) {
  const board = useHomeworkBoard(todayKst);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null); // PC 2-pane 용

  const levels = board.seriesId ? levelsBySeries[board.seriesId] ?? [] : [];

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
```

- [ ] **Step 2: 칩 + 검색 헤더 (공통)**

```tsx
  const Chips = (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-xs font-semibold text-slate-500 w-12">시리즈</span>
        {seriesOptions.map((s) => {
          const active = board.seriesId === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => board.selectStpoint(active ? null : s.id, null)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-white text-slate-700 border-slate-200 hover:border-primary/50 hover:text-primary"
              }`}
            >
              {s.name || "(이름 없음)"}
            </button>
          );
        })}
      </div>
      {board.seriesId && levels.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="shrink-0 text-xs font-semibold text-slate-500 w-12">레벨</span>
          {levels.map((lv) => {
            const active = board.level === lv;
            return (
              <button
                key={lv}
                type="button"
                onClick={() => board.selectStpoint(board.seriesId, active ? null : lv)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-white text-slate-700 border-slate-200 hover:border-primary/50 hover:text-primary"
                }`}
              >
                {lv}
              </button>
            );
          })}
        </div>
      )}
      <input
        type="search"
        value={board.search}
        onChange={(e) => board.setSearch(e.target.value)}
        placeholder="영어이름 / 한글이름 / 반 검색"
        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-slate-400"
      />
    </div>
  );

  const SaveBar = board.pendingCount > 0 && (
    <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 shadow-lg">
      <span className="text-sm text-orange-700 font-medium">{board.pendingCount}건 변경됨 (미저장)</span>
      <div className="flex gap-2">
        <button type="button" onClick={board.cancel} disabled={board.isSaving}
          className="px-4 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100 border border-slate-200 bg-white disabled:opacity-50">취소</button>
        <button type="button" onClick={board.save} disabled={board.isSaving}
          className="px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-primary hover:bg-primary/90 border border-primary disabled:opacity-50">
          {board.isSaving ? "저장 중…" : "저장"}</button>
      </div>
    </div>
  );
```

- [ ] **Step 3: 빈 상태 + 모바일 아코디언 + PC 2-pane 렌더**

```tsx
  const emptyHint = !board.seriesId
    ? "시리즈를 선택하세요."
    : board.isLoading
      ? "불러오는 중…"
      : board.filteredStudents.length === 0
        ? "해당 시리즈·레벨에 학생이 없습니다."
        : null;

  return (
    <div className="space-y-4">
      {Chips}

      {emptyHint ? (
        <div className="rounded-xl border bg-card py-12 text-center">
          <p className="text-sm text-muted-foreground">{emptyHint}</p>
        </div>
      ) : (
        <>
          {/* 모바일: 아코디언 */}
          <div className="space-y-3 lg:hidden">
            {board.filteredStudents.map((s) => (
              <BoardStudentCard
                key={s.id}
                student={s}
                books={board.byStudent[s.id] ?? []}
                isAbsent={board.absentStudentIds.has(s.id)}
                expanded={expanded.has(s.id)}
                onToggle={() => toggleExpand(s.id)}
                editable
                onUnitClick={(tbId, unit) => board.unitClick(s.id, tbId, unit)}
                dirtyNumbers={(tbId) => board.dirtyNumbers(s.id, tbId)}
              />
            ))}
          </div>

          {/* PC: 2-pane (좌 리스트 / 우 선택 학생 그리드) */}
          <div className="hidden lg:grid lg:grid-cols-[320px_1fr] lg:gap-4">
            <div className="space-y-1.5 max-h-[70vh] overflow-y-auto pr-1">
              {board.filteredStudents.map((s) => {
                const sel = selectedStudentId === s.id;
                const isAbsent = board.absentStudentIds.has(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedStudentId(s.id)}
                    className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                      sel ? "border-primary bg-primary/5" : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-sm font-semibold text-slate-900">
                      {s.english_name ?? s.korean_name ?? s.id.slice(0, 6)}
                    </span>
                    <span className="ml-1.5 text-[11px] text-slate-400">
                      {s.korean_name && s.english_name ? `${s.korean_name} · ` : ""}{s.className}
                    </span>
                    {isAbsent && <span className="ml-1.5 text-[11px] text-slate-400">(결석)</span>}
                  </button>
                );
              })}
            </div>
            <div className="min-w-0">
              {selectedStudentId && board.byStudent[selectedStudentId] ? (
                <BoardStudentCard
                  student={board.filteredStudents.find((s) => s.id === selectedStudentId)!}
                  books={board.byStudent[selectedStudentId] ?? []}
                  isAbsent={board.absentStudentIds.has(selectedStudentId)}
                  expanded
                  onToggle={() => {}}
                  editable
                  onUnitClick={(tbId, unit) => board.unitClick(selectedStudentId, tbId, unit)}
                  dirtyNumbers={(tbId) => board.dirtyNumbers(selectedStudentId, tbId)}
                />
              ) : (
                <div className="rounded-xl border bg-card py-12 text-center">
                  <p className="text-sm text-muted-foreground">왼쪽에서 학생을 선택하세요.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {SaveBar}
    </div>
  );
}
```

- [ ] **Step 4: 검증**

Run: `pnpm type-check` — Expected: exit 0.
Run: `pnpm lint` — Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/homework/HomeworkBoard.tsx
git commit -m "feat(homework): 보드 본체(칩+검색+모바일 아코디언/PC 2-pane)"
```

---

## Task 5: 모바일 `m/homework` 에 보드 = 기본, 반 방식 = 보조

**Files:**
- Modify: `src/app/(admin)/m/homework/page.tsx`
- Modify: `src/app/(admin)/m/homework/_components/MobileHomeworkClient.tsx` (상단에 모드 토글 + 보드 렌더)

- [ ] **Step 1: page.tsx 에서 보드 칩 데이터 prefetch**

`page.tsx` import 에 `listSeries`, `listLevelsBySeries` 추가하고, `Promise.all` 에 끼워 넣은 뒤 가공해 클라이언트로 전달.

```ts
import {
  listClassesForHomeworkPicker,
  listClassUnitProgressDetailed,
  listTeachersForSelect,
  listTextbooks,
  getAbsentStudentIds,
  listSeries,
  listLevelsBySeries,
} from "@/app/(admin)/admin/actions";
```

`Promise.all` 블록(18–22)을 다음으로 교체:

```ts
  const [classOptions, teachers, allTextbooks, seriesList, levelsRaw] = await Promise.all([
    listClassesForHomeworkPicker(),
    listTeachersForSelect(),
    listTextbooks(),
    listSeries({ activeOnly: true }),
    listLevelsBySeries(),
  ]);

  const seriesOptions = seriesList.map((s) => ({ id: s.id, name: s.name }));
  const levelsBySeries: Record<string, string[]> = {};
  for (const [sid, rows] of Object.entries(levelsRaw)) {
    const set = new Set<string>();
    for (const r of rows) if (r.level) set.add(r.level);
    levelsBySeries[sid] = [...set].sort((a, b) => a.localeCompare(b, "ko", { numeric: true }));
  }
```

그리고 `<MobileHomeworkClient ... />` 에 props 추가:

```tsx
        <MobileHomeworkClient
          classes={classOptions}
          initialClassId={initialClassId}
          initialData={initialData}
          teachers={teachers}
          allTextbooks={allTextbooks}
          initialAbsentStudentIds={absentResult.studentIds}
          todayKst={today}
          seriesOptions={seriesOptions}
          levelsBySeries={levelsBySeries}
        />
```

- [ ] **Step 2: MobileHomeworkClient 에 모드 토글 + 보드**

import 추가:

```ts
import { HomeworkBoard } from "@/components/homework/HomeworkBoard";
import type { BoardSeriesOption, BoardLevelsBySeries } from "@/components/homework/HomeworkBoard";
```

`Props` 타입(49–57)에 추가:

```ts
  seriesOptions: BoardSeriesOption[];
  levelsBySeries: BoardLevelsBySeries;
```

함수 시그니처 구조분해(59–67)에 `seriesOptions, levelsBySeries` 추가. 컴포넌트 본문 최상단(`const router = ...` 위)에 모드 상태:

```ts
  const [mode, setMode] = useState<"board" | "class">("board");
```

`return (` 직후 최상단에 토글 + 분기. 기존 `<div className="space-y-4"> ... </div>` 전체를 다음으로 감싼다:

```tsx
  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("board")}
          className={`flex-1 rounded-md px-3 py-1.5 font-medium transition-colors ${mode === "board" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}
        >
          시리즈·레벨
        </button>
        <button
          type="button"
          onClick={() => setMode("class")}
          className={`flex-1 rounded-md px-3 py-1.5 font-medium transition-colors ${mode === "class" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}
        >
          반별
        </button>
      </div>

      {mode === "board" ? (
        <HomeworkBoard seriesOptions={seriesOptions} levelsBySeries={levelsBySeries} todayKst={todayKst} />
      ) : (
        <>
          {/* ↓↓↓ 기존 반별 UI (검색/필터/반 pill + ClassUnitProgressList) 그대로 ↓↓↓ */}
          {/* 기존 318–584 의 내부 JSX 를 여기로 이동 */}
        </>
      )}
    </div>
  );
```

> 구현 시: 기존 `return (<div className="space-y-4"> ... </div>)`(318–585)의 **내부 자식들**을 위 `mode === "class"` 분기의 `<>...</>` 안으로 그대로 옮긴다. 로직/상태/핸들러는 손대지 않는다(프로젝트 규칙: 기능 축소 금지).

- [ ] **Step 3: 검증**

Run: `pnpm type-check` — Expected: exit 0.
Run: `pnpm lint` — Expected: exit 0.

Run: `pnpm dev` 후 모바일 폭(또는 devtools 모바일)에서 `http://localhost:3000/m/homework`:
- 기본이 "시리즈·레벨" 탭. 시리즈 칩 클릭 → 레벨 칩 노출 → 학생들이 영어이름순으로 표시.
- 검색에 영어이름 일부 입력 → 후보가 한글이름·반과 함께 좁혀짐.
- 학생 펼침 → 오늘치 유닛 amber 강조 + 셀 탭 → 하단 저장바 → 저장 → toast. 새로고침 후 유지.
- "반별" 탭 → 기존 화면 그대로 동작.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(admin)/m/homework/page.tsx" "src/app/(admin)/m/homework/_components/MobileHomeworkClient.tsx"
git commit -m "feat(homework): 모바일 숙제 화면에 시리즈·레벨 보드(기본) 추가"
```

---

## Task 6: PC `admin/homework` 에 보드 탭(기본) 추가

**Files:**
- Modify: `src/app/(admin)/admin/homework/page.tsx`
- Modify: `src/app/(admin)/admin/homework/_components/TextbooksPageClient.tsx`

- [ ] **Step 1: page.tsx — 보드 칩 데이터는 이미 로드됨**

`page.tsx` 는 이미 `listAllSeries()` + `listLevelsBySeries()` 를 로드한다(`allSeriesList`, `levelsBySeries`). 단 `listAllSeries` 는 `verifyAdmin` 전용이므로 교사 접근 시 빈 배열이 된다. PC `/admin` 은 admin 전용 라우트이므로 그대로 사용 가능. 보드용 가공 데이터를 만들어 `TextbooksPageClient` 로 전달:

`return` 직전에 추가:

```ts
  const boardSeriesOptions = allSeriesList
    .filter((s) => s.is_active)
    .map((s) => ({ id: s.id, name: s.name }));
  const boardLevelsBySeries: Record<string, string[]> = {};
  for (const [sid, rows] of Object.entries(levelsBySeries)) {
    const set = new Set<string>();
    for (const r of rows) if (r.level) set.add(r.level);
    boardLevelsBySeries[sid] = [...set].sort((a, b) => a.localeCompare(b, "ko", { numeric: true }));
  }
```

`<TextbooksPageClient ... />` 에 props 추가:

```tsx
          boardSeriesOptions={boardSeriesOptions}
          boardLevelsBySeries={boardLevelsBySeries}
          todayKst={today}
```

(이미 `todayKst={today}` 가 없으면 추가. 기존엔 `initialAbsentStudentIds`/`todayKst` 전달 중 — 91행 확인 후 중복 없게.)

- [ ] **Step 2: TextbooksPageClient — "보드" 탭 추가 + 기본 탭화**

`TextbooksPageClient.tsx` 를 열어 탭 정의/상태를 확인한다(현재 탭: `textbooks`, `class`). 다음을 수행:

1. import 추가:
```ts
import { HomeworkBoard } from "@/components/homework/HomeworkBoard";
import type { BoardSeriesOption, BoardLevelsBySeries } from "@/components/homework/HomeworkBoard";
```
2. Props 타입에 추가:
```ts
  boardSeriesOptions: BoardSeriesOption[];
  boardLevelsBySeries: BoardLevelsBySeries;
  todayKst: string;
```
3. 탭 목록에 맨 앞 `board` 추가하고 초기 탭 기본값을 `board` 로. (탭이 문자열 유니온/배열로 정의돼 있으면 거기에 `"board"` 와 라벨 "시리즈·레벨" 추가. 기존 `textbooks`/`class` 라벨·순서는 유지.)
4. 탭 컨텐츠 렌더에 분기 추가:
```tsx
{activeTab === "board" && (
  <HomeworkBoard
    seriesOptions={boardSeriesOptions}
    levelsBySeries={boardLevelsBySeries}
    todayKst={todayKst}
  />
)}
```

> 기존 `textbooks`/`class` 탭 렌더는 손대지 않는다. URL `?tab=` 기본값만 `board` 로(page.tsx 23–30 의 `rawTab` 기본값 `"textbooks"` → 그대로 두고, TextbooksPageClient 내부 초기 activeTab 만 board 로 해도 됨. 둘 중 탭 상태의 single source 를 따라 한 곳만 바꿀 것).

- [ ] **Step 3: 검증**

Run: `pnpm type-check` — Expected: exit 0.
Run: `pnpm lint` — Expected: exit 0.

Run: `pnpm dev` 후 PC 폭에서 `http://localhost:3000/admin/homework`:
- 기본 탭이 "시리즈·레벨". 시리즈→레벨 선택 → 좌측 학생 리스트(영어이름순) + 우측 그리드.
- 좌측 학생 선택 → 우측에 전체 그리드, 셀 탭 → 저장바 → 저장 → toast.
- 검색으로 영어이름 좁히기 동작.
- "교재"·"반별" 기존 탭 정상 동작.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(admin)/admin/homework/page.tsx" "src/app/(admin)/admin/homework/_components/TextbooksPageClient.tsx"
git commit -m "feat(homework): PC 숙제 관리에 시리즈·레벨 보드 탭(기본) 추가"
```

---

## Task 7: 통합 검증 + 마무리

**Files:** (없음 — 검증/정리)

- [ ] **Step 1: 전체 타입체크 + 린트**

Run: `pnpm type-check` — Expected: exit 0.
Run: `pnpm lint` — Expected: exit 0.

- [ ] **Step 2: 수동 시나리오 (스펙 §9)**

`pnpm dev` 로 아래 5개 확인:
1. 시리즈→레벨 선택 시 **여러 반** 학생이 영어이름순으로 섞여 나온다(같은 시리즈·레벨을 다른 반이 하는 경우 한 화면에).
2. 영어이름 검색 → 중복 이름이 한글·반과 함께 구분되어 좁혀진다.
3. 학생 펼침 → 오늘치 유닛 amber 강조 → 셀 탭 저장 → **새로고침 후 유지**.
4. 결석자: 회색+결석뱃지, 완료 표시 시 경고 토스트, 저장 시 결석자 제외 카운트 노출.
5. 모바일(`/m/homework`)·PC(`/admin/homework`) 모두 동일 데이터로 동작.

- [ ] **Step 3: 스펙과 대조(자기점검)**

`docs/superpowers/specs/2026-05-29-homework-check-board-design.md` 의 §3·§4·§5·§7 각 항목이 구현됐는지 체크. 누락 시 보강 태스크 추가.

- [ ] **Step 4: 최종 커밋(있으면) + 브랜치 정리**

```bash
git status   # 미커밋 없는지 확인
git log --oneline main..HEAD   # 이 기능의 커밋들 검토
```

PR 은 사용자 요청 시에만 생성한다.

---

## 자기검토 메모 (작성자)

- **스펙 커버리지**: §3 진입(보드 기본+반 보조)=Task5·6 / §4 데이터·쿼리=Task1(신규 액션은 `listSeriesLevelProgress` 하나, 칩 데이터는 기존 `listSeries`+`listLevelsBySeries` 재사용 — 스펙의 신규 `listSeriesLevels` 제안은 기존 동명 액션이 이미 존재하여 대체) / §5 인터랙션=Task3·4 / §6 컴포넌트=Task2·3·4 / §7 엣지(영어이름 없음 fallback, 중복=한글·반 병기, 다권=byStudent 배열, todayUnit null="오늘 없음", 결석)=Task1·3·4 / §8 에러(롤백·toast)=Task2 / §9 테스트(수동)=Task5·6·7.
- **타입 일관성**: `BoardStudent`/`SeriesLevelProgress`(Task1) ↔ `useHomeworkBoard`(Task2) ↔ `BoardStudentCard`(Task3) ↔ `HomeworkBoard`(Task4) ↔ 페이지(Task5·6) 시그니처 일치 확인함. `selectStpoint` 명칭은 훅 정의·Task4 호출부 두 곳만 사용.
- **플레이스홀더**: 코드 블록 모두 실제 코드. 단 Task5 Step2 "기존 JSX 이동", Task6 Step2 "탭 정의 위치"는 기존 파일 구조 의존 → 구현 시 해당 파일을 열어 single-source 확인 후 적용(파일을 안 읽고는 정확한 라인 고정 불가하여 명시적 지시로 대체).
