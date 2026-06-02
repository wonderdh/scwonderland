# /admin/today 학생 검색 + 인라인 진도 표시 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/admin/today` 페이지에 학생 이름(한/영) 검색 필터를 추가하고, 숙제 모드에서 학생마다 반복되던 표지·시리즈명·레벨 헤더를 제거해 클릭 가능한 unit 그리드를 학생 이름 옆에 인라인으로 배치한다.

**Architecture:** 변경은 전부 클라이언트 측. 검색은 `useTodayClassEditor` 훅의 `filteredClasses` 에 이미 들어오는 `studentNames` 를 substring 매칭하는 필터 한 줄로 처리(서버 쿼리 추가 없음). 표시 변경은 공용 `UnitProgressGrid` 에 비파괴적 `hideHeader` prop 을 추가하고, `StudentRow` 숙제 모드의 레이아웃만 재구성한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4. **테스트 러너 없음** → 검증 게이트는 `pnpm type-check`, `pnpm lint`, 수동 브라우저 확인.

---

## 확정된 요구사항 (브레인스토밍 결과)

1. **학생 이름 검색** — 필터 바에 이름 검색 입력 추가. 한글·영어 모두 substring 매칭(대소문자 무시).
   - 검색은 **현재 필터(구분·요일·시간대) 범위 안에서만** 동작 (전체 무시 아님).
   - 매칭된 반을 추려 보여주기만 함. **자동 펼침·학생 강조 안 함.**
2. **숙제 모드 학생 행 재구성** — 학생마다 들어가던 `UnitProgressGrid` 헤더(표지 이미지·시리즈명·레벨)를 **제거**.
   - 클릭 가능한 unit 그리드 **자체를 학생 이름 옆(같은 행)에 인라인** 배치.
   - 이름 옆에 `완료 N/total` 진도 카운트를 작게 유지 (헤더에 있던 완료 수가 사라지므로).
   - unit 수가 많으면 이름 오른쪽 영역에서 자연스럽게 줄바꿈(wrap). 셀 클릭 토글 동작은 그대로.

## 비파괴 제약 (반드시 지킬 것)

- `UnitProgressGrid` 는 `BoardStudentList`, `ClassUnitProgressList`, `app/academy/student/homework/page.tsx`, `StudentRow` 4곳에서 쓰인다. 새 prop 은 **optional + 기본값이 기존 동작** 이어야 한다.
- `TodayPageClient` / `StudentRow` / `ClassCard` / `useTodayClassEditor` 는 데스크탑 `/admin/today` 와 모바일 `/m/today` 가 **공유**한다. 변경은 양쪽에 반영되며, 양쪽 모두 수동 확인 대상이다.
- 출결(attendance) 모드 렌더는 건드리지 않는다 — 숙제(homework) 모드 분기만 변경.

## File Structure

- Modify: `src/app/(admin)/admin/today/_hooks/useTodayClassEditor.ts` — 검색 상태 + `filteredClasses` 필터 추가, `search`/`setSearch` export.
- Modify: `src/app/(admin)/admin/today/_components/TodayPageClient.tsx` — 필터 바에 검색 입력, 빈 상태 메시지 검색 대응.
- Modify: `src/components/homework/UnitProgressGrid.tsx` — optional `hideHeader` prop (기본 false → 기존 동작 유지).
- Modify: `src/app/(admin)/admin/today/_components/StudentRow.tsx` — 숙제 모드 레이아웃을 `[이름+진도] | [인라인 그리드]` 로 재구성.

---

## Task 1: 검색 상태를 `useTodayClassEditor` 훅에 추가

**Files:**
- Modify: `src/app/(admin)/admin/today/_hooks/useTodayClassEditor.ts`

훅에 `search` 상태를 추가하고, `filteredClasses` 의 기존 group/day/period 필터에 이름 매칭을 한 단계 더 얹는다. 검색은 현재 필터 결과 안에서만 적용된다.

- [ ] **Step 1: 검색 상태 추가**

`useTodayClassEditor.ts` 의 기존 필터 상태 선언부(현재 line 94-97)를 찾는다:

```ts
  const [group, setGroup] = useState<GroupFilter>("오후반");
  const [day, setDay] = useState<number>(todayDow);
  const [periodId, setPeriodId] = useState<string>(defaultPeriodId);
  const [date, setDate] = useState<string>(todayKst);
```

바로 아래에 검색 상태를 추가한다:

