# 점검 종료 후 후속 작업

작성일: 2026-05-02 / 갱신: 2026-05-03

배경: cutover (commit 2f46b6a + f4df53e) 이후 코드/스키마 회귀 fix 와 DB 위생 작업 진행 기록.

---

## 진행 상황 (2026-05-03)

### ✅ 해결됨

| 항목 | 상태 | 커밋 |
|---|---|---|
| 점검 모드 (`MAINTENANCE_MODE`) 코드 제거 | 완료 | `751177a` |
| 보안 보강 마이그레이션 (`20260502010000_revoke_anon_writes`) push | 완료 | manual repair + push |
| 신 스키마 컬럼명 정합 (schedule + report) | 완료 | `a316842` |
| 신 스키마 컬럼명 정합 (academy + afterschool + ts-nocheck 제거) | 완료 | `9ac5332` |
| realtime payload 정합 (`student_id ↔ student_profile_id`) | 완료 | `e887bfd` |
| RLS 모던화 — `get_my_role()` private 이전 + `(select)` wrap + FOR ALL 분할 | 완료 | `d66b8c6` |
| Index 위생 — FK 인덱스 17개 + 중복 3개 제거 | 완료 | `d66b8c6` |
| Enum 전환 — attendance.status / bus_change_requests.{change_type,status} / weekly_sentence_config.mode | 완료 | `d66b8c6` |
| `updated_at` 자동 갱신 트리거 (17 테이블) | 완료 | `d66b8c6` |
| `admins` 테이블 드롭 (미사용) | 완료 | `20260503110838` |
| `notices.published_at` nullable + default 제거 | 완료 | `20260503110838` |
| `bus_stop_*_unique_idx` → `nulls not distinct` 리팩 | 완료 | `20260503110838` |

Supabase advisor warning: 40 → 3 (storage bucket 2 + leaked password protection 1)

---

## 🟡 미해결 — 코드 동시 수정 필요

### 1-A. 사라진 도메인 stub 정리
신 스키마에 테이블이 없어서 호출 시 PGRST204:

| 파일 | 사라진 테이블 | 결정 |
|---|---|---|
| `src/app/(admin)/admin/actions/textbook-actions.ts` | `textbooks`, `class_textbooks`, `student_textbook_progress` | 미정 |
| `src/app/(admin)/admin/actions/homework-actions.ts` | `homework_assignments`, `homework_submissions`, `homework_submission_files` | 미정 |
| `src/app/(admin)/admin/actions/lunch-actions.ts` | `lunch_*` | 미정 |
| `src/app/(admin)/admin/actions/class-notice-actions.ts` | `class_notices`, `notice_attachments` | 미정 |
| `src/app/(admin)/admin/actions/learning-actions.ts` | `learning_records` | 미정 |
| `src/app/bus/layout.tsx` + `actions.ts` | `bus_staff` + `user_role`에 `"bus"` enum | 비활성 (방치) |

**결정 필요**: 각 도메인 schema 복원 vs 기능 폐지 vs UI 숨김 유지.

### 1-B. ts-nocheck 잔존
| 파일 | 사유 |
|---|---|
| `src/lib/supabase/notice-crud-helpers.ts` | generic 테이블명 string 패턴이 `<Database>` narrow 불가 |

(`schedule-actions.ts`, `manifest-actions.ts`, `afterschool-actions.ts`, `academy/actions.ts` 의 ts-nocheck 는 `9ac5332`/`a316842` 에서 제거 완료)

### 1-C. `students.group_type` 컬럼 처리
- live 데이터 174 행 전부 NULL
- 코드 8+ 곳 (`AdminListSidebar.tsx`, `ClassesManager.tsx`, `domain-helpers.ts`, `api.ts:UserWithProfile`) 에서 `"유치부"`/`"오후반"` 필터 사용 중인데 데이터가 없어 dead-code 상태
- **결정 필요**: (a) 컬럼 드롭 + 코드 제거, (b) 데이터 백필 + 살리기

