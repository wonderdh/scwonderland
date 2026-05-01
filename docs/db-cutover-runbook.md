# DB 컷오버 런북 (In-Place 마이그레이션)

> **작성일**: 2026-04-30  
> **전략**: 동일 Supabase 프로젝트에 신 스키마 마이그레이션 적용 — public 데이터 dump+restore, auth 그대로  
> **롤백 윈도우**: pg_dump 백업 보관 기간 (권장 30일)

---

## 📋 개요

### 현황
- **Cloud Supabase 프로젝트**: `jxrzhonxnkjpjmzdhyoi` (운영 중, OLD 스키마)
- **신 스키마**: `codex/db-refactor-schema` 브랜치 마이그레이션 (`supabase/migrations/20260430*`)
- **문제**: 신규 마이그레이션 중 `core_role_split.sql` 가 `add column NOT NULL` 을 데이터 있는 테이블에 시도 → populated DB 에선 실패. 또한 23개 테이블을 DROP TABLE 함

### 전략: In-Place + Snapshot/Restore
**같은 Supabase 프로젝트 그대로** 사용. auth schema 안 건드림. public 데이터만 snapshot 떠뒀다가 마이그레이션 후 복원:

```
[현재 cloud, OLD 스키마, 데이터 + auth]
       │
       ├─ 1. pg_dump 풀백업 (안전망)
       ├─ 2. SNAPSHOT_OUT → public 데이터 JSON 파일로 dump (auth 제외)
       ├─ 3. TRUNCATE public 테이블 (마이그레이션 NOT NULL 통과시키기)
       ├─ 4. supabase db push → 신 스키마 적용 (auth.users 안 건드림)
       ├─ 5. SNAPSHOT_IN + KEEP_AUTH=true → JSON 복원, 기존 auth.users 매핑
       └─ 6. verify-migration → 검증
[같은 cloud, NEW 스키마, 데이터 복원 + auth 동일]
```

### 예상 영향

| 항목 | 예상치 |
|---|---|
| **다운타임** | ~10–15분 (Phase 3) |
| **사용자 영향** | 없음 (auth/세션/JWT 키 모두 보존) |
| **비번 초기화** | **없음** — 기존 비번 그대로 |
| **재로그인 필요** | **없음** — JWT 그대로 유효 |
| **환경변수 변경** | **없음** — Supabase URL/KEY 동일 |
| **앱 재배포** | 선택 (코드는 새 스키마 기준이라 main 머지 후 자동 배포) |
| **복구 방식** | pg_dump 백업으로 풀 복원 |

---

## ✅ Pre-flight Checklist

Phase 1 진행 전 모두 통과해야 함:

- [ ] **Staging 검증 완료** — 본 절차를 staging Supabase 프로젝트에 한 번 돌려보고 verify 통과
- [ ] `npm run type-check` 통과
- [ ] `npm run build` 성공
- [ ] `scripts/migrate-cloud-to-target.mjs` snapshot-out / snapshot-in 모드 동작 확인
- [ ] `scripts/verify-migration.mjs` 동작 확인
- [ ] cloud DB password 확인 (Supabase Dashboard → Project Settings → Database)
- [ ] 학원 운영 일정 확인 (수업 없는 시간대, 권장: 22:00 이후 또는 일요일)
- [ ] 사용자 공지 발송 (다운타임 안내, 비번 변경 없음 강조)
- [ ] 해당 시간대에 cron / scheduled job 없음 확인
- [ ] **롤백 권한 보유 확인** — Supabase Dashboard 접근 + service_role key
- [ ] `backups/` 디렉터리 준비 (`mkdir -p backups`)

---

## 🛠️ Phase 1: 풀 백업 (안전망)

> 권장 시간: **컷오버 1시간 전**  
> 소요시간: ~3분

```bash
# Supabase Dashboard → Project Settings → Database → Connection string 에서 확인
DB_URL="postgresql://postgres.jxrzhonxnkjpjmzdhyoi:[YOUR_PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"

# 풀 백업 (스키마 + 데이터 + auth + storage 메타데이터)
mkdir -p backups
pg_dump "$DB_URL" \
  --no-owner --no-privileges \
  --file="backups/cloud-pre-cutover-$(date +%Y%m%d-%H%M).sql"

# 사이즈 확인 (예상: 수십 MB)
ls -lh backups/cloud-pre-cutover-*.sql

# 검증: 헤더 + 라인 수
head -10 backups/cloud-pre-cutover-*.sql
wc -l backups/cloud-pre-cutover-*.sql
```

**⚠️ 이 백업 파일이 유일한 풀 복구 경로다. 안전한 곳에 별도 보관 (S3/로컬/외장하드 등).**

