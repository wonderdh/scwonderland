# DB 리뷰

> 대상: `supabase/migrations/*` (30개), `supabase/AGENTS.md`, `supabase/config.toml`, `supabase/seed.sql`, `src/lib/supabase/{admin,server,client,storage}.ts`, `src/lib/types/database.generated.ts`.
> 리뷰 모드: 읽기 전용. 마이그레이션/코드 수정 없음.
> 코드 의존성: `src/app/(admin)/admin/homework/**`, `actions/{class-textbook,homework-unit,series,publisher,textbook,lunch,schedule}-actions.ts`, `src/lib/lunch/rotation.ts`, `src/components/homework/UnitProgressGrid.tsx`, `src/lib/types/database.generated.ts` 등 28+ 파일이 본 리뷰 대상 테이블에 의존.

---

## 1. 요약

전반적으로 **RLS 보안 모델, FK 컨벤션 의도, security definer trigger 의 RLS 위임 계약**이 잘 문서화되어 있고 일관성도 높은 편입니다. `private.get_my_role()` / `private.is_korean_teacher()` 헬퍼와 `(select private...)` 인라인 호출 패턴은 Supabase 권장 RLS 최적화를 그대로 따랐습니다. 그러나 **숙제 도메인이 한 달 안에 5~6회 대규모 재구조화**되면서 ① 컬럼명과 의미가 어긋난 부분 (`homework_books.title` 이 실질적으로 "교재 단권 이름"인데 `series.name` 이 표지·총단원 소유) ② `class_homework_books.textbook_id` 라는 옛 이름이 그대로 남아 새 이름 `class_homework_books.homework_book_id` 와 충돌 없는 척 잠복 ③ profiles(id) 를 가리키는 student_id 등 일부 컬럼이 중간에 students(id) 로 옮겨졌으나 lunch 시리즈는 처음부터 옳게 함 — 등 마이그레이션 흔적이 자국으로 남아 있습니다. **CRITICAL 수준은 1건**(`bus_change_requests` 의 student-self insert 가 임의 student_id 로 insert 허용), **HIGH 수준 4건** (RLS 가 학생 본인을 `profiles.id = auth.uid()` 가 아닌 `student_id = auth.uid()` 로 비교 — `student_id` 가 이미 students(id) 로 옮겨졌지만 shared PK 때문에 동작은 하나 컨벤션 위배, `class_schedules_select`/`bus_*_select`/`classes_select`/`class_students_select` 등 다수가 USING(true) 라 인증 누구나 전체 학생 명부 열람 가능, `student_homework_books_select` 의 학생-본인 비교가 `cs.student_id = auth.uid()` 인데 cs.student_id 는 이제 students(id) 라 OK 지만 의미 명확화 필요, attendance/report_cards 가 anon 에게 `GRANT ALL` — RLS 가 막더라도 위험한 grant) 입니다.

### 강점
- **2-stage RLS 헬퍼 (`private.get_my_role` SECURITY DEFINER + `is_korean_teacher`) + `(select …)` 인라인 wrap** — Postgres 16/17 의 RLS 캐시 최적화 그대로 적용.
- **security definer trigger 4개에 RLS 위임 계약 코멘트** (`20260509010000_homework_unit_progress_followups.sql`) — 트리거가 부모 테이블 RLS 에 의존한다는 사실을 코드로 못박음. 모범 사례.
- **FK 컨벤션** 문서화 (`supabase/AGENTS.md`) 및 일괄 교체 마이그레이션 (`20260512000000_role_specific_fks.sql`) 존재. 최근 추가된 lunch 시리즈는 처음부터 올바르게 students(id) / classes(id) / profiles(id) 분리.
- **soft-delete 후 동일 이름 재사용**을 부분 인덱스 `where is_active = true` 로 깔끔히 해결 (`series_name_active_uidx`, `publishers_name_active_uidx`).
- **트리거 시드 + 일회성 backfill 짝짓기** 패턴이 `20260521000000_backfill_class_homework_books_seed.sql` 에서 잘 보임 (rename 후 신규 시드 트리거가 옛 row 를 안 쳐서 backfill 필요한 케이스).

### 약점 (우선순위 순)
- **CRITICAL/HIGH 보안 정책 누수 1+4건** (8장 표 참조). 특히 `bus_change_requests_insert` 가 `student_id = auth.uid() OR staff` 라서 학생이 자기 id 로만 만들 수 있지만, `student_id` 컬럼에 자신의 id 를 어떻게든 넣은 row 는 어디서든 들어감. 더 큰 문제는 `attendance` / `bus_change_requests` / `report_cards` 등에 **`GRANT ALL ... TO anon`** 이 baseline 에 박혀 있음 — RLS 가 enabled 이면 안전하지만 RLS 사고나면 즉시 노출.
- **homework 도메인 마이그레이션 12개가 한 달간 누적**되어 truncate × 2회, drop column cascade × 5회, 테이블 rename × 2회. 운영 환경에 적용하려면 손으로 정리해야 하는 회복 불가 작업이 다수.
- `class_homework_books.textbook_id` 컬럼명 vs `homework_books` 테이블명 불일치 (textbook → homework_book 변경이 컬럼명까지 안 옴).
- `enum 대신 text + CHECK` 패턴이 도입 후 한 번도 enum 으로 승격 안 됨 (`status`, `lunch_group`).
- `profiles` 가 username/role 외에 학생/교사 공통 메타가 거의 없는데도 `students.id = profiles.id = auth.users.id` 가 shared PK 라 FK 잘못 걸려도 동작은 됨 — 컨벤션 위반이 정적으로 안 잡힘.
- 트리거 함수 본문에 `public.textbooks` / `public.class_textbooks` 가 들어 있어서 rename 마다 plpgsql 함수 재선언 필요 — 부서지기 쉬운 구조.

---

## 2. 스키마 전반 (테이블 그룹별)

