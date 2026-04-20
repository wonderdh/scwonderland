# Admin Timetable (시간표 관리)

## 라우트 경로
- URL: `/admin/timetable`
- 라우트 그룹: `(admin)`

## 핵심 파일
- page.tsx: `src/app/(admin)/admin/timetable/page.tsx`

## 컴포넌트
| 파일 | 역할 |
|------|------|
| `timetable/components/TimetablePageClient.tsx` | 시간표 페이지 클라이언트 래퍼 (그룹 탭 전환: 유치부/오후반) |
| `timetable/components/GroupTimetableGrid.tsx` | 그룹별 시간표 그리드 (반x교시x요일 매트릭스, 교사/교재 배정) |
| `timetable/components/TimetableManager.tsx` | 수업 시간대(교시) CRUD 관리 |

## Server Actions

### timetable-actions.ts
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `listAcademyPeriods` | (없음) | `academy_periods` |
| `createAcademyPeriod` | name, startTime, endTime, groupLabel? | `academy_periods` |
| `updateAcademyPeriod` | id, name, startTime, endTime, groupLabel? | `academy_periods` |
| `deleteAcademyPeriod` | id | `academy_periods` (soft delete: is_active=false) |

### schedule-actions.ts
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `getGroupTimetableGrid` | groupLabel | `academy_periods`, `classes`, `class_schedules`, `teachers`, `profiles`, `textbooks` |
| `addSingleClassSchedule` | classId, periodId, day, teacherId, label, textbookId, studentProfileId | `class_schedules`, `classes` |
| `deleteClassSchedule` | scheduleId | `class_schedules` |

## 타입
- `AcademyPeriod` from `src/lib/types`
- `GroupTimetableData` from `schedule-actions.ts` (periods, classes, cells, teachers, textbooks)

## 데이터 흐름
1. `page.tsx`: 인증 확인 후 3개 데이터 병렬 로드
   - `listAcademyPeriods()` — 전체 교시 목록
   - `getGroupTimetableGrid("유치부")` — 유치부 시간표
   - `getGroupTimetableGrid("오후반")` — 오후반 시간표
2. `TimetablePageClient`에 데이터 전달 → 그룹 탭 전환
3. `GroupTimetableGrid`: 반(열) x 교시(행) x 요일(5일) 매트릭스 렌더링
4. 셀 클릭 → 교사/교재 배정 모달

## 의존성
- Actions: `listAcademyPeriods`, `getGroupTimetableGrid` from `actions.ts` barrel export
- Auth: page.tsx에서 자체 인증 체크 (layout과 별도)

## 주의사항
- 시간표는 유치부/오후반 2개 그룹 탭으로 분리 (방과후는 별도 `/admin/afterschool`)
- `GroupTimetableData.cells` 키 형식: `${classId}_${periodId}_${dayOfWeek}`
- 교시 삭제는 soft delete (`is_active = false`)
- 교사 배정 시 충돌 검사: 같은 교시+요일에 다른 반 배정 여부 확인
- `addSingleClassSchedule`은 upsert 패턴 (기존 있으면 update, 없으면 insert)
- 교시의 `group_label`로 유치부/오후반/방과후 구분