```ts
  const [group, setGroup] = useState<GroupFilter>("오후반");
  const [day, setDay] = useState<number>(todayDow);
  const [periodId, setPeriodId] = useState<string>(defaultPeriodId);
  const [date, setDate] = useState<string>(todayKst);
  // 학생 이름 검색어 (한/영 substring, 대소문자 무시). 현재 필터 결과 안에서만 적용.
  const [search, setSearch] = useState<string>("");
```

- [ ] **Step 2: `filteredClasses` 에 이름 매칭 추가**

기존 `filteredClasses` useMemo(현재 line 99-107):

```ts
  const filteredClasses = useMemo(() => {
    const wantType = GROUP_TO_TYPE[group];
    return classes.filter((c) => {
      if (c.groupType !== wantType) return false;
      if (!c.daysOfWeek.includes(day)) return false;
      if (periodId !== "" && c.periodId !== periodId) return false;
      return true;
    });
  }, [classes, group, day, periodId]);
```

을 아래로 교체한다 (검색 조건 + deps 에 `search` 추가):

```ts
  const filteredClasses = useMemo(() => {
    const wantType = GROUP_TO_TYPE[group];
    const q = search.trim().toLowerCase();
    return classes.filter((c) => {
      if (c.groupType !== wantType) return false;
      if (!c.daysOfWeek.includes(day)) return false;
      if (periodId !== "" && c.periodId !== periodId) return false;
      // 이름 검색: 반의 학생 중 한글/영문 이름이 검색어를 포함하면 통과.
      if (q) {
        const hit = c.studentNames.some(
          (s) =>
            (s.ko ?? "").toLowerCase().includes(q) ||
            (s.en ?? "").toLowerCase().includes(q)
        );
        if (!hit) return false;
      }
      return true;
    });
  }, [classes, group, day, periodId, search]);
```

- [ ] **Step 3: `search` / `setSearch` 를 훅 반환값에 추가**

훅 반환 객체의 필터 섹션(현재 line 382-394 의 `// 필터` 블록)에서 `setDate,` 다음 줄에 추가한다:

```ts
    date,
    setDate,
    search,
    setSearch,
    availablePeriods,
```

- [ ] **Step 4: 타입 체크**

Run: `pnpm type-check`
Expected: 통과 (PASS, 에러 0). `TodayClassEditor` 타입에 `search`/`setSearch` 가 자동 포함된다.

- [ ] **Step 5: 커밋**

