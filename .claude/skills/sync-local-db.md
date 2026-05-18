---
name: sync-local-db
description: Use when the user wants to sync cloud Supabase data to their local dev DB, reset local passwords, or troubleshoot the db:sync* npm scripts. Triggers on phrases like "로컬 DB 동기화", "클라우드 데이터 가져오기", "비번 1111 리셋", "supabase 동기화", "db:sync".
---

# 로컬 DB 동기화 가이드

## ⚠️ 현재 상황 (2026-05-18)

기존 npm 스크립트 — `db:sync`, `db:sync:no-auth` — 의 backbone 인
`scripts/migrate-cloud-to-target.mjs` 는 **옛 스키마 가정**이라
**현 cloud 스키마에서 깨진다**.

```
ERROR: [read profiles] column profiles.first_name does not exist
```

옛 가정: `profiles.first_name/last_name`, `students.profile_id`, `class_students.student_profile_id`, `report_cards.author_id/content` 등.
현 스키마: `profiles.username`, `students.id = profiles.id` (shared PK),
`class_students.student_id`, `report_cards.class_student_id/class_teacher_id` 등.

→ 스크립트를 새 스키마에 맞게 다시 쓰기 전까지는 아래 **ad-hoc 절차** 사용.
`db:reset-passwords` 는 auth.users 만 만지므로 그대로 작동.

## Ad-hoc 절차 (cloud → local, KEEP_AUTH)

### 0. 사전
- 로컬 Supabase 실행 중 (`supabase status` 로 확인)
- cloud service role key 손에 있음 (`.env.cloud` 의 `SUPABASE_SERVICE_ROLE_KEY`)
- 마이그레이션 상태 일치 확인: `supabase migration list --local` 가 cloud 와
  같은지 본다. local 이 더 앞서가는 1~2 개는 OK, cloud 가 앞서가면
  먼저 `supabase db pull` (DB 비번 필요) 또는 수동으로 마이그레이션 정렬.

### 1. auth.users 를 cloud 기준으로 맞추기

`supabase-js` admin API 로 양쪽 user list 받아 email 매칭:
- cloud 에 있고 local 없음 → `target.auth.admin.createUser({ id, email, password: '1111', email_confirm: true })`
  (UUID 그대로 보존해야 public 데이터 매핑 깨지지 않음)
- cloud 에 없고 local 있음 → `target.auth.admin.deleteUser(id, false)`
  **`false` 가 hard delete**. `true` 는 soft delete (email scramble, UUID 유지) — 함정.

비번 "1111" 가 작동하려면 `supabase/config.toml`:
```toml
[auth]
minimum_password_length = 4
```
변경 시 `supabase stop && supabase start`.

### 2. public 테이블 truncate + 트리거 일시 disable

```bash
docker exec supabase_db_scwonderland-local psql -U postgres -d postgres -c "
do \$\$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname='public' loop
    execute format('alter table public.%I disable trigger user', r.tablename);
  end loop;
end\$\$;
TRUNCATE academy_periods, bus_numbers, bus_time_slots, classes, publishers,
  weekly_sentence_config, weekly_sentences, profiles, students, teachers,
  notices, bus_stops, series, bus_stop_day_assignments, bus_stop_schedules,
  homework_books, class_students, class_teachers, class_schedules, attendance,
  student_bus_defaults, bus_change_requests, bus_check_records,
  afterschool_enrollments, class_homework_books, report_cards,
  student_homework_books, student_homework_progress CASCADE;
"
```

왜 트리거 disable: 다음 트리거들이 INSERT 시 자식 row **자동 생성** →
명시 insert 와 unique constraint / FK 충돌.
- `tg_class_student_seed_homework_books` on `class_students` INSERT
- `tg_class_homework_book_seed_students` on `class_homework_books` INSERT
- `tg_student_homework_book_seed_progress` on `student_homework_books` INSERT
- `handle_attendance_bus_sync` on `attendance` INSERT (bus_change_requests 자동 생성)

### 3. cloud → local public 데이터 insert (supabase-js)

