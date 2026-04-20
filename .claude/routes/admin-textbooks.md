# Admin Textbooks (교재 관리)

## 라우트 경로
- URL: `/admin/textbooks`
- 라우트 그룹: `(admin)`

## 핵심 파일
- page.tsx: `src/app/(admin)/admin/textbooks/page.tsx`

## 컴포넌트
| 파일 | 역할 |
|------|------|
| `textbooks/components/TextbooksManager.tsx` | 교재 CRUD, 반/학생 배정, 진도 관리 통합 클라이언트 |

## Server Actions

### textbook-actions.ts
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `listTextbooks` | (없음) | `textbooks` |
| `getTextbook` | textbookId | `textbooks` |
| `createTextbook` | FormData(title, series, level, category, total_units, description, cover_image) | `textbooks`, Storage: `textbook-covers` |
| `updateTextbook` | FormData(id, title, series, level, category, total_units, description, cover_image, remove_cover) | `textbooks`, Storage: `textbook-covers` |
| `deleteTextbook` | textbookId | `textbooks` (soft delete: is_active=false), Storage |
| `listClassTextbooks` | classId | `class_textbooks`, `textbooks` |
| `assignTextbookToClass` | classId, textbookId | `class_textbooks`, `class_students`, `student_textbook_progress` |
| `removeTextbookFromClass` | classId, textbookId | `class_textbooks`, `student_textbook_progress` |
| `assignTextbookToStudent` | studentProfileId, textbookId | `student_textbook_progress` |
| `removeTextbookFromStudent` | progressId | `student_textbook_progress` |
| `updateProgress` | progressId, completedUnits, note?, assignedAt?, completedAt? | `student_textbook_progress`, `textbooks` |
| `listStudentProgress` | studentProfileId | `student_textbook_progress`, `textbooks`, `classes` |
| `getClassTextbookProgress` | classId, textbookId | `class_students`, `students`, `student_textbook_progress` |
| `listTextbooksNotInClass` | classId | `class_textbooks`, `textbooks` |
| `listTextbooksNotAssignedToStudent` | studentProfileId | `student_textbook_progress`, `textbooks` |
| `batchUpdateProgress` | classId, textbookId, completedUnits, excludeStudentIds[] | `student_textbook_progress`, `textbooks` |

### textbook-constants.ts
| 상수 | 값 |
|------|---|
| `TEXTBOOK_CATEGORIES` | general(일반), phonics(파닉스), reading(읽기), grammar(문법), speaking(말하기), writing(쓰기), vocabulary(어휘) |

## 타입
- `Textbook` from `textbook-actions.ts` (직접 export)
- `ClassTextbook` from `textbook-actions.ts`
- `StudentTextbookProgress` from `textbook-actions.ts`
- `ClassTextbookProgressRow` from `textbook-actions.ts`

## 데이터 흐름
1. `page.tsx`: `listTextbooks()` → 활성 교재 목록 로드
2. `TextbooksManager`에 초기 데이터 전달
3. 교재 CRUD + 반/학생 배정 + 진도 관리 모두 하나의 클라이언트 컴포넌트에서 처리

## 의존성
- Actions: `listTextbooks` from `textbook-actions.ts` (직접 import, barrel 미경유)
- Storage: `textbook-covers` 버킷 (커버 이미지)

## 주의사항
- 교재 삭제는 soft delete (`is_active = false`)
- 커버 이미지: JPG/PNG/WebP, 최대 10MB, `textbook-covers` 버킷
- 반에 교재 배정 시 해당 반 학생들에게 자동으로 `student_textbook_progress` 레코드 생성
- 반에서 교재 해제 시 `source_type='class'`인 progress도 함께 삭제
- 진도 상태: `not_started` → `in_progress` → `completed` (completed_units 기준 자동 결정)
- `batchUpdateProgress`로 반 전체 학생 일괄 진도 업데이트 가능 (제외 학생 지정)
- 타입이 `textbook-actions.ts`에서 직접 export됨 (`src/lib/types`가 아닌 action 파일 자체)