### 2.1 인증 / 사용자 (auth → profiles → students/teachers)

```
auth.users (Supabase)
   └─ public.profiles (id PK = auth.users.id, role, username, deleted_at)
         ├─ public.students (id PK = profiles.id, korean_name, english_name, age, group_type, is_active)
         └─ public.teachers (id PK = profiles.id, teacher_type, name, is_active)
```

- **Shared PK 패턴**: `students.id = teachers.id = profiles.id = auth.users.id`. `ON DELETE CASCADE` 체인이 깔끔.
- 한 사용자는 학생이거나 교사이거나 admin 중 하나 — DB 레벨에 mutual exclusion 제약은 없음. `profiles.role` 만 일치하지 않을 수 있음 (예: profiles.role='admin' 인데 teachers row 가 존재). `is_korean_teacher()` 같은 헬퍼는 `teachers.teacher_type` 만 보지 profiles.role 을 보지 않음 — 잠재적 불일치.
- `profiles.role` 이 NULLable (`role public.user_role` without NOT NULL, default 없음). 신규 가입 후 role 부여 전 상태는 `private.get_my_role()` 가 NULL 반환 → 모든 staff RLS 통과 못함 (의도된 동작이긴 함).
- `profiles.username` 은 unique index `where username is not null` — 좋음. `profiles.deleted_at` 은 컬럼만 있고 RLS 정책에서 참조 안 됨 → soft-deleted profile 이 여전히 SELECT 됨.

### 2.2 반 / 시간표 / 출결 (classes / schedules / attendance)

```
academy_periods (name, start_time, end_time, group_type, sort_order)
   ←── class_schedules (class_id, academy_period_id, day_of_week, class_teacher_id)
   ←── classes (period_id, days_of_week int[], lunch_group, group_type, homework_days 이제 없음)
        ├─ class_students (class_id, student_id, is_active)
        ├─ class_teachers (class_id, teacher_id)
        └─ class_homework_books (class_id, textbook_id → homework_books.id, homework_days int[], skip_dates date[], start_unit, start_date)

attendance (student_id, attendance_date UNIQUE, status enum)
   → trigger handle_attendance_bus_sync → bus_change_requests upsert
```

- `class_schedules.day_of_week CHECK (1..5)` 와 `class_homework_books.homework_days <@ {0..6}` 의 **day 인덱싱 컨벤션이 다름** (1=월~5=금 vs 0=일~6=토). `classes.days_of_week` 도 1..5. 코드 (`src/lib/utils/date-kst.ts`) 에서 KST 변환할 때 헷갈리기 쉬운 자리.
- `academy_periods.is_active` 와 `has_dropoff` 를 `20260525000000` 에서 drop. `is_active` 가 없어진 후 `class_schedules` 가 `academy_period_id ON DELETE RESTRICT` 라 비활성화 대신 삭제로만 처리 가능 — soft delete 일관성 깨짐.
- `classes.period_id` 는 ON DELETE SET NULL — 반의 "시작 시간" 이 사라지면 NULL. 의도된 듯.
- `class_schedules.label` 자유 텍스트 — 무엇을 위한 라벨인지 코멘트 없음.
- `attendance` 는 `(student_id, attendance_date)` UNIQUE 인데 같은 키에 대해 일반 인덱스 (`attendance_student_id_attendance_date_key` constraint + `attendance_student_id_date_key` 인덱스) 가 **중복**으로 잡혀 있음 (baseline L557/L696).

### 2.3 숙제 (homework_books / class_homework_books / student_homework_books / progress / series / publishers)

```
publishers (id, name, homepage_url, is_active)
   ↑
series (id, name, publisher_id, is_active, total_units, cover_image_url)
   ↑
homework_books (id, title, level, sort_order, series_id, category, is_active)
   ↑
class_homework_books (class_id, textbook_id → homework_books.id, homework_days int[],
                       skip_dates date[], start_unit, start_date)
   ↑
student_homework_books (class_student_id → class_students(id),
                         class_homework_book_id)  UK (class_student_id, class_homework_book_id)
   ↑
student_homework_progress (student_homework_book_id, unit_number)  PK 컴포지트
                          status text check ('pending'|'completed'|'missed')
```

- **`class_homework_books.textbook_id`** 가 `homework_books.id` 를 가리키는데 옛 이름 그대로 — 컬럼명만 보면 textbooks 테이블이 어딨나 헷갈림.
- `series.total_units` 의 default 가 0 인데 trigger 가 `v_total <= 0 → return NEW` 로 skip 함. 결과: 신규 series 등록 후 total_units 를 안 정하고 책 부여하면 **progress 가 한 줄도 안 생김 → UI 에서 unit grid 가 비어 보임**. 이게 의도된 graceful skip 인지 아니면 데이터 누락 버그인지 코멘트 부족.
- progress 테이블의 PK 가 `(student_homework_book_id, unit_number)` 라 surrogate `id uuid` 가 없음. 클라이언트가 single row 를 식별할 때 두 컬럼 다 보내야 함 — DX 살짝 불편. Action `homework-unit-actions.ts` 에서 어떻게 처리하는지는 별도 코드 리뷰 대상.
- `student_homework_books` 가 progress 와 책 부여 사이 mapping table 역할. RLS chain: `progress → shb → cs (class_students) → auth.uid()` 까지 4-hop join. 학생 SELECT 가 매번 4단 EXISTS — 인덱스로 충분히 빠를 거지만 모니터링 필요.
- 마이그레이션 12개 누적 결과 트리거 함수 본문이 `class_textbooks` / `student_textbooks` → `class_homework_books` / `student_homework_books` / `homework_books` 로 3회 재선언. 늦은 바인딩 함정 잘 인지하고 처리했음.
- `student_homework_progress.completed_at` 컬럼이 없음 (drop_unit_progress_restructure_progress 에서 빠짐). 완료 일시 추적 안 함 → 통계 산출 시 시점 정보 부재.