---

## 🚀 Phase 2: 컷오버 실행

> 권장 시간대: **수업 종료 후, 다음 수업까지 1시간 이상 여유 있는 시점**  
> 총 소요시간: ~10–15분

### Step 0: Maintenance 모드 ON (선택)
앱이 cutover 도중 destructive write 가 들어오면 데이터 inconsistent 됨. Vercel 등 호스팅에 maintenance 페이지 있으면 활성화:

```bash
# 예: Vercel 환경변수
vercel env add MAINTENANCE_MODE production
# 값: true
vercel deploy --prod
```

또는 Supabase 단에서 service_role key 만 일시적으로 사용 (앱은 anon/authenticated 만 쓰니까 RLS 차단됨).

---

### Step 1: SNAPSHOT_OUT — public 데이터 JSON dump
> ⏱️ ~1분

`auth schema 는 dump 하지 않음`. cloud 의 auth.users / identities / sessions / mfa 모두 그대로 둠.

```bash
SOURCE_URL=https://jxrzhonxnkjpjmzdhyoi.supabase.co \
SOURCE_SERVICE_KEY=sb_secret_... \
SNAPSHOT_OUT=backups/snapshot-$(date +%Y%m%d-%H%M).json \
node scripts/migrate-cloud-to-target.mjs
```

**예상 출력**:
```
[HH:MM:SS] === 마이그레이션 시작: snapshot-out 모드 ===
[HH:MM:SS]   auth.users: 194명
[HH:MM:SS]   profiles: 194행
... (전 테이블 카운트)
[HH:MM:SS]   snapshot 저장: backups/snapshot-...json (~540 KB)
[HH:MM:SS] === SNAPSHOT_OUT 완료 (target에는 쓰지 않음) ===
```

✅ snapshot 파일 사이즈가 0이 아니고 모든 테이블 카운트 출력되면 OK.

---

### Step 2: TRUNCATE public 테이블
> ⏱️ ~1분  
> ⚠️ **이 단계 후 데이터는 snapshot 파일에만 존재**. 실수로 삭제 금지.

신 마이그레이션의 `add column NOT NULL` 이 빈 테이블에서만 통과하기 때문에 미리 비워야 함. auth schema 는 안 건드림.

`scripts/truncate-public.sql` 작성 (한 번만):
```sql
-- 모든 public 테이블 비우기 (FK 무시, CASCADE)
do $$
declare r record;
begin
  -- supabase 내부 테이블 / 마이그레이션 추적 테이블은 제외
  for r in (
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename not like 'supabase_%'
      and tablename not like 'pg_%'
      and tablename not in ('schema_migrations')
  ) loop
    execute format('truncate table public.%I cascade', r.tablename);
  end loop;
end $$;
```

실행:
```bash
psql "$DB_URL" -f scripts/truncate-public.sql
# 또는 Supabase Studio → SQL Editor 에 붙여넣기
```

검증:
```bash
psql "$DB_URL" -c "select tablename, n_live_tup from pg_stat_user_tables where schemaname='public' order by n_live_tup desc limit 10;"
# 모든 행이 0 이어야 함
```

---

### Step 3: 마이그레이션 적용
> ⏱️ ~2분

main 브랜치 머지 후 (`db-refactor-schema` → main), 로컬에서 cloud 에 push:

```bash
# 머지 후 main pull
git checkout main
git pull

# Supabase project 링크 (한 번만)
npx supabase link --project-ref jxrzhonxnkjpjmzdhyoi

# 마이그레이션 적용
npx supabase db push
```

**예상 출력**:
```
Connecting to remote database...
Applying migration 20260430020118_20260430_core_role_split.sql...
Applying migration 20260430023000_core_public_grants.sql...
Applying migration 20260430030000_admin_ops_schema.sql...
Applying migration 20260430033000_admin_ops_grants.sql...
Applying migration 20260430034000_admin_ops_rls.sql...
Applying migration 20260430040000_profiles_simplify.sql...
Applying migration 20260430050000_shared_pk_and_role.sql...
Finished supabase db push.
```

⚠️ **에러 발생 시 즉시 Step 4 의 SNAPSHOT_IN 실행하지 말고 Phase 3 롤백으로**.

---

### Step 4: SNAPSHOT_IN + KEEP_AUTH — 데이터 복원
> ⏱️ ~5분

cloud 의 auth.users (마이그레이션이 안 건드린 그대로) 와 매핑해서 public 데이터 복원:

