# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SC Wonderland is a Next.js 16 application for an English language academy (원더랜드 영어학원), built with TypeScript, Tailwind CSS v4, and Supabase for authentication and data storage. The application has three main sections organized as Next.js route groups.

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

The dev server runs on http://localhost:3000

## Architecture

### Route Groups

The app uses three Next.js route groups that don't appear in URLs:

1. **`(content)`** - Public-facing website with information about the academy
   - About, Programs, Notice, Community, Experience sections
   - Each section has its own layout with SubNav
   - Uses `CategoryLayout` and `CategoryPageWrapper` components

2. **`(admin)`** - Admin dashboard at `/admin`
   - Student and teacher management
   - Class management
   - Uses Server Actions in `actions.ts` for CRUD operations

3. **`(academy)`** - Student/teacher portal at `/academy`
   - Dashboard for students and teachers
   - Login at `/academy/login`
   - Protected routes with authentication

### Supabase Integration

Three Supabase client patterns are used throughout:

- **`lib/supabase/client.ts`** - Browser client for Client Components
- **`lib/supabase/server.ts`** - Server client for Server Components and Server Actions
- **`lib/supabase/admin.ts`** - Admin client with elevated privileges for user management

Authentication is handled via middleware (`middleware.ts`) which refreshes sessions on every request.

Environment variables required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_EMAIL_DOMAIN` (defaults to "scwonderland.com")

### Database Schema

Key tables (see `docs/*.sql`):
- `students` - Student profiles with student_number, korean_name, english_name
- `teachers` - Teacher profiles with teacher_number
- `classes` - Course/class information
- `class_students` - Junction table for class enrollment
- `report_cards` - Student reports

User roles are stored in `user_metadata.role` (either "student" or "teacher").

## Important Patterns

### Routing Logic

All route mappings are centralized in `lib/menu-routes.ts`:

```typescript
// Get full path for a menu item
getMenuItemHref("about", "인사말") // → "/about-wonderland/greeting"

// Get first item in a category
getDefaultMenuItemHref("programs") // → "/program/map"

// Get all items in a category
getCategoryItemLabels("about") // → ["인사말", "회사연혁", ...]
```

When adding new pages to the (content) section:
1. Create the page in the appropriate folder
2. Update `itemSlugs` in `lib/menu-routes.ts`
3. Update the category's layout if needed

### Email Normalization

User emails follow a pattern: if no "@" is present, the email domain is appended automatically:
```typescript
normalizeEmail("student123") // → "student123@scwonderland.com"
normalizeEmail("user@gmail.com") // → "user@gmail.com"
```

This pattern is used in admin actions for creating students/teachers.

### Layout Composition

Pages in the (content) section use a nested layout pattern:

```
RootLayout (app/layout.tsx)
└── Navigation (global, fixed top)
    └── CategoryLayout (section-specific, e.g., about-wonderland/layout.tsx)
        └── CategoryPageWrapper
            ├── SideBar (fixed right, quick links)
            ├── SubNav (category navigation)
            └── Page Content
            └── Footer
```

The `CategoryPageWrapper` provides consistent structure (sidebar + footer) across all content pages.

## Styling

The project uses **Tailwind CSS v4** for almost all styling. Key points:

- Global styles in `app/globals.css` with CSS variables for theming
- Dark mode support via `prefers-color-scheme`
- Main brand colors: orange-500 (primary CTA), green-600 (sub-nav), blue-500, red-500
- Custom fonts: Geist Sans (body), Geist Mono (code)

**Exception**: One page uses CSS Modules - `app/(content)/program/wonderland/page.tsx` uses `CurriculumProgram.module.css` for complex circular layout positioning. This is the only CSS Module in the project.

When adding new content pages, stick to Tailwind CSS for consistency.

## Server Actions

Server Actions (marked with `"use server"`) are used for all data mutations:

- `app/(admin)/admin/actions.ts` - Admin operations (create/delete students, teachers, classes)
- `app/(academy)/academy/actions.ts` - Academy operations (enrollment, student info)

Always use the appropriate Supabase client:
- Use `createAdminClient()` for user creation/deletion (requires service role)
- Use `createClient()` for regular authenticated operations

## Component Patterns

### Navigation Components

- **`Navigation.tsx`** - Main site navigation with mega menu (shows on hover)
- **`SubNav.tsx`** - Section-specific navigation that highlights current page
- **`SideBar.tsx`** - Quick links to external services (report card, level test)

### Common Components

- **`ImageWithFallback.tsx`** - Handles image loading errors gracefully with fallback
- **`LayoutSwitcher.tsx`** - Provides different layouts for different sections

## Important Files

- `PROJECT_STRUCTURE.md` - Comprehensive documentation in Korean about the (content) section
- `docs/*.sql` - Database schema and migration files
- `lib/menu-routes.ts` - Central routing configuration
- `middleware.ts` - Session refresh for all routes

## Notes

- The project primarily serves Korean-speaking users (Korean text is common in UI)
- Student/teacher numbers are auto-generated by database functions
- External images from Unsplash are configured in `next.config.ts`
- All authentication flows use Supabase Auth with email/password
- The app uses React 19 and Next.js 16 (App Router only)
