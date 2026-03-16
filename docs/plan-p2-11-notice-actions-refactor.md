# P2-11: 공지사항 3개 Action 파일 통합

> 상태: 미완료 / 난이도: 大
> 관련 파일: `notice-actions.ts`, `class-notice-actions.ts`, `academy-notice-actions.ts`

---

## 1. 현재 상황 — 무엇이 문제인가

### 공지사항 3종 구조

SC Wonderland에는 **세 종류의 공지사항**이 존재합니다:

| 종류 | 테이블 | 첨부 테이블 | 대상 | 액션 파일 |
|------|--------|------------|------|----------|
| 공개 공지 | `notices` | `notice_attachments` | 사이트 방문자·학생·교사 모두 | `notice-actions.ts` |
| 반별 공지 | `class_notices` | `class_notice_attachments` | 해당 반 학생·교사 | `class-notice-actions.ts` |
| Academy 공지 | `academy_notices` | `academy_notice_attachments` | 로그인한 학생·교사 | `academy-notice-actions.ts` |

### 각 파일의 함수 목록

세 파일이 완전히 동일한 패턴의 함수를 각자 구현합니다.

| 기능 | notice-actions | class-notice-actions | academy-notice-actions |
|------|:---:|:---:|:---:|
| 목록 조회 | `listNotices` | `listClassNotices` | `listAcademyNotices` |
| 상세+첨부 조회 | `getNoticeWithAttachments` | `getClassNoticeWithAttachments` | `getAcademyNoticeWithAttachments` |
| 생성 | `createNotice` | `createClassNotice` | `createAcademyNotice` |
| 수정 | `updateNotice` | `updateClassNotice` | `updateAcademyNotice` |
| 삭제 | `deleteNotice` | `deleteClassNotice` | `deleteAcademyNotice` |
| 파일 업로드 헬퍼 | `uploadNoticeFile` | `uploadClassNoticeFile` | `uploadFile` |
| 파일 삭제 헬퍼 | `deleteNoticeFile` | `deleteClassNoticeFile` | `deleteFile` |

**총 함수 수: ~21개 × 3파일 = 코드 중복 매우 심각**

### 각 파일의 라인 수

| 파일 | 라인 수 |
|------|--------|
| `notice-actions.ts` | 429줄 |
| `class-notice-actions.ts` | 425줄 |
| `academy-notice-actions.ts` | 370줄 |
| **합계** | **~1,224줄** |

---

## 2. 코드가 얼마나 같은가 — 실제 비교

### create 함수 비교 (핵심 로직)

```typescript
// notice-actions.ts:createNotice
const { data, error } = await supabase
  .from("notices")                        // ← 테이블명만 다름
  .insert({ title, content, excerpt, is_published, is_pinned })
  .select("id").single();
// 첨부파일 insert: notice_attachments, notice_id 키

// academy-notice-actions.ts:createAcademyNotice
const { data, error } = await supabase
  .from("academy_notices")               // ← 테이블명만 다름
  .insert({ title, content, excerpt, is_published, is_pinned })
  .select("id").single();
// 첨부파일 insert: academy_notice_attachments, academy_notice_id 키
```

로직 100% 동일, **테이블명과 FK 컬럼명만 다릅니다.**

### update 함수 비교

```typescript
// 세 파일 모두:
// 1. 새 이미지 업로드 → uploadXxxFile(file, "image")
// 2. 새 첨부파일 업로드 → uploadXxxFile(file, "attachment")
// 3. DB update
// 4. 새 첨부 레코드 insert
// 5. 제거 대상 파일 Storage 삭제 → deleteXxxFile(url)
// 6. 제거 대상 DB 레코드 삭제
// 7. revalidatePath
```

**7단계 흐름이 완전히 동일**, 변수명만 약간씩 다릅니다.

### Storage 헬퍼 비교

```typescript
// 세 파일 모두 동일한 구조:
async function upload___(file, fileType) {
  const validation = validateFile(file, category);
  if (!validation.valid) return { error };
  const storagePath = generateStoragePath(file.name, folder);
  const { error } = await supabase.storage.from(BUCKET).upload(...);
  return { url, storagePath };
}
```

버킷 상수(`BUCKET`)만 다릅니다.

---

## 3. 왜 완전 통합이 어려운가

### Next.js Server Actions 제약

```typescript
"use server";
export async function createNotice(formData: FormData) { ... }
```

Server Action은 **직접 export된 함수만** 클라이언트에서 참조할 수 있습니다. 즉:

```typescript
// ❌ 이렇게 할 수 없음 — 클라이언트가 동적으로 함수를 선택할 수 없음
const fn = noticeType === "class" ? createClassNotice : createNotice;
await fn(formData);

// ✅ 반드시 직접 import해야 함
import { createClassNotice } from "@/app/(admin)/admin/actions/class-notice-actions";
await createClassNotice(formData);
```

따라서 **외부 인터페이스(export된 함수명)는 유지**하면서, **내부 구현만 공통화**하는 thin-wrapper 패턴이 필요합니다.

---

## 4. 목표 구조 — 어떻게 바꿀 것인가

### 현재 구조

