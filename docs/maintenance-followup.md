# 점검 종료 전 후속 작업

작성일: 2026-05-02
배경: cutover (commit 2f46b6a + f4df53e) 이후 코드/스키마 회귀 fix 작업의 1차 패치는 끝났으나, 운영 재개 전 정리해야 할 항목이 남아있음. 점검 페이지(`MAINTENANCE_MODE` 미들웨어)가 떠있는 동안에는 호출되지 않으므로 안전하지만, `MAINTENANCE_MODE=off` 로 풀기 전에 아래 모두 처리.

---

## 0. **즉시 별도 처리 (점검과 무관)**

### 0-1. service_role 키 평문 커밋 (HIGH 보안)
- 위치: `scripts/migrate-cloud-to-local.mjs:14, 17, 151`
- 현재 cloud `service_role` 키와 비밀번호가 평문으로 git history 에 남음.
- 조치:
  1. cloud 콘솔에서 service_role 키 즉시 로테이션
  2. git history 청소 (`git filter-repo` 또는 `git filter-branch`)
  3. 스크립트는 env 화 (`migrate-cloud-to-target.mjs` 와 동일 패턴)

---

## 1. **운영 재개 전 필수 — 코드 refactor**

다음 9 파일에 `// @ts-nocheck` 또는 deprecate stub 이 적용되어 있음. 운영 재개 시 호출되면 빈 데이터/에러 발생.

### 1-A. 사라진 도메인 — schema 추가 결정 후 복원 OR 코드 삭제
신 스키마(database.generated.ts)에 테이블이 없어서 호출 시 PGRST204:

| 파일 | 사라진 테이블 |
|---|---|
| `src/app/(admin)/admin/actions/textbook-actions.ts` | `textbooks`, `class_textbooks`, `student_textbook_progress` |
| `src/app/(admin)/admin/actions/homework-actions.ts` | `homework_assignments`, `homework_submissions`, `homework_submission_files` |
| `src/app/(admin)/admin/actions/lunch-actions.ts` | `lunch_*` (lunch_groups, lunch_leader_anchors, …) |
| `src/app/(admin)/admin/actions/class-notice-actions.ts` | `class_notices`, `notice_attachments` |
| `src/app/(admin)/admin/actions/learning-actions.ts` | `learning_records` |
| `src/app/(bus)/bus/layout.tsx` + `actions.ts` | `bus_staff` + `user_role`에 `"bus"` enum |

**결정 필요**: 각 도메인 schema 복원 vs 기능 폐지.

### 1-B. 신 스키마와 컬럼명 불일치 — 패턴 변환 refactor
신 스키마에 테이블은 있지만 컬럼명이 변경됨:

| 변경 |
|---|
| `students.profile_id` → `students.id` (Shared PK) |
| `teachers.profile_id` → `teachers.id` (Shared PK) |
| `class_schedules.teacher_profile_id` → `class_schedules.teacher_id` |
| `class_schedules.student_profile_id` → 컬럼 자체 제거 (학생 개인 배정 폐지) |
| `class_students.student_profile_id` → `class_students.student_id` |
| `afterschool_enrollments.student_profile_id` → `afterschool_enrollments.student_id` |
| `profiles.first_name`/`last_name` → `profiles.username` |
| `bus_staff` 모든 참조 + `role:"bus"` → 도메인 폐지 OR enum 복원 |

ts-nocheck 처리된 파일:

| 파일 | 주요 잔존 패턴 |
|---|---|
| `src/app/(admin)/admin/actions/schedule-actions.ts` | teachers + class_schedules + class_students + afterschool_enrollments 다수 |
| `src/app/(admin)/admin/actions/bus/manifest-actions.ts` | students.profile_id select/in |
| `src/app/(admin)/admin/actions/afterschool-actions.ts` | students + afterschool_enrollments |
| `src/app/(academy)/academy/actions.ts` | students/teachers + 사라진 도메인 혼재 |
| `src/lib/supabase/notice-crud-helpers.ts` | generic 테이블명 string 패턴이 `<Database>` narrow 불가 |

작업 순서 권고:
1. `domain-helpers.ts` 의 `profile_id` alias 제거 + 호출처 `s.id` 직접 사용으로 전환
2. 위 5 파일의 select/in/eq 컬럼명 일괄 치환
3. 학생 개인 배정 (`class_schedules.student_profile_id`) 제거 또는 schema 복원 product 결정 → schedule-actions.ts 정리
4. ts-nocheck 주석 제거 + lint/type-check 통과 확인

