# Raz 책 목록 + 학생별 읽음 체크 — 설계 스펙

- 날짜: 2026-08-13
- 원 요청: `docs/homepage-request.md`
- 상태: 사용자 승인 대기

## 개요

raz-plus.com에서 수집한 책 2,572권을 서비스에 올리고, 학생별로 "읽음"을
체크·조회하는 기능. 학생 본인이 자기 계정으로 체크하고, 교사·관리자는 전체
학생을 조회·체크할 수 있다.

원 요청 문서의 설계 원칙 6개 중 5개(WebP Storage, 정적 books, read_logs 행
존재로 읽음 표현, level_order, lexile_num, RLS)는 그대로 유지한다. 원칙 2의
"localStorage 캐시 + 클라이언트 직접 쿼리"만 이 레포의 academy 컨벤션(RSC +
Server Action, 클라이언트 캐시 라이브러리 금지)에 맞춰 **서버 캐시**로
대체한다. 필터·검색·정렬이 클라이언트 메모리에서 즉각 동작해야 한다는 원칙은
유지된다.

주요 결정 사항:

- 문서가 제안한 `students` 테이블은 만들지 않는다 — 기존 `public.students`
  (profiles와 shared PK, 학생 로그인 지원)를 그대로 사용.
- multilevel 책(같은 제목, 레벨만 다른 시리즈)은 묶지 않고 **개별 표시**.
- 진행률 UI는 교사용 대시보드(반별·학생별 비교)까지 포함.

## DB 스키마

테이블 2개. `books`는 기존 `homework_books`와 혼동 여지가 있어 `raz_` 접두 사용.

```sql
create table raz_books (
  id          int primary key,   -- raz 고유 id, 표지 URL 조합에도 사용
  title       text not null,
  level       text not null,     -- aa~Z2 (29개)
  level_order int not null,      -- aa=0, A=1, ..., Z=26, Z1=27, Z2=28 (정렬용)
  grade       text,              -- Grade K ~ Grade 5+
  lexile      text,              -- 원문 "440L", "BR70L"
  lexile_num  int,               -- "BR70L"→-70, "440L"→440 (범위 필터용)
  genre       text,              -- Fiction / Nonfiction
  genre2      text,              -- 세부 장르 (Realistic, Fable, Informational 등)
  multilevel  boolean not null default false
);

create table raz_read_logs (
  student_id uuid not null references public.students(id) on delete cascade,
  book_id    int  not null references raz_books(id),
  read_at    timestamptz not null default now(),
  marked_by  uuid references public.profiles(id),
  primary key (student_id, book_id)
);
```

- `student_id → students(id)`, `marked_by → profiles(id)` — supabase/AGENTS.md
  FK 컨벤션 준수 (actor는 학생 본인·교사·admin 모두 가능하므로 profiles).
- 읽음 여부 = 행 존재. 체크 = insert, 해제 = delete. update 없음.
- `marked_by`는 "누가 체크했는지" 감사용. 학생 본인 체크면 본인 id.

## RLS

기존 `private.get_my_role()` 헬퍼 재사용.

- `raz_books`: authenticated 전체 select 허용. insert/update/delete 정책 없음
  (적재는 service role 스크립트로만).
- `raz_read_logs`: select / insert / delete 각각
  `student_id = auth.uid() or private.get_my_role() in ('teacher', 'admin')`.
  update 정책 없음.

anon 권한은 이 프로젝트에서 이미 회수됨(`20260601010000_revoke_anon_grants`) —
새 테이블도 authenticated 전용.

## Storage

- 기존 `20260601040000_storage_buckets_rls.sql` 패턴대로 public 버킷
  `raz-covers` 추가.
- 경로: `covers/{id}.webp` (WebP q80, 원본 209MB → 약 27MB).
- 이미지 URL은 DB에 저장하지 않고 book id로 조합. `<img loading="lazy">` 적용.

## 라우트 · 화면