### 2.4 점심지도 (lunch_supervision)

```
classes.lunch_group text CHECK ('7세' | '6세')

lunch_leader_anchors (effective_from date, class_id, leader_student_id → students,
                       created_by → profiles)
   UNIQUE (effective_from, class_id)

lunch_class_order_anchors (effective_from date, lunch_group text CHECK,
                            first_class_id → classes, created_by → profiles)
   UNIQUE (effective_from, lunch_group)
```

- **FK 컨벤션 100% 준수**: leader_student_id → students, first_class_id → classes, created_by → profiles. 모범 사례.
- **anchor 회전 설계**: 변경한 날부터 영구 적용. 회전 계산은 `src/lib/lunch/rotation.ts` 에 있음 — DB 가 단순화되어 좋음.
- RLS 가 `admin_all` 하나로 통합 (`FOR ALL TO authenticated`) — 깔끔. 다만 학생/교사가 lunch monitor 페이지에서 본인 lunch 그룹 보려면 SELECT 권한이 admin 만이라 막혀 있을 텐데 의도된 듯 (admin 전용 페이지). `/lunch-monitor` 페이지에서 SELECT 막힘 → 빈 화면 가능.
- `lunch_group` 이 enum 이 아니라 text+CHECK. classes.lunch_group 과 lunch_class_order_anchors.lunch_group 양쪽에 같은 CHECK 가 중복 정의. enum 화 후보.
- 두 anchor 테이블에 `updated_at` 컬럼은 있지만 `tg_set_updated_at` 트리거 부착 안 됨 — UPDATE 시 자동 갱신 안 됨. 명시 set 필요.

### 2.5 버스 (bus_*)

```
bus_time_slots, bus_numbers, bus_stops
bus_stop_day_assignments (bus_stop, bus_number, day_of_week, bus_time_slot)
bus_stop_schedules (bus_stop, day_of_week, bus_time_slot, estimated_time)
student_bus_defaults (student_id PK 일부, day_of_week, direction, time_slot, stop)
bus_change_requests (student_id, request_date UNIQUE,
                      change_type enum, status enum)
bus_check_records (student_id, check_date UNIQUE, time_slot, number)
```

- `student_bus_defaults` 의 PK 가 `(student_id, direction, day_of_week)` — 좋음. 그런데 `(student_id, day_of_week)` UNIQUE 가 별도로 추가됨 (baseline L667) — direction 무시. 같은 학생이 같은 요일에 pickup + dropoff 두 row 가 있으면 UNIQUE 위반 → **버그 잠재**. PK 와 모순됨.
- `bus_change_requests` 의 RLS insert 가 `student_id = auth.uid() OR staff`. 학생은 본인 id 의 row 만 만들 수 있긴 하지만, `new_bus_time_slot_id` / `new_bus_number_id` / `new_bus_stop_id` 가 모두 FK SET NULL 이고 CHECK 가 없음 → 학생이 `change_type = 'change'` 라고 주장하고 새 버스 정보를 자유롭게 골라 insert. status 도 default 'pending' 이라 무방하지만 RLS 가 status 컬럼 변경 제한 안 함 — 학생이 `bus_change_requests_update` 정책으로 자기 row 의 `status = 'approved'` 로 바꿀 수 있나 확인 필요. **CRITICAL 후보**.

### 2.6 공지 / 성적표 / 주간문장

- `notices` 는 author_id → profiles, `notices_public_read_published` 가 **TO authenticated, anon** USING `is_published = true OR admin`. anon 도 published 공지 읽을 수 있게 의도된 듯.
- `weekly_sentences_public_read` / `weekly_sentence_config_public_read` 도 anon select 허용. 의도된 듯하나 `weekly_sentences` 가 학원 커리큘럼 컨텐츠라 anon 노출 의도 다시 확인 권장.
- `report_cards` 가 `class_student_id` / `class_teacher_id` 기반으로 재구조됨 (`20260525000000`). 학생 본인 `student_id = auth.uid()` 비교가 EXISTS class_students 한 단계 join 으로 바뀜 — 더 엄격해진 셈.
- `weekly_sentence_config.id integer PRIMARY KEY` 인데 default sequence 없음 (singleton row 가정?). 실수로 두 row insert 가능.

---

## 3. FK 컨벤션 준수

`supabase/AGENTS.md` 기준 표:

| 카테고리 | 컬럼 의미 | 참조해야 할 테이블 |
|---|---|---|
| 학생 컬럼 | `student_id`, `leader_student_id`, … | `public.students(id)` |
| 교사 컬럼 | `teacher_id`, `class_teacher_id`, … | `public.teachers(id)` 또는 `class_teachers(id)` |
| Actor (admin 가능) | `assigned_by`, `recorded_by`, `marked_by`, `updated_by`, `author_id`, `reviewed_by`, `checked_by`, `created_by` | `public.profiles(id)` |

### 준수 ✅
- `students` 가 FK 인 컬럼: `attendance.student_id`, `bus_change_requests.student_id`, `bus_check_records.student_id`, `student_bus_defaults.student_id`, `class_students.student_id`, `afterschool_enrollments.student_id`, `lunch_leader_anchors.leader_student_id`. (baseline L911~966, L1066, lunch L34)
- `teachers` 가 FK 인 컬럼: `class_teachers.teacher_id`, `class_schedules.class_teacher_id`, `report_cards.class_teacher_id → class_teachers(id)` (간접). (baseline L1011, L1031, 20260525 L120)
- Actor 컬럼이 `profiles` 인 곳: `attendance.recorded_by`, `bus_change_requests.reviewed_by`, `bus_check_records.checked_by`, `notices.author_id`, `lunch_leader_anchors.created_by`, `lunch_class_order_anchors.created_by`. (baseline L916, L941, L961, L1036, lunch L35/L58)

