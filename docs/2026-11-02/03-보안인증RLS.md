# 03. 보안 — 인증 · 권한 · RLS · 입력 검증 (2026-11-02)

> 소유자 자기 코드베이스 방어적 리뷰. 읽기 전용, 원격 미접속.

## 요약
1. **DB 레이어가 가장 약하다.** `20260615110558_remote_schema.sql`(db pull 산출물)이 6월 1일 보안 패치를 되돌린 상태가 **아직 그대로**(이후 마이그레이션 4개에 복구 없음). 이전 리뷰가 잡은 셀프승인 가드·anon grant 원복 외에, **반 4개 테이블 SELECT 가 `using (true)` 로 되돌아간 것은 미보고 신규 발견**.
2. Server Action 계층은 전 export 함수 **인증 호출 누락 0건**(stub 제외). 문제는 "레벨이 틀린" 쪽 — `board-actions.ts` 5개(이전 지적, 미해결)와 `verifyAuthenticated` 로 열린 학생 대상 read 액션 다수에서 호출자-대상 소유권 체크가 없음.
3. 비밀값·open redirect·admin 클라이언트 번들 유입 방지는 양호. 입력 검증은 FormData 수동 캐스팅 45곳에 날짜 정규식 검증이 2파일뿐.

## Server Action 인증 표
전 export 함수 164개를 스크립트로 전수 스캔(`verify*` 호출·`@auth-skip`·`createAdminClient` 유무). 전부 `verifyAdmin` 인 파일은 한 줄로 축약.