```bash
TARGET_URL=https://jxrzhonxnkjpjmzdhyoi.supabase.co \
TARGET_SERVICE_KEY=sb_secret_... \
SNAPSHOT_IN=backups/snapshot-YYYYMMDD-HHMM.json \
KEEP_AUTH=true \
node scripts/migrate-cloud-to-target.mjs
```

**예상 출력**:
```
[HH:MM:SS] === 마이그레이션 시작: snapshot-in 모드 ===
[HH:MM:SS] TARGET: https://jxrzhonxnkjpjmzdhyoi.supabase.co
[HH:MM:SS] KEEP_AUTH: 활성 (auth.users 생성/수정 스킵)
[HH:MM:SS]   snapshot 로드: backups/...json (auth.users 194명)
[HH:MM:SS]   [KEEP_AUTH] target에 이미 194명. 생성/수정 스킵
[HH:MM:SS]   profiles: 191행 완료  (※ bus role 3명 스킵 — 신 스키마에 bus 없음)
... (전 테이블 복원)
[HH:MM:SS] === 마이그레이션 완료 ===
```

⚠️ `[KEEP_AUTH] target에 이미 N명` 의 N 이 snapshot 의 auth.users 수와 같아야 함. 만약 다르면 마이그레이션이 auth schema 도 건드린 것 → 즉시 Phase 3 롤백.

---

### Step 5: verify-migration
> ⏱️ ~1분

snapshot 파일 (= cutover 직전 cloud 상태) 과 현재 cloud 비교:

```bash
# snapshot 파일을 임시 source 로 쓸 수 없으므로 기준은 snapshot 그 자체 (행 수만)
# 또는 풀백업 sql 에서 카운트 추출 (선택)

# 간단 검증: cloud 자체의 row count 확인
TARGET_URL=https://jxrzhonxnkjpjmzdhyoi.supabase.co \
TARGET_SERVICE_KEY=sb_secret_... \
psql "$DB_URL" -c "
  select 'profiles' as t, count(*) from profiles
  union all select 'students', count(*) from students
  union all select 'teachers', count(*) from teachers
  union all select 'classes', count(*) from classes
  union all select 'class_students', count(*) from class_students
  union all select 'class_teachers', count(*) from class_teachers
  union all select 'attendance', count(*) from attendance
  union all select 'student_bus_defaults', count(*) from student_bus_defaults
  union all select 'class_schedules', count(*) from class_schedules
  union all select 'academy_periods', count(*) from academy_periods
  order by t;
"
```

snapshot Step 1 의 카운트와 비교:
- profiles: 194 → 191 (bus 3 빼고)
- 나머지: snapshot 카운트와 동일 (또는 ±0)

또한 임시 staging 에 snapshot-in 한 번 더 떠서 verify-migration 으로 cross-check 해도 됨.

---

### Step 6: 앱 smoke test
> ⏱️ ~3분

브라우저에서 직접:
- [ ] admin 로그인 (예: admin@scwonderland.com) — 기존 비번 그대로 동작 확인
- [ ] 학생 로그인 (예: s1@scwonderland.com) — 기존 비번 그대로
- [ ] 교사 로그인 (예: t1@scwonderland.com) — 기존 비번 그대로
- [ ] 학생 정보 페이지 (학생 6명 이상 표시)
- [ ] 반 관리 페이지 (29개 반 표시)
- [ ] 출결 작성 → 저장 → 재조회
- [ ] 승하차 변경요청 페이지 (이름 표시 확인)
- [ ] 리포트카드 (반별 진행률 표시)

문제 발견 시 **즉시 Phase 3 (롤백)** 진행. 일부만 깨졌다고 해서 patch 시도하지 말 것 — 더 큰 손상 야기 가능.

---

### Step 7: Maintenance 모드 OFF (Step 0에서 켰다면)

```bash
vercel env rm MAINTENANCE_MODE production
vercel deploy --prod
```

---

## 🔄 Phase 3: 롤백 시나리오

각 단계별 롤백 절차. **시간 민감** — 빠르게 결정해야 함.

### Step 1 실패 (snapshot dump 에러)
- 영향: 없음, cloud 그대로
- 조치: 에러 메시지 확인 후 재시도. 보통 source service_key 권한 문제.

### Step 2 실패 (truncate 에러)
- 영향: 일부 테이블만 truncate 됐을 수 있음
- 조치:
  ```bash
  # 백업으로 풀 복원 (auth 포함)
  psql "$DB_URL" -c "drop schema public cascade; create schema public;"
  psql "$DB_URL" -f backups/cloud-pre-cutover-YYYYMMDD-HHMM.sql
  ```
- 시간: ~5분

