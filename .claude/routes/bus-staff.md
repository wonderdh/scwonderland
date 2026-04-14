# 버스 직원 모니터 (Bus Staff)

## 라우트 경로
- URL: /bus
- 라우트 그룹: (bus)

## 핵심 파일
- page.tsx: `app/(bus)/bus/page.tsx`
- layout.tsx: `app/(bus)/bus/layout.tsx`
- error.tsx: `app/(bus)/bus/error.tsx`
- actions.ts: `app/(bus)/bus/actions.ts`

## 컴포넌트
| 파일 | 역할 |
|------|------|
| `app/(bus)/bus/components/BusStaffMonitor.tsx` | 버스 직원용 탑승/하차 체크 메인 컴포넌트 (일괄 저장 방식) |
| `components/LogoutButton.tsx` | 로그아웃 버튼 |

## Server Actions

### bus/actions.ts (로컬)
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `getCurrentBusStaffProfile` | () | profiles, bus_staff, bus_numbers |

### admin/actions (barrel export)
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `getDailyBusManifest` | (date) | bus_time_slots, student_bus_defaults, bus_change_requests, bus_check_records, students, bus_numbers, bus_stops |
| `boardBusStudent` | (studentProfileId, date, busTimeSlotId, busNumberId) | bus_check_records |
| `unboardBusStudent` | (studentProfileId, date) | bus_check_records |
| `checkBusStudent` | (studentProfileId, date, busTimeSlotId, busNumberId, staffProfileId) | bus_check_records |
| `uncheckBusStudent` | (studentProfileId, date) | bus_check_records |

## 타입
- `BusStaffProfile` — id, profile_id, email, name, bus_number_id, bus_label, created_at
- `BusManifestGroup` — bus_time_slot_id, bus_number_id, bus_label, slot_time, slot_label, students[]
- `BusManifestEntry` — student_profile_id, korean_name, english_name, age, boarded_at, checked_at, estimated_time, note, is_changed 등

## 데이터 흐름

### layout.tsx
1. `getUser()` → 미인증 시 `/academy/login?next=/bus` 리다이렉트
2. `profiles.role !== "bus"` → `/academy/dashboard` 리다이렉트
3. `bus_staff` 테이블에서 직원 이름, 배정 호차 조회
4. `bus_numbers` 테이블에서 호차 라벨 조회
5. 헤더: 호차 배지 + 직원 이름 + 로그아웃 버튼
6. PWA 지원: `manifest-bus.json`, apple-touch-icon, 테마 컬러

### page.tsx
1. `getCurrentBusStaffProfile()` 호출 → 미인증 시 `/academy/login` 리다이렉트
2. `<BusStaffMonitor busNumberId={...} staffProfileId={...} />` 렌더링

### BusStaffMonitor (핵심 컴포넌트)
1. **데이터 로드**: `getDailyBusManifest(date)` → 자기 호차 그룹만 필터링
2. **시간대 필터**: "현재 이후" (기본), "전체", 개별 시간대
3. **정류장별 그룹핑**: `groupStudentsByStop()` — estimated_time + note 기준, 그룹 내 나이순→이름순
4. **일괄 저장 방식** (핵심):
   - 학생 클릭 → `pendingChanges` Map에 추가/제거 (board/unboard/check/uncheck)
   - 하단 고정 바에 선택 인원 표시
   - "확인" 클릭 → 낙관적 UI 업데이트 + `Promise.allSettled`로 일괄 서버 저장
   - 에러 시 전체 새로고침, 성공 시 toast
5. **UI 상태 시각화**:
   - 미탑승: 흰색 배경, ○ 아이콘
   - 탑승 대기(pending board): 파란 ring
   - 탑승 완료: 파란 배경, ● + 탑승 시간
   - 하차 대기(pending check): 초록 ring
   - 하차 완료: 초록 배경, ✓ + 하차 시간
6. **요약 통계**: 탑승/하차 진행률 (상단)
7. **프로그레스 바**: 호차 카드별 탑승/하차 progress bar

### error.tsx
- 에러 바운더리: "문제가 발생했습니다" + "다시 시도" 버튼

## 의존성
- `lib/supabase/server.ts` — 서버 클라이언트 (layout, page, actions)
- `lib/supabase/admin.ts` — Admin 클라이언트 (actions)
- `app/(admin)/admin/actions.ts` — bus 관련 actions barrel export
- `sonner` — toast 알림

## 주의사항
- **PWA 앱**: manifest-bus.json 연결, 모바일 최적화 (max-w-lg, touch-manipulation)
- **일괄 저장 패턴**: 개별 저장이 아닌 선택 → 확인 방식 (네트워크 요청 최소화)
- **낙관적 UI**: 저장 전 즉시 UI 반영, 에러 시 전체 reload
- **호차 필터링**: `busNumberId`로 자기 호차만 표시 (layout에서 확인한 배정 호차)
- **실시간 미사용**: `use-bus-realtime.ts` 훅은 이 컴포넌트에서 사용하지 않음 (BusMonitorClient에서만 사용)
- `bus_check_records` 테이블: board는 `boarded_at` 기록, check는 `checked_at` + `checked_by_staff_id` 기록
