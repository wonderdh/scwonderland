# Admin Classes (반 관리)

## 라우트 경로
- URL: `/admin/classes`
- 라우트 그룹: `(admin)`

## 핵심 파일
- page.tsx: `app/(admin)/admin/classes/page.tsx`

## 컴포넌트
| 파일 | 역할 |
|------|------|
| `classes/components/ClassesPageClient.tsx` | 반 관리 페이지 클라이언트 래퍼 (탭/뷰 전환) |
| `classes/components/ClassesManager.tsx` | 반 CRUD 관리 (생성, 수정, 삭제, 교사 배정) |
| `classes/components/ClassesOverview.tsx` | 반 전체 현황 개요 |
| `classes/components/ClassScheduleManager.tsx` | 반별 수업 시간표 관리 |

## Server Actions

### class-actions.ts
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `listClassesWithDetails` | (없음) | `classes`, `class_teachers`, `teachers`, `class_students` |
| `getClassWithStudents` | classId | `classes`, `class_teachers`, `teachers`, `class_students`, `students` |
| `getAllClassStudentsFlat` | (없음) | `class_students`, `students` |
| `createClass` | name, teacherProfileIds[], groupLabel? | `classes`, `class_teachers`, `academy_periods`, `class_schedules` |
| `updateClass` | classId, name, teacherProfileIds[], groupLabel? | `classes`, `class_teachers`, `academy_periods`, `class_schedules` |
| `deleteClass` | classId | `classes` |
| `addStudentToClass` | classId, studentProfileId | `class_students` |
| `removeStudentFromClass` | classStudentId | `class_students` |
| `listTeachersForSelect` | (없음) | `profiles`, `teachers` |
| `listStudentsNotInClass` | classId | `class_students`, `students` |

### schedule-actions.ts
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `getGroupTimetableGrid` | groupLabel | `academy_periods`, `classes`, `class_schedules`, `teachers`, `textbooks` |
| `listClassSchedules` | classId | `class_schedules`, `academy_periods`, `teachers` |
| `addClassScheduleBatch` | classId, periodId, dayOfWeeks[], teacherId?, label? | `class_schedules` |
| `deleteClassSchedule` | scheduleId | `class_schedules` |

### timetable-actions.ts
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `listAcademyPeriods` | (없음) | `academy_periods` |

### textbook-actions.ts (교재 선택용)
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `listTextbooks` | (없음) | `textbooks` |

### user-actions.ts
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `listAllStudents` | (없음) | `profiles`, `students` |

## 타입
- `ClassWithDetails` from `lib/types`
- `ClassStudentRow` from `lib/types`
- `ClassTeacherInfo` from `lib/types`
- `AcademyPeriod` from `lib/types`
- `ClassScheduleWithDetails` from `lib/types`

## 데이터 흐름
1. `page.tsx`: 6개 데이터 병렬 로드 (`listClassesWithDetails`, `listTeachersForSelect`, `getAllClassStudentsFlat`, `listAllStudents`, `listAcademyPeriods`, `listTextbooks`)
2. `ClassesPageClient`에 초기 데이터 전달
3. 반 선택 → 학생 목록, 시간표, 교재 배정 관리

## 의존성
- Shared: (없음 - 자체 컴포넌트 사용)
- Actions: from `actions.ts` barrel export

## 주의사항
- 반 group_label: "유치부" | "오후반" | "방과후" | null
- 유치부 반 생성/수정 시 자동으로 모든 교시x요일 슬롯 생성 (`class_schedules`)
- 반 삭제는 하드 삭제 (CASCADE)
- 교사 배정은 `class_teachers` 중간 테이블 (다대다)
- `getClassWithStudents`는 `verifyAuthenticated` 사용 (교사도 조회 가능)
