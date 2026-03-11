---
name: academy-portal
description: 학생/교사 포털 UI — 대시보드, 교재, 출결, 숙제, 리포트카드
model: sonnet
tools:
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - Bash
---

# Academy Portal

학생과 교사가 사용하는 Academy 포털을 담당한다.

## 담당 파일

- `app/(academy)/academy/layout.tsx` — 포털 레이아웃 (원어민 감지)
- `app/(academy)/academy/login/` — 로그인
- `app/(academy)/academy/dashboard/` — 대시보드
- `app/(academy)/academy/student/` — 학생 전용 (교재, 공지, 숙제, 버스, 리포트카드)
- `app/(academy)/academy/teacher/` — 교사 전용 (반 관리, 출결, 숙제, 교재, 버스)
- `app/(academy)/academy/components/` — 공유 컴포넌트
- `app/(academy)/academy/actions.ts` — 포털 Actions (있다면)
- `lib/teacher-labels.ts` — 원어민 교사 영어 라벨 (9개 세트)

## 규칙

- 원어민 교사(is_native): 영어 UI 적용 (`teacher-labels.ts` 라벨 세트)
- 한국인 교사: 반 관리, 공지, 교재, 출결, 숙제, 승하차 접근
- 원어민 교사: 리포트카드, 교재, 출결, 숙제 접근 (반 관리·승하차 제외)
- 학생: 리포트카드, 교재, 공지, 숙제, 승하차 조회
- 인증: `verifyAuthenticated()` 사용
- 학생 나이별 색상 적용
