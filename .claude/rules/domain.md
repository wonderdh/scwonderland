# Domain Rules

This file is the compact domain index. Detailed legacy rule files may remain, but this file is the default read target.

## Stack

Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Supabase Auth/PostgreSQL/Storage.

## Server Actions

- Admin actions live under `src/app/(admin)/admin/actions/`.
- Mutating actions must call `verifyAdmin`, `verifyTeacherOrAdmin`, or `verifyAuthenticated`.
- Shared read actions must still protect ownership and IDOR paths.
- Return shape defaults to `{ error?: string }`.
- Use `npm run check:auth` after action changes.

## Shared Utilities

- Dates and KST: `src/lib/utils/date-kst.ts`.
- HTML escaping outside React: `src/lib/utils/escape-html.ts`.
- Server logging: `src/lib/server/logger.ts`; no raw server `console.log/error`.
- Student sorting: `src/lib/utils/student-sort.ts`.
- Student name formatting: `src/lib/utils/student-name.ts`.
- Attendance constants: `src/lib/constants/attendance.ts`.
- Timetable colors: `src/lib/constants/timetable.ts`.

## UI

- Use existing shadcn/ui primitives and shared components before adding new abstractions.
- Route-specific components should stay colocated unless reused across domains.
- Shared components live under `src/components/<group>/`.

## Data And Supabase

- `supabase/migrations/00000000000000_remote_baseline.sql` is the current schema baseline.
- Type changes belong in `src/lib/types/`.
- Storage helpers live in `src/lib/supabase/storage.ts`.
