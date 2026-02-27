# SC Wonderland 구현 진행사항

> 최종 업데이트: 2026-02-27

---

## 완료된 Step 요약

| Step | 내용 | 상태 |
|------|------|------|
| Step 1 | 교사 교재 일괄 업데이트 + Admin 학생 반 조회 | ✅ 완료 |
| Step 2 | Admin 학습관리 탭 + 출결 탭 | ✅ 완료 |
| Step 3 | Storage 인프라 (버킷, 유틸, 공용 컴포넌트) | ✅ 완료 |
| Step 4 | 반별 공지 시스템 (교사 CRUD + 학생 조회) | ✅ 완료 |
| Step 5 | Academy 포털 공지사항 (Admin 관리 + 학생/교사 조회) | ✅ 완료 |
| Step 6 | 숙제 시스템 (AudioRecorder, 제출, 리뷰) | ✅ 완료 |
| Step 7 | 사이트 플레이스홀더 7개 | ⏸ 보류 (콘텐츠 미준비) |

---

## Step별 상세

### Step 1: 교사 교재 일괄 업데이트 + Admin 학생 반 조회

**교사 교재 일괄 업데이트:**
- `batchUpdateProgress` 액션 (`textbook-actions.ts`)
- `batchUpdateLabels` 라벨 (`teacher-labels.ts`, korean + native)
- `TeacherTextbookClient.tsx`에 일괄 업데이트 모달 UI

**Admin 학생 반 조회:**
- `getStudentClasses` 액션 (`class-actions.ts`)
- `StudentClassesView.tsx` 신규 컴포넌트
- Admin 학생 관리 info 탭에 소속 반 카드 추가

### Step 2: Admin 학습관리 탭 + 출결 탭

**DB 마이그레이션:**
- `learning_records` 테이블 (카테고리: test, assessment, note, level_change)
- `attendance` 테이블 (상태: present, absent, late, excused)

**학습관리:**
- `learning-actions.ts` (CRUD: list/create/update/delete)
- `StudentLearningTab.tsx` 교체 (카테고리별 목록 + CRUD 폼)

**출결:**
- `attendance-actions.ts` (record/list/delete/stats)
- `StudentAttendanceTab.tsx` 신규 (월간 캘린더 뷰 + 통계)
- RLS: admin 전체 + 담당 반 교사만 관리 가능

### Step 3: Storage 인프라

**Supabase Storage 버킷 (3개 신규):**
- `class-notices` (public) — 반별 공지 첨부
- `academy-notices` (public) — Academy 공지 첨부
- `homework-submissions` (private) — 숙제 제출 파일

**공용 유틸:**
- `lib/supabase/storage.ts` — 파일 검증, 경로 생성, 카테고리 분류
- `components/FileUpload.tsx` — 드래그앤드롭 다중 파일 업로드
- `components/FileList.tsx` — 파일 목록 (아이콘, 썸네일, 오디오 플레이어)

### Step 4: 반별 공지 시스템

**DB 마이그레이션:**
- `class_notices` + `class_notice_attachments` 테이블
- RLS: admin 전체, 교사 담당반 CRUD, 학생 소속반 읽기

**교사 포털:**
- `TeacherNoticesClient.tsx` — 반별 공지 목록/상세/작성 (한국인 전용)
- `noticeLabels` 추가 (`teacher-labels.ts`)

**학생 포털:**
- `StudentNoticesClient.tsx` — 공지 목록/상세 (반별 + Academy 통합)
- `StudentNav.tsx`에 공지 탭 추가

**Server Actions:**
- `class-notice-actions.ts` — CRUD + `getMyClassNotices`

### Step 5: Academy 포털 공지사항

**DB 마이그레이션:**
- `academy_notices` + `academy_notice_attachments` 테이블
- RLS: admin CRUD, 학생/교사 게시된 것만 읽기

**Admin 관리:**
- `AcademyNoticesManager.tsx` — 전체 CRUD, 이미지/파일 첨부, 게시/고정 관리
- `AdminSidebar.tsx`에 "Academy 공지" 링크 추가

**학생 포털:**
- `StudentNoticesClient.tsx` 확장 — 전체/학원/반 탭 필터

**Server Actions:**
- `academy-notice-actions.ts` — CRUD

### Step 6: 숙제 시스템

