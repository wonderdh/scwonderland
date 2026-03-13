# Admin Afterschool (방과후 관리)

## 라우트 경로
- URL: `/admin/afterschool`
- 라우트 그룹: `(admin)`

## 핵심 파일
- page.tsx: `app/(admin)/admin/afterschool/page.tsx`

## 컴포넌트
| 파일 | 역할 |
|------|------|
| `afterschool/components/AfterschoolPageClient.tsx` | 방과후 학생 등록/관리 클라이언트 (요일별 등록, 학생 추가/제거) |

## Server Actions

### afterschool-actions.ts
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `getOrCreateAfterschoolClass` | (없음) | `classes` |
| `getAfterschoolEnrollments` | classId | `afterschool_enrollments`, `students` |
| `enrollStudent` | classId, studentProfileId, days[] | `afterschool_enrollments`, `class_students` |
| `removeAfterschoolStudent` | classId, studentProfileId | `afterschool_enrollments`, `class_students` |
| `listAvailableStudents` | classId | `afterschool_enrollments`, `profiles`, `students` |
| `listAfterschoolStudentIdsByDay` | day: number | `afterschool_enrollments` |
| `getStudentAfterschoolDays` | studentProfileId | `afterschool_enrollments` |
| `bulkUpdateEnrollmentDays` | classId, updates[{studentProfileId, days[]}] | `afterschool_enrollments`, `class_students` |

## 타입
- `AfterschoolStudentEnrollment` from `afterschool-actions.ts` (studentProfileId, korean_name, english_name, age, days[])

## 데이터 흐름
1. `page.tsx`: `getOrCreateAfterschoolClass()` → 방과후 반 조회 (없으면 자동 생성)
2. 병렬 로드: `getAfterschoolEnrollments(classId)` + `listAvailableStudents(classId)`
3. `AfterschoolPageClient`에 classId, 등록 학생, 미등록 학생 데이터 전달

## 의존성
- Actions: from `actions.ts` barrel export

## 주의사항
- 방과후 반은 `group_label = "방과후"`인 단일 반 (자동 생성)
- `afterschool_enrollments` 테이블로 학생별 요일(1~5) 등록 관리
- 등록 시 `class_students`에도 upsert (출석/숙제 호환)
- 요일이 0개가 되면 `class_students`에서도 제거
- `bulkUpdateEnrollmentDays`: 기존 삭제 → 새로 insert 패턴 (전체 교체)
- 학생 시간표(`getStudentTimetable`)에서 방과후 등록 요일만 필터링하여 표시
- `listAvailableStudents`는 소프트 삭제되지 않은 학생 중 미등록 학생만 반환
