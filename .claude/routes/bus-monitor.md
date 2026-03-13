# 버스 모니터링 대시보드 (Bus Monitor)

## 라우트 경로
- URL: /bus-monitor
- 라우트 그룹: (monitor)

## 핵심 파일
- page.tsx: `app/(monitor)/bus-monitor/page.tsx`
- layout.tsx: `app/(monitor)/bus-monitor/layout.tsx`

## 컴포넌트
| 파일 | 역할 |
|------|------|
| `app/(monitor)/bus-monitor/BusMonitorClient.tsx` | 전체 버스 모니터링 대시보드 (읽기 전용, 대형 화면 최적화) |

## Server Actions
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `listBusTimeSlots` | () | bus_time_slots |
| `getDailyBusManifest` | (date, direction) | bus_time_slots, student_bus_defaults, bus_change_requests, bus_check_records, students, bus_numbers, bus_stops |
| `listAllActiveStudentNames` | () | students, profiles |

## 타입
- `BusManifestGroup` — 호차별 학생 그룹
- `BusManifestEntry` — 개별 학생 승하차 정보
- `BusTimeSlot` — 시간대 정보 (id, time, label, direction)
- `AfterSchoolBusEntry` — 방과후 학생 정보

## 데이터 흐름

### layout.tsx
1. 인증 없음 — 누구나 접근 가능 (관리자용 모니터)
2. PWA 메타데이터: `manifest-bus-monitor.json`, apple-touch-icon, 테마 컬러
3. `<head>` 태그에 manifest, apple-touch-icon 직접 삽입
4. 별도의 헤더/네비게이션 없음 (전체 화면 모니터링용)

### page.tsx
1. `listBusTimeSlots()` 서버에서 호출 → `BusMonitorClient`에 전달
2. 최소한의 래퍼 (min-h-screen bg-slate-100)

### BusMonitorClient (핵심 컴포넌트)
1. **초기 로드**: `getDailyBusManifest()` 등원/하원 각각 + `listAllActiveStudentNames()` 병렬 호출
2. **시간대별 그룹 병합**:
   - pickup/dropoff 결과를 `TimeGroup`으로 병합
   - 시간순 정렬, 같은 시간이면 등원 먼저
3. **미배정 학생 계산**: manifest에 없는 학생 목록 생성
4. **방과후 학생**: 하원 결과의 `afterschoolStudents` 별도 표시
5. **필터링**:
   - 전체 보기 / 현재 시간 이후
   - 그룹 필터: 유치부, 오후반, 방과후 (시간대 label 기반)
   - 시간대 드롭다운: 개별 시간대 선택
6. **호차별 색상**: `BUS_CARD_COLORS` 8색 팔레트 (호차 라벨 알파벳순 매핑)
7. **학생 표시**:
   - 나이별 색상: `getAgeColor(age)` 적용 (5세=pink, 6세=sky, 7세=emerald)
   - 상태 이모지: 미탑승=⬜, 탑승=🚌, 하차=✅
   - 변경된 학생: 노란 배경 + "원래 호차 → 변경 호차" 표시
   - 탑승/하차 시간 표시
8. **정류장별 그룹핑**: bus_stop_name + estimated_time 기준
9. **프로그레스 바**: 호차별 탑승 진행률 (색상: 90%+ 파랑, 50%+ 노랑, 미만 빨강)
10. **나이별 범례**: 상단 우측에 5세/6세/7세/기타 색상 범례
11. **레이아웃**: grid 2열 (md 이상), 대형 폰트 (text-2xl 학생 이름)

### 관련 훅
| 파일 | 역할 |
|------|------|
| `lib/hooks/use-bus-realtime.ts` | Supabase Realtime 구독 (bus_check_records 테이블 변경 감지) |

#### use-bus-realtime.ts 상세
- `useBusRealtime(date, onUpdate)`: `bus_check_records` 테이블의 `check_date` 필터로 Realtime 구독
- `postgres_changes` 이벤트 감지 → 500ms 디바운스 → `onUpdate` 콜백 호출
- cleanup 시 채널 제거
- **현재 BusMonitorClient에서는 미사용** (폴링 방식 사용 가능)

## 의존성
- `app/(admin)/admin/actions.ts` — barrel export (getDailyBusManifest, listBusTimeSlots, listAllActiveStudentNames)
- `lib/student-age-colors.ts` — `getAgeColor()` 함수
- `lib/hooks/use-bus-realtime.ts` — Realtime 구독 훅 (선택적 사용)
- `components/ui/button.tsx` — 필터 버튼

## 주의사항
- **인증 불필요**: layout에 인증 체크 없음 — 관리자 사무실 모니터/TV용
- **읽기 전용**: 탑승/하차 체크 기능 없음 (BusStaffMonitor와 다름)
- **대형 화면 최적화**: 학생 이름 text-2xl, 상태 이모지 text-xl, grid 2열
- **PWA 지원**: 별도 manifest (manifest-bus-monitor.json), 전체 화면 모니터링
- **나이별 색상 필수**: `getAgeColor(age)` 적용 — 학생 이름에 나이 색상 반영
- **호차 색상 일관성**: 호차 라벨 알파벳순 정렬 후 팔레트 인덱스 매핑 → 호차 색상 일관 유지
- `UnassignedCard`: 어느 호차에도 배정되지 않은 학생 카드 (하단)
- `AfterSchoolBusEntry`: 방과후 학생 별도 섹션 (보라색 테마)
