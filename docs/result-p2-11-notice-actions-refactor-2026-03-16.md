# P2-11 작업 결과: 공지사항 3개 Action 파일 공통 헬퍼로 통합

> 작업일: 2026-03-16 (일요일)
> 커밋: `refactor(P2-11): 공지사항 3개 Action 파일 공통 헬퍼로 통합`
> 빌드 상태: ✅ TypeScript 오류 없음 (55개 페이지 정상 생성)

---

## 1. 왜 이 작업을 했나

SC Wonderland에는 **세 종류의 공지사항**이 존재합니다.

| 종류 | 테이블 | 파일 |
|------|--------|------|
| 공개 공지 | `notices` | `notice-actions.ts` |
| 반별 공지 | `class_notices` | `class-notice-actions.ts` |
| Academy 공지 | `academy_notices` | `academy-notice-actions.ts` |

세 파일이 **완전히 동일한 패턴**을 각자 구현하고 있었습니다.

- Storage 업로드/삭제 헬퍼: 버킷 상수만 다르고 100% 동일
- 파일 업로드 루프(create/update): 7단계 흐름 완전 동일
- delete 함수: 첨부파일 URL 조회 → Storage 삭제 → DB 삭제, 100% 동일

**작업 전 총 줄 수: ~1,224줄 (429 + 425 + 370)**

---

## 2. 무엇을 했나

### 파일 구조 변화

```
변경 전
app/(admin)/admin/actions/
  notice-actions.ts         (429줄) — 전체 로직 자급자족
  class-notice-actions.ts   (425줄) — 전체 로직 자급자족
  academy-notice-actions.ts (370줄) — 전체 로직 자급자족

변경 후
lib/supabase/
  notice-crud-helpers.ts    (397줄) — 공통 CRUD 헬퍼 (신규)
app/(admin)/admin/actions/
  notice-actions.ts          (79줄) — CONFIG + thin wrapper
  academy-notice-actions.ts  (79줄) — CONFIG + thin wrapper
  class-notice-actions.ts   (294줄) — 커스텀 list/get/create/update + 헬퍼 사용
```

**총 줄 수: 849줄 (약 31% 감소)**

---

## 3. `notice-crud-helpers.ts` 설계

### NoticeConfig 타입

각 공지 종류의 테이블 설정을 담는 구성 객체입니다.

```typescript
export type NoticeConfig = {
  table: string;           // "notices" | "class_notices" | "academy_notices"
  attachmentTable: string; // "notice_attachments" | ...
  fkField: string;         // "notice_id" | "class_notice_id" | "academy_notice_id"
  bucket: string;          // STORAGE_BUCKETS.NOTICE_FILES | ...
};
```

### 내보내는 함수 목록

| 함수 | 용도 | 사용하는 파일 |
|------|------|--------------|
| `uploadNoticeFile(bucket, file, fileType)` | Storage 단일 파일 업로드 | 내부 |
| `deleteNoticeFile(bucket, publicUrl)` | Storage 단일 파일 삭제 | 내부 + class-notice |
| `uploadFilesFromFormData(bucket, imageFiles, attachmentFiles)` | 이미지+첨부 업로드 루프 | class-notice |
| `rollbackUploadedFiles(bucket, files)` | 업로드 실패 시 롤백 | 내부 + class-notice |
| `insertAttachmentRecords(supabase, config, noticeId, records)` | 첨부파일 DB 레코드 삽입 | class-notice |
| `deleteAttachmentsByIds(bucket, supabase, config, removeIds)` | ID로 첨부파일 삭제 | class-notice |
| `listPublicNoticesCommon(config, supabase, includeUnpublished)` | 목록 + 개수 집계 | notice, academy |
| `getNoticeWithAttachmentsCommon(config, supabase, noticeId)` | 상세 + 이미지/파일 분리 | notice, academy |
| `createPublicNoticeCommon(config, supabase, formData)` | 생성 | notice, academy |
| `updatePublicNoticeCommon(config, supabase, formData)` | 수정 | notice, academy |
| `deleteNoticeCommon(config, supabase, noticeId)` | 삭제 | notice, academy, class |

---

## 4. 파일별 변환 방식

### `notice-actions.ts` → thin wrapper (429줄 → 79줄)

공개 공지는 `academy_notices`와 필드 구조가 동일(excerpt, is_published 포함)하므로 5개 함수 모두 공통 함수 위임으로 완전 교체.

```typescript
// CONFIG 상수 정의
const CONFIG = {
  table: "notices",
  attachmentTable: "notice_attachments",
  fkField: "notice_id",
  bucket: STORAGE_BUCKETS.NOTICE_FILES,
} as const;

// thin wrapper 예시
export async function createNotice(formData: FormData) {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const result = await createPublicNoticeCommon(CONFIG, createAdminClient(), formData);
  if (!result.error) revalidatePath("/admin/notices");
  return result;
}
```