FK 의존성 순으로 cloud `SELECT *` → local `INSERT` (chunk 500).
의존성 순:
```
academy_periods, bus_numbers, bus_time_slots, classes, publishers,
weekly_sentence_config, weekly_sentences,
profiles, students, teachers, notices,
bus_stops, series,
bus_stop_day_assignments, bus_stop_schedules, homework_books,
class_students, class_teachers, class_schedules,
attendance, student_bus_defaults, bus_change_requests, bus_check_records,
afterschool_enrollments,
class_homework_books, report_cards,
student_homework_books, student_homework_progress
```

user-id 컬럼은 sourceId → targetId remap (1번 결과 매핑 활용). 매핑되어야 하는 컬럼:
- `profiles.id`, `students.id`, `teachers.id`
- `class_students.student_id`, `class_teachers.teacher_id`
- `afterschool_enrollments.student_id`
- `attendance.student_id`, `attendance.recorded_by`
- `bus_change_requests.student_id`, `bus_change_requests.reviewed_by`
- `bus_check_records.student_id`, `bus_check_records.checked_by`
- `notices.author_id`
- `student_bus_defaults.student_id`

target user 없는 row 는:
- required (PK / NOT NULL FK): 스킵
- optional (recorded_by 등): NULL 로

### 4. 트리거 다시 enable (개별)

```bash
docker exec supabase_db_scwonderland-local psql -U postgres -d postgres -c "
do \$\$
declare r record;
begin
  for r in
    select c.relname as t, t.tgname
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname='public' and not t.tgisinternal and t.tgenabled = 'D'
  loop
    execute format('alter table public.%I enable trigger %I', r.t, r.tgname);
  end loop;
end\$\$;
"
```

⚠️ 일괄 `ALTER TABLE ... ENABLE TRIGGER USER` 가 일부 트리거에 안 먹는
케이스가 있다 — 위처럼 개별 `ENABLE TRIGGER <name>` 으로 가야 안전.

### 5. 타입 재생성
```bash
npm run db:types:local
```

## 함정 모음
- `supabase-js .from(t).delete().not(...)` 는 PostgREST `max_rows = 1000`
  제한 때문에 1000+ 행 테이블에선 일부만 지워질 수 있음.
  → docker exec + `TRUNCATE` 가 신뢰성 있음.
- `auth.admin.deleteUser(id, true)` 는 **soft delete**: email 이 무작위
  문자열로 바뀌고 `deleted_at` 만 set 되며 **UUID 는 유지**됨. 그 UUID 로
  새 user 생성하려면 PK 충돌. hard delete 는 `deleteUser(id, false)` 또는
  인자 생략.
- INSERT 시 트리거가 자식 row 자동 생성 → unique constraint 충돌. truncate
  cascade 만으로는 부족, 트리거 disable 필수.
- 같은 UUID 인데 email 한 글자만 다른 stale row 가 local 에 있을 수 있음
  (예: `thdtlgu` vs cloud 의 `thdtlgn`). UUID PK 충돌로 createUser 실패.
  → 이런 case 는 cloud 기준으로 local 의 deviant row 먼저 hard delete.
- cloud auth 의 deleted (`deleted_at` set) user 도 `listUsers` 에 나옴.
  필요 시 필터.

## 비번 일괄 리셋 (`db:reset-passwords`)
- `scripts/reset-local-passwords.mjs` 는 auth.users 만 만지므로 새 스키마와
  무관 — **정상 작동**.
- 안전장치: URL 이 `127.0.0.1` / `localhost` 가 아니면 거부.
  필요 시 `ALLOW_REMOTE=true` 명시.

## 관련 파일
- `scripts/migrate-cloud-to-target.mjs` — **현 스키마에서 깨짐**.
  새 스키마에 맞게 재작성 필요 (TODO).
- `scripts/sync-full.sh` / `scripts/sync-no-auth.sh` — 위 스크립트에 의존,
  같이 깨짐.
- `scripts/reset-local-passwords.mjs` — 정상.
- `supabase/config.toml` `[auth] minimum_password_length` — "1111" 쓰려면 ≤ 4.
- `.env.cloud` — cloud `SUPABASE_SERVICE_ROLE_KEY` 보관.
