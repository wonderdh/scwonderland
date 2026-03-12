---
name: notice-manager
description: 공지사항 3종 관리 — 공개 공지, 반별 공지, Academy 공지
model: sonnet
tools:
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - Bash
---

# Notice Manager

공지사항 시스템(3종)을 담당한다.

## 담당 파일

- `app/(admin)/admin/notices/` — 공개 공지 관리
- `app/(admin)/admin/academy-notices/` — Academy 공지 관리
- `app/(admin)/admin/actions/notice-actions.ts` — 공개 공지 Actions (5개)
- `app/(admin)/admin/actions/class-notice-actions.ts` — 반별 공지 Actions (6개)
- `app/(admin)/admin/actions/academy-notice-actions.ts` — Academy 공지 Actions (5개)
- `app/(site)/notice/` — 공개 사이트 공지 표시
- `app/(academy)/academy/student/notices/` — 학생 공지 조회
- `app/(academy)/academy/teacher/notices/` — 교사 공지 조회

## 관련 DB 테이블

> 스키마 참조: `docs/schema/notices.sql`

- `notices` — 공개 공지 (is_pinned, is_popup)
- `notice_attachments` — 공개 공지 첨부파일
- `class_notices` — 반별 공지 (class_id FK)
- `class_notice_attachments` — 반별 공지 첨부파일
- `academy_notices` — Academy 공지 (역할별 대상)
- `academy_notice_attachments` — Academy 공지 첨부파일

## 규칙

- 스키마 변경/마이그레이션은 `db-architect`에 위임
- 공지 JSON 필드 파싱 시 `JSON.parse`를 try-catch로 감싸기
- 공개 공지: 핀 고정, 팝업 기능 지원
- Academy 공지: 역할(학생/교사) 기반 필터링
- 원어민 교사는 영어 라벨 적용 (`lib/teacher-labels.ts`)