### 1-C. realtime payload 타입 정합 (manifest 와 묶음)
- 파일: `src/lib/bus/realtime-utils.ts:5,13`
- 현재 `CheckRecordRow.student_profile_id` / `ChangeRequestRow.student_profile_id` 사용
- Postgres CDC 페이로드는 실 컬럼명인 `student_id` 를 보냄 → silent mismatch (모니터 stale)
- 호출처: `src/app/(monitor)/bus-monitor/BusMonitorClient.tsx:118,128`, `src/app/(bus)/bus/components/BusStaffMonitor.tsx:524,529`
- manifest-actions.ts refactor 와 **함께** 처리 권고 (BusManifestEntry/NoRideEntry 타입의 `student_profile_id` 필드도 같이 정리)

---

## 2. **운영 재개 전 필수 — DB 마이그레이션 적용**

### 2-1. 보안 보강 마이그레이션 push
- 파일: `supabase/migrations/20260502010000_revoke_anon_writes_grant_authenticated.sql`
- 점검 윈도우 안에 `npm run db:push`
- 대상 변경:
  - anon 14 테이블 INSERT/UPDATE/DELETE 회수
  - anon 11 테이블 SELECT 회수 (위젯 3 테이블만 유지)
  - authenticated 9 테이블 mutation grant 부여
  - get_my_role() EXECUTE 를 anon/PUBLIC 회수

### 2-2. 추가 검토 권고 — 미적용 (사용자 결정)
리뷰에서 도출된 RLS 정책 결함:
- `report_cards_update_own_or_staff` — 학생이 본인 성적표 임의 update 가능 (content/author_id 포함). UPDATE 정책을 staff-only 로 좁히고 학생 reply 만 별도 컬럼/테이블로 분리.
- `bus_changes_update_own_or_staff` / `bus_changes_delete_own_or_staff` — 학생이 검토·승인 후에도 silently 수정/삭제 가능. `status='pending'` 인 경우만 학생 수정 허용.
- `attendance.recorded_by` / `report_cards.author_id` — `with check (... = auth.uid())` 미강제 → 위장 가능.
- 학생 시점 read 범위 — `classes/class_students/class_teachers/class_schedules/academy_periods` 가 모두 `using (true)` 라 다른 학생 PII 일부 노출. 운영 정책에 따라 좁힐지 결정.

### 2-3. 향후 마이그레이션 가드 추가 (가이드)
- 새 마이그레이션 prod 적용 전 `pg_dump --schema-only -Fc` 백업 의무화
- Shared PK 같은 광범위 변경은 `SET lock_timeout = '5s';` + 점검 윈도우 명시
- 자식 테이블 추가 시 `cutover-runbook.md` 의 자식 테이블 목록 동기화

---

## 3. **운영 재개 전 권고 — 검증 인프라**

### 3-1. verify-migration.mjs 신 스키마 갱신
- 파일: `scripts/verify-migration.mjs`
- `bus_staff` 카운트 제거
- `student_bus_defaults.time_slot_id` → `bus_time_slot_id`
- cloud→target 의 `student_profile_id` 호출 → `student_id`
- 그렇지 않으면 cutover 검증이 항상 fail.

### 3-2. db-cutover-runbook.md 갱신
- pre-flight: "`Database` 타입 바인딩 후 type-check 통과" 강제 항목
- smoke test: 콘솔 에러 모니터링 + PGRST 응답 (data:null vs 정상) 분류 추가

---

## 4. **운영 재개 후 — 백로그**

리뷰 결과 Medium 이하:
- `auth-helpers.cachedVerifyAdmin` stale role 주석 추가
- `class-actions.ts` `class_students/class_schedules` 전체 fetch → `.in("class_id", ...)` 필터 추가
- bus actions mutation `revalidatePath` 누락 7건 보강
- `change-actions.ts:160,319` `getDay()` KST 일관 처리 (`date-kst.ts` util)
- `lib/auth/user-roles.ts` `supabase: any` → `SupabaseClient<Database>` 타이핑
- `staff-actions.ts:90-114` `updateBusStaff(busNumberId)` dead 인자 제거 (또는 schema 복원)
- 다수 액션의 `error.message` 그대로 반환 → `logger.error` 분리 + 사용자에게는 일반 메시지
- domain-helpers `profile_id` alias 단계적 제거

---

## 5. **운영 재개 절차**

1. 이 문서 1-A / 1-B / 1-C / 2-1 모두 처리 완료 확인
2. `npm run type-check` 0 errors + `npm run build` 성공
3. dev 환경에서 핵심 화면 (학생/교사 로그인, 시간표, 출결, 버스) 수동 검증
4. `supabase/migrations/20260502010000_*.sql` push
5. Vercel 환경변수 `MAINTENANCE_MODE=off` 설정 후 재배포
6. 첫 1시간 콘솔/PGRST 에러 로그 모니터링
