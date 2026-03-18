# eSmart Campus 매뉴얼 기반 SC Wonderland 신규 기능 도입 계획

> 작성일: 2026-03-17
> 출처: `Teachers_Manual.pdf` (e-future eSmart Campus Teacher's Page Manual)
> 작업 범위: PDF에서 추출한 적용 가능 기능 분석 + 기능별 상세 구현 계획

---

## 1. 신규 기능 목록 (우선순위 순)

| 순위 | 기능 | 난이도 | DB 변경 | 신규 라우트 |
|------|------|--------|---------|------------|
| P1-A | 수료증 자동 발급 | 중 | `certificates` 테이블 + 트리거 | 없음 (기존 탭 추가) |
| P1-B | 학부모 포털 | 높음 | `parent_student_links` + role 추가 | `(academy)/academy/parent/` 전체 |
| P2-C | 별 포인트 시스템 | 낮음 | `learning_records.stars` 컬럼 | 없음 (기존 UI 확장) |
| P2-D | 교재자료실 | 중 | `textbook_resources` 테이블 + 버킷 | 없음 (탭 추가) |
| P3-E | 알림장 YouTube 삽입 | 낮음 | 공지 3개 테이블에 컬럼 추가 | 없음 (기존 폼 확장) |
| P3-F | 학생 일괄 Excel 등록 | 중 | 없음 | 없음 (모달 추가) |

**권장 구현 순서:** E → C → A → D → F → B

---

## 2. [P1-A] 수료증 자동 발급 시스템

### 현황
`student_textbook_progress` 테이블에 `completed_units`, `total_units`, `status` 필드 존재. 완료 조건 충족 시 수료증 화면 없음.

### DB 마이그레이션
```sql
CREATE TABLE certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  textbook_id UUID REFERENCES textbooks(id) ON DELETE CASCADE,
  issued_by UUID REFERENCES profiles(id),  -- NULL = 자동 발급
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_profile_id, textbook_id)
);
```

### Server Actions
- `issueCertificate(studentProfileId, textbookId, issuedBy?)` → `verifyAdmin`
- `revokeCertificate(certificateId)` → `verifyAdmin`
- `listStudentCertificates(studentProfileId)` → `verifyAuthenticated`
- `autoIssueCertificateIfComplete(studentProfileId, textbookId)` → internal (updateProgress 내부 호출)

### UI
- 학생 포털 교재 탭에 수료증 섹션 추가 (`completed_units >= total_units`일 때 표시)
- 수료증 카드: 학생 이름, 교재명, 발급일 (`CertificateCard` 컴포넌트)
- 관리자 학생 상세 → "수료증" 탭 추가 (`StudentCertificateTab` 컴포넌트)

### 영향 파일
- `lib/types/database.ts` — `Certificate` 타입 추가
- `app/(admin)/admin/actions/textbook-actions.ts` — 수료증 CRUD 추가
- `app/(admin)/admin/students/components/StudentCertificateTab.tsx` — 신규
- `app/(academy)/academy/student/textbooks/` — 수료증 섹션 추가

---

## 3. [P1-B] 학부모 포털 (Parent Portal)

### 현황
`admin` / `student` / `teacher` 3개 역할만 존재. 학부모가 자녀 정보 열람 불가.

### DB 마이그레이션
```sql
-- profiles.role CHECK 제약에 'parent' 추가

CREATE TABLE parent_student_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  student_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parent_profile_id, student_profile_id)
);
```

### 신규 라우트 구조
```
app/(academy)/academy/
└── parent/
    ├── layout.tsx              # 학부모 인증 (role=parent 확인)
    ├── page.tsx                # 자녀 목록 (다자녀 지원)
    └── [studentId]/
        ├── page.tsx            # 선택 자녀 대시보드
        ├── notices/page.tsx    # 반별 공지 + Academy 공지 (읽기 전용)
        ├── homework/page.tsx   # 숙제 현황 (제출 여부 확인)
        ├── textbooks/page.tsx  # 교재 진도 현황 (읽기 전용)
        ├── reports/page.tsx    # 리포트카드 (읽기 전용)
        └── attendance/page.tsx # 출결 현황 (읽기 전용)
```

### Server Actions
- `createParentAccount(formData)` → `verifyAdmin`
- `linkParentToStudent(parentProfileId, studentProfileId)` → `verifyAdmin`
- `unlinkParentFromStudent(linkId)` → `verifyAdmin`
- `getParentChildren(parentProfileId)` → `verifyAuthenticated` (parent 본인)
- `getChildDashboard(studentProfileId)` → `verifyAuthenticated` (parent 소유권 검증)

### 관리자 기능 추가
- `/admin/students` 상세 → "학부모 계정" 탭 추가 (생성/연결/해제)

### 영향 파일
- `lib/types/database.ts` — `ParentStudentLink` 타입 추가
- `app/(admin)/admin/actions/user-actions.ts` — 학부모 CRUD 추가
- `app/(academy)/academy/parent/` — 전체 라우트 신규 생성
- `.claude/rules/architecture.md` — 라우트맵 업데이트

---

## 4. [P2-C] 별(Star) 포인트 게임화 시스템

### 현황
`learning_records`에 `score`, `max_score` 존재. 별 개념 없음.

### 별 계산 규칙
| 점수 | 별점 |
|------|------|
| 100점 | ★★★ (3점) |
| 67~99점 | ★★☆ (2점) |
| 33~66점 | ★☆☆ (1점) |
| 0~32점 | ☆☆☆ (0점) |

### DB 마이그레이션
```sql
ALTER TABLE learning_records ADD COLUMN IF NOT EXISTS stars INT NOT NULL DEFAULT 0;
```

### Server Actions
- `getStudentStarSummary(studentProfileId)` → `verifyAuthenticated`
  반환: `{ thisMonth: number, total: number, byRecord: StarRecord[] }`

### UI
- 학생 포털 대시보드 — "누적 별 획득" 위젯 (`StarSummaryWidget`)
- 학습 기록 목록 — 별점 시각화 (`StarBadge` 공유 컴포넌트)
- 관리자 학생 상세 학습기록 탭 — 별점 컬럼 추가

### 영향 파일
- `lib/types/database.ts` — `LearningRecord`에 `stars` 추가
- `app/(admin)/admin/actions/learning-actions.ts` — 별 계산 로직 추가
- `components/StarBadge.tsx` — 신규 공유 컴포넌트
- `app/(academy)/academy/student/` — 위젯, 학습기록 별점 표시

---

## 5. [P2-D] 교재자료실 (Teacher Resource Library)

### 현황
`textbooks` 테이블에 기본 정보만 존재. 부속 자료(PDF, MP3) 다운로드 기능 없음.

### DB 마이그레이션
```sql
CREATE TABLE textbook_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  textbook_id UUID REFERENCES textbooks(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN
    ('answer_key','audio_script','flashcard','worksheet','mp3','test','word_list','other')),
  title TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size_bytes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Storage 버킷:** `textbook-resources` (Private — 교사/관리자만 접근)

### Server Actions
- `listTextbookResources(textbookId)` → `verifyAuthenticated`
- `uploadTextbookResource(formData)` → `verifyAdmin`
- `deleteTextbookResource(resourceId)` → `verifyAdmin`
- `getTextbookResourceDownloadUrl(resourceId)` → `verifyAuthenticated` (Signed URL, 1시간)

### UI
- 관리자 `/admin/textbooks` 교재 상세 → "부속 자료" 탭 추가 (`TextbookResourceTab`)
- 교사 포털 `/academy/teacher/textbooks` → "자료 다운로드" 버튼 추가 (`ResourceDownloadList`)

### 영향 파일
- `lib/types/database.ts` — `TextbookResource` 타입 추가
- `app/(admin)/admin/actions/textbook-actions.ts` — 자료 CRUD 추가
- `app/(admin)/admin/textbooks/components/TextbookResourceTab.tsx` — 신규
- `app/(academy)/academy/teacher/textbooks/` — 다운로드 버튼 추가

---

## 6. [P3-E] 알림장 YouTube 영상 삽입

### 현황
공지사항 3종(공개/반별/Academy) 이미지/파일 첨부 가능. YouTube 삽입 없음.

### DB 마이그레이션
```sql
ALTER TABLE notices         ADD COLUMN IF NOT EXISTS youtube_url TEXT;
ALTER TABLE class_notices   ADD COLUMN IF NOT EXISTS youtube_url TEXT;
ALTER TABLE academy_notices ADD COLUMN IF NOT EXISTS youtube_url TEXT;
```

### 구현 내용
- 공지 작성/수정 폼에 "YouTube URL" 입력 필드 추가
- URL → `https://youtube.com/embed/{id}` 변환
- 공지 상세 페이지에서 `<iframe>` 임베드 표시
- 입력 검증: YouTube URL만 허용 (보안)
- `YoutubeEmbed` 공유 컴포넌트 신규 생성

### 영향 파일
- `lib/types/database.ts` — 3개 공지 타입에 `youtube_url` 추가
- `lib/supabase/notice-crud-helpers.ts` — youtube_url 처리 추가
- 공지 관련 Server Actions 3개 — youtube_url 파라미터 추가
- 공지 작성/수정 폼 컴포넌트 3종 — URL 입력 필드 추가
- 공지 상세 컴포넌트 3종 — iframe 렌더링 추가
- `components/YoutubeEmbed.tsx` — 신규 공유 컴포넌트

---

## 7. [P3-F] 학생 일괄 Excel 등록

### 현황
관리자가 학생을 한 명씩 등록. 신입생 다수 처리 시 불편.

### 구현 내용
- 관리자 학생 관리 페이지 → "일괄 등록" 버튼 추가
- Excel 템플릿 다운로드 제공 (이름, 한국이름, 나이, 아이디, 초기비밀번호)
- 업로드 → 행별 `createStudent()` 호출
- 결과: 성공 N건 / 실패 M건 + 실패 사유 표시
- 파일 제한: 1MB / 최대 100명

### 기술
- `xlsx` npm 패키지 (SheetJS) — 서버에서 파싱

### Server Actions
- `bulkCreateStudents(formData)` → `verifyAdmin`

### 영향 파일
- `app/(admin)/admin/actions/user-actions.ts` — `bulkCreateStudents()` 추가
- `app/(admin)/admin/students/components/BulkStudentUpload.tsx` — 신규 (모달)
- `package.json` — `xlsx` 패키지 추가

---

## 8. 미적용 결정 기능

| eSmart Campus 기능 | 미적용 이유 |
|---|---|
| **Reading Fluency Builder** (AI 발음 평가) | 외부 AI API 필요, 비용 발생, 이퓨쳐 전용 서비스 |
| **수업용 e-book** | 이퓨쳐 DRM 콘텐츠 — 자체 구현 불가 |
| **레벨테스트 통합** | 이퓨쳐 전용 서비스 |
| **오디오 플레이어** | 이퓨쳐 저작권 음원 |
| **학습관리 Test/Quiz per Unit** | 교재 단위별 문제 은행 구축 필요 — 이퓨쳐 핵심 가치 중복 |

---

## 9. 신규 컴포넌트 목록

| 컴포넌트 | 위치 | 비고 |
|---------|------|------|
| `StudentCertificateTab` | `admin/students/components/` | 관리자 수료증 탭 |
| `CertificateCard` | `academy/student/textbooks/` | 학생 포털 수료증 카드 |
| `StarBadge` | `components/` | 공유 — ★★☆ 시각화 |
| `StarSummaryWidget` | `academy/student/` | 이번달/전체 별 집계 |
| `TextbookResourceTab` | `admin/textbooks/components/` | 관리자 자료 업로드 탭 |
| `ResourceDownloadList` | `academy/teacher/textbooks/` | 교사 자료 다운로드 목록 |
| `YoutubeEmbed` | `components/` | 공유 — iframe 렌더링 |
| `ParentNav` | `academy/parent/components/` | 자녀 선택 + 탭 내비게이션 |
| `BulkStudentUpload` | `admin/students/components/` | 일괄 등록 모달 |

---

## 10. 검증 체크리스트

### [A] 수료증
- [ ] 교재 전체 unit 완료 시 수료증 자동 발급 확인
- [ ] 학생 포털 교재 탭에서 수료증 카드 표시 확인
- [ ] 관리자 학생 상세 수동 발급 버튼 동작 확인

### [B] 학부모 포털
- [ ] 학부모 계정 생성 + 자녀 연결 → `/academy/parent` 로그인 확인
- [ ] 자녀 공지/숙제/리포트카드 읽기 전용 열람 확인
- [ ] 다자녀 계정 자녀 전환 동작 확인
- [ ] 타인 자녀 접근 시 권한 오류 확인

### [C] 별 포인트
- [ ] 학습기록 생성 시 점수에 따라 별 자동 계산 확인
- [ ] 학생 포털 대시보드 위젯에 누적 별 표시 확인

### [D] 교재자료실
- [ ] 관리자 자료 업로드 → 교사 포털 다운로드 확인
- [ ] Signed URL 만료 후 재접근 불가 확인

### [E] YouTube
- [ ] 공지 작성 시 YouTube URL 입력 → 상세에서 영상 임베드 확인
- [ ] 잘못된 URL 입력 시 검증 오류 확인

### [F] 일괄등록
- [ ] 엑셀 템플릿 다운로드 → 업로드 → 계정 생성 확인
- [ ] 오류 데이터 포함 시 실패 행만 표시 확인
