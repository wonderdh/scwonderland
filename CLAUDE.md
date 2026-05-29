# SC Wonderland

Next.js 16 App Router + React 19 + TypeScript + Tailwind v4 + Supabase 기반 학원 관리 SaaS.

## 작업 규칙
- 코드 수정 전 `ARCHITECTURE.md` 에서 대상 폴더의 위치와 책임을 확인한다.
- 하네스(훅, `ARCHITECTURE.md`, `.claude/settings.json` 등) 관련 작업 전에는 `docs/HARNESS.md` 를 읽는다.
- 작업 대상 폴더(또는 상위 폴더)에 `AGENTS.md` 가 있으면 **모두** 읽고, 거기 적힌 규칙을 작업에 반영한다.
- Server Action 은 mutation 전에 `verifyAdmin` / `verifyTeacherOrAdmin` / `verifyAuthenticated` 중 하나로 인증 검증. 못 넣을 사정이 있으면 함수 본문 위에 `// @auth-skip: <이유>`.
- Supabase 마이그레이션은 `supabase/migrations/` 에 추가하고 `pnpm db:types` 로 타입 재생성.
- **DB FK 컨벤션**: 학생 컬럼은 `students(id)`, 교사 컬럼은 `teachers(id)` 참조. `profiles(id)` 는 admin·teacher 가 섞이는 actor 컬럼 (`assigned_by`, `recorded_by`, `marked_by` 등) 에만. 상세는 `supabase/AGENTS.md` "FK 컨벤션".
- **요청 범위 준수**: ① 질문/탐색 단계(가능?, 어떻게 돼있어? 등)엔 답만 하고 코드/DB 손 안 댐. ② 명령 단계(바꿔/해/없애 등)엔 DB + 그에 따라 깨지는 코드까지 한 번에 (tsc 통과). ③ **요청 안 한 리팩토·기능 삭제·"이왕 하는 김에" 식 정리 금지**. UI feature 를 stub 으로 만들거나 축소하는 건 사용자 동의 후에만.
- 환경변수는 `.env*` 파일 사용. 민감값 커밋 금지.

## 자주 쓰는 명령
- `pnpm dev` — 개발 서버
- `pnpm build` — 프로덕션 빌드
- `pnpm lint` / `pnpm type-check`
- `pnpm db:types` / `pnpm db:types:local`

## 문서
- `ARCHITECTURE.md` — 프로젝트 구조 인덱스
- `docs/` — 캐시/SSR/관찰성 등 패턴 가이드

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
| ------ | ---------- |
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
