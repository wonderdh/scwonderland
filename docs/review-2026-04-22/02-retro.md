# /retro Report — SC Wonderland (2026-04-22)

## Summary Period

- Window: last ~3 months (2026-01-28 → 2026-04-20)
- Commits analyzed: **201** (entire repo history also = 201; project began 2026-01-28)
- Contributors: 1 (solo dev, `wonderdh`)
- Latest commit: `6cb6c60` (2026-04-20) — chore: 루트 및 docs/ 정리
- First commit: `8a9064e` (2026-01-28) — Initial commit

## Commit Mix

| Prefix | Count | Share |
|---|---|---|
| feat: | 53 | 26.4% |
| fix: | 29 | 14.4% |
| refactor: | 15 | 7.5% |
| docs: | 10 | 5.0% |
| chore: | 9 | 4.5% |
| perf: | 4 | 2.0% |
| style: | 1 | 0.5% |
| revert: | 1 | 0.5% |
| test: | 1 | 0.5% |
| Merge: | 1 | 0.5% |
| **other (unconventional)** | **77** | **38.3%** |

Observation: **38% of commits use no conventional prefix** — they're short or placeholder labels like `1`, `d`, `f`, `j`, `v`, `v2`, `v5`, `time_table_01`, `big fix`, `20260311_01`, `admin/student_fixed`, `방과후`, `인원제외`, `s`, `l`. This is the single biggest signal in the repo's history. The project clearly crossed a professionalism threshold around mid-March: before 2026-03-16, raw terse labels dominate; after, conventional prefixes are near-universal. Discipline is visibly improving over time.

Feat:fix ratio is healthy at **1.83:1** — more building than firefighting.

## Churn Hotspots (Top 10 most-modified files)

All paths are pre-`src/` move. Commit `fab2f44` (2026-04-20) moved the web source into `src/`, so current locations are under `C:\scwonderland\src\...`. Churn counts below are from the 3-month window.

| Rank | File | Changes | Notes |
|---|---|---|---|
| 1 | `app/(admin)/admin/actions/bus-actions.ts` | 41 | Bus Server Actions — highest churn in the repo. 6 of those are `fix:`. Bus domain is the hot zone. |
| 2 | `app/(admin)/admin/actions.ts` (barrel) | 40 | Barrel re-export file — moves with every new action, somewhat expected. |
| 3 | `lib/types/database.ts` | 33 | Shared DB types. Split into `database.ts + api.ts` on 2026-03-16 (`fd4ac98`). |
| 4 | `app/(monitor)/bus-monitor/BusMonitorClient.tsx` | 25 | Bus monitor display — 3 fixes. |
| 5 | `lib/types/index.ts` | 21 | Types barrel. |
| 6 | `app/(admin)/admin/bus/components/BusDashboard.tsx` | 21 | Admin bus dashboard — 3 fixes. |
| 7 | `app/(admin)/admin/actions/user-actions.ts` | 21 | User/auth actions. |
| 8 | `app/(admin)/admin/classes/components/ClassesManager.tsx` | 20 | Class management UI. |
| 9 | `app/(admin)/admin/actions/class-actions.ts` | 19 | Class Server Actions. |
| 10 | `app/(bus)/bus/components/BusStaffMonitor.tsx` | 18 | Bus staff view — 3 fixes. |