### `academy-notice-actions.ts` → thin wrapper (370줄 → 79줄)

`notice-actions.ts`와 CONFIG 값만 다른 완전히 동일한 구조. 5개 함수 모두 공통 함수 위임.

### `class-notice-actions.ts` → 부분 위임 (425줄 → 294줄)

반별 공지는 공개 공지와 세 가지가 다릅니다.

| 차이점 | 이유 | 처리 방법 |
|--------|------|----------|
| 인증 방식 | `createClient().auth.getUser()` + `user.id === author_id` 검증 | 커스텀 유지 |
| list 함수 | `teachers` 테이블 작성자 이름 조인 | 커스텀 유지 |
| get 함수 | 작성자 이름 조인, 첨부파일 미분류 | 커스텀 유지 |
| create/update 필드 | `excerpt`, `is_published` 없음; `class_id`, `author_id` 추가 | 커스텀 유지 |
| delete 함수 | 다른 공지와 동일한 패턴 | `deleteNoticeCommon` 사용 |
| 업로드 루프 | 다른 공지와 동일한 패턴 | `uploadFilesFromFormData` 사용 |

`getMyClassNotices(studentProfileId)` 함수는 변경 없이 그대로 유지했습니다.

---

## 5. revalidatePath 위치

**헬퍼 함수 내부에서 호출하지 않고, 각 thin wrapper에서 호출합니다.**

```typescript
// 헬퍼: revalidatePath 없음 — 순수 DB/Storage 작업만
export async function createPublicNoticeCommon(...) { ... return { id }; }

// wrapper: 성공 시만 revalidatePath
const result = await createPublicNoticeCommon(CONFIG, supabase, formData);
if (!result.error) revalidatePath("/admin/notices");
return result;
```

이유:
- 헬퍼는 `lib/` 디렉토리의 일반 모듈로, Next.js의 서버 컨텍스트와 무관하게 재사용 가능하도록 설계
- revalidatePath 경로는 각 도메인마다 다르므로 wrapper에서 관리하는 것이 더 명확

---

## 6. TypeScript 처리

### AdminClient 타입

`createAdminClient()` 반환값 타입을 직접 참조합니다.

```typescript
type AdminClient = ReturnType<typeof createAdminClient>;
```

### select("*") 사용

첨부파일 개수 집계 시 `select(\`${config.fkField}, file_type\`)` 형태의 템플릿 리터럴을 사용하면 Supabase TypeScript 생성 타입이 파싱에 실패해 `ParserError` 타입이 추론됩니다. `select("*")`로 변경해 해결했습니다.

---

## 7. 변경된 파일 목록

| 파일 | 변경 내용 | 줄 수 |
|------|----------|-------|
| `lib/supabase/notice-crud-helpers.ts` | **신규 생성** | 397줄 |
| `notice-actions.ts` | 429줄 → thin wrapper | **79줄** |
| `academy-notice-actions.ts` | 370줄 → thin wrapper | **79줄** |
| `class-notice-actions.ts` | 425줄 → 부분 위임 | **294줄** |

**총 1,224줄 → 849줄 (−375줄, 31% 감소)**

---

## 8. 보존된 외부 인터페이스

기존 export 함수 시그니처 **완전 유지** — 이 파일들을 import하는 컴포넌트/페이지 파일은 **단 한 곳도 수정하지 않았습니다.**

```typescript
// 변경 전후 동일
export async function listNotices(includeUnpublished?: boolean)
export async function getNoticeWithAttachments(noticeId: string)
export async function createNotice(formData: FormData)
export async function updateNotice(formData: FormData)
export async function deleteNotice(noticeId: string)
// ... class/academy도 동일
```

---

## 9. 검증

```bash
$ npm run build
# TypeScript 오류: 0건
# 생성된 페이지: 55개 정상
```

---

## 10. 향후 새 공지 종류 추가 시

새로운 공지 테이블이 추가되면, CONFIG 상수 정의 + thin wrapper 4개 함수만 작성하면 됩니다. Storage/업로드/DB CRUD 로직은 `notice-crud-helpers.ts`에서 자동으로 처리됩니다.

```typescript
// 새 공지 종류 추가 예시
const CONFIG = {
  table: "school_notices",
  attachmentTable: "school_notice_attachments",
  fkField: "school_notice_id",
  bucket: STORAGE_BUCKETS.SCHOOL_NOTICES,
} as const;
// → thin wrapper 4개만 작성하면 완성
```