### 의문점 / 잔존 이슈 ⚠️
- `homework_books.title` 이 사실 책의 단권 이름인데 series + level 이 결합되어야 하는 경우가 많아 보임 — FK 자체는 OK 지만 series_id 가 NULLable, level NULLable 이라 모델링이 살짝 느슨.
- `report_cards` 재구조 전(baseline L1046) `report_cards.author_id → profiles(id)` 였다가 `20260514000000` 에서 `author_id` → `teacher_id` rename + `teachers(id)` FK 로 교체, 다시 `20260525000000` 에서 `teacher_id` → `class_teacher_id` + `class_teachers(id)` FK. **3중 회전**. 회전이 끝났으니 현재 상태는 OK 지만 PR 리뷰에서 cross-reference 가 깨질 위험 큼.
- `class_schedules.class_teacher_id` 가 `teachers(id)` 를 가리킴 (이름은 `class_teacher_id` 인데 참조는 teachers). 컬럼명 그대로면 `class_teachers(id)` 를 가리키는 게 직관 — 이름과 참조가 어긋남. (baseline L1011 vs 20260525 L40-50)
- `class_homework_books.textbook_id` — 이름은 textbook 인데 참조는 `homework_books(id)`. `homework_book_id` 로 rename 후보.

### 위반 사례 ❌ (현재 시점)
없음. 옛 위반 (homework_progress_mvp 시절 student_id → profiles) 은 `20260512000000_role_specific_fks.sql` 에서 모두 students(id) 로 교체. lunch 도 처음부터 옳음.

### 의도된 profiles(id) FK
모두 actor 컬럼: `assigned_by` (예전), `recorded_by`, `marked_by` (예전), `updated_by` (예전), `author_id`, `reviewed_by`, `checked_by`, `created_by`. 적절.

---

## 4. RLS / 보안

### 4.1 헬퍼 함수
- `private.get_my_role()` — SECURITY DEFINER, search_path 'public', revoke from public + grant authenticated/service_role. 모범.
- `private.is_korean_teacher()` — 동일 패턴. 모범.

### 4.2 정책 패턴

대부분 테이블이 4-policy quartet (`*_select`, `*_admin_insert`, `*_admin_update`, `*_admin_delete`) 또는 staff 변형. 일관성 좋음.

### 4.3 SELECT 정책 — 너무 느슨한 곳 (HIGH)

| 테이블 | 정책 | USING | 위험 |
|---|---|---|---|
| `academy_periods` | `academy_periods_select` | `true` | 인증된 누구나 학원 시간표 열람 — 의도된 듯 |
| `class_schedules` | `class_schedules_select` | `true` | 모든 반 모든 시간표 노출 — 학생이 본인 반 외 시간표까지 본다 |
| `class_students` | `class_students_select` | `true` | **모든 학생 명부 + 반 매핑 전체 노출**. 학생 A 가 학생 B 가 어느 반인지 다 봄 |
| `class_teachers` | `class_teachers_select` | `true` | 교사 명부 + 반 매핑 전체 |
| `classes` | `classes_select` | `true` | 반 이름·그룹타입·days_of_week·lunch_group·period_id 전체 |
| `bus_numbers` / `bus_stops` / `bus_time_slots` / `bus_stop_schedules` / `bus_stop_day_assignments` | `*_select` | `true` | 버스 마스터데이터 전체 (의도된 듯, 학생이 본인 버스 노선 확인 필요) |
| `weekly_sentence_config` / `weekly_sentences` | `*_public_read` | `true` (anon 포함) | 주간 문장 컨텐츠 anon 노출 — 의도된 듯 |
| `notices` | `notices_public_read_published` | `is_published = true OR admin` (anon 포함) | 의도된 듯 |

→ `class_students`, `classes`, `class_teachers` 의 `USING(true)` 는 학생끼리 다른 반 명부를 보게 함. 학원 도메인에서 어느 정도 허용되는 부분이긴 하나, **학생→학생 PII 노출 정책** 으로 명문화 권장.

### 4.4 anon GRANT (HIGH)

`baseline` L1540-1655 에서 다음 테이블들이 `GRANT ALL ... TO anon`:
- `attendance`, `bus_change_requests`, `bus_check_records`, `bus_numbers`, `bus_stop_day_assignments`, `bus_stop_schedules`, `bus_stops`, `bus_time_slots`, `notices`, `report_cards`, `student_bus_defaults`, `weekly_sentence_config`, `weekly_sentences`

RLS 가 enabled 이면 안전하지만, **방어 심층 (defense in depth) 원칙**으로는 anon 에게 ALL 대신 필요한 SELECT 만 줘야 함. 정책에 버그가 생기는 순간 즉시 데이터 유출. 다른 일부 테이블 (`academy_periods`, `class_schedules`, `class_students`, `classes`, `profiles`, `students`, `teachers`) 은 `SELECT, MAINTAIN` 만 받는데 — 일관성 없음.

### 4.5 학생 본인 비교 — 의미 점검 (MEDIUM)

- `student_textbooks_select` (구버전 정책, 현재는 `student_homework_books_select`) 가 `student_id = auth.uid()` 비교. `student_id` 컬럼이 처음에는 profiles(id) 였다가 students(id) 로 교체. shared PK 라 값은 같으나 컬럼 의미상 `students.id = profiles.id = auth.uid()` 라는 가정에 의존. profiles row 가 없는 students row 가 만들어지면 (이론상 불가하지만 FK CASCADE 사고로) 깨짐.
- `student_homework_books_select` (20260520 L83) 가 `cs.student_id = auth.uid()` — 같은 가정.
- `bus_change_requests_*` (insert/select/update/delete 전부) 가 `student_id = auth.uid()`. `bus_change_requests.student_id` 가 students(id) 이고 학생은 자기 row 만 R/W. **그러나 update with check 가 staff OR self 라 학생이 자기 row 의 `status = 'approved'` 로 직접 바꿀 수 있음 — CRITICAL 후보** (8장 참조).
- `attendance_select` 가 `student_id = auth.uid()` — 학생 본인 출결만 보임. OK.
- `report_cards_select` (20260525 L133) 가 EXISTS class_students join. 더 엄격해짐. 좋음.