```
notice-actions.ts         (~429줄) — 공개 공지 전체 로직
class-notice-actions.ts   (~425줄) — 반별 공지 전체 로직
academy-notice-actions.ts (~370줄) — Academy 공지 전체 로직
```

### 목표 구조

```
lib/supabase/notice-crud-helpers.ts   (~250줄) — 공통 CRUD 로직
  ↑ import
notice-actions.ts         (~80줄)  — 테이블 설정 + thin wrapper
class-notice-actions.ts   (~100줄) — 테이블 설정 + thin wrapper (반별 특수 로직 포함)
academy-notice-actions.ts (~80줄)  — 테이블 설정 + thin wrapper
```

**총 1,224줄 → 약 510줄 (58% 감소)**

### 공통 헬퍼 파일 설계 (`lib/supabase/notice-crud-helpers.ts`)

```typescript
// 테이블 설정 객체
export type NoticeConfig = {
  table: string;           // "notices" | "class_notices" | "academy_notices"
  attachmentTable: string; // "notice_attachments" | ...
  fkField: string;         // "notice_id" | "class_notice_id" | "academy_notice_id"
  bucket: string;          // STORAGE_BUCKETS.NOTICE_FILES | ...
  revalidatePath: string;  // "/admin/notices" | ...
};

// 공통 함수들
export async function uploadNoticeAttachment(bucket, file, fileType) { ... }
export async function deleteNoticeAttachment(bucket, publicUrl) { ... }
export async function listNoticesCommon(config, supabase, filters) { ... }
export async function getNoticeWithAttachmentsCommon(config, supabase, noticeId) { ... }
export async function createNoticeCommon(config, supabase, fields, files) { ... }
export async function updateNoticeCommon(config, supabase, id, fields, files) { ... }
export async function deleteNoticeCommon(config, supabase, noticeId) { ... }
```

### thin wrapper 예시 (`notice-actions.ts` 변경 후)

```typescript
"use server";
import { NOTICE_CONFIG } from "@/lib/supabase/notice-crud-helpers";
import { createNoticeCommon, deleteNoticeCommon } from "@/lib/supabase/notice-crud-helpers";

const CONFIG = {
  table: "notices",
  attachmentTable: "notice_attachments",
  fkField: "notice_id",
  bucket: STORAGE_BUCKETS.NOTICE_FILES,
  revalidatePath: "/admin/notices",
};

export async function createNotice(formData: FormData) {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  return createNoticeCommon(CONFIG, createAdminClient(), formData);
}

export async function deleteNotice(noticeId: string) {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  return deleteNoticeCommon(CONFIG, createAdminClient(), noticeId);
}
```

---

## 5. 세 파일의 차이점 — 주의할 특수 로직

통합 시 아래 **차이점을 반드시 유지**해야 합니다.

### 인증 방식 차이

| 파일 | create/update/delete | list/get |
|------|---------------------|----------|
| `notice-actions.ts` | `verifyAdmin()` | `verifyAuthenticated()` |
| `class-notice-actions.ts` | `createClient().auth.getUser()` + authorId 검증 | `verifyAuthenticated()` |
| `academy-notice-actions.ts` | `verifyAdmin()` | `verifyAuthenticated()` |

반별 공지는 **교사 본인 글만 수정 가능**한 로직이 있어 인증 방식이 다릅니다.

### 목록 조회 추가 로직

| 파일 | 특수 로직 |
|------|----------|
| `notice-actions.ts` | 없음 |
| `class-notice-actions.ts` | 작성자 이름 조인 (`teachers` 테이블) |
| `academy-notice-actions.ts` | 없음 |

### 추가 조회 함수 (공통화 대상 외)

`class-notice-actions.ts`에만 있는 함수:
- `getMyClassNotices(studentProfileId)` — 학생 포털용, 소속 반 공지 전체 조회
- `toggleClassNoticePinned(noticeId)` — 고정/해제 토글

이 함수들은 공통 패턴이 아니므로 **개별 파일에 유지**.

---

## 6. 작업 절차

1. `lib/supabase/notice-crud-helpers.ts` 생성
   - `NoticeConfig` 타입 정의
   - Storage 업로드/삭제 공통 함수 (버킷 파라미터로 받음)
   - list / get / create / update / delete 공통 함수

2. `notice-actions.ts` thin wrapper로 교체
   - CONFIG 상수 정의
   - 각 export 함수에서 공통 함수 호출

3. `academy-notice-actions.ts` thin wrapper로 교체 (구조가 notice와 거의 동일)

4. `class-notice-actions.ts` thin wrapper로 교체
   - 인증 로직 차이 주의 (교사 본인 검증)
   - 작성자 이름 조인 로직 유지
   - `getMyClassNotices`, `toggleClassNoticePinned` 유지

5. 빌드 후 전체 공지사항 기능 수동 테스트

---

## 7. 리스크

- **범위**: 공지사항 3종 모든 CRUD 영향
- **인증 로직**: 파일마다 다른 인증 방식을 공통 함수에서 분기 처리 필요
- **테스트 불가**: 현재 자동화 테스트 없음 → 수동 테스트 필수
- **권장 접근**: 한 파일씩 순차 교체, 각 단계마다 빌드 확인