| 함수 | 파일 | verify | 비고 |
|---|---|---|---|
| 전부(15) | `class-actions.ts` | verifyAdmin | 단 `getClassWithStudents`:254, `getStudentClasses`:320 은 verifyAuthenticated |
| 전부(15) | `user-actions.ts` | verifyAdmin | — |
| 전부(5/5/5/4/4/2/7) | `textbook-`, `publisher-`, `series-`, `timetable-`, `raz-`, `dashboard-`, `lunch-actions.ts` | verifyAdmin | read 일부 verifyAuthenticated; `getLunchSchedule`:91 `@auth-skip`(TV) |
| 전부(7) | `weekly-sentence-actions.ts` | verifyAdmin | `getCurrentWeeklySentences`:17 무가드 — user 클라이언트+anon SELECT 정책이라 의도된 공개 read |
| `boardBusStudent`:10 `unboardBusStudent`:39 `checkBusStudent`:86 `uncheckBusStudent`:117 `batchBusCheckRecord`:163 | `bus/board-actions.ts` | **verifyAuthenticated** | 🔴 mutation+admin client. 이전 지적(03-백엔드리뷰) **미해결** |
| `approve/reject/createAdmin/updateAdmin/deleteAdmin/bulkCreate` | `bus/change-actions.ts` | verifyAdmin | reviewer 스푸핑(2026-06-14 리뷰) ✅ 해결(:445,:519 `auth.userId`) |
| `getStudentChangeRequests`:539 `submitBusChangeRequest`:594 `cancelBusChangeRequest`:627 | 〃 | verifyAuthenticated | 본인 체크 있음 ✅ |
| `getExistingBusChange`:772 `listBusRouteRows`:96 | 〃 | verifyAuthenticated | 🟡 소유권 체크 없음 |
| `listPendingChangeRequests`:427 | 〃 | (없음) | `listAllChangeRequests`(verifyAdmin) 위임 — OK |
| `listBusTimeSlots`:96 | `bus/master-actions.ts` | `@auth-skip` | TV 모니터. 나머지 list 는 verifyAuthenticated, 쓰기는 verifyAdmin. 2026-06-14 "무가드 read 5개" ✅ 해결 |
| `getDailyBusManifest`:14 | `bus/manifest-actions.ts` | `@auth-skip` | 03-백엔드리뷰 #1 정책모순 ✅ 해결(주석 추가) |
| `listAllActiveStudentNames`:18 `listServedStop*` `getStudentBusDefaults`:91 | `bus/assignment-actions.ts` | verifyAuthenticated | `getStudentBusDefaults` 는 본인/스태프 체크 ✅. `listAllActiveStudentNames` 이전 지적 미해결(학생 전원 id·이름·나이) |
| 쓰기 5개 | 〃 | verifyAdmin | — |
| `recordAttendance`:55 `deleteAttendance`:115 | `attendance-actions.ts` | verifyTeacherOrAdmin | 담당반 체크 없음 |
| `listAttendanceRecords`:15 `getStudentAttendanceByDate`:96 `getAttendanceStats`:280 `getClassAttendanceByDate`:134 | 〃 | verifyAuthenticated | 🟡 임의 studentProfileId 조회 가능 |
| `getAfterschoolEnrollments`:39 `listAfterschoolStudentIdsByDay`:223 `getStudentAfterschoolDays`:237 `getStudentAfterschoolDetail`:252 | `afterschool-actions.ts` | verifyAuthenticated | 🟡 동일 |
| `getStudentTimetable`:388 `listClassSchedules`:270 `getGroupTimetableGrid`:24 | `schedule-actions.ts` | verifyAuthenticated | 🟡 동일 |
| `listUnitProgressByStudent`:602 `listClassUnitProgressDetailed`:122 | `homework-unit-actions.ts` | verifyAuthenticated | 🟡 동일 (학생이 반 전체 진도 조회) |
| `markUnit`:780 `bulkMarkUnits`:837 `clearUnit`:960 `listSeriesLevelProgress`:366 `getAbsentStudentIds`:939 | 〃 | verifyTeacherOrAdmin | 담당반 체크 없음(이전 지적) |
| `updateClassTextbookDays`:286 `updateStudentTextbookDays`:437 | `class-textbook-actions.ts` | verifyTeacherOrAdmin + `assertKoreanTeacherOrAdmin` | 담당반 체크 없음 |
| `assignStudentTextbook`:431 `listStudentScheduleByMonth`:491 `listUnitProgressByClass`:772 `getCurrentBusStaffProfile`(`bus/actions.ts`:7) | 각 파일 | (없음) | 빈 stub — DB 접근 0, 무해 |
| `getReportCard`:57 `listReportCardsByStudent`:97 | `report-actions.ts` | (없음) | report_cards 는 user 클라이언트(RLS), 보조 조회만 admin. 이전 지적(컨벤션) 미해결 |
| `upsertReportCard`:126 `deleteReportCard`:245 `updateReportCardReply`:304 | 〃 | `@auth-skip` 수동 | 담당반·본인 검증 있음 ✅ |
| `listNotices`:11 `getNoticeWithAttachments`:36 | `notice-actions.ts` | verifyAuthenticated(+Admin) | OK |
| `getCurrent*`, `getTeacherClasses`, `getReadLogs`, `toggleRazRead`, `getStudentNameForStaff` | `academy/actions.ts` | `getUser`+`hasUserRole` 수동 | 본인 또는 teacher. `getTeacherReadingStats`:429 는 `getTeacherClasses` 위임 OK |
| `runAction` | `run-action.ts` | auth 옵션 강제 | **사용처 0건** — 래퍼를 안 거치는 함수 = 전부 |

## 🔴
**R1. 반 4개 테이블 SELECT 가 `using (true)` 로 원복 (신규)**
`supabase/migrations/20260615110558_remote_schema.sql:505-540` 이 `classes_select`·`class_students_select`·`class_teachers_select`·`class_schedules_select` 를 drop 후 `to authenticated using (true)` 로 재생성 → `20260601020000`/`20260601050000` 의 좁히기·재귀수정 무효. 학생이 브라우저 anon 키+세션으로 PostgREST 직접 호출하면 **전교 반 명단(`class_students.student_id` 전체), 교사 배정, 시간표** 열람 가능. 이후 마이그레이션(0815·1015·1031)에 복구 없음.
개선안: `20260601050000` 본문을 새 마이그레이션으로 재적용. `db pull` 산출물은 머지 전 diff 리뷰 절차(02-DB리뷰 권고) 수립.

**R2. 셀프승인 가드 원복** — 이전 지적(02-DB리뷰 🔴). **미해결**: `remote_schema.sql:7,137` 이 트리거·함수 drop, `:499` 정책에 `status='pending'` 조건 없음. 학생이 자기 `bus_change_requests` 를 `status='approved'` 로 UPDATE 가능.