### 4.6 Storage RLS

- `textbook-covers` 버킷: public read (`for select to public`), admin/korean-teacher insert/update/delete.
- 다른 버킷 (`notice-files`, `class-notices`, `academy-notices`, `homework-submissions`) 은 `src/lib/supabase/storage.ts` 에 상수로만 있고 마이그레이션에 정책 없음. 정책 누락이면 anon 도 자유 R/W. **CRITICAL 후보, 별도 확인 필요**.

### 4.7 SECURITY DEFINER trigger
- 4개 함수 모두 `set search_path to 'public'` 명시 + owner postgres + RLS 위임 코멘트. 안전.
- `handle_attendance_bus_sync` 는 `set search_path to 'public', 'pg_catalog'` 로 명시적 — `bus_change_requests` upsert 시 RLS 우회. attendance staff 만 mutate 가능하므로 RLS 우회는 안전한 사용.

---

## 5. 인덱스 & 성능

### 5.1 잘 잡힌 인덱스 ✅
- `attendance (student_id, attendance_date)` UNIQUE + 개별 column 인덱스.
- `class_schedules` 의 `(class_id, day_of_week)`, `(teacher_id, day_of_week)`, `academy_period_id` — 시간표 조회 패턴 적합.
- `homework_books` / `series` / `publishers` 의 `*_active_idx` (단순 boolean) — partial 가 더 효율적이지만 cardinality 가 낮아도 적당.
- `series_name_active_uidx (lower(name)) where is_active = true` — partial unique. 모범.
- `homework_unit_progress` (현재 폐기) 시절 `(student_id, textbook_id)` composite + status 별도. 패턴이 좋았음.
- 새 `student_homework_progress` 의 PK `(student_homework_book_id, unit_number)` — leading column 만으로 충분한 조회 (특정 책의 전체 unit). `status` 만 별도.
- `idx_classes_period_id` 등 FK 컬럼 인덱스가 잘 동반됨.

### 5.2 중복/누락 인덱스 (LOW)
- `attendance_student_id_attendance_date_key` UNIQUE constraint (자동 인덱스 생성) + `attendance_student_id_date_key` 일반 unique index — **거의 동일**, 하나 제거 가능.
- `bus_change_requests_student_id_request_date_key` UNIQUE + `bus_change_requests_student_id_date_key` 별도 unique index — 동일 중복.
- `bus_check_records` 유사. baseline L696, L700.
- `classes.lunch_group` 인덱스 없음 — `where lunch_group = '7세'` 자주 쿼리 시 풀스캔. (lunch_group 인구가 작아 무시 가능)
- `class_homework_books.skip_dates` 가 GIN 인덱스 없음 — 옛 `class_textbooks_skip_dates_gin` 은 `20260515` 의 column drop cascade 로 사라짐. 새 `class_homework_books.skip_dates` (`20260524000000`) 에는 GIN 안 만듬. 날짜 containment 쿼리가 자주 일어나면 추가 권장.
- `homework_books.series_id` 인덱스 있음 (`textbooks_series_id_idx` 가 rename 따라옴). OK.
- `student_homework_books (class_student_id)` + `(class_homework_book_id)` 둘 다 있고 UK 도 있음. 좋음.

### 5.3 잠재적 N+1 / 성능 핫스팟 (MEDIUM)
- **`student_homework_progress` 의 학생 SELECT** 가 progress → shb → cs → auth.uid() 4-hop. progress row 가 학생당 수십~수백 개 (책 × unit) 이라 페이지당 50~100 rows × 4 join × auth.uid() = 200~400 inner index scan. RLS 가 매 row마다 evaluate. 학생 본인은 본인 책만 보면 되므로 캐시 잘 먹지만 admin/teacher 의 전체 조회는 RLS optimizer 가 staff 분기를 어떻게 plan 하느냐에 따라 다름.
- `series_owns_units_and_cover` 마이그레이션의 backfill loop (DO $$) 가 series row 마다 mode() + subquery — series 수가 적으면 OK 지만 수백 개면 느림. 1회성이라 무방.
- `tg_class_student_seed_progress` (재선언본) 가 class_students 가 N row 늘 때마다 N × ct rows 만큼 insert — 큰 반 일괄 등록 시 트랜잭션 길어짐.
- `handle_attendance_bus_sync` 는 매 attendance 변경마다 trigger fire — 출결 일괄 import 할 때 N × bus_change_requests upsert. exception handler 에서 warning 만 raise 라서 한 row 실패해도 attendance 자체는 성공 — 좋은 패턴.

### 5.4 풀스캔 가능성
- `classes.period_id IS NULL` (방과후 반) 조회 시 partial index 없음. 방과후 반이 많지 않으면 무시.
- `homework_books.is_active = false` 조회 — partial 없음. 보통 admin 전용이라 OK.

---

## 6. 마이그레이션 히스토리 (위험 신호)

### 6.1 회전 횟수 큰 도메인
| 도메인 | 마이그레이션 수 (1개월) | 회전 작업 |
|---|---|---|
| homework (textbook → homework_book) | 12개 | rename × 2, drop column cascade × 5, truncate × 2, 트리거 재선언 × 5 |
| report_cards | 3개 | rename × 2 (author_id → teacher_id → class_teacher_id), FK 재정의 × 2 |
| academy_periods | 2개 | column drop × 3 (group_label, is_active, has_dropoff), data delete (afterschool) |
| series | 3개 | sort_order drop, total_units/cover_image_url 이관 (homework_books → series) |

