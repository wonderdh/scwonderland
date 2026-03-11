# SC Wonderland Agent Teams 가이드

## 1. Agent Teams 개요

Claude Code의 **Agent Teams**는 `.claude/agents/` 디렉토리에 Markdown 파일로 정의하는 특화 에이전트다.

### 파일 구조

```
.claude/agents/
├── db-architect.md
├── bus-developer.md
├── timetable-developer.md
├── admin-crud.md
├── notice-manager.md
├── academy-portal.md
└── site-builder.md
```

### Frontmatter 스펙

```yaml
---
name: agent-name          # 에이전트 식별자
description: 한 줄 설명     # 에이전트 목적
model: sonnet              # sonnet | opus | haiku
tools:                     # 사용 가능한 도구 제한
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - Bash
---
```

### 호출 방식

| 방식 | 설명 |
|------|------|
| **수동** | `Agent` 도구에서 `subagent_type` 지정 또는 에이전트 이름 참조 |
| **자동** | 상위 에이전트가 작업 분배 시 하위 에이전트로 디스패치 |
| **병렬** | 독립 작업을 여러 에이전트에 동시 디스패치 (worktree 격리) |

---

## 2. SC Wonderland 추천 에이전트 구성

프로젝트의 도메인 경계와 파일 의존성을 기준으로 7개 에이전트를 구성한다.

| Agent | 담당 영역 | Model | 이유 |
|-------|----------|-------|------|
| `db-architect` | 마이그레이션, 스키마 설계, RLS, 타입 생성 | sonnet | DB 변경의 단일 진입점, MCP 도구 독점 |
| `bus-developer` | 승하차 시스템 전체 | sonnet | 복잡한 실시간 상태 + drag-and-drop |
| `timetable-developer` | 시간표 + 교시 관리 | sonnet | 스케줄 로직, 시간 충돌 검증 |
| `admin-crud` | 학생/교사/반/교재 CRUD | sonnet | 가장 넓은 범위, DB 스키마 이해 필요 |
| `notice-manager` | 공지사항 3종 | sonnet | 공개/반별/Academy 공지 분리 로직 |
| `academy-portal` | 학생/교사 포털 UI | sonnet | 역할별 분기 + 원어민 영어 UI |
| `site-builder` | 공개 사이트 페이지 | haiku | 정적 콘텐츠 위주, 비용 효율적 |

---

## 3. 각 에이전트 상세 정의

### 3.1 `db-architect.md`

