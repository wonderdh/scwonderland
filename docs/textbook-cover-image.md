# 교재 커버 이미지 기능

## 개요

교재 등록/수정 시 커버 이미지를 Supabase Storage에 업로드하고, 교재 카드에 표시하는 기능.

---

## Supabase 설정 (사전 필수)

### 1. textbooks 테이블

```sql
CREATE TABLE public.textbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  series TEXT,
  level TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  total_units INTEGER NOT NULL DEFAULT 1,
  cover_image TEXT,          -- Storage public URL 저장
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.textbooks ENABLE ROW LEVEL SECURITY;
```

### 2. Storage 버킷

Supabase 대시보드 → Storage → New bucket:
- **Name:** `textbook-covers`
- **Public bucket:** ON
- **File size limit:** 10MB

또는 SQL:
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('textbook-covers', 'textbook-covers', true, 10485760);
```

> RLS 정책은 별도 불필요 — 서버에서 `service_role` 키(Admin Client)로 업로드하므로 RLS 우회됨.

---

## 이미지 제한사항

| 항목 | 값 |
|------|---|
| 허용 형식 | JPG, PNG, WebP |
| 최대 크기 | 10MB |
| 저장 위치 | `textbook-covers` 버킷 (public) |
| 파일명 규칙 | `{timestamp}_{random6자}{확장자}` (충돌 방지) |

---

## 동작 흐름

### 교재 추가 (createTextbook)

```
1. 모달에서 이미지 선택 (클라이언트 사전 검증: 형식, 크기)
2. FormData에 cover_image 파일 포함
3. Server Action에서:
   ├─ uploadCoverImage() → Storage 업로드 → public URL 반환
   └─ textbooks 테이블 INSERT (cover_image = public URL)
4. DB INSERT 실패 시 → 업로드한 이미지 Storage에서 롤백 삭제
```

### 교재 수정 (updateTextbook)

```
▶ 이미지 교체 (새 이미지 선택):
  1. 새 이미지 Storage 업로드
  2. DB UPDATE (cover_image = 새 URL)
  3. DB 성공 후 → 이전 이미지 Storage에서 삭제
  4. DB 실패 시 → 새 이미지 롤백 삭제

▶ 이미지 제거 (X 버튼):
  1. FormData에 remove_cover=true 전송
  2. DB UPDATE (cover_image = null)
  3. DB 성공 후 → 이전 이미지 Storage에서 삭제

▶ 이미지 변경 없음:
  - cover_image 필드 UPDATE에서 제외 (기존 값 유지)
```

### 교재 삭제 (deleteTextbook)

```
1. 기존 cover_image URL 조회
2. soft delete (is_active = false)
3. DB 성공 후 → Storage에서 커버 이미지 삭제
```

---

## 수정된 파일

| 파일 | 변경 내용 |
|------|----------|
| `next.config.ts` | Supabase Storage 도메인을 `images.remotePatterns`에 추가 (next/image 최적화) |
| `app/(admin)/admin/actions/textbook-actions.ts` | `uploadCoverImage()`, `deleteCoverImage()` 헬퍼 추가. `createTextbook`/`updateTextbook`/`deleteTextbook`에서 이미지 처리 |
| `app/(admin)/admin/textbooks/components/TextbooksManager.tsx` | 모달: 이미지 선택 UI(미리보기, X 삭제 버튼) / 카드: 커버 이미지 표시(없으면 책 아이콘) |

---

## UI 구성

### 모달 (TextbookFormModal)

- 이미지가 없을 때: 점선 테두리 버튼 "이미지 선택 (JPG, PNG, WebP / 10MB 이하)"
- 이미지 선택 후: 미리보기 표시 + 우측 상단 X 버튼으로 제거 가능
- 수정 모달: 기존 커버 이미지를 미리보기로 표시, 교체 또는 제거 가능

### 카드 (TextbookCard)

- 커버 이미지 있음: `next/image`로 h-36 커버 이미지 표시 (object-cover)
- 커버 이미지 없음: 회색 배경에 책 아이콘 표시 (fallback)