**DB 마이그레이션:**
- `homework_assignments` — 숙제 출제
- `homework_submissions` — 학생 제출 (상태: pending/submitted/reviewed)
- `homework_submission_files` — 제출 파일 메타데이터
- RLS: admin 전체, 교사 담당반 CRUD+리뷰, 학생 본인 제출

**AudioRecorder (`components/AudioRecorder.tsx`):**
- MediaRecorder API 기반
- 녹음 → 정지 → 재생 → 다시 녹음
- 최대 시간 자동 정지, WebM/OGG 출력

**학생 숙제 (`StudentHomeworkClient.tsx`):**
- 숙제 목록 (상태 배지: 미제출/제출 완료/확인 완료)
- 상세 뷰: 과제 정보, AudioRecorder 녹음 제출, 텍스트 메모
- 교사 피드백 표시, 마감 지난 과제 강조

**교사 숙제 관리 (`TeacherHomeworkClient.tsx`):**
- 반별 숙제 출제/수정/삭제
- 제출 현황 조회 (오디오 재생 + 피드백 작성)
- 제출률 표시
- `homeworkLabels` (korean + native 이중 언어)

**Server Actions (`homework-actions.ts`):**
- `listHomeworkAssignments`, `createHomeworkAssignment`, `updateHomeworkAssignment`, `deleteHomeworkAssignment`
- `listSubmissions`, `getStudentHomework`, `submitHomework`, `reviewSubmission`, `getSubmissionFiles`
- 숙제 생성 시 반 학생들에게 자동으로 pending submission 생성
- private 버킷 signed URL (3600초)

---

## 남은 작업

### Step 7: 사이트 플레이스홀더 7개 (보류)

콘텐츠 준비 시 구현. 현재 모두 간단한 placeholder 페이지 상태.

| 경로 | 페이지 |
|------|--------|
| `/about-wonderland/certification` | 대외기관 인증 |
| `/community/parent-consultation` | 학부모 상담 |
| `/community/franchise-inquiry` | 가맹 문의 |
| `/community/campus` | 캠퍼스 |
| `/experience/special-day` | Special Day |
| `/experience/e-school` | E-School |
| `/experience/library` | Library |

---

## 전체 기능 체크리스트

### Admin 대시보드
- [x] 대시보드 통계
- [x] 학생 관리 (CRUD, 검색)
- [x] 학생 리포트카드 탭
- [x] 학생 교재 진도 탭
- [x] 학생 학습관리 탭 (Step 2)
- [x] 학생 출결 탭 (Step 2)
- [x] 학생 반 조회 (Step 1)
- [x] 교사 관리 (CRUD, 검색)
- [x] 반 관리 (CRUD, 학생 등록)
- [x] 교재 관리 (CRUD, 배정, 커버 이미지)
- [x] 공지사항 관리 (이미지/파일 첨부)
- [x] Academy 공지 관리 (Step 5)

### 교사 포털
- [x] 대시보드 (담당 반 목록)
- [x] 리포트카드 작성 (원어민)
- [x] 교재 현황 조회
- [x] 교재 일괄 진도 업데이트 (Step 1)
- [x] 반별 공지 CRUD (한국인) (Step 4)
- [x] 반 관리 읽기 전용 (한국인)
- [x] 숙제 관리 (Step 6)

### 학생 포털
- [x] 내 정보 (프로필, 소속 반)
- [x] 리포트카드 조회 + 답변
- [x] 교재 진도 조회
- [x] 공지사항 (반별 + Academy) (Step 4+5)
- [x] 숙제 (AudioRecorder 제출) (Step 6)

### 공개 사이트
- [x] 랜딩 페이지
- [x] 원장 인사말, 연혁, 교육 철학
- [x] 프로그램 소개 (4개)
- [x] 공지사항 목록/상세
- [ ] 플레이스홀더 7개 → 실제 콘텐츠 (Step 7, 보류)

---

## 기술 참고

- **Supabase Storage 버킷:** textbook-covers, notice-files, class-notices, academy-notices, homework-submissions
- **private 버킷:** homework-submissions만 private (signed URL 사용)
- **RLS 정책:** 모든 테이블에 역할 기반 RLS 적용 (admin/teacher/student)
- **출결 권한:** admin + 담당 반 교사만 관리 가능 (class_teachers 기반 RLS)