```markdown
---
name: db-architect
description: DB 스키마 설계, 마이그레이션, RLS 정책, 타입 생성, 쿼리 최적화
model: sonnet
tools:
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - Bash
  - mcp__supabase__execute_sql
  - mcp__supabase__apply_migration
  - mcp__supabase__generate_typescript_types
  - mcp__supabase__list_tables
  - mcp__supabase__list_extensions
---

# DB Architect

데이터베이스 스키마 설계, 마이그레이션, RLS 정책, TypeScript 타입 생성을 담당한다.

## 담당 파일

- `docs/schema/*.sql` — 도메인별 DDL 스키마 (아래 섹션 5 참조)
- `docs/migrations/` — 마이그레이션 기록
- `lib/types/database.ts` — TypeScript 타입 정의

## 규칙

- 마이그레이션 적용 후 해당 도메인 `docs/schema/*.sql` 즉시 업데이트
- soft delete 패턴 준수 (profiles.deleted_at, textbooks.deleted_at)
- FK 관계 일관성, 인덱스 설계
- Supabase MCP 도구는 이 에이전트만 사용 (다른 에이전트는 MCP 호출 금지)
- 마이그레이션 전 영향받는 테이블의 기존 데이터 확인
- RLS 정책: admin은 전체 접근, teacher/student는 본인 관련 데이터만
```

### 3.2 `bus-developer.md`

```markdown
---
name: bus-developer
description: 승하차 시스템 개발 — 버스 노선, 정류장, 배정, 모니터링, 변경 요청
model: sonnet
tools:
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - Bash
---

# Bus Developer

승하차(버스) 시스템 전체를 담당한다.

## 담당 파일

- `app/(admin)/admin/bus/` — 관리자 버스 관리 UI
- `app/(admin)/admin/actions/bus-actions.ts` — 버스 Server Actions
- `app/(academy)/academy/student/bus/` — 학생 버스 조회
- `app/(academy)/academy/teacher/bus/` — 교사 버스 모니터링
- `lib/types/database.ts` — bus 관련 타입 (bus_numbers, bus_stops, student_bus_defaults, daily_bus_overrides, bus_change_requests)

## 관련 DB 테이블

> 스키마 참조: `docs/schema/bus.sql`

- `bus_numbers` — 버스 노선 (morning/afternoon, sort_order)
- `bus_stops` — 정류장 (bus_number_id FK, sort_order)
- `student_bus_defaults` — 학생 기본 배정 (bus_number_id, bus_stop_id)
- `daily_bus_overrides` — 일별 변경
- `bus_change_requests` — 변경 요청 (학부모/교사 → 관리자 승인)

## 규칙

- 스키마 변경/마이그레이션은 `db-architect`에 위임
- 학생 이름 표시 시 `getAgeColor(age)` 나이별 색상 필수 적용
- drag-and-drop 배정 시 낙관적 업데이트 + 에러 롤백
- 버스 번호 삭제 시 관련 정류장·배정 데이터 정리 필요
- Server Action은 `verifyAdmin()` 또는 `verifyAuthenticated()` 인증 필수
```

### 3.3 `timetable-developer.md`

```markdown
---
name: timetable-developer
description: 시간표 및 교시 관리 — 스케줄 CRUD, 시간 충돌 검증, 교사 배정
model: sonnet
tools:
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - Bash
---

# Timetable Developer

시간표(timetable)와 스케줄 관리를 담당한다.

## 담당 파일

- `app/(admin)/admin/timetable/` — 시간표 관리 UI
- `app/(admin)/admin/actions/timetable-actions.ts` — 시간표 CRUD Actions
- `app/(admin)/admin/actions/schedule-actions.ts` — 교시 스케줄 Actions (GroupTimetableData 타입 정의 포함)
- `lib/types/` — timetable, schedule 관련 타입

## 관련 DB 테이블

> 스키마 참조: `docs/schema/timetable.sql`

- `timetables` — 시간표 메타 (학기, 시작/종료일)
- `timetable_classes` — 시간표-반 연결
- `schedules` — 교시 데이터 (요일, 시작/종료 시간, 교사, 교실)

## 규칙

- 스키마 변경/마이그레이션은 `db-architect`에 위임
- `GroupTimetableData` 타입은 `schedule-actions.ts`에서 직접 import (크로스 라우트 그룹)
- 시간 충돌 검증: 같은 교사가 같은 시간에 중복 배정 불가
- 유치부(6반)와 오후반(19개) 시간표 별도 관리
```

### 3.4 `admin-crud.md`

```markdown
---
name: admin-crud
description: 학생/교사/반/교재 CRUD 및 관리자 대시보드
model: sonnet
tools:
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - Bash
---

# Admin CRUD

학생, 교사, 반, 교재의 생성·조회·수정·삭제를 담당한다.

## 담당 파일

- `app/(admin)/admin/students/` — 학생 관리
- `app/(admin)/admin/teachers/` — 교사 관리
- `app/(admin)/admin/classes/` — 반 관리
- `app/(admin)/admin/textbooks/` — 교재 관리
- `app/(admin)/admin/actions/user-actions.ts` — 학생/교사 CRUD
- `app/(admin)/admin/actions/class-actions.ts` — 반 CRUD
- `app/(admin)/admin/actions/textbook-actions.ts` — 교재 CRUD
- `app/(admin)/admin/actions/learning-actions.ts` — 교재 진도
- `app/(admin)/admin/actions/attendance-actions.ts` — 출결
- `app/(admin)/admin/actions/homework-actions.ts` — 숙제
- `app/(admin)/admin/actions/report-actions.ts` — 리포트카드
- `app/(admin)/admin/actions/dashboard-actions.ts` — 대시보드 통계
- `lib/types/` — 공유 타입 정의

## 관련 DB 테이블

> 스키마 참조: `docs/schema/users.sql`, `docs/schema/classes.sql`, `docs/schema/textbooks.sql`, `docs/schema/academy.sql`

- `profiles` — 사용자 프로필 (role, deleted_at 소프트 삭제)
- `students` — 학생 상세 (age, parent_phone)
- `teachers` — 교사 상세 (is_native)
- `classes` — 반 (type: kindergarten/afternoon)
- `class_students` — 반-학생 매핑
- `textbooks` — 교재 (deleted_at 소프트 삭제)
- `student_textbook_progress` — 교재 진도
- `attendance` — 출결
- `homework` — 숙제

## 규칙

- 스키마 변경/마이그레이션은 `db-architect`에 위임
- 사용자 삭제: soft delete (profiles.deleted_at + Supabase Auth ban)
- 교재 삭제: soft delete (deleted_at)
- `TrashView` 공유 컴포넌트로 삭제 항목 관리 (`?section=trash`)
- 학생 나이별 색상: `getAgeColor(age)` 필수
- 관리자 UI: 교번·학번·이메일 숨김, 아이디만 표시 (`email.split("@")[0]`)
- 교사 색상: `TEACHER_COLOR_PALETTE` (-200 계열)
- 반 색상: `CLASS_COLOR_PALETTE` (-100 계열)
```

### 3.5 `notice-manager.md`

```markdown
---
name: notice-manager
description: 공지사항 3종 관리 — 공개 공지, 반별 공지, Academy 공지
model: sonnet
tools:
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - Bash
---

# Notice Manager

공지사항 시스템(3종)을 담당한다.

## 담당 파일

- `app/(admin)/admin/notices/` — 공개 공지 관리
- `app/(admin)/admin/academy-notices/` — Academy 공지 관리
- `app/(admin)/admin/classes/[id]/notices/` — 반별 공지 (반 상세 내)
- `app/(admin)/admin/actions/notice-actions.ts` — 공개 공지 Actions
- `app/(admin)/admin/actions/class-notice-actions.ts` — 반별 공지 Actions
- `app/(admin)/admin/actions/academy-notice-actions.ts` — Academy 공지 Actions
- `app/(site)/notice/` — 공개 사이트 공지 표시
- `app/(academy)/academy/student/notices/` — 학생 공지 조회
- `app/(academy)/academy/teacher/notices/` — 교사 공지 조회

## 관련 DB 테이블

> 스키마 참조: `docs/schema/notices.sql`

- `notices` — 공개 공지 (is_pinned, is_popup)
- `class_notices` — 반별 공지 (class_id FK)
- `academy_notices` — Academy 공지 (역할별 대상)

## 규칙

- 스키마 변경/마이그레이션은 `db-architect`에 위임
- 공지 JSON 필드 파싱 시 `JSON.parse`를 try-catch로 감싸기
- 공개 공지: 핀 고정, 팝업 기능 지원
- Academy 공지: 역할(학생/교사) 기반 필터링
- 원어민 교사는 영어 라벨 적용 (`lib/teacher-labels.ts`)
```

### 3.6 `academy-portal.md`

```markdown
---
name: academy-portal
description: 학생/교사 포털 UI — 대시보드, 교재, 출결, 숙제, 리포트카드
model: sonnet
tools:
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - Bash
---

# Academy Portal

학생과 교사가 사용하는 Academy 포털을 담당한다.

## 담당 파일

- `app/(academy)/academy/layout.tsx` — 포털 레이아웃 (원어민 감지)
- `app/(academy)/academy/login/` — 로그인
- `app/(academy)/academy/dashboard/` — 대시보드
- `app/(academy)/academy/student/` — 학생 전용 (교재, 공지, 숙제, 버스, 리포트카드)
- `app/(academy)/academy/teacher/` — 교사 전용 (반 관리, 출결, 숙제, 교재, 버스)
- `app/(academy)/academy/components/` — 공유 컴포넌트
- `app/(academy)/academy/actions.ts` — 포털 Actions (있다면)
- `lib/teacher-labels.ts` — 원어민 교사 영어 라벨 (9개 세트)

## 규칙

- 원어민 교사(is_native): 영어 UI 적용 (`teacher-labels.ts` 라벨 세트)
- 한국인 교사: 반 관리, 공지, 교재, 출결, 숙제, 승하차 접근
- 원어민 교사: 리포트카드, 교재, 출결, 숙제 접근 (반 관리·승하차 제외)
- 학생: 리포트카드, 교재, 공지, 숙제, 승하차 조회
- 인증: `verifyAuthenticated()` 사용
- 학생 나이별 색상 적용
```

### 3.7 `site-builder.md`

```markdown
---
name: site-builder
description: 공개 사이트 페이지 — 학원 소개, 프로그램, 체험, 커뮤니티
model: haiku
tools:
  - Read
  - Edit
  - Write
  - Grep
  - Glob
---

# Site Builder

공개 사이트(비인증 영역)를 담당한다.

## 담당 파일

- `app/(site)/layout.tsx` — 사이트 레이아웃
- `app/(site)/page.tsx` — 메인 페이지
- `app/(site)/about-wonderland/` — 학원 소개
- `app/(site)/program/` — 프로그램 안내
- `app/(site)/experience/` — 체험 신청
- `app/(site)/community/` — 커뮤니티
- `app/(site)/notice/` — 공지사항 (공개)
- `app/(site)/_components/` — 사이트 공유 컴포넌트

## 규칙

- 인증 불필요 (공개 페이지)
- SEO 메타데이터 포함
- 반응형 디자인 (모바일 우선)
- Tailwind CSS v4 스타일링
- Bash 도구 제외 (정적 콘텐츠만 다루므로 불필요)
```

---

## 4. 도메인별 스키마 파일 구조

MCP로 매번 DB 스키마를 조회하는 대신, 로컬 SQL DDL 파일로 스키마를 관리한다.

### 왜 로컬 파일인가?

- **MCP 호출 비용 절감**: 에이전트마다 매번 `list_tables` + `execute_sql` 호출 불필요
- **빠른 참조**: 도메인 에이전트가 자기 영역의 `.sql` 파일만 읽으면 됨
- **변경 추적**: Git으로 스키마 변경 이력 관리 가능
- **단일 진입점**: DB 변경은 `db-architect`만 수행, 다른 에이전트는 읽기만

### 파일 구조

```
docs/schema/
├── bus.sql          # bus_numbers, bus_stops, student_bus_defaults, daily_bus_overrides, bus_change_requests
├── users.sql        # profiles, students, teachers
├── classes.sql      # classes, class_students
├── timetable.sql    # timetables, timetable_classes, schedules
├── notices.sql      # notices, class_notices, academy_notices
├── textbooks.sql    # textbooks, student_textbook_progress
└── academy.sql      # attendance, homework, report_cards
```

### 동기화 규칙

- `db-architect`가 마이그레이션 적용 시 해당 `.sql` 파일 **즉시 업데이트** 필수
- 각 `.sql` 파일은 해당 도메인의 `CREATE TABLE`, 인덱스, RLS 정책을 포함
- 도메인 에이전트는 자기 도메인 `.sql`만 읽으면 됨 → MCP 불필요

---

## 5. 오케스트레이션 패턴

### 메인 Claude = 오케스트레이터

메인 Claude(opus)가 사용자 요청을 분석하고, 적절한 에이전트에 작업을 분배한다. **자동 분배가 아닌 사용자 요청 기반**으로 동작한다.

### 병렬 실행 (독립 작업)

독립된 도메인의 작업은 **worktree 격리**로 병렬 실행한다.

```
사용자: "버스 정류장 순서 변경 UI + 공개 사이트 프로그램 페이지 추가"

→ 분석: 두 도메인 독립 (bus ↔ site)
→ Agent 1: bus-developer (worktree 격리)
→ Agent 2: site-builder (worktree 격리)
→ 병렬 실행 → 결과 병합
```

### 순차 실행 (의존 작업)

DB 스키마 변경이 포함된 작업은 **db-architect 먼저 → 도메인 에이전트** 순서로 실행한다.

```
사용자: "학생에 학년(grade) 필드 추가하고 관리자 UI에 표시"

→ 분석: DB 변경 → UI 변경 (의존 관계)
→ Step 1: db-architect — students 테이블에 grade 컬럼 추가, 마이그레이션 적용, docs/schema/users.sql 업데이트
→ Step 2: admin-crud — 학생 폼/목록에 학년 필드 추가
→ 순차 실행 (Step 1 완료 후 Step 2)
```

### 판단 기준

| 조건 | 실행 방식 |
|------|----------|
| 도메인이 겹치지 않음 | 병렬 (worktree 격리) |
| DB 스키마 변경 포함 | 순차 (db-architect 먼저) |
| 같은 파일 수정 가능성 | 순차 (충돌 방지) |
| 한 에이전트로 충분 | 단독 실행 |

---

## 6. 활용 시나리오

### 쓰는 경우

| 시나리오 | 추천 방식 |
|---------|----------|
| 버스 시스템에 새 기능 추가 | `bus-developer` 단독 디스패치 |
| 학생 CRUD + 공지 동시 수정 | `admin-crud` + `notice-manager` 병렬 디스패치 |
| 공개 사이트 새 페이지 추가 | `site-builder` 단독 (haiku로 비용 절감) |
| 대규모 리팩토링 (여러 도메인) | 도메인별 에이전트 병렬 디스패치 + worktree 격리 |
| 시간표 로직 변경 | `timetable-developer` 단독 (스케줄 충돌 로직 이해 필요) |

### 안 쓰는 경우

| 시나리오 | 이유 |
|---------|------|
| 단일 파일 버그 수정 | 에이전트 오버헤드 불필요, 직접 수정이 빠름 |
| 타입 정의만 변경 | 단순 작업, Grep + Edit로 충분 |
| CLAUDE.md 업데이트 | 프로젝트 설정은 직접 관리 |
| DB 마이그레이션만 실행 | `db-architect` 단독 디스패치 |

### 병렬 작업 예시

```
사용자: "학생 목록에 필터 추가하고, 동시에 공개 사이트 공지 페이지 디자인 개선해줘"

→ Agent 1: admin-crud (학생 필터 기능)     ← sonnet, worktree 격리
→ Agent 2: site-builder (공지 페이지 UI)   ← haiku, worktree 격리
→ 두 작업 완료 후 결과 병합
```

```
사용자: "버스 정류장 관리 UI 추가 + 시간표에 교실 필드 추가"

→ Agent 1: bus-developer (정류장 UI)       ← sonnet, worktree 격리
→ Agent 2: timetable-developer (교실 필드) ← sonnet, worktree 격리
→ 독립 도메인이므로 충돌 없이 병합 가능
```

### 비용 최적화

- **haiku**: 정적 콘텐츠, 단순 UI 작업 (`site-builder`)
- **sonnet**: 비즈니스 로직, DB 연동, 복잡한 UI (나머지 6개)
- **opus**: 아키텍처 설계, 복잡한 디버깅 시 수동 오버라이드