**R3. anon GRANT 원복** — 이전 지적(02-DB리뷰 🟠, 2026-06-14 #5). **미해결**: `remote_schema.sql:308-496` 95건 재부여(attendance·report_cards 등 14 테이블에 DELETE/TRUNCATE 포함). 정책이 `to authenticated` 라 당장 악용은 안 되지만, baseline:1681 `ALTER DEFAULT PRIVILEGES … TO anon` 도 살아 있어 신규 테이블마다 재발.

**R4. `bus/board-actions.ts` 승하차 mutation 이 `verifyAuthenticated`** — 이전 지적(03-백엔드리뷰 🟠). **미해결**(:16,:45,:93,:124,:173). 추가로 `checkedBy`(:91,:172) 가 클라이언트 인자 → `checked_by` 감사열 위조 가능. `BusDashboard.tsx:181` 이 `adminId` 를 넘기지만 서버는 검증 안 함.
개선안: `verifyTeacherOrAdmin` 으로 격상 + `checked_by: auth.userId`.

## 🟡
**Y1. 학생이 호출 가능한 read 액션의 IDOR (admin 클라이언트)** — 표의 🟡 행. 패턴: `verifyAuthenticated` 통과 후 인자 `studentProfileId`/`classId` 를 그대로 admin 클라이언트 쿼리에 사용. 예: `attendance-actions.ts:15-27`(출결 전체), `homework-unit-actions.ts:122-135`(반 전체 학생 진도), `schedule-actions.ts:388-400`, `afterschool-actions.ts:237-248`, `bus/change-actions.ts:772-791`. 학생용 페이지(`academy/student/**`)가 이들을 호출하므로 액션 자체는 학생 세션에서 열려 있다. `getStudentBusDefaults`:91-104 와 `getStudentChangeRequests`:539-553 에 이미 있는 "본인 또는 admin/teacher" 패턴을 복붙하면 된다.
개선안: 두 곳의 가드를 `auth-helpers.ts` 에 `assertSelfOrStaff(auth, targetId)` 한 함수로 뽑아 위 액션에 1줄씩.

**Y2. teacher 의 담당반 소유권 체크 부재** — 이전 지적(03-백엔드리뷰 markUnit 계열). 추가: `attendance-actions.ts:55,115` `recordAttendance/deleteAttendance`, `class-textbook-actions.ts:286,437`, `academy/actions.ts:392 toggleRazRead`(어느 교사든 어느 학생 읽음 기록 토글; RLS `raz_read_logs_*` 도 teacher 전체 허용). 교사 간 상호 지원이 정책이면 문서에 명시하고 끝내도 됨.

**Y3. `report_cards_select` 정책이 삭제된 컬럼 기준(추정)** — `baseline.sql:1387` `student_id = auth.uid()` 인데 `20260525000000` 리팩토링 후 `report_cards` 는 `class_student_id` 를 쓴다(`report-actions.ts:65`). 컬럼이 drop 되었다면 정책 생성이 실패했거나 재작성됐을 텐데 `report_cards_update` 만 `class_students` 조인으로 재작성됨. 실 DB 의 `report_cards_select` 정의 확인 필요 — 학생 본인 조회가 teacher/admin 분기로만 통과한다면 `getReportCard` 가 학생에게 빈 결과를 줄 것.

**Y4. `getStudentNameForStaff`·`getReadLogs`** `academy/actions.ts:452,375` — teacher 면 임의 `studentId` 조회. Y2 와 같은 정책 결정 사안.

**Y5. 입력 검증** — 이전 지적(2026-06-14 "zod 없음·72곳 캐스팅"). 현황 45곳. 날짜 문자열 정규식 검증은 `closed-days-actions.ts`·`class-textbook-actions.ts`·`lunch-actions.ts:94` 만. `board-actions.ts checkDate`, `change-actions.ts requestDate/dates[]`, `attendance-actions.ts` 날짜는 그대로 쿼리 — Postgres 가 타입 에러로 막아주고 `error.message` 가 토스트로 노출(정보 누출 경미). 배열 길이 상한은 전 bulk 액션(`bulkMarkUnits`, `saveBulkBusDefaults`, `bulkCreateBusChanges`, `batchBusCheckRecord`, `bulkResetStudentPasswords`) 에 없음 — `bulkResetStudentPasswords:523` 는 N 건 순차 Admin API 호출이라 DoS 표면.
개선안: `ISO_DATE_RE` 를 `lib/utils/date-kst.ts` 로 올려 공용화, bulk 는 `if (items.length > 500) return fail(...)` 1줄.

**Y6. 교사 페이지 class 파라미터는 검증됨, 액션은 아님** — `academy/teacher/homework/page.tsx:34-37` 이 `params.class` 를 담당반 목록과 대조 ✅. 그러나 그 아래 호출하는 `listClassTextbooks`/`listClassUnitProgressDetailed` 는 클라이언트 컴포넌트에서도 직접 호출 가능해 페이지 가드가 우회된다(Y1 과 동일 뿌리).

**Y7. 비밀번호 정책 불일치** — `user-actions.ts:505 MIN_PASSWORD_LENGTH=8` 은 reset 경로만. `createStudent:27`/`createTeacher:93` 은 길이 검증 없음. `supabase/config.toml:175 minimum_password_length = 4`(로컬). 클라우드 설정 확인 권장.

## 🟢
- `run-action.ts` 래퍼 채택 0건 — 이전 지적(ActionResult 0건) 과 동일 뿌리. 신규 액션(1015·1031 커밋분)도 안 씀.
- `(admin)/m/layout.tsx:18-26` role 직접 쿼리 — 이전 지적, 미해결. `academy/layout.tsx:21`·`teacher/layout.tsx:23` 은 레이아웃에서 admin 클라이언트로 본인 행만 조회 — 유출 아님, 불필요한 RLS 우회.
- `check-admin-client-imports.mjs:27` 는 `from "@/lib/supabase/admin"` 정규식만 매칭. 우회 경로: 상대경로 `../../lib/supabase/admin`, `import()` 동적 import, 재export 배럴 경유, `createClient(url, SERVICE_ROLE)` 직접 호출. 현재 코드베이스에 우회 사례 0건(grep 확인). CI(`.github/workflows/ci.yml:31`)에 묶여 있음 ✅. 개선: 정규식을 `supabase\/admin["']` 로 완화 + `SUPABASE_SERVICE_ROLE_KEY` 리터럴도 검사.
- `proxy.ts:18-21` setAll 이 `/admin`→`/m` 리다이렉트 응답에는 적용 안 됨(세션 갱신 누락, 기능 이슈).
- `.env.local`·`.env.scripts` 는 `.gitignore:*.env*` 로 제외 ✅, git 추적 0건. 하드코딩 키·project-ref 없음. `NEXT_PUBLIC_` 은 URL·anon·도메인·사이트URL 4종만 ✅.
- `scripts/raz-import/*.mjs:9` 가 `SUPABASE_SERVICE_ROLE_KEY` 를 `.env.local` 에서 읽음 — 운영 키가 개발자 로컬에 상주. 별도 `.env.scripts` 가 이미 있으니 그쪽으로.

## 잘 되어 있는 점
1. **open redirect 방어** `LoginForm.tsx:26-33` — `/` 시작·`//`·백슬래시 차단, 서버 `redirect()` 는 모두 리터럴. `academy/login/page.tsx` 도 `/login` 으로만 전달.
2. **역할 판정 단일 소스** — `private.get_my_role()`(SECURITY DEFINER, `profiles` INSERT/UPDATE 는 admin 전용 정책 `baseline.sql:1372-1376`) 이라 학생이 `role` 을 스스로 올릴 경로 없음. `auth.users` 트리거로 `user_metadata.role` 을 신뢰하는 코드도 없음.
3. **리뷰 추적 반영** — reviewer 스푸핑, master-actions 무가드 read, manifest `@auth-skip` 모순이 지난 리뷰 이후 실제로 고쳐졌고 CI 에 admin-import 체크가 묶였다. 남은 것은 거의 전부 **DB 마이그레이션 1장**(R1·R2·R3 재적용)과 **board-actions 5줄**(R4)로 해결된다.