| 경로 | 대상 | 내용 |
|---|---|---|
| `/academy/student/reading` | 학생 | 책 목록(표지+제목+레벨/lexile/장르) + 필터 + 본인 읽음 토글 + 진행률 요약 |
| `/academy/teacher/reading` | 교사 | 대시보드(반별·학생별 읽은 권수, 레벨 분포) → 학생 클릭 → 그 학생의 목록 화면(토글 가능) |
| `/admin/reading` | 관리자 | 교사 대시보드와 동일 내용, 전체 반 대상. 기존 "관리자 반별 리포트 조회 탭"과 같은 패턴 |

필터: 레벨, 장르(대/세부), lexile 범위, 제목 검색, "읽은 책만 보기".
정렬: `level_order` → `title`.

### 컴포넌트 배치

- 목록·필터·토글 UI(`BookGrid`)와 대시보드 표는 presentational 컴포넌트로
  `src/components/reading/`에 둔다.
- academy ↔ admin 컴포넌트 상호 import 금지 규칙 때문에 공용 폴더 배치.
  데이터 로딩·server action은 각 포털이 자기 컨벤션대로 주입한다.

## 데이터 흐름

- **books**: 서버에서 1회 조회 + `unstable_cache` (revalidate 없음 — 정적
  데이터. 재적재 시에만 tag 무효화) → client 컴포넌트에 props로 전달.
  2,572행 ≈ gzip 60KB. 필터·검색·정렬은 전부 클라이언트 메모리에서 처리.
  서버측 페이지네이션·검색 인덱스는 만들지 않는다 (과설계).
- **읽음 상태**: 페이지 RSC에서 대상 학생의 `raz_read_logs` 1회 조회 →
  `Set<book_id>` → 토글 시 `useOptimistic` 즉시 반영 + server action
  insert/delete 1건 + `revalidatePath`.
- **server action**:
  - academy: `academy/actions.ts`에 토글 액션 1개 추가. 가드는 academy
    컨벤션(`createClient()` + `hasUserRole`) — 본인이거나 teacher. RLS가
    이중 방어선.
  - admin: `(admin)/admin/actions/`에 `verifyAdmin` 붙인 별도 토글 액션
    (insert/delete 2줄이라 중복 미미).
- **교사 대시보드 집계**: 학생별 읽은 권수·레벨 분포는 서버에서
  `raz_read_logs` group by 조회. 반별 그룹핑은 기존 `class_students` 사용.

## 적재 스크립트 (일회성)

위치 `scripts/raz-import/`, Node + `sharp`(devDependency 추가). 원본은
`D:\Projects\raz-kids`.

1. `import-books.ts` — `resourcelist.json` → `level_order` / `lexile_num` 계산
   → service role로 `raz_books` batch upsert. 변환 규칙(29개 레벨 매핑,
   "BR70L"→-70 파싱)은 스크립트 내 assert 셀프체크 포함.
2. `upload-covers.ts` — PNG 2,572개 → WebP q80 변환 → `raz-covers` 업로드
   (동시 업로드 수 제한).

service key는 `.env`에서 읽는다. 커밋 금지.

## 에러 처리

- 토글 실패(네트워크·RLS 거부): optimistic 상태 롤백 + 기존 toast 패턴으로 알림.
- 표지 이미지 없음: `<img>` onError 시 플레이스홀더.
- 적재 스크립트: 실패 행/파일 목록 출력 후 비정상 종료 — 재실행 시 upsert /
  overwrite라 멱등.

## 테스트 · 검증

- 변환 규칙(level_order, lexile_num)은 적재 스크립트 내 assert 셀프체크.
- 마이그레이션 후 `pnpm db:types` → tsc / lint 통과.
- 수동 확인: 학생 계정 토글, 교사 계정 타 학생 토글, admin 대시보드,
  RLS(학생이 타 학생 로그 접근 불가), 필터 즉각 반응, lazy 이미지 로드.

## 구현 순서

1. 마이그레이션(테이블 + RLS + 버킷) + `pnpm db:types`
2. 적재 스크립트 작성·실행 (books + 표지)
3. `/academy/student/reading` (목록 + 필터 + 토글 + 진행률)
4. `/academy/teacher/reading` (대시보드 + 학생별 화면)
5. `/admin/reading` 탭