### 6.2 데이터 손실 위험 (HIGH)
- `20260516000000` 의 `truncate public.student_textbook_progress cascade` + `truncate public.student_homework_books cascade` — dev 환경 주석 있음. 운영 적용 시 즉시 진도 0.
- `20260518000000` 의 `truncate public.student_homework_progress cascade` — 동일.
- `20260525000000` 의 `DELETE FROM report_cards rc WHERE NOT EXISTS (SELECT 1 FROM class_students WHERE student_id = rc.student_id)` — 어떤 반에도 등록된 적 없는 학생 성적표 삭제. 환영 메시지 단축 가능하지만 운영에 적용하면 데이터 손실.
- `20260525000000` 의 `DELETE FROM academy_periods WHERE group_type = 'afterschool'` — 운영 적용 시 afterschool periods 사라짐.

→ 운영에 적용한 적이 없는 dev-only 마이그레이션 이라면 OK 지만, **roll-forward 만 가능, rollback 사실상 불가**. 운영 DB 가 이미 적용된 상태라면 무방.

### 6.3 Timestamp 충돌
- `20260525000000` vs `20260526000000` vs `20260527000000` — 시퀀셜 OK.
- `20260530000000_lunch_supervision.sql` vs `20260530100000_classes_period_id.sql` — 같은 날짜 하루에 두 마이그레이션. 두번째가 `_100000` 접미사로 회피. 커밋 메시지 `fix(migrations): classes_period_id timestamp 충돌 회피 (lunch_supervision 과 동일 prefix)` 가 확인. 잘 처리됨.

### 6.4 Idempotency / 안전성
- 거의 모든 마이그레이션이 `if not exists` / `if exists` / `on conflict do nothing` 사용. 모범.
- 일부 (`20260525000000_refactor_classes_periods_schedules_report_cards.sql`) 는 BEGIN/COMMIT 으로 트랜잭션 명시. 더 안전.
- `20260528000000_fix_nagichang_total_units.sql` 의 DO $$ 가드 (`bad_count > 0 → raise exception`) — 잘 짠 safety net.
- `20260530100000_classes_period_id.sql` 의 이름 파싱 정규식 (`^[^/]+/[^_]+_[MTWhF]+_[0-9]+:[0-9]+$`) — 이름 규칙이 깨지는 반은 skip. 의도된 동작.

### 6.5 Rollback 가능성
- `lunch_supervision.sql` 에 ROLLBACK 주석 있음. 좋음.
- 나머지는 거의 없음. 특히 truncate + drop column cascade 는 rollback 불가.

---

## 7. 명명 / 모델링 일관성

### 7.1 명명 일관성 ⚠️
| 위치 | 이슈 | 권장 |
|---|---|---|
| `class_homework_books.textbook_id` | 테이블은 homework_books 인데 컬럼 이름은 textbook_id | `homework_book_id` 로 rename 또는 코멘트 추가 |
| `class_schedules.class_teacher_id` 가 `teachers(id)` 참조 | 컬럼명은 class_teacher 인데 FK 가 teachers — `class_teachers(id)` 가 직관 | `report_cards.class_teacher_id` 처럼 `class_teachers(id)` 로 통일하거나 컬럼명을 `teacher_id` 로 되돌리기 |
| `class_homework_books` 의 `homework_days int[]` vs `classes.days_of_week int[]` | 같은 컨셉 다른 이름 (요일 비트맵) | 한쪽 통일 |
| `homework_completion` → `homework_unit_progress` → `student_homework_progress` | 세 번 rename. 현재는 후자 | 통일됨, 코멘트 부족 |
| `enums vs text+CHECK` | `attendance_status` / `bus_change_status` / `class_group` / `teacher_type` / `user_role` 는 enum. `homework_status` / `lunch_group` 은 text+CHECK | 일관성: enum 으로 승격 또는 text 로 통일 |

### 7.2 0-based vs 1-based 요일
- `class_homework_books.homework_days <@ {0..6}` (0=일~6=토, KST)
- `classes.days_of_week <@ {1..5}` (1=월~5=금)
- `class_schedules.day_of_week CHECK (1..5)` (월~금)
- `afterschool_enrollments.day_of_week CHECK (1..5)` (월~금)

→ **한 도메인 내에서 두 표기 혼재**. `class_homework_books.homework_days` 만 0..6 인 이유: 일요일/토요일 숙제 출제 가능성 때문. 그러나 운영 코드 (`src/lib/utils/date-kst.ts`) 에서 변환 mismatch 위험. 명확한 코멘트 + 변환 헬퍼가 한 곳에 모이도록.

### 7.3 ON DELETE 정책
| 패턴 | 케이스 | 평가 |
|---|---|---|
| CASCADE | 학생-반 / 학생-책 / 진도 등 자식 row | 좋음 |
| SET NULL | actor 컬럼 (`recorded_by`, `assigned_by`, `created_by`, …) | 좋음 |
| RESTRICT | `class_schedules.academy_period_id → academy_periods` | 일관성 깨짐. 다른 모든 ap FK 는 SET NULL. 의도된 듯 (period 삭제 못 하게) — but 다른 곳도 통일 권장 |

### 7.4 Soft delete vs Hard delete
- `is_active boolean` 사용: classes, students, teachers, bus_numbers, bus_stops, bus_time_slots, series, publishers, homework_books, class_students.
- `deleted_at timestamptz` 사용: profiles 만.
- 둘 다 정책에 반영 안 됨: `profiles.deleted_at IS NOT NULL` 인 row 도 RLS 통과 (`profiles_select` 정책 USING 에서 deleted_at 체크 없음). soft-deleted profile 이 여전히 보임.

→ **컨벤션 분기**: 학생/교사는 is_active false 로 비활성, profiles 는 deleted_at 로. 한 패턴으로 통일 권장. `homework_unit_progress` (폐기) 의 `completed_at` 도 soft 시점 추적 — 살아남았으면 비교 가능했을 것.

