# /health Report — SC Wonderland (2026-04-22)

## Overall Score: 5.7/10

Type safety is clean (great). Lint and dead code are the problem. The lint failures
are dominated by React 19 / Next.js 16 hook rules that were added or tightened when
the codebase upgraded — about 30 of the 49 errors are the same pattern
(`react-hooks/set-state-in-effect`) and another 9 are `react-hooks/refs`. These are
mechanical, not deep. Dead code is the slow bleed: 16 files that nothing imports and
23 unused exports mostly in the barrel `src/app/(admin)/admin/actions.ts` plus the
shadcn UI primitives.

## Category Scores

| Category | Score | Status | Details |
|---|---|---|---|
| Type Safety | 10/10 | CLEAN | 0 errors (`tsc --noEmit` exit 0) |
| Lint | 2/10 | CRITICAL | 49 errors, 42 warnings across 57 files |
| Dead Code | 2/10 | CRITICAL | 16 unused files, 23 unused exports, 13 unused types |
| Build Health | 8/10 | WARNING | tsc clean; full `next build` not executed (long-running); no config red flags |
| Tests | SKIPPED | — | No test runner configured in `package.json` |
| Shell Lint | SKIPPED | — | No shell scripts in scope |

Weight redistribution (tests + shell skipped): typecheck 35.7%, lint 28.6%,
deadcode 21.4%, build 14.3%.
Composite = `(10*0.357) + (2*0.286) + (2*0.214) + (8*0.143) = 5.71`.

## Top Issues (prioritized)

Grouped by rule, not file, because most of the pain is a few repeated patterns.

### HIGH — React 19 hook violations (39 errors)

