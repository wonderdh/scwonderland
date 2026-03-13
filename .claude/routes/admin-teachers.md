# Admin Teachers (교사 관리)

## 라우트 경로
- URL: `/admin/teachers`
- 라우트 그룹: `(admin)`

## 핵심 파일
- page.tsx: `app/(admin)/admin/teachers/page.tsx`

## 컴포넌트
| 파일 | 역할 |
|------|------|
| `teachers/components/AddTeacherForm.tsx` | 교사 추가 폼 (아이디, 비밀번호, 이름, 유형: 한국인/원어민) |
| `teachers/components/TeacherInfoCard.tsx` | 선택된 교사 정보 카드 (이름, 유형 수정/삭제) |
| `teachers/components/TeacherTabNav.tsx` | 교사 상세 탭 네비게이션 (info, classes, timetable) |
| `teachers/components/TeacherClassesTab.tsx` | 교사 담당 반 목록 |
| `teachers/components/TeacherTimetableTab.tsx` | 교사 시간표 (3개 그룹별 하이라이트) |
| `components/AdminListSidebar.tsx` | 교사 목록 좌측 사이드바 |
| `components/UserList.tsx` | 사용자 목록 테이블 |
| `components/TrashView.tsx` | 소프트 삭제된 교사 복구/영구삭제 뷰 |

## Server Actions

### user-actions.ts
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `createTeacher` | FormData(email, password, name, teacher_type) | `auth.users`, `teachers` |
| `listUsersByRole` | role: "teacher" | `profiles`, `auth.users`, `teachers` |
| `listDeletedUsers` | role: "teacher" | `profiles`, `auth.users`, `teachers` |
| `updateTeacherProfile` | FormData(id, name, teacher_type) | `profiles`, `teachers` |
| `deleteUserById` | FormData(id) | `class_teachers`, `class_schedules`, `profiles`, `auth.users` |
| `restoreUser` | userId | `profiles`, `auth.users` |
| `permanentlyDeleteUser` | userId | `auth.users` |
| `getTeacherAssignmentCounts` | userId | `class_teachers`, `class_schedules` |

### class-actions.ts
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `listClassesWithDetails` | (없음) | `classes`, `class_teachers`, `teachers`, `class_students` |

### schedule-actions.ts
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `getGroupTimetableGrid` | groupLabel: string | `academy_periods`, `classes`, `class_schedules`, `teachers`, `profiles`, `textbooks` |

## 타입
- `UserWithProfile` from `lib/types`
- `ClassWithDetails` from `lib/types`
- `TeacherTabId` = "info" | "classes" | "timetable"
- `GroupTimetableData` from `schedule-actions.ts`

## 데이터 흐름
1. `page.tsx`: `listUsersByRole("teacher")` + `listClassesWithDetails()` 병렬 로드
2. searchParams로 `section`, `selected`, `tab` 결정
3. 시간표 탭 선택 시 → `getGroupTimetableGrid` 3개 그룹(유치부, 오후반, 방과후) 병렬 로드
4. `TeacherTimetableTab`에 allGroupData 전달 → 해당 교사의 수업 하이라이트 표시

## 의존성
- Shared: `AdminListSidebar`, `UserList`, `TrashView`
- Actions: from `actions.ts` barrel export

## 주의사항
- 교사 유형: `korean` (한국인) / `native` (원어민) 구분
- 교사 삭제 시 `class_teachers` (담임 배정), `class_schedules` (수업 배정) 먼저 삭제
- `getTeacherAssignmentCounts`로 삭제 전 연관 데이터 건수 경고 가능
- 시간표 탭: 3개 그룹 데이터를 page.tsx에서 사전 로드 (Server Component)
- 원어민 교사는 academy 포털에서 영어 UI 사용 (`teacher-labels.ts`)