```bash
git add src/app/\(admin\)/admin/today/_hooks/useTodayClassEditor.ts
git commit -m "feat(today): add student-name search state to editor hook

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: 필터 바에 학생 이름 검색 입력 추가

**Files:**
- Modify: `src/app/(admin)/admin/today/_components/TodayPageClient.tsx`

필터 바(시간대 select 다음, 날짜 입력 앞)에 검색 입력을 추가하고, 결과가 0개일 때 메시지를 검색 상황에 맞게 바꾼다.

- [ ] **Step 1: 검색 입력 추가**

`TodayPageClient.tsx` 의 시간대 select 블록 닫힘(현재 line 161 의 `</div>`)과 날짜 블록(현재 line 163 `{/* 날짜 */}`) 사이에 검색 입력 블록을 끼워 넣는다. 시간대 블록은 이렇게 끝난다:

```tsx
            <select
              value={editor.periodId}
              onChange={(e) => editor.setPeriodId(e.target.value)}
              className="h-8 rounded border border-slate-200 bg-white px-2 text-xs"
            >
              <option value="">전체</option>
              {editor.availablePeriods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {p.id === editor.defaultPeriodId ? " · 첫 수업" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* 날짜 */}
```

`</div>` 와 `{/* 날짜 */}` 사이에 다음을 삽입한다:

```tsx
          </div>

          {/* 학생 이름 검색 */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">학생</span>
            <input
              type="search"
              value={editor.search}
              onChange={(e) => editor.setSearch(e.target.value)}
              placeholder="이름 검색 (한/영)"
              className="h-8 w-40 rounded border border-slate-200 bg-white px-2 text-xs"
            />
          </div>

          {/* 날짜 */}
```

- [ ] **Step 2: 빈 상태 메시지를 검색 상황에 맞게 변경**

현재 빈 상태(line 202-205):

```tsx
      {classes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-400">
          선택한 조건에 수업이 있는 반이 없습니다.
        </p>
      ) : (
```

를 아래로 교체한다:

```tsx
      {classes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-400">
          {editor.search.trim()
            ? "검색어와 일치하는 학생이 있는 반이 없습니다."
            : "선택한 조건에 수업이 있는 반이 없습니다."}
        </p>
      ) : (
```

- [ ] **Step 3: 타입 체크 + 린트**

Run: `pnpm type-check && pnpm lint`
Expected: 둘 다 통과 (에러 0).

- [ ] **Step 4: 수동 검증 (검색 동작)**

Run: `pnpm dev` 후 브라우저에서 `/admin/today` 접속.
확인:
1. 필터 바에 "학생 · 이름 검색 (한/영)" 입력이 보인다.
2. 펼치지 않아도 되는 어떤 반의 학생 한글 이름 일부를 입력 → 그 학생이 속한 반만 남는다.
3. 같은 학생의 영문 이름 일부(소문자/대문자 섞어서)를 입력 → 동일하게 매칭된다.
4. 매칭 없는 문자열 입력 → "검색어와 일치하는 학생이 있는 반이 없습니다." 메시지.
5. 검색어를 지우면 현재 구분/요일/시간대 필터 결과로 복귀.
6. 구분/요일을 바꾸면 검색은 그 범위 안에서만 적용됨(현재 필터 내 검색).

- [ ] **Step 5: 커밋**

```bash
git add src/app/\(admin\)/admin/today/_components/TodayPageClient.tsx
git commit -m "feat(today): add student-name search input to filter bar

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `UnitProgressGrid` 에 비파괴 `hideHeader` prop 추가

**Files:**
- Modify: `src/components/homework/UnitProgressGrid.tsx`

`hideHeader` 가 true 면 표지/시리즈명/레벨/완료카운트 헤더와 바깥 section 테두리를 생략하고 셀 그리드만 렌더한다. 기본값 false → 기존 4개 사용처 동작 그대로.

- [ ] **Step 1: Props 타입에 `hideHeader` 추가**

현재 `Props` 타입(line 40-48):

```tsx
type Props = {
  textbook: UnitGridTextbook;
  units: UnitGridUnit[];
  editable?: boolean;
  /** 미저장 변경이 있는 unitNumber 집합 — orange dot 표시용 */
  dirtyNumbers?: Set<number>;
  /** 셀 클릭 시 호출 (동기). state 관리는 부모 책임. */
  onUnitClick?: (unitNumber: number) => void;
};
```

에 `hideHeader` 를 추가한다:

```tsx
type Props = {
  textbook: UnitGridTextbook;
  units: UnitGridUnit[];
  editable?: boolean;
  /** 미저장 변경이 있는 unitNumber 집합 — orange dot 표시용 */
  dirtyNumbers?: Set<number>;
  /** 셀 클릭 시 호출 (동기). state 관리는 부모 책임. */
  onUnitClick?: (unitNumber: number) => void;
  /** true → 표지·시리즈명·레벨·완료카운트 헤더 + 바깥 테두리 생략, 셀 그리드만 렌더. 기본 false. */
  hideHeader?: boolean;
};
```

- [ ] **Step 2: 함수 시그니처에 `hideHeader` 구조분해 추가**

현재(line 82-88):

```tsx
export function UnitProgressGrid({
  textbook,
  units,
  editable = false,
  dirtyNumbers,
  onUnitClick,
}: Props) {
```

를:

```tsx
export function UnitProgressGrid({
  textbook,
  units,
  editable = false,
  dirtyNumbers,
  onUnitClick,
  hideHeader = false,
}: Props) {
```

- [ ] **Step 3: section/header/grid 래퍼를 조건부로 변경**

현재 return 의 바깥 구조(line 93-96, 그리고 header 닫힘 후 line 143-144):

```tsx
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <header className="flex items-start gap-3 border-b border-slate-200 bg-slate-50/50 px-4 py-3">
```

... (header 내용) ...

```tsx
      </header>

      {/* Grid */}
      <div className="p-2">
```

세 부분을 다음과 같이 바꾼다.

(a) section 여는 태그:

```tsx
    <section
      className={
        hideHeader
          ? ""
          : "rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
      }
    >
      {/* Header */}
      {!hideHeader && (
        <header className="flex items-start gap-3 border-b border-slate-200 bg-slate-50/50 px-4 py-3">
```

(b) header 닫힘 — 기존 `</header>` 를 `</header>` + `)}` 로 닫는다:

```tsx
      </header>
      )}

      {/* Grid */}
      <div className={hideHeader ? "" : "p-2"}>
```

> 주의: `<header>` 내부 JSX 는 그대로 두고 `{!hideHeader && (` ... `)}` 로 감싸기만 한다. `completedCount`/`displayTitle` 변수는 여전히 header JSX 에서 참조되므로 미사용 경고가 나지 않는다.

- [ ] **Step 4: 타입 체크 + 린트**

Run: `pnpm type-check && pnpm lint`
Expected: 통과. 기존 사용처(BoardStudentList, ClassUnitProgressList, student/homework)는 `hideHeader` 를 안 넘기므로 false → 동작 불변.

- [ ] **Step 5: 커밋**

```bash
git add src/components/homework/UnitProgressGrid.tsx
git commit -m "feat(homework): add optional hideHeader prop to UnitProgressGrid

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `StudentRow` 숙제 모드를 [이름+진도] | [인라인 그리드] 로 재구성

**Files:**
- Modify: `src/app/(admin)/admin/today/_components/StudentRow.tsx`

숙제 모드 분기에서만 레이아웃을 바꾼다. 출결 모드(line 55-85)와 상단 `name` 정의(line 41-52)는 그대로 둔다.

- [ ] **Step 1: 숙제 모드 분기 교체**

현재 숙제 모드 블록 전체(line 87-148, `// ── 숙제 모드 …` 주석부터 마지막 닫는 `);` 직전까지):

```tsx
  // ── 숙제 모드: 이름 + 선택한 책 1권 그리드 ──────────────────────────────────
  const book = selectedBookId
    ? student.books.find((b) => b.id === selectedBookId)
    : undefined;
  const dirty = book
    ? editor.dirtyUnitNumbers(classId, student.studentId, book.id)
    : new Set<number>();
  const units = book
    ? book.units.map((u) => ({
        ...u,
        status: editor.getMergedUnitStatus(
          classId,
          student.studentId,
          book.id,
          u.unitNumber,
          u.status
        ),
      }))
    : [];

  return (
    <div className={`rounded-xl border px-3 py-2.5 transition-colors ${rowTint}`}>
      <div className="mb-2 flex items-center gap-2 flex-wrap">
        {name}
        {isAbsent && (
          <span className="text-[11px] font-medium text-red-600">
            결석 · 숙제 비활성
          </span>
        )}
      </div>
      {!book ? (
        <p className="py-2 text-center text-xs text-slate-400">
          이 학생에겐 이 책이 부여되지 않았습니다.
        </p>
      ) : (
        <div
          style={{
            opacity: isAbsent ? 0.45 : 1,
            pointerEvents: isAbsent ? "none" : "auto",
          }}
        >
          <UnitProgressGrid
            textbook={book}
            units={units}
            editable={!isAbsent}
            dirtyNumbers={dirty}
            onUnitClick={
              isAbsent
                ? undefined
                : (unitNumber) =>
                    editor.cycleUnit(
                      classId,
                      student.studentId,
                      book.id,
                      unitNumber
                    )
            }
          />
        </div>
      )}
    </div>
  );
}
```

를 아래로 교체한다 (`book`/`dirty`/`units` 계산은 동일하게 유지하고, `completedCount` 추가 + 레이아웃만 변경):

```tsx
  // ── 숙제 모드: [이름 + 진도] | [인라인 unit 그리드] ─────────────────────────
  const book = selectedBookId
    ? student.books.find((b) => b.id === selectedBookId)
    : undefined;
  const dirty = book
    ? editor.dirtyUnitNumbers(classId, student.studentId, book.id)
    : new Set<number>();
  const units = book
    ? book.units.map((u) => ({
        ...u,
        status: editor.getMergedUnitStatus(
          classId,
          student.studentId,
          book.id,
          u.unitNumber,
          u.status
        ),
      }))
    : [];
  const completedCount = units.filter((u) => u.status === "completed").length;

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors ${rowTint}`}
    >
      {/* 좌측: 이름 + 진도 카운트 (고정폭) */}
      <div className="w-28 shrink-0 sm:w-32">
        {name}
        {book && (
          <p className="mt-0.5 text-xs tabular-nums text-slate-500">
            완료 {completedCount}/{book.total_units}
          </p>
        )}
        {isAbsent && (
          <p className="mt-0.5 text-[11px] font-medium text-red-600">
            결석 · 비활성
          </p>
        )}
      </div>

      {/* 우측: 클릭 가능한 unit 그리드 (인라인, 헤더 없음) */}
      <div className="min-w-0 flex-1">
        {!book ? (
          <p className="py-2 text-xs text-slate-400">
            이 학생에겐 이 책이 부여되지 않았습니다.
          </p>
        ) : (
          <div
            style={{
              opacity: isAbsent ? 0.45 : 1,
              pointerEvents: isAbsent ? "none" : "auto",
            }}
          >
            <UnitProgressGrid
              textbook={book}
              units={units}
              editable={!isAbsent}
              hideHeader
              dirtyNumbers={dirty}
              onUnitClick={
                isAbsent
                  ? undefined
                  : (unitNumber) =>
                      editor.cycleUnit(
                        classId,
                        student.studentId,
                        book.id,
                        unitNumber
                      )
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입 체크 + 린트**

Run: `pnpm type-check && pnpm lint`
Expected: 둘 다 통과 (에러 0).

- [ ] **Step 3: 수동 검증 (데스크탑 숙제 모드)**

`pnpm dev` → `/admin/today` → 아무 반 펼치기 → "숙제" 탭 → 책 칩 1개 선택.
확인:
1. 각 학생 행에서 **표지 이미지·시리즈명·레벨 헤더가 사라짐**.
2. 학생 이름 오른쪽에 클릭 가능한 unit 그리드가 **같은 행에 인라인**으로 표시됨.
3. 이름 아래 `완료 N/total` 진도 카운트가 보임.
4. unit 셀 클릭 → 미완료→완료→결손 토글 정상 동작, dirty(주황 점) 표시 정상, 하단 저장 바 정상.
5. unit 수가 많은 책은 이름 오른쪽 영역에서 줄바꿈(wrap)되어 표시됨.
6. 학생을 결석 처리하면 그리드가 회색·비활성 되고 이름 아래 "결석 · 비활성" 표시.
7. 책 칩(시리즈)에는 여전히 책 이름이 표시됨(반 단위 식별은 유지).

- [ ] **Step 4: 수동 검증 (모바일 + 다른 사용처 회귀)**

1. `/m/today` 접속 → 숙제 모드에서 동일하게 인라인 그리드가 보이고 좁은 화면에서 줄바꿈으로 정상 표시되는지 확인.
2. 회귀: `UnitProgressGrid` 헤더가 그대로 필요한 화면들이 안 깨졌는지 확인 —
   - 학생용 숙제 페이지 `/academy/student/homework`
   - 숙제 관리의 `ClassUnitProgressList` / `BoardStudentList` 가 렌더되는 화면
   세 곳 모두 **표지·시리즈명·레벨 헤더가 그대로** 보여야 한다(= 기본 동작 불변).

- [ ] **Step 5: 커밋**

```bash
git add src/app/\(admin\)/admin/today/_components/StudentRow.tsx
git commit -m "feat(today): inline unit grid next to student name in homework mode

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: 최종 통합 검증

**Files:** (코드 변경 없음 — 검증 전용)

- [ ] **Step 1: 전체 타입 체크 + 린트 + 빌드**

Run: `pnpm type-check && pnpm lint && pnpm build`
Expected: 셋 다 성공.

- [ ] **Step 2: 통합 시나리오 수동 확인**

`/admin/today` 에서:
1. 학생 이름으로 검색 → 해당 반만 남음 → 그 반 펼치기 → 숙제 모드 → 인라인 그리드로 진도 확인/채점 → 저장까지 한 흐름이 매끄러운지 확인.
2. 검색어 입력 중 구분/요일/시간대를 바꿔도 현재 필터 범위 내에서 검색이 유지되는지 확인.

- [ ] **Step 3: 작업 완료 보고**

변경 파일 4개(`useTodayClassEditor.ts`, `TodayPageClient.tsx`, `UnitProgressGrid.tsx`, `StudentRow.tsx`)와 검증 결과를 요약 보고. 미해결/추가 논의 필요 항목이 있으면 함께 보고.

---

## Self-Review (작성자 체크)

- **Spec 커버리지:**
  - 요구사항 1(이름 한/영 검색, 현재 필터 내, 매칭 반 표시) → Task 1+2. 자동 펼침/강조 미구현은 사용자 확정사항.
  - 요구사항 2(헤더 제거 + 이름 옆 인라인 그리드 + 진도 카운트) → Task 3(hideHeader)+4(레이아웃).
- **Placeholder 스캔:** 모든 코드 단계에 실제 코드 포함, TODO/"적절히 처리" 류 없음.
- **타입/네이밍 일관성:** `search`/`setSearch`(Task1) ↔ `editor.search`/`editor.setSearch`(Task2) 일치. `hideHeader`(Task3) ↔ `hideHeader` prop 전달(Task4) 일치. `completedCount`(Task4)는 머지된 `units` 기준으로 계산.
- **비파괴:** `hideHeader` 기본 false → 타 사용처 불변(Task3 Step4, Task4 Step4 회귀 검증). 출결 모드 미변경.