### 7.5 컨벤션 일관성 점수
- 트리거 함수 이름: `tg_<context>_<action>` — 매우 일관.
- 정책 이름: `<table>_<role>_<verb>` 또는 `<table>_<verb>` — 일관.
- 인덱스 이름: `<table>_<col>_idx` 와 `idx_<table>_<col>` 혼재. baseline 은 `idx_<table>_<col>`, 신규 마이그레이션은 `<table>_<col>_idx`.

---

## 8. 개선 권장사항 (Severity / Effort / Impact)

| # | 이슈 | Severity | Effort | Impact | 우선순위 |
|---|---|---|---|---|---|
| 1 | `bus_change_requests_update` 정책이 학생 본인 row 의 status / change_type / reviewed_by 컬럼을 column-level 제한 없이 허용 — 학생이 자기 요청을 `approved` 로 셀프승인 가능 잠재. WITH CHECK 에 status 변경 시 staff 만 통과하도록 분기, 또는 self-update 시 status='pending' 강제 trigger. | CRITICAL | M | HIGH | 즉시 |
| 2 | `attendance` / `bus_change_requests` / `report_cards` / `bus_check_records` / `student_bus_defaults` / `notices` 에 대한 `GRANT ALL TO anon` (baseline L1540-1655) — RLS 사고 시 즉시 PII 유출. `SELECT, MAINTAIN` 또는 더 좁게 줄여야. | HIGH | S | HIGH | 즉시 |
| 3 | `class_students_select` / `classes_select` / `class_teachers_select` 가 `USING(true)` — 학생끼리 다른 반 명부 노출. 적어도 `student_id = auth.uid() OR EXISTS staff` 로 좁히기. | HIGH | M | MEDIUM | 즉시 |
| 4 | `student_bus_defaults` 의 PK `(student_id, direction, day_of_week)` 와 UNIQUE `(student_id, day_of_week)` 가 모순. UNIQUE 가 direction 무시해 pickup + dropoff 동시 등록 막음. UNIQUE 제거 필요. | HIGH | XS | MEDIUM | 즉시 |
| 5 | `notice-files` / `class-notices` / `academy-notices` / `homework-submissions` storage 버킷의 RLS 정책이 마이그레이션에 없음 — 코드는 참조하는데 정책 누락이면 anon R/W 가능. 즉시 확인. | HIGH | S | HIGH | 즉시 |
| 6 | `series.total_units = 0` 인 series 에 책 부여 시 progress 가 한 줄도 시드 안 됨 — silent UX 결함. trigger 에 raise warning 또는 series.total_units > 0 NOT NULL 제약. | MEDIUM | S | MEDIUM | 1주 |
| 7 | `class_homework_books.textbook_id` → `homework_book_id` rename. textbooks 테이블이 더 이상 없으니 이름 정합성 회복. 단, 마이그레이션 cascade 위험 — 시리즈 rename 한 번 더 추가. | MEDIUM | M | LOW | 백로그 |
| 8 | `class_schedules.class_teacher_id` 가 `teachers(id)` 참조 — 컬럼명과 FK 불일치. `report_cards.class_teacher_id → class_teachers(id)` 와 일관되게 정렬. | MEDIUM | M | LOW | 백로그 |
| 9 | `homework_status` / `lunch_group` 을 text+CHECK 에서 enum 으로 승격. type safety + DB 자체 catalog 활용. | MEDIUM | S | LOW | 백로그 |
| 10 | `class_homework_books.skip_dates` GIN 인덱스 추가. 옛 `class_textbooks_skip_dates_gin` 이 rename 시 사라짐. | MEDIUM | XS | MEDIUM | 1주 |
| 11 | `attendance_student_id_date_key` / `bus_change_requests_student_id_date_key` / `bus_check_records_student_id_check_date_key` 중복 인덱스 정리 (UNIQUE constraint 가 자동 인덱스 만들어줌). | LOW | XS | LOW | 백로그 |
| 12 | `profiles.deleted_at IS NULL` 을 `profiles_select` 등 RLS 에 반영하거나, soft-delete 패턴 통일. | LOW | M | MEDIUM | 백로그 |
| 13 | `lunch_leader_anchors` / `lunch_class_order_anchors` 에 `tg_set_updated_at` 트리거 부착 (현재 누락). updated_at 컬럼이 있지만 자동 갱신 안 됨. | LOW | XS | LOW | 1주 |
| 14 | 요일 인덱싱 (0..6 vs 1..5) 혼재. 한쪽 정리 또는 명확한 변환 헬퍼 단일화. | LOW | L | MEDIUM | 백로그 |
| 15 | 인덱스 이름 컨벤션 (`idx_<table>_<col>` vs `<table>_<col>_idx`) 한쪽 통일. | LOW | S | LOW | 백로그 |
| 16 | `weekly_sentence_config.id` 가 sequence 없음 + singleton 가정. CHECK `id = 1` 또는 trigger 로 enforce. | LOW | XS | LOW | 백로그 |
| 17 | 마이그레이션의 `truncate` 가 dev-only 라는 사실을 파일명에 명시 (`_dev_only` 접미사 또는 README 표). 운영 실수 방지. | LOW | XS | MEDIUM | 1주 |
| 18 | `class_homework_books.start_date` 컬럼이 `20260515` cascade 에서 살아남았는지 확인 — `homework_days/skip_dates/start_unit` 만 drop 했고 start_date 는 따로 안 봄. trigger 가 start_date 안 쓰면 dead column. | LOW | XS | LOW | 백로그 |

S = Small (1~4h), M = Medium (1d), L = Large (2~5d), XS = Trivial.

---

## 9. 재사용 가능 패턴 (Boilerplate 후보)

이 코드베이스에서 잘 돌아가는 패턴들 — 새 테이블 추가 시 그대로 베껴 쓸 수 있는 템플릿.

### 9.1 표준 4-policy quartet (admin-only mutation)

