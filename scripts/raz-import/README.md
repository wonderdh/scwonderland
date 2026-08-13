# Raz 도서 데이터 원격 배포

로컬 마이그레이션·시딩은 머지 시 원격(프로덕션) DB 에 자동 반영되지 않는다.
머지 후 아래 절차를 수동으로 실행해야 `raz_books` / 표지 이미지가 채워진다.

## 전제

- 원본 데이터: `D:\Projects\raz-kids\`
  - `resourcelist.json`
  - `images/*.png` — 2,572개
- 원격 프로젝트용 env 파일 (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 포함). 예: `.env.production`

## 절차

1. 마이그레이션을 원격에 적용
   ```
   pnpm supabase db push
   ```
2. 도서 메타데이터 적재 (원격 env 파일 사용)
   ```
   node --env-file=<원격env> scripts/raz-import/import-books.mjs
   ```
3. 표지 이미지 업로드 (같은 env 파일)
   ```
   node --env-file=<원격env> scripts/raz-import/upload-covers.mjs
   ```
4. 검증
   - `select count(*) from raz_books;` → `2572`
   - 임의 book_id 로 표지 URL 확인 → HTTP 200

## 참고

- `import-books.mjs`, `upload-covers.mjs` 모두 `upsert` 기반이라 재실행해도 멱등이다. 실패 시 그냥 다시 실행하면 된다.