### 1-D. `report_cards` 양국어 컬럼 명명 비대칭
- 현재: `content` (en) / `content_ko` / `reply` (ko) / `reply_en`
- 목표: `content_en` / `content_ko` / `reply_ko` / `reply_en`
- ALTER COLUMN RENAME 마이그레이션 + codemod (대량 `.select('content')` 패턴) 필요. 별도 PR.

---

## 🔵 dashboard 작업 (마이그레이션 자동화 불가)

### Auth → Leaked Password Protection
- Supabase advisor 0001: HaveIBeenPwned 검사 비활성화
- Project Settings → Auth → Password Strength → Enable
- 학원 어플 특성상 ON 권장. 사용자 마찰: 약한 비밀번호 가입 거절.

### Storage Bucket 정리
- `academy-notices`, `class-notices` 두 public bucket 잔재 (대응 테이블은 `core_role_split.sql` 에서 드롭)
- Supabase advisor 0025: broad SELECT 정책으로 listing 가능
- Studio dashboard 에서 객체 수 확인 → 비어있으면 bucket 삭제

---

## 🔴 보안 — 즉시 처리 권고

### service_role 키 평문 커밋 (HIGH)
- 위치: `scripts/migrate-cloud-to-local.mjs:14, 17, 151`
- 현재 cloud `service_role` 키와 비밀번호가 평문으로 git history 에 남음
- 조치:
  1. cloud 콘솔에서 service_role 키 즉시 로테이션
  2. git history 청소 (`git filter-repo` 또는 `git filter-branch`)
  3. 스크립트 env 화

---

## 🟣 RLS 정책 추가 검토 (운영 정책 결정 필요)

리뷰에서 도출된 RLS 정책 결함 (이번 모던화에 포함 안 됨):

- `report_cards_update` — 학생이 본인 성적표 임의 update 가능 (content/author_id 포함). UPDATE 정책을 staff-only 로 좁히고 학생 reply 만 별도 컬럼/테이블로 분리 권고.
- `bus_change_requests_update` / `_delete` — 학생이 검토·승인 후에도 silently 수정/삭제 가능. `status='pending'` 인 경우만 학생 수정 허용.
- `attendance.recorded_by` / `report_cards.author_id` — `with check (... = auth.uid())` 미강제 → 위장 가능.
- 학생 시점 read 범위 — `classes/class_students/class_teachers/class_schedules/academy_periods` 가 모두 `using (true)` 라 다른 학생 PII 일부 노출. 운영 정책에 따라 좁힐지 결정.

---

## 🟠 백로그 (Medium 이하)

- `auth-helpers.cachedVerifyAdmin` stale role 주석 추가
- `class-actions.ts` `class_students/class_schedules` 전체 fetch → `.in("class_id", ...)` 필터 추가
- bus actions mutation `revalidatePath` 누락 7건 보강
- `change-actions.ts:160,319` `getDay()` KST 일관 처리 (`date-kst.ts` util)
- `lib/auth/user-roles.ts` `supabase: any` → `SupabaseClient<Database>` 타이핑
- `staff-actions.ts:90-114` `updateBusStaff(busNumberId)` dead 인자 제거 (또는 schema 복원)
- 다수 액션의 `error.message` 그대로 반환 → `logger.error` 분리 + 사용자에게는 일반 메시지
- 인덱스 명명 컨벤션 `supabase/AGENTS.md` 또는 `docs/HARNESS.md` 에 문서화
- `verify-migration.mjs` 신 스키마 갱신

---

## 인프라 가이드

- 새 마이그레이션 prod 적용 전 `pg_dump --schema-only -Fc` 백업 의무화
- Shared PK 같은 광범위 변경은 `SET lock_timeout = '5s';` + 점검 윈도우 명시
- 자식 테이블 추가 시 `cutover-runbook.md` 의 자식 테이블 목록 동기화
- 마이그레이션 push 후 `supabase db advisors --linked` 재확인 + warning 변화 commit message 에 기록
