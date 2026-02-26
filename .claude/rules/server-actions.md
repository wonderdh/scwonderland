# Server Actions

## admin/actions/ (도메인별 분할, barrel re-export via actions.ts)

**user-actions.ts — 사용자 관리:**
- `createStudent(formData)` — 학생 계정 생성 (AdminClient, email_confirm: true)
- `createTeacher(formData)` — 교사 계정 생성 (teacher_type: korean/native)
- `listUsersByRole(role)` — 역할별 사용자 목록 (profiles + auth + students/teachers 조인)
- `deleteUserById(formData)` — 사용자 삭제 (cascade)
- `updateStudentProfile(formData)` — 학생 이름 수정 (profiles + students 테이블)
- `updateTeacherProfile(formData)` — 교사 이름/유형 수정
- `resetUserPassword(userId, newPassword)` — 비밀번호 초기화
- `listAllStudents()` — 전체 학생 목록

**report-actions.ts — 리포트카드:**
- `getReportCard(studentProfileId, year, month)` — 리포트카드 조회 (RLS)
- `listReportCardsByStudent(studentProfileId)` — 학생별 리포트카드 목록
- `upsertReportCard(studentProfileId, year, month, content)` — 리포트카드 작성/수정 (교사/관리자만)
- `updateReportCardReply(reportCardId, reply)` — 학생 답변 작성 (본인만)

**class-actions.ts — 반 관리:**
- `listClassesWithDetails()` — 전체 반 목록 (교사명, 학생 수 포함)
- `getClassWithStudents(classId)` — 반 상세 + 학생 목록
- `getAllClassStudentsFlat()` — 전체 반-학생 매핑 (flat)
- `createClass(name, teacherProfileIds[])` — 반 생성 (교사 최대 2명)
- `updateClass(classId, name, teacherProfileIds[])` — 반 수정 (교사 재배정)
- `deleteClass(classId)` — 반 삭제
- `addStudentToClass(classId, studentProfileId)` — 학생 등록
- `removeStudentFromClass(classStudentId)` — 학생 제거
- `listTeachersForSelect()` — 교사 목록 (id, name, teacher_type)
- `listStudentsNotInClass(classId)` — 반에 미등록 학생 목록

**dashboard-actions.ts:** `getDashboardStats()` — 대시보드 통계 (학생, 교사, 반, 리포트카드, 공지사항)

**notice-actions.ts — 공지사항 관리:**
- `listNotices(includeUnpublished?)` — 공지 목록 (admin: true, public: false)
- `getNoticeWithAttachments(id)` — 공지 상세 + 이미지/첨부파일
- `createNotice(formData)` — 생성 (title, content, excerpt, is_published, is_pinned, images[], attachments[])
- `updateNotice(formData)` — 수정 (+ new_images[], new_attachments[], remove_attachment_ids)
- `deleteNotice(id)` — 삭제 (Storage 파일 먼저 삭제 → DB 삭제, hard delete)
- `uploadNoticeFile(file, fileType)` / `deleteNoticeFile(url)` — 내부 헬퍼 (Storage 업로드/삭제)

**textbook-actions.ts — 교재 관리:**
- `listTextbooks()` / `getTextbook(id)` — 교재 목록/상세 조회
- `createTextbook(formData)` / `updateTextbook(formData)` / `deleteTextbook(id)` — 교재 CRUD (삭제는 soft delete)
  - 커버 이미지: FormData의 `cover_image` 파일 → Storage 업로드 → public URL을 DB에 저장
  - 수정 시 `remove_cover=true`로 이미지만 제거 가능, 새 이미지 선택 시 기존 이미지 교체
  - 삭제/수정 실패 시 Storage 이미지 롤백 처리
- `uploadCoverImage(file)` / `deleteCoverImage(url)` — 내부 헬퍼 (Storage 업로드/삭제)
- `assignTextbookToClass()` / `removeTextbookFromClass()` — 반 교재 배정/해제
- `assignTextbookToStudent()` / `removeTextbookFromStudent()` — 개별 학생 교재 배정
- `updateProgress()` — 학생 교재 진도 업데이트
- `listStudentProgress()` — 학생별 교재 진도 조회
- `getClassTextbookProgress()` — 반 교재 전체 학생 진도 조회

## academy/actions.ts

- `getCurrentStudentProfile()` — 현재 로그인 학생의 프로필 조회
- `getCurrentStudentClasses()` — 현재 학생의 소속 반 + 담당 교사 조회
- `getCurrentTeacherProfile()` — 현재 로그인 교사의 프로필 조회
- `getTeacherClasses()` — 교사 담당 반 + 학생 목록
- `getClassReportStatus(classId, year, month)` — 반별 리포트카드 작성 현황
- `getClassTextbooks(classId)` — 반 교재 목록
- `getCurrentStudentTextbooks()` — 학생 교재 진도 조회