The bus domain occupies **4 of the top 10** (ranks 1, 4, 6, 10) plus more just outside it (`BusChangeRequestsPanel.tsx` #11, `StudentBusTab.tsx` #15, `BusMonitoringDashboard.tsx` #16). Bus is clearly the most complex and fragile subsystem. That makes sense — it handles realtime events, daily change requests, route assignments, and multi-role views.

## Re-work Patterns

Files touched by 3+ distinct `fix:` commits in the 3-month window (design smell indicator):

| File | fix: commits | Reading |
|---|---|---|
| `app/(admin)/admin/actions/bus-actions.ts` | **6** | Bus Server Actions are genuinely fragile. Candidate for extraction into smaller domain-scoped files + regression tests. |
| `lib/types/database.ts` | 5 | Expected — shared types churn whenever schema changes. Already mitigated by 2026-03-16 split into `database.ts + api.ts`. |
| `components/bus/MonitorBusCard.tsx` | 3 | Shared bus card component — UI edge cases (absent students, race conditions). |
| `app/(monitor)/bus-monitor/BusMonitorClient.tsx` | 3 | Monitor screen — race condition + realtime fix history. |
| `app/(bus)/bus/components/BusStaffMonitor.tsx` | 3 | Bus driver view — color/state issues. |
| `app/(admin)/admin/students/components/StudentBusTab.tsx` | 3 | Student detail → bus sub-tab. |
| `app/(admin)/admin/bus/components/BusDashboard.tsx` | 3 | Admin bus dashboard — matches realtime + dnd fixes. |
| `app/(admin)/admin/actions/schedule-actions.ts` | 3 | Schedule actions. |

Pattern: **every top re-work file except `lib/types/database.ts` is in the bus domain.** This is the design smell — the bus module is carrying too much complexity across Server Actions, realtime, dashboards, monitor, staff view, and admin change requests. Recent commits show awareness: `31e03ca` moved `MonitorBusCard` to a shared path, `9daeea8` extracted a shared component, `95d7045` introduced `versionRef` to block a race condition, `fab2f44` moved everything to `src/`. The problem is being actively addressed, but more decomposition is warranted.

## Velocity Trend

Commits per month:

| Month | Commits | Shape |
|---|---|---|
| 2026-01 (4 days) | 4 | Project kickoff — landing page, nav scaffolding |
| 2026-02 | 37 | Foundation — Supabase integration, admin dashboard v1, students/classes v1 |
| 2026-03 | **110** | **Peak month** — bus v1→v7, monitor, P0/P1/P2/P3 refactor sweep, types split |
| 2026-04 (20 days) | 50 | Sustained high velocity — reports, weekly sentences, senior UX, RLS Phase 1-5 |

Weekly view shows the same story: weeks W11–W14 (mid-March through early April) were the build-heavy sprint (27, 41, 29, 18 commits). W15–W17 slowed but shifted to higher-quality work: RLS hardening, docs, structural cleanup.

**Velocity is decreasing in raw count but increasing in leverage.** Recent commits are larger, better-described, and more structural (RLS across 5 domains, `src/` reorganization, senior-friendly UX overhaul) vs. the early-March burst of small iterative UI tweaks.

## Notable Commits / Milestones

Chronological highlights:

- **2026-02-11** `72061d3` — Supabase integration landed
- **2026-02-12** `1e0cb60` — Student dashboard v1 + admin dashboard v1
- **2026-03-01** `ed999d6` — Timetable grid redesigned (toolbar + checkbox + textbook)
- **2026-03-09→2026-03-13** — Bus module v1 → v7 iterations (many unconventional-label commits)
- **2026-03-16** `9a9ba76` — "2026_03_16" checkpoint commit; immediately followed by a **refactor sweep**: P0/P1/P2/P3 improvements, types split (`database.ts + api.ts`), `TeacherTypeContext` provider, `ConfirmDialog` rollout, `"use server" export type` violation fixes
- **2026-03-23** `b4c8b6a` — **First (and only) PR merge**: `feat/bus-realtime` — Supabase Realtime across the bus domain
- **2026-03-26** `8309101` — 2026 통합명단 (integrated roster) applied to DB
- **2026-04-02** `98f644c` — N+1 query removal + `loading.tsx` skeletons
- **2026-04-07** `0a72efb` — Report card DeepL translation
- **2026-04-15** `512ed80` — **Senior-friendly UX overhaul** (larger fonts, bigger touch targets, status badges, nav grouping, loading contexts)
- **2026-04-20** `b6a1f14` → `a23d17a` — **RLS Phase 1–5** shipped in one day across users / classes / academy / bus / notices+textbooks (hardest security hardening milestone to date)
- **2026-04-20** `fab2f44` — Moved web source to `src/` (structural cleanup)

## Recommendations

1. **Refactor target: `bus-actions.ts`.** Highest churn (41 edits) and highest fix count (6). Split by concern: assignment actions, change-request actions, realtime-publish actions, dashboard-query actions. Each in its own file under `src/app/(admin)/admin/actions/bus/`, re-exported through the existing `actions.ts` barrel. Every split file becomes independently testable.

2. **Add regression tests to the bus domain.** Seven of the top eight re-work files are bus-related. `docs/test-infrastructure-setup.md` exists — use it. Priority tests:
   - `BusMonitoringDashboard` race conditions (`versionRef` pattern already in place — assert on it)
   - `MonitorBusCard` absent-student state transitions
   - `AdminBusChangeDnD` change-type routing (picked up multiple fixes)
   - `bus-actions.ts` each Server Action — happy path + unauthenticated + wrong-role

3. **Commit message hygiene.** 38% unconventional prefix rate is inflated by the early weeks — post-2026-03-16 the rate drops sharply. Keep that up. For the 12 commits that are literally `1`, `d`, `f`, `j`, `v`, `s`, `l`, `2`, `3` — future Claude sessions can't learn from those. Every commit should answer "what and why" in one line.

4. **Shared types are stable enough to freeze churn.** `lib/types/database.ts` at 33 edits was mostly pre-split. Post-split (`database.ts + api.ts`), the churn should plateau. If it doesn't, the split was too coarse.

5. **Ship review gate for bus work.** The only PR in the repo was `feat/bus-realtime` — everything else pushed straight to main. Given bus is the fragile zone, force bus changes through a PR with self-review (or `/review`) before landing. Rest of repo can stay direct-push.

6. **Document the RLS story.** RLS Phase 1–5 in one day is impressive but risky — it's the hardest category of change to verify. Write a short runbook: which tables are locked, which roles bypass, how to test a new policy. `.claude/rules/database.md` is the right home. You already updated it the same day; make sure the RLS section is the first thing a future contributor reads.

7. **Consider retiring the single-letter label pattern entirely.** Add a commit-msg git hook that rejects messages under 10 characters. Zero friction for normal commits, blocks the "just let me push this" reflex that produced the 20+ throwaway labels.

---

**Tweetable summary:** 3 months, 201 commits, 5 route groups, 1 contributor. Bus domain owns 4 of the top-10 churn files — classic "complexity hotspot." Recent RLS Phase 1-5 sweep + `src/` reorganization + senior UX overhaul show the project leveling up from prototype to production.