```sql
alter table public.<TABLE> enable row level security;

drop policy if exists "<TABLE>_select" on public.<TABLE>;
create policy "<TABLE>_select" on public.<TABLE>
  for select to authenticated
  using (true);  -- 또는 student_id = auth.uid() OR staff

drop policy if exists "<TABLE>_admin_insert" on public.<TABLE>;
create policy "<TABLE>_admin_insert" on public.<TABLE>
  for insert to authenticated
  with check ((select private.get_my_role()) = 'admin'::public.user_role);

drop policy if exists "<TABLE>_admin_update" on public.<TABLE>;
create policy "<TABLE>_admin_update" on public.<TABLE>
  for update to authenticated
  using  ((select private.get_my_role()) = 'admin'::public.user_role)
  with check ((select private.get_my_role()) = 'admin'::public.user_role);

drop policy if exists "<TABLE>_admin_delete" on public.<TABLE>;
create policy "<TABLE>_admin_delete" on public.<TABLE>
  for delete to authenticated
  using ((select private.get_my_role()) = 'admin'::public.user_role);

grant select, insert, update, delete on public.<TABLE> to authenticated;
```

`(select private.get_my_role())` 의 select-wrap 은 Supabase 의 RLS 정책 캐시 최적화에 필수. 반복 호출이 1회로 합쳐짐.

### 9.2 Soft delete + 활성 row 사이 unique
```sql
create unique index if not exists <TABLE>_name_active_uidx
  on public.<TABLE> (lower(name))
  where is_active = true;
```
→ 비활성으로 내린 후 같은 이름 재사용 허용. `series`, `publishers` 에 적용됨.

### 9.3 updated_at trigger
```sql
drop trigger if exists tg_<TABLE>_set_updated_at on public.<TABLE>;
create trigger tg_<TABLE>_set_updated_at
  before update on public.<TABLE>
  for each row execute function public.tg_set_updated_at();
```

### 9.4 SECURITY DEFINER trigger 위임 계약 코멘트
```sql
comment on function public.tg_<X>() is
  'SECURITY DEFINER: relies on parent <TABLE> RLS (admin only insert). Do not relax without audit.';
```
→ trigger 가 RLS 우회한다는 사실 + 어느 정책에 의존하는지 명시. `20260509010000_homework_unit_progress_followups.sql` 의 모범.

### 9.5 일회성 seed + 신규 트리거 결합
신규 테이블 추가 시 (1) trigger 가 부모 row 의 신규 INSERT 처리, (2) 기존 row 는 같은 마이그레이션 안에서 `on conflict do nothing` 로 backfill. `20260521000000_backfill_class_homework_books_seed.sql` 참조.

### 9.6 멱등 ALTER + DO 가드
```sql
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = '<NAME>'
      and conrelid = 'public.<TABLE>'::regclass
  ) then
    alter table public.<TABLE>
      add constraint <NAME> check (...);
  end if;
end$$;
```
→ `20260508010000_homework_schedule_columns.sql` 의 패턴. CHECK 추가 시 idempotent.

### 9.7 actor 컬럼 (profiles FK) 표준
```sql
created_by   uuid references public.profiles(id) on delete set null,
updated_by   uuid references public.profiles(id) on delete set null,
```
ON DELETE SET NULL — actor 가 사라져도 도메인 row 는 보존. `lunch_supervision.sql` 의 모범.

### 9.8 학생/교사 FK 표준
```sql
student_id         uuid not null references public.students(id) on delete cascade,
teacher_id         uuid references public.teachers(id) on delete set null,
class_student_id   uuid not null references public.class_students(id) on delete cascade,
class_teacher_id   uuid references public.class_teachers(id) on delete set null,
```
컨벤션 명문: 학생/교사 본질은 cascade, class 매핑 본질은 cascade (mapping 삭제 = 도메인 row 도 무의미), actor 는 set null.

### 9.9 다단계 RLS — 학생 본인 비교 EXISTS 패턴
```sql
exists (
  select 1
  from public.class_students cs
  where cs.id = <TABLE>.class_student_id
    and cs.student_id = (select auth.uid())
)
```
→ `report_cards_select` (20260525) 의 모범. `student_id = auth.uid()` 직접 비교보다 의미가 명확하고 students(id) 컨벤션 위반 위험 없음.

### 9.10 ROLLBACK 주석 동반
```sql
-- ROLLBACK:
-- BEGIN;
-- DROP TABLE IF EXISTS public.<NEW_TABLE>;
-- COMMIT;
```
→ `lunch_supervision.sql` 의 모범. 새 테이블 추가 시 자동으로 같이 작성하는 PR 템플릿 검토 권장.

---

## 추가 메모

### 코드 의존성 그래프 (요약)
homework 도메인 28개 파일이 `student_homework_*` / `class_homework_books` / `series` / `homework_books` 에 의존. 가장 비중 큰 곳:
- `src/app/(admin)/admin/actions/{class-textbook,homework-unit,series,publisher,textbook}-actions.ts` — 모든 mutation 진입점.
- `src/components/homework/UnitProgressGrid.tsx` — student_homework_progress 의 unit grid 렌더링.
- `src/app/academy/teacher/homework/_components/TeacherTextbooksClient.tsx` — teacher view.
- `src/lib/lunch/rotation.ts` — anchor → 실제 회전 계산.
- `src/lib/types/database.generated.ts` — 자동 생성, 모든 동의어.

### 결론
- **승인 여부**: REQUEST CHANGES — CRITICAL 1건 (bus_change_requests self-approve 잠재), HIGH 4건 존재. 다만 dev 환경에서 이미 적용된 마이그레이션이라 *마이그레이션 자체를 거부* 는 비현실적. **추가 마이그레이션으로 후속 보완** 권장 (8장 표 1~5번).
- **재사용 패턴**: 9장의 10개 boilerplate 는 next sprint 의 `supabase/AGENTS.md` 부록 또는 `docs/migration-template.md` 로 옮길 가치 충분.