### Step 3 실패 (마이그레이션 에러)
- 영향: cloud 가 partial 신 스키마 상태. 위험.
- 조치:
  ```bash
  # 1. 풀 백업으로 schema + data 복원
  psql "$DB_URL" -c "drop schema public cascade; create schema public;"
  psql "$DB_URL" -f backups/cloud-pre-cutover-YYYYMMDD-HHMM.sql
  
  # 2. supabase 마이그레이션 추적 테이블도 원복 (필요 시)
  psql "$DB_URL" -c "delete from supabase_migrations.schema_migrations where version like '20260430%';"
  ```
- 시간: ~5–10분

### Step 4 실패 (SNAPSHOT_IN 중 에러)
- 영향: cloud 가 신 스키마이지만 데이터 일부만 로딩됨
- 조치 A (재시도, 멱등): 같은 명령 다시 실행 (upsert + ignoreDuplicates 라 안전)
- 조치 B (포기 + 롤백): Step 3 실패 와 동일하게 풀 복원

### Step 5–6 실패 (검증/smoke test 결과 이상)
- 영향: 데이터 불일치 또는 앱 동작 이상
- 조치: 풀 백업으로 복원 (Step 3 실패와 동일)

### 컷오버 후 N시간 뒤 발견된 문제
- 해당 시점부터 새 데이터가 누적됐을 수 있어서 풀 복원 시 신규 데이터 손실
- 조치: 새 데이터를 먼저 export → 풀 복원 → 새 데이터 재이식 (별도 절차)

---

## 📦 Phase 4: Post-cutover 작업

### 즉시 (당일)
- [ ] cutover 완료 공지 (사용자 / 학원장)
- [ ] backups/cloud-pre-cutover-*.sql 별도 안전한 위치에 백업
- [ ] backups/snapshot-*.json 도 보관 (선택)

### 1주일 내
- [ ] `npm run db:types` 로 타입 재생성하고 main 머지 (이미 머지됐으면 confirm)
- [ ] RLS 정책 활성화 — qa-report-2026-04-30.md 의 잔존 이슈 9개 테이블
  ```sql
  alter table public.profiles enable row level security;
  alter table public.students enable row level security;
  alter table public.teachers enable row level security;
  alter table public.classes enable row level security;
  alter table public.class_students enable row level security;
  alter table public.class_teachers enable row level security;
  alter table public.academy_periods enable row level security;
  alter table public.afterschool_enrollments enable row level security;
  alter table public.class_schedules enable row level security;
  ```
  + 각 테이블별 정책 작성 (별도 마이그레이션)
- [ ] 사용자 잔존 이슈 (academy/student/bus → undefined 등) 추적 후 fix

### 30일 후
- [ ] backups/ 의 `cloud-pre-cutover-*.sql` 정리 (롤백 윈도우 종료)

---

## 📚 부록 A: snapshot-only 체크용 스크립트

cutover 전 staging 으로 dry-run 할 때 사용:

```bash
# 1. cloud 에서 snapshot
SOURCE_URL=cloud SOURCE_SERVICE_KEY=cloud_key \
SNAPSHOT_OUT=staging-snapshot.json \
node scripts/migrate-cloud-to-target.mjs

# 2. staging 프로젝트에 마이그레이션 적용
SUPABASE_DB_URL=staging_url npx supabase db push

# 3. snapshot 적용 (staging 은 fresh 상태라 KEEP_AUTH 불필요, 사용자 새로 생성)
TARGET_URL=staging_url TARGET_SERVICE_KEY=staging_key \
SNAPSHOT_IN=staging-snapshot.json \
node scripts/migrate-cloud-to-target.mjs

# 4. verify
SOURCE_URL=cloud SOURCE_SERVICE_KEY=cloud_key \
TARGET_URL=staging_url TARGET_SERVICE_KEY=staging_key \
node scripts/verify-migration.mjs
```

---

## 📚 부록 B: scripts 빠른 참조

| 모드 | 환경변수 | 용도 |
|---|---|---|
| LEGACY | SOURCE_* + TARGET_* | source → target 직접 (auth 새로 만듦) |
| SNAPSHOT_OUT | SOURCE_* + SNAPSHOT_OUT=path | source → JSON dump only |
| SNAPSHOT_IN | TARGET_* + SNAPSHOT_IN=path | JSON → target 적용 |
| + KEEP_AUTH=true | (어느 모드든 추가) | auth.users 생성 스킵 |
| + DRY_RUN=true | (어느 모드든 추가) | 카운트만 출력 |

---

## 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-04-30 | 초안 (blue-green 전략) |
| 2026-04-30 | **인-플레이스 전략으로 전면 개정** — auth 보존, 비번 그대로, 환경변수 변경 없음 |
