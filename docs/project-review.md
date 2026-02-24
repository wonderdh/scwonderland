# SC Wonderland 프로젝트 리뷰 및 교재 트래킹 설계

---

## 목차

1. [전체 평가 요약](#1-전체-평가-요약)
2. [잘된 점 (강점)](#2-잘된-점-강점)
3. [아쉬운 점 (개선 필요)](#3-아쉬운-점-개선-필요)
4. [추가해야 할 것](#4-추가해야-할-것)
5. [교재 트래킹 기능 설계](#5-교재-트래킹-기능-설계)

---

## 1. 전체 평가 요약

| 영역 | 점수 | 평가 |
|------|------|------|
| **아키텍처** | 9/10 | Route Group 분리, Server Action 패턴 우수 |
| **보안** | 8/10 | 2단계 인증, RLS, service role key 분리 |
| **코드 품질** | 7/10 | TypeScript strict, 일부 타입/에러 처리 부족 |
| **UI/UX** | 7/10 | 반응형 구현 좋으나, placeholder 페이지 다수 |
| **스타일링** | 6/10 | Tailwind + CSS Module 혼재, 컬러/브레이크포인트 불일치 |
| **SEO** | 4/10 | 기본 metadata만 존재, og/sitemap/구조화데이터 없음 |
| **접근성** | 5/10 | aria 부분 적용, focus 스타일/모션 대응 없음 |
| **성능** | 6/10 | Server Component 기반이나, 이미지 최적화 미흡 |

**종합: 6.5 / 10** — 핵심 기능과 구조는 탄탄하지만, 완성도와 마감 품질에서 보완 필요.

---

## 2. 잘된 점 (강점)

### 2.1 아키텍처

- **Route Group 분리**: `(content)`, `(admin)`, `(academy)` 3개 섹션이 깔끔하게 분리
- **LayoutSwitcher**: pathname 기반으로 레이아웃을 자동 분기하는 영리한 패턴
- **menu-routes.ts 중앙 관리**: 모든 Content 라우트를 한 파일에서 관리하여 일관성 보장
- **Server Action 기반**: 모든 데이터 변경이 Server Action을 통해 이루어져 보안성 높음

### 2.2 보안

- **2단계 인증 (Admin)**: middleware 세션 갱신 → layout.tsx에서 인증 + role 검증
- **Supabase 클라이언트 분리**: Browser / Server / Admin 3종으로 권한 분리
- **service role key**: 서버 전용, 클라이언트 노출 차단
- **이메일 정규화**: `normalizeEmail()` 함수로 도메인 자동 추가

### 2.3 코드 품질

- **TypeScript strict 모드** 활성화
- **React 19 useActionState** 적극 활용 (AddStudentForm, AddTeacherForm)
- **에러 반환 일관성**: 모든 Server Action이 `{ error?: string }` 패턴
- **한국어 에러 메시지**: LoginForm에서 에러코드별 사용자 친화적 메시지

### 2.4 UI/UX

- **Navigation 메가 메뉴**: hover 드롭다운 + 모바일 햄버거 잘 구현
- **SideBar**: desktop fixed + mobile FAB 반응형 전환 우수
- **company-history 타임라인**: 1993~2022 연혁을 정교하게 시각화
- **StudentReportTab**: 복잡한 리포트카드 CRUD UI를 깔끔하게 처리

---

## 3. 아쉬운 점 (개선 필요)

### 3.1 미완성 페이지 (9개)

| 경로 | 현재 상태 |
|------|----------|
| `/about-wonderland/certification` | "대외기관 인증 콘텐츠 영역입니다." |
| `/community/parent-consultation` | "학부모상담 콘텐츠 영역입니다." |
| `/community/franchise-inquiry` | "가맹문의 콘텐츠 영역입니다." |
| `/community/campus` | "캠퍼스 콘텐츠 영역입니다." |
| `/experience/special-day` | "Special Day 콘텐츠 영역입니다." |
| `/experience/e-school` | "Wonderland E-School 콘텐츠 영역입니다." |
| `/experience/library` | "Library 콘텐츠 영역입니다." |
| `/academy/teacher` | "준비 중" |
| `/academy/student/homework` | "준비 중" |

> Content 섹션의 약 40%가 placeholder 상태. Hero CTA "상담 신청하기" 버튼이 placeholder 페이지(`/community/parent-consultation`)로 연결됨.

### 3.2 SEO 부족

| 항목 | 현재 상태 | 필요 |
|------|----------|------|
| `title` + `description` | ✅ 각 페이지에 있음 | — |
| `og:image` | ❌ 없음 | 소셜 미디어 공유 시 이미지 표시 |
| `og:url` | ❌ 없음 | 정확한 URL 전달 |
| `keywords` | ❌ 없음 | 검색 엔진 힌트 |
| `sitemap.xml` | ❌ 없음 | Google 크롤링 |
| `robots.txt` | ❌ 없음 | 크롤링 제어 |
| 구조화 데이터 (ld+json) | ❌ 없음 | 검색 결과 리치 스니펫 |

### 3.3 스타일링 불일치

#### 컬러값이 파일마다 다름

```
Orange: #ff7700 vs #f87100 vs #ffa400 (3가지)
Green:  #52b978 vs #059467 vs #1f8963 (3가지)
```

#### 브레이크포인트 불일치

```
CSS Modules: 1280px (태블릿), 768px (모바일)
Tailwind:    1024px (lg), 768px (md)
→ 768~1280px 구간에서 레이아웃 충돌 가능
```

#### 폰트 충돌

```
layout.tsx: Geist 폰트 로드
globals.css: font-family: Arial, Helvetica, sans-serif (덮어쓰기)
→ Geist 폰트가 실제로 적용되지 않을 수 있음
```

### 3.4 접근성 미흡

| 항목 | 상태 | 영향 |
|------|------|------|
| `focus` 스타일 | ❌ 대부분 없음 | 키보드 사용자가 현재 위치 파악 불가 |
| `prefers-reduced-motion` | ❌ 없음 | 모션 민감 사용자 배려 부족 |
| `htmlFor` + `id` 연결 | ❌ 일부 누락 | 스크린 리더가 label-input 연결 불가 |
| 색상 대비 | ⚠️ `text-white/50` 등 | WCAG AA 기준 미달 가능 |

### 3.5 폼 검증 부족

- 이메일 형식 검증 없음 (pattern 속성 미사용)
- 비밀번호 강도 표시 없음
- AddStudentForm/AddTeacherForm에서 성공 메시지 없음 (에러만 표시)
- 일부 폼에서 중복 제출 방지 없음 (버튼 disabled 미적용)

### 3.6 이미지 최적화

- `ImageWithFallback`이 HTML `<img>` 사용 (Next.js `Image` 미사용)
- CSS `background-image`로 로드하는 이미지 5개 (최적화 불가)
- PNG 20개 vs SVG 2개 — 아이콘류는 SVG로 전환 권장

### 3.7 에러 처리/로깅

- Server Action에서 에러 발생 시 `{ error: error.message }` 반환만 하고 서버 로깅 없음
- try-catch가 일부 액션에만 적용
- Sentry 같은 에러 모니터링 미연동

### 3.8 Admin 대시보드

- 현재는 3개 링크 카드만 있음 (학생/교사/반 관리)
- "서비스 현황을 한눈에" 텍스트가 있으나 실제 통계 정보 없음
- 추가 필요: 총 학생 수, 교사 수, 반 수, 최근 리포트카드 작성 현황 등

---

## 4. 추가해야 할 것

### 4.1 즉시 (우선순위 높음)

| 항목 | 내용 |
|------|------|
| **SEO 기본** | `og:image`, `sitemap.xml`, `robots.txt` 추가 |
| **폼 검증** | email pattern, password 강도, 성공 메시지, 중복 제출 방지 |
| **Admin 대시보드 통계** | 학생/교사/반/리포트카드 카운트 표시 |
| **에러 로깅** | Server Action에 try-catch + console.error (최소한) |
| **globals.css 폰트 수정** | Arial → Geist 폰트 사용으로 변경 |

### 4.2 중기 (기능 완성)

| 항목 | 내용 |
|------|------|
| **교사 포털** | `/academy/teacher` — 담당 반 조회, 리포트카드 작성 |
| **숙제 기능** | `/academy/student/homework` — 숙제 목록/제출 |
| **Placeholder 페이지** | 7개 Content 페이지 콘텐츠 채우기 |
| **교재 트래킹** | 학생별/반별 교재 완료 표시 (아래 상세 설계) |

### 4.3 장기 (품질 향상)

| 항목 | 내용 |
|------|------|
| **접근성 개선** | focus 스타일, prefers-reduced-motion, label 연결 |
| **이미지 최적화** | Next.js Image 전환, SVG 아이콘 |
| **컬러 시스템 통일** | CSS 변수로 브랜드 컬러 중앙 관리 |
| **브레이크포인트 통일** | CSS Modules와 Tailwind 간 일관성 |
| **에러 모니터링** | Sentry 또는 Vercel Analytics 연동 |
| **테스트 코드** | Server Action 단위 테스트 (현재 테스트 0개) |

---

## 5. 교재 트래킹 기능 설계

### 5.1 개요

학생이 완료한 교재를 추적하는 시스템. **반 단위**와 **개인 단위** 모두 관리 가능.

#### 핵심 시나리오

```
1. 관리자/교사가 교재 목록을 등록한다
2. 반에 교재를 배정한다 (반에 속한 학생들이 자동으로 해당 교재 목록을 갖게 됨)
3. 개별 학생에게도 추가 교재를 배정할 수 있다
4. 교사/관리자가 학생의 교재 완료 상태를 체크한다
5. 학생은 자신의 교재 진도를 조회할 수 있다
```

### 5.2 데이터베이스 설계

#### 새로 추가할 테이블 (4개)

```
기존 테이블                          신규 테이블
─────────────                    ─────────────
profiles ──┐                     textbooks (교재 마스터)
students ──┤                         │
teachers ──┘                         ├── class_textbooks (반별 교재 배정)
classes ───── class_students         │       │
                                     └── student_textbook_progress (학생별 진도)
```

#### 테이블 1: `textbooks` (교재 마스터)

교재 정보를 관리하는 마스터 테이블.

```sql
CREATE TABLE textbooks (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title       TEXT NOT NULL,                    -- 교재명 (예: "Phonics Fun 1")
  series      TEXT,                             -- 시리즈명 (예: "Phonics Fun")
  level       TEXT,                             -- 레벨 (예: "Beginner", "Level 1")
  category    TEXT NOT NULL DEFAULT 'general',  -- 분류: general, phonics, reading, grammar, speaking
  total_units INT NOT NULL DEFAULT 1,           -- 총 단원 수 (예: 12)
  cover_image TEXT,                             -- 표지 이미지 URL (optional)
  description TEXT,                             -- 교재 설명 (optional)
  sort_order  INT NOT NULL DEFAULT 0,           -- 정렬 순서
  is_active   BOOLEAN NOT NULL DEFAULT true,    -- 사용 여부 (삭제 대신 비활성화)
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
```

#### 테이블 2: `class_textbooks` (반별 교재 배정)

특정 반에 어떤 교재를 배정했는지 관리. 반에 속한 학생들이 공통으로 진행할 교재 목록.

```sql
CREATE TABLE class_textbooks (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  textbook_id UUID NOT NULL REFERENCES textbooks(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (class_id, textbook_id)  -- 같은 반에 같은 교재 중복 배정 방지
);
```

#### 테이블 3: `student_textbook_progress` (학생별 교재 진도)

학생 개인의 교재 완료 상태를 추적. 반 배정이든 개별 배정이든 이 테이블에서 진도 관리.

```sql
CREATE TABLE student_textbook_progress (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  textbook_id         UUID NOT NULL REFERENCES textbooks(id) ON DELETE CASCADE,

  -- 배정 출처
  source_type         TEXT NOT NULL DEFAULT 'class',  -- 'class' (반 배정) | 'individual' (개별 배정)
  source_class_id     UUID REFERENCES classes(id) ON DELETE SET NULL,  -- class 배정인 경우 어느 반인지

  -- 진도 상태
  status              TEXT NOT NULL DEFAULT 'not_started',  -- not_started | in_progress | completed
  completed_units     INT NOT NULL DEFAULT 0,               -- 완료한 단원 수
  started_at          TIMESTAMPTZ,                          -- 학습 시작일
  completed_at        TIMESTAMPTZ,                          -- 전체 완료일

  -- 메모
  note                TEXT,                                 -- 교사/관리자 메모

  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),

  UNIQUE (student_profile_id, textbook_id, source_class_id)
  -- 같은 학생이 같은 교재를 같은 반에서 중복 진행 방지
  -- 단, 다른 반에서 같은 교재를 진행하는 건 허용
);
```

#### 인덱스

```sql
CREATE INDEX idx_stp_student ON student_textbook_progress(student_profile_id);
CREATE INDEX idx_stp_textbook ON student_textbook_progress(textbook_id);
CREATE INDEX idx_stp_class ON student_textbook_progress(source_class_id);
CREATE INDEX idx_stp_status ON student_textbook_progress(status);
CREATE INDEX idx_ct_class ON class_textbooks(class_id);
```

### 5.3 전체 관계도 (기존 + 신규)

```
Supabase Auth Users
    │
    ├── profiles (id, role, first_name, last_name)
    │   ├── students (profile_id FK, korean_name, english_name, student_number)
    │   └── teachers (profile_id FK, name, teacher_number)
    │
    ├── classes (id, name, teacher_profile_id FK)
    │   ├── class_students (class_id FK, student_profile_id FK)        [기존]
    │   └── class_textbooks (class_id FK, textbook_id FK)              [신규]
    │
    ├── report_cards (student_profile_id FK, author_id FK, year, month) [기존]
    │
    ├── textbooks (id, title, series, level, category, total_units)     [신규]
    │   ├── class_textbooks (textbook_id FK, class_id FK)               [신규]
    │   └── student_textbook_progress (textbook_id FK, student_id FK)   [신규]
    │
    └── student_textbook_progress                                       [신규]
            (student_profile_id FK, textbook_id FK, source_type, status, completed_units)
```

### 5.4 핵심 동작 흐름

#### 흐름 1: 교재 등록 (Admin)

```
관리자 → /admin/textbooks
  → "교재 추가" 클릭
  → 교재명, 시리즈, 레벨, 카테고리, 총 단원 수 입력
  → textbooks 테이블에 INSERT
```

#### 흐름 2: 반에 교재 배정 (Admin/Teacher)

```
관리자 → /admin/classes → 반 선택 → "교재 배정" 탭
  → 교재 목록에서 선택 → 배정
  → class_textbooks에 INSERT
  → 해당 반의 모든 학생에게 student_textbook_progress 자동 생성
    (status: 'not_started', completed_units: 0)
```

**자동 생성 로직 (Server Action 또는 DB Trigger):**

```
반에 교재 배정 시:
  1. class_textbooks에 INSERT
  2. class_students에서 해당 반의 모든 학생 조회
  3. 각 학생에 대해 student_textbook_progress INSERT (IF NOT EXISTS)
     - source_type: 'class'
     - source_class_id: 해당 class_id

반에 새 학생 추가 시:
  1. class_students에 INSERT
  2. class_textbooks에서 해당 반의 모든 교재 조회
  3. 각 교재에 대해 student_textbook_progress INSERT (IF NOT EXISTS)
```

#### 흐름 3: 개별 학생에게 교재 배정 (Admin/Teacher)

```
관리자 → /admin/students → 학생 선택 → "교재" 탭
  → 교재 목록에서 선택 → 배정
  → student_textbook_progress INSERT
    - source_type: 'individual'
    - source_class_id: NULL
```

#### 흐름 4: 진도 업데이트 (Admin/Teacher)

```
관리자/교사 → 학생 선택 → "교재" 탭
  → 교재별 진도 슬라이더/체크박스
  → completed_units 업데이트
  → 전체 완료 시 status: 'completed', completed_at: now()
```

#### 흐름 5: 학생이 본인 진도 조회

```
학생 → /academy/student/textbooks
  → 내 교재 목록 (반 배정 + 개별 배정)
  → 교재별 진도율 표시 (예: "8/12 단원 완료")
  → 완료된 교재는 체크 표시
```

### 5.5 라우트 설계

#### Admin 라우트

| 경로 | 기능 |
|------|------|
| `/admin/textbooks` | 교재 목록 관리 (CRUD) |
| `/admin/students?tab=textbook` | 학생별 교재 진도 관리 |
| `/admin/classes` → 교재 탭 | 반별 교재 배정 및 진도 현황 |

#### Academy 라우트

| 경로 | 기능 |
|------|------|
| `/academy/student/textbooks` | 학생 본인의 교재 진도 조회 |

### 5.6 Server Actions 설계

#### admin/actions.ts에 추가할 함수

```typescript
// --- 교재 관리 ---
createTextbook(formData)           // 교재 등록
updateTextbook(formData)           // 교재 수정
deleteTextbook(textbookId)         // 교재 삭제 (is_active = false)
listTextbooks()                    // 교재 목록 조회
getTextbook(textbookId)            // 교재 상세 조회

// --- 반별 교재 배정 ---
assignTextbookToClass(classId, textbookId)    // 반에 교재 배정 + 학생들 자동 progress 생성
removeTextbookFromClass(classId, textbookId)  // 반에서 교재 제거
listClassTextbooks(classId)                    // 반의 교재 목록
getClassTextbookProgress(classId, textbookId) // 반 전체 학생의 해당 교재 진도

// --- 개별 교재 배정 ---
assignTextbookToStudent(studentProfileId, textbookId)   // 개별 배정
removeTextbookFromStudent(progressId)                    // 개별 제거

// --- 진도 관리 ---
updateProgress(progressId, completedUnits, note?)  // 진도 업데이트
listStudentProgress(studentProfileId)               // 학생의 전체 교재 진도
```

#### academy/actions.ts에 추가할 함수

```typescript
// --- 학생 본인 조회 ---
getCurrentStudentTextbooks()  // 내 교재 목록 + 진도
```

### 5.7 UI 컴포넌트 설계

#### Admin: 교재 관리 페이지 (`/admin/textbooks`)

```
┌──────────────────────────────────────────────┐
│  교재 관리                    [+ 교재 추가]    │
├──────────────────────────────────────────────┤
│  검색: [__________________] 카테고리: [전체 ▼] │
├──────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────┐ │
│  │ 📘 Phonics Fun 1                       │ │
│  │ 시리즈: Phonics Fun | 레벨: Beginner   │ │
│  │ 단원: 12 | 카테고리: Phonics            │ │
│  │                        [수정] [삭제]    │ │
│  ├─────────────────────────────────────────┤ │
│  │ 📗 Reading Explorer 2                  │ │
│  │ 시리즈: Reading Explorer | 레벨: Level 2│ │
│  │ 단원: 10 | 카테고리: Reading            │ │
│  │                        [수정] [삭제]    │ │
│  └─────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

#### Admin: 반별 교재 진도 (ClassesManager에 탭 추가)

```
┌──────────────────────────────────────────────┐
│  Level A반              담당: 김교사          │
│  [학생 목록] [교재 배정] [진도 현황]           │
├──────────────────────────────────────────────┤
│  교재 배정 탭:                                │
│  ┌────────────────────────────────────────┐  │
│  │  배정된 교재:                           │  │
│  │  ✅ Phonics Fun 1 (12단원)    [제거]   │  │
│  │  ✅ Reading Explorer 2 (10단원) [제거] │  │
│  │                                        │  │
│  │  [+ 교재 추가 배정]                     │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  진도 현황 탭:                                │
│  ┌────────────────────────────────────────┐  │
│  │        │ Phonics Fun 1 │ Reading Ex 2 │  │
│  │ 학생명  │ 진도          │ 진도         │  │
│  ├────────┼──────────────┼─────────────┤  │
│  │ 김민수  │ ████████░░ 8/12│ ██░░░░░░ 2/10│  │
│  │ 이영희  │ ████████████ 완료│ ████░░░░ 4/10│  │
│  │ 박철수  │ ██░░░░░░░░ 2/12│ 미시작       │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

#### Admin: 학생별 교재 탭 (StudentTabNav에 추가)

```
[정보] [학습] [리포트] [교재] [예정]
                       ^^^^
┌──────────────────────────────────────────────┐
│  김민수의 교재 현황                            │
│                                              │
│  📘 Phonics Fun 1 (Level A반 배정)           │
│  ████████░░░░  8/12 단원 (67%)               │
│  [- 1] [██████████] [+ 1]                    │
│  메모: 7단원까지 잘 따라옴                     │
│                                              │
│  📗 Reading Explorer 2 (Level A반 배정)      │
│  ██░░░░░░░░░░  2/10 단원 (20%)               │
│  [- 1] [██████████] [+ 1]                    │
│                                              │
│  📙 Grammar World 1 (개별 배정)              │
│  ░░░░░░░░░░░░  0/8 단원 (0%)                 │
│  [- 1] [██████████] [+ 1]                    │
│                                              │
│  [+ 교재 개별 배정]                            │
└──────────────────────────────────────────────┘
```

#### Academy: 학생 본인 교재 페이지

```
[내 정보] [리포트카드] [교재] [숙제]
                       ^^^^
┌──────────────────────────────────────────────┐
│  나의 교재 현황                               │
│                                              │
│  완료: 1  진행중: 2  미시작: 1                 │
│                                              │
│  ✅ Phonics Fun 1         완료! (12/12)      │
│  📖 Reading Explorer 2   진행중 (4/10)       │
│  📖 Grammar World 1      진행중 (2/8)        │
│  📕 Writing Skills 1     미시작              │
└──────────────────────────────────────────────┘
```

### 5.8 RLS (Row Level Security) 정책

```sql
-- textbooks: 누구나 조회 가능, admin만 수정
ALTER TABLE textbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "textbooks_select" ON textbooks FOR SELECT USING (true);
CREATE POLICY "textbooks_admin" ON textbooks FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- class_textbooks: admin/teacher 조회, admin만 수정
ALTER TABLE class_textbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_textbooks_select" ON class_textbooks FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher'))
);
CREATE POLICY "class_textbooks_admin" ON class_textbooks FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- student_textbook_progress: 본인 + admin/teacher 조회, admin/teacher만 수정
ALTER TABLE student_textbook_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stp_select_own" ON student_textbook_progress FOR SELECT USING (
  student_profile_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher'))
);
CREATE POLICY "stp_modify" ON student_textbook_progress FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher'))
);
```

### 5.9 구현 단계

| 단계 | 작업 | 예상 |
|------|------|------|
| **1단계** | DB 테이블 + RLS 생성 (Supabase SQL) | 빠름 |
| **2단계** | Server Actions 구현 (CRUD + 진도 업데이트) | 중간 |
| **3단계** | Admin 교재 관리 페이지 (`/admin/textbooks`) | 중간 |
| **4단계** | Admin 반별 교재 배정 (ClassesManager에 탭 추가) | 중간 |
| **5단계** | Admin 학생별 교재 탭 (StudentTabNav에 "교재" 탭 추가) | 중간 |
| **6단계** | Academy 학생 교재 조회 (`/academy/student/textbooks`) | 가벼움 |
| **7단계** | 교사 포털에서 진도 관리 (`/academy/teacher`) | 나중에 |

### 5.10 확장 가능성

| 확장 | 설명 |
|------|------|
| **교재 단원별 상세 관리** | `textbook_units` 테이블 추가 → 단원별 제목/내용 관리 |
| **학습 이력** | `progress_history` 테이블 → 날짜별 진도 변화 기록 |
| **교재 추천** | 완료한 교재 기반으로 다음 단계 교재 자동 추천 |
| **학부모 조회** | 학부모 role 추가 → 자녀의 교재 진도 조회 |
| **통계 대시보드** | Admin 대시보드에 교재 진도 요약 위젯 |
| **교재 리뷰/평가** | 교사가 교재별 학생 성취도 코멘트 |

---

## 부록: 현재 DB 스키마 요약 (코드 기반 추정)

> SQL 파일이 없어 actions.ts 코드에서 추정한 스키마입니다.

```
profiles
  - id: UUID (PK, = auth.users.id)
  - role: TEXT ("admin" | "student" | "teacher")
  - first_name: TEXT
  - last_name: TEXT

students
  - profile_id: UUID (FK → profiles.id)
  - korean_name: TEXT
  - english_name: TEXT
  - student_number: TEXT (DB 함수 자동 생성)
  - updated_at: TIMESTAMPTZ

teachers
  - profile_id: UUID (FK → profiles.id)
  - name: TEXT
  - teacher_number: TEXT (DB 함수 자동 생성)
  - updated_at: TIMESTAMPTZ

classes
  - id: UUID (PK)
  - name: TEXT
  - teacher_profile_id: UUID (FK → profiles.id, nullable)
  - created_at: TIMESTAMPTZ
  - updated_at: TIMESTAMPTZ

class_students
  - id: UUID (PK)
  - class_id: UUID (FK → classes.id)
  - student_profile_id: UUID (FK → profiles.id)

report_cards
  - id: UUID (PK)
  - student_profile_id: UUID (FK → profiles.id)
  - author_id: UUID (FK → profiles.id)
  - year: INT
  - month: INT
  - content: TEXT
  - reply: TEXT
  - created_at: TIMESTAMPTZ
  - updated_at: TIMESTAMPTZ
  - UNIQUE (student_profile_id, year, month)
```
