# 라우트별 문서 인덱스

특정 페이지/기능 작업 시 해당 MD 파일을 참조하면 관련 파일, 컴포넌트, 액션, 타입을 빠르게 파악할 수 있습니다.

## 사용법

작업 대상 URL/파일에 따라 아래 MD 파일을 읽으세요:

## Admin 라우트 (`/admin/*`)

| 파일 | URL | 설명 |
|------|-----|------|
| [admin-dashboard.md](admin-dashboard.md) | `/admin` | 관리자 대시보드 (통계) |
| [admin-students.md](admin-students.md) | `/admin/students` | 학생 관리 (4탭: 기본정보/학습&리포트/시간표&출결/승하차) |
| [admin-teachers.md](admin-teachers.md) | `/admin/teachers` | 교사 관리 (프로필·반·시간표) |
| [admin-classes.md](admin-classes.md) | `/admin/classes` | 반 관리 (반 CRUD·학생 배정·스케줄) |
| [admin-textbooks.md](admin-textbooks.md) | `/admin/textbooks` | 교재 관리 (교재 CRUD·진도 관리) |
| [admin-notices.md](admin-notices.md) | `/admin/notices` | 공개 공지사항 관리 |
| [admin-academy-notices.md](admin-academy-notices.md) | `/admin/academy-notices` | 학원 내부 공지 관리 |
| [admin-timetable.md](admin-timetable.md) | `/admin/timetable` | 시간표·교시 관리 |
| [admin-afterschool.md](admin-afterschool.md) | `/admin/afterschool` | 방과후 프로그램 관리 |
| [admin-bus.md](admin-bus.md) | `/admin/bus` | 승하차 관리 (4탭: 오늘운행/변경요청/배정관리/마스터) |
| admin-weekly-sentences | `/admin/weekly-sentences` | 주간 문장 관리 (48주×3레벨(기초/중급/상급) CRUD, 기초는 Q&A, 자동/수동 주차, Excel 업로드) |
| admin-reservations | `/admin/reservations` | 예약 현황 (출결/버스 다중 날짜 일괄 예약, 캘린더 히트맵, 목록 CRUD) |

## Academy 라우트 (`/academy/*`)

| 파일 | URL | 설명 |
|------|-----|------|
| [academy-login.md](academy-login.md) | `/academy/login`, `/academy/dashboard` | 로그인 + 대시보드 (역할별 리디렉트) |
| [academy-student.md](academy-student.md) | `/academy/student/*` | 학생 포털 (대시보드·시간표·교재·공지·숙제·리포트카드·승하차) |
| [academy-teacher.md](academy-teacher.md) | `/academy/teacher/*` | 교사 포털 (대시보드·반관리·시간표·교재·공지·출결·숙제·리포트카드·승하차) |

## Bus 라우트

| 파일 | URL | 설명 |
|------|-----|------|
| [bus-staff.md](bus-staff.md) | `/bus` | 버스 직원 모니터 (승하차 체크) |
| [bus-monitor.md](bus-monitor.md) | `/bus-monitor` | 모니터링 대시보드 (실시간 현황) |

## Site 라우트 (공개 사이트)

| 파일 | URL | 설명 |
|------|-----|------|
| [site-home.md](site-home.md) | `/` | 홈페이지 (Hero·프로그램 소개) |
| [site-about.md](site-about.md) | `/about-wonderland/*` | 학원 소개 (인사말·소개·연혁·인증) |
| [site-program.md](site-program.md) | `/program/*` | 프로그램 안내 (Wonder K·Wonderland·Primo·Quest·오시는길) |
| [site-notice.md](site-notice.md) | `/notice/*` | 공개 공지 목록/상세 |
| [site-community.md](site-community.md) | `/community/*` | 커뮤니티 (캠퍼스·상담·가맹) |
| [site-experience.md](site-experience.md) | `/experience/*` | 체험 (e-School·도서관·스페셜데이) |

## 공유 모듈

| 파일 | 범위 | 설명 |
|------|------|------|
| [shared-components.md](shared-components.md) | `src/components/` | 공용 컴포넌트 목록 (Admin·Site 레이아웃) |
| [shared-lib.md](shared-lib.md) | `src/lib/` | 유틸리티·타입·Supabase 클라이언트·훅 |
| [shared-actions.md](shared-actions.md) | `actions/` | Server Actions 전체 인덱스 (함수↔테이블 매핑) |

## 작업별 참조 가이드

| 작업 유형 | 읽을 파일 |
|-----------|-----------|
| 특정 페이지 수정 | 해당 라우트 MD |
| 새 Server Action 추가 | `shared-actions.md` + 해당 라우트 MD |
| 타입 수정 | `shared-lib.md` + 영향받는 라우트 MD |
| 공용 컴포넌트 수정 | `shared-components.md` + 사용처 라우트 MD |
| DB 스키마 변경 | `shared-actions.md` (테이블 매핑) + `rules/database.md` |
| 스타일 작업 | `rules/styling.md` + 해당 라우트 MD |