Same story 30+ times: an effect calls `setState` (or a function that setState's)
synchronously in its body, causing cascading renders. React 19 treats this as an
error now, not a warning. Each site needs either (a) move the setState into an
event handler, (b) guard with `useSyncExternalStore`, or (c) derive the value at
render time instead of stuffing it in state.

- `src\app\(academy)\academy\components\PortalNav.tsx:28` — `setPendingHref(null)` in effect
- `src\app\(academy)\academy\student\bus\StudentBusClient.tsx:72` — `load()` in effect
- `src\app\(academy)\academy\student\homework\StudentHomeworkClient.tsx:53` — `load()` in effect
- `src\app\(academy)\academy\student\notices\StudentNoticesClient.tsx:81` — `loadNotices()` in effect
- `src\app\(academy)\academy\student\timetable\StudentTimetableClient.tsx:91` — setState in effect
- `src\app\(academy)\academy\teacher\attendance\components\TeacherAttendanceClient.tsx:69`
- `src\app\(academy)\academy\teacher\bus\components\TeacherBusClient.tsx:34`
- `src\app\(academy)\academy\teacher\components\TeacherTextbookClient.tsx:62`
- `src\app\(academy)\academy\teacher\homework\components\TeacherHomeworkClient.tsx:71`
- `src\app\(academy)\academy\teacher\notices\components\TeacherNoticesClient.tsx:64`
- `src\app\(admin)\admin\academy-notices\components\AcademyNoticesManager.tsx:54`
- `src\app\(admin)\admin\bus\components\AdminBusChangeDnD.tsx:102`
- `src\app\(admin)\admin\bus\components\BusAssignmentManager.tsx:90`
- `src\app\(admin)\admin\bus\components\BusChangeRequestsPanel.tsx:68`
- `src\app\(admin)\admin\bus\components\BusDashboard.tsx:90`
- `src\app\(admin)\admin\bus\components\BusManagePanel.tsx:133`
- ...and ~14 more.

### HIGH — `react-hooks/refs` (9 errors)

Writing a ref's `.current` during render. React 19 now treats this as an error.

- `src\lib\hooks\use-bus-realtime.ts:18` — `callbacksRef.current = callbacks;` during render
- `src\app\(admin)\admin\bus\components\BusStatusRealtimeDashboard.tsx` — 3 sites (lines 134, 553, 656)
- `src\app\(monitor)\bus-monitor\components\BusMonitorClient.tsx` — 2 sites (lines 138, 507)
- and a few more.

Fix pattern: move the assignment into a `useEffect` (for syncing) or pass the
callback via a stable ref set in a handler, not at the top of the component body.

### MEDIUM — Unused variables / imports (24 warnings)

Examples:
- `src\app\(academy)\academy\student\notices\StudentNoticesClient.tsx:13` — 4 unused type imports (`ClassNotice`, `ClassNoticeAttachment`, `AcademyNotice`, `AcademyNoticeAttachment`).
- `src\app\(academy)\academy\student\timetable\StudentTimetableClient.tsx:11` — `TEACHER_COLOR_PALETTE` imported but not used (dead import after the shared-palette refactor landed).
- `src\components\forms\FileList.tsx:16` — `formatFileSize` unused.
- `scripts\import-2026-students.ts:298` — `finalEmail` assigned but never used.

### MEDIUM — `next/no-img-element` (10 errors)

Raw `<img>` instead of `next/image`. Next.js 16 flags this harder than before.
Concentrated in admin/teacher UI and the `(site)` public pages.

### LOW — `no-require-imports` in `.claude/scripts/*.js` (4 errors)

The claude-scripts files use CommonJS `require()`. They're also reported by knip as
unused. They should either be excluded from lint (they're not shipped code) or
converted to ESM.

### LOW — `prefer-const` (5 errors)

Trivial auto-fixable. Files:
- `scripts\import-2026-students.ts:269` — `skipped`
- `src\app\(admin)\admin\bus\components\BusChangeRequestsPanel.tsx:137` — `groupMap`
- `src\app\(admin)\admin\bus\components\AdminBusChangeDnD.tsx:1218`, `1381` — `defaultSlotMap` (twice)

### HIGH — Dead files (16)

These files are not imported anywhere. Half of them are behind feature-flag UIs that
got replaced:

- `src\app\(academy)\academy\teacher\attendance\components\TeacherAttendanceClient.tsx`
- `src\app\(academy)\academy\teacher\bus\components\TeacherBusClient.tsx`
- `src\app\(admin)\admin\bus\components\BusAssignmentManager.tsx`
- `src\app\(admin)\admin\bus\components\BusManagePanel.tsx`
- `src\app\(admin)\admin\bus\components\BusMonitoringDashboard.tsx`
- `src\app\(admin)\admin\students\components\ReportCardReadView.tsx`
- `src\app\(admin)\admin\students\components\StudentComingTab.tsx`
- `src\components\navigation\QueryTabNav.tsx` — but CLAUDE.md lists it as a shared component. Either it's still wired up via dynamic import (knip can miss that) or the reference is stale.
- `src\components\ui\avatar.tsx`, `popover.tsx`, `tooltip.tsx` — shadcn primitives installed but never used.
- `.claude\scripts\*.js` — 4 files.
- `scripts\import-2026-students.ts` — one-shot migration, fine to keep but mark.

### HIGH — Unused exports (23)

Most are in `src\app\(admin)\admin\actions.ts`, the admin barrel. Every function
the barrel re-exports that nothing outside the action files imports is listed:
`removeStudentFromClass`, `listNotices`, `getNoticeWithAttachments`, `createNotice`,
`updateNotice`, `deleteNotice`, `getTextbookLinkedCounts`, `getClassAttendanceByDate`,
`addClassScheduleBatch`, `getStudentTimetableEditable`, `deleteStudentSchedule`,
`deleteStudentBusDefault`, `listPendingChangeRequests`, `boardBusStudent`,
`unboardBusStudent`, `checkBusStudent`, `uncheckBusStudent`, `listBusStopSchedules`.

Interpretation: the barrel is fine (it's a compatibility surface), but knip can't
tell what's used via server actions. These may be live. Confirm case-by-case.

Also real unused exports worth cleaning:
- `src\lib\ui\toast.ts` — `toastInfo`, `toast`
- `src\lib\utils\date-kst.ts` — `formatDateTimeKst`, `formatTimeKst` (but CLAUDE.md says these must be used; either the grep is stale or the codebase is inconsistent with its own rule)
- `src\lib\constants\attendance.ts` — `getStatusLabel` (CLAUDE.md explicitly names this as a required shared util — same tension)
- `src\lib\types\index.ts` and `src\lib\types\server-action.ts` — `ok`, `fail`, `okVoid` helpers + `ActionResult` type

### MEDIUM — Unlisted dependencies (2)

- `postcss` — used by `postcss.config.mjs` but not declared in `package.json`. Works today because it's a transitive dep of `@tailwindcss/postcss`, but add it explicitly.
- `supabase` CLI — used in `db:types` scripts but not declared. Either add it, or document that it's a global install expectation.

## Recommendations

Ranked by impact = `weight * (10 - score)`:

1. **Fix the React 19 hook errors.** 39 errors, one pattern. Lint jumps from 2 → ~6 with this alone. Do it in batches by route group (academy first, admin second) so reviews stay small. Impact on Lint weight (28.6%) → roughly +1.1 composite points.
2. **Delete the 16 dead files.** Pure subtract. If any are actually used (suspect `QueryTabNav.tsx` given CLAUDE.md mentions it), confirm by grep for dynamic imports first. Impact on Dead Code weight (21.4%) → roughly +0.9 composite points.
3. **Reconcile `date-kst` / `attendance` unused-export warnings with CLAUDE.md.** Either the rule in CLAUDE.md is being violated (people are still using ad-hoc `toLocaleDateString` and local `STATUS_CONFIG`) or knip is wrong. A single grep for `toLocaleDateString` and local `STATUS_CONFIG` will tell you. If the rule is being violated, that's a bigger systemic issue than the lint score shows.
4. **Fix `next/no-img-element` (10 sites).** Replace with `next/image`. Performance win too — LCP on mobile improves on the public `(site)` pages.
5. **Convert `.claude/scripts/*.js` to ESM or exclude from lint.** 4 errors vanish. Also delete them if they're unused (knip says yes).
6. **Auto-fix `prefer-const` and `no-unused-vars` with `eslint --fix`.** About 25 of the 42 warnings are auto-fixable.
7. **Declare `postcss` and `supabase` in `package.json`.** Cheap, prevents "works on my machine" breaks.
8. **Add a test runner.** No tests means the Tests category is unscorable and the project is one careless refactor from a regression. Even a smoke test suite (Vitest + a handful of server-action tests) would move the dial.

## Raw Output

### `npx tsc --noEmit`

```
(empty — exit code 0, no errors)
```

### `npm run lint` — summary

```
✖ 91 problems (49 errors, 42 warnings)
  3 errors and 5 warnings potentially fixable with the `--fix` option.
```

Breakdown by rule:

```
  30  react-hooks/set-state-in-effect
  24  typescript-eslint/no-unused-vars
  10  next/no-img-element
   9  react-hooks/refs
   4  typescript-eslint/no-require-imports
   3  react-hooks/exhaustive-deps
   2  react-hooks/static-components
  (remaining spread across prefer-const, etc.)
```

Affected files: 57 unique paths.

### Dead code scan (`npx knip`)

```
Unused files (16)
Unused exports (23)
Unused exported types (13)
Unlisted dependencies (1)   — postcss
Unlisted binaries (1)       — supabase
```

(Full lists above under "Top Issues".)

### Build health

Not executed: `npm run build` was skipped because Next.js 16 full builds are long.
Signals used as proxy:
- `tsc --noEmit` clean.
- `next.config` exists and has no obvious misconfiguration.
- No orphan route groups detected.
- Package versions are current (Next 16.1.6, React 19.2.3).

If you want a firm build score, run `npm run build` once and attach the output.
