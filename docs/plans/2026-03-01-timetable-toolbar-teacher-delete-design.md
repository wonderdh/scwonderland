# Design: 시간표 툴바 + 교사 삭제 배정 해제

Date: 2026-03-01

---

## 1. 교사 삭제 경고 + 배정 자동 해제

### 목표
- 교사 소프트 삭제 시, 해당 교사의 반 담임 및 수업 배정을 **모두 삭제**
- 삭제 전 배정 현황을 알려주는 **커스텀 경고 모달** 표시

### 새 Server Action
`deleteUserById()` 내부에 배정 조회 + 삭제 로직 통합:
1. `class_teachers`에서 해당 `teacher_profile_id` 행 삭제
2. `class_schedules`에서 해당 `teacher_profile_id` 행 **완전 삭제**
3. `profiles.deleted_at = now()` + Auth ban

새 조회 전용 action:
```ts
getTeacherAssignmentCounts(userId: string): Promise<{ classCount: number; scheduleCount: number }>
```

### UI 변경 (TeacherInfoCard)
- 기존 `confirm()` 제거
- `showDeleteModal: boolean` state 추가
- 삭제 버튼 클릭 → 먼저 `getTeacherAssignmentCounts` 호출 → 모달 표시
- 모달 내용: "XXX 선생님은 현재 N개 반 담임, M개 수업에 배정되어 있습니다. 삭제 시 모두 해제됩니다."
- 모달 확인 → 실제 삭제 진행 → "휴지통으로 이동되었습니다." 메시지 1.5초 후 이동

---

## 2. 시간표 툴바 + 체크박스 배정 UI

### DB 스키마 변경
```sql
ALTER TABLE class_schedules
ADD COLUMN textbook_id UUID REFERENCES textbooks(id) ON DELETE SET NULL;
```

### `GroupTimetableData` 타입 변경
`textbooks` 필드 추가:
```ts
textbooks: { id: string; title: string; series: string | null }[]
```
`getGroupTimetableGrid`에서 `textbooks` 테이블 전체 조회 추가.

### UI 구조 변경

#### 툴바 (기존 요일 가이드 위치 대체)
```
┌────────────────────────────────────────────────────────────────────┐
│ 선생님: [Nana ▾]   과목: [Science ▾]   교재: [없음 ▾]                │
│                                            [전체해제] [저장 N건]    │
└────────────────────────────────────────────────────────────────────┘
```
- 드롭다운 3개: teacher(선택사항), label(선택사항), textbook(선택사항)
- 저장 버튼: pending 건수 표시, 0건이면 비활성화
- 전체해제: pendingChanges 초기화

#### 셀 동작
| 상태 | 셀 표시 | 클릭 동작 |
|------|---------|-----------|
| 빈 셀, pending 없음 | 요일 레이블 (기존) | pendingChanges에 추가 + 툴바 프리뷰 표시 |
| 빈 셀, pending 있음 | 체크마크 + 프리뷰 (녹색 배경) | pendingChanges에서 제거 (취소) |
| 기존 배정, pending 없음 | 현재 배정 정보 (기존) | pendingChanges에 추가 (덮어쓰기 예정, 노란 테두리) |
| 기존 배정, pending 있음 | 노란 테두리 + 프리뷰 | pendingChanges에서 제거 (덮어쓰기 취소) |

#### 저장 로직
```ts
// 저장 버튼 클릭 시
for (const [key, assignment] of pendingChanges) {
  const [classId, periodId, day] = key.split("_");
  await addSingleClassSchedule(classId, periodId, day, assignment.teacherId, assignment.label, assignment.textbookId);
}
// 성공 시 pendingChanges 초기화 + refreshData()
```

#### 기존 삭제 버튼 유지
- 배정된 셀 hover 시 × 버튼 → **즉시 DB 삭제** (기존 동작 유지)
- pending 상태와 독립적으로 동작

### `addSingleClassSchedule` 시그니처 변경
```ts
addSingleClassSchedule(
  classId, periodId, dayOfWeek,
  teacherProfileId: string | null,
  label: string | null,
  textbookId: string | null,  // 추가
)
```

---

## 변경 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `docs/*.sql` 또는 Supabase migration | `class_schedules.textbook_id` 컬럼 추가 |
| `app/(admin)/admin/actions/user-actions.ts` | `deleteUserById` 배정 삭제 로직 추가, `getTeacherAssignmentCounts` 추가 |
| `app/(admin)/admin/actions/schedule-actions.ts` | `addSingleClassSchedule` textbookId 파라미터 추가, `getGroupTimetableGrid` textbooks 추가 |
| `app/(admin)/admin/actions.ts` | 새 action re-export |
| `app/(admin)/admin/teachers/components/TeacherInfoCard.tsx` | 커스텀 삭제 모달 |
| `app/(admin)/admin/students/components/StudentSelectedView.tsx` | 커스텀 삭제 모달 (동일 패턴) |
| `app/(admin)/admin/timetable/components/GroupTimetableGrid.tsx` | 전체 UI 재설계 |
