# 버스 모니터링 대시보드 (Bus Monitor)

## 라우트 경로
- URL: /bus-monitor
- 라우트 그룹: (monitor)

## 핵심 파일
- page.tsx: `src/app/(monitor)/bus-monitor/page.tsx`
- layout.tsx: `src/app/(monitor)/bus-monitor/layout.tsx`
- loading.tsx: `src/app/(monitor)/bus-monitor/loading.tsx` (SkeletonList 6)

## 컴포넌트
| 파일 | 역할 |
|------|------|
| `src/app/(monitor)/bus-monitor/BusMonitorClient.tsx` | 요일/시간대 필터 + 호차별 카드 그리드 렌더 (읽기 전용) |
| `src/components/bus/MonitorBusCard.tsx` | 호차 카드 (정류장별 학생 목록, `BUS_CARD_COLORS` 팔레트) |

## Server Actions
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `listBusTimeSlots` | () | bus_time_slots |
| `getDailyBusManifest` | (date) | bus_time_slots, student_bus_defaults, bus_change_requests, bus_check_records, students, bus_numbers, bus_stops |

## 타입
- `BusTimeSlot` — 시간대 (id, time, label, `show_empty_stops`)
- `BusManifestGroup` — 호차별 학생 그룹. `extra_stops?`는 `show_empty_stops=true` 시간대의 빈 정류장
- `BusManifestEntry` — 개별 학생 승하차 정보
- `BusManifestExtraStop` — 빈 정류장 메타 ("배정 학생 없음" 렌더용)

## 데이터 흐름

### layout.tsx
1. 인증 없음 — 누구나 접근 가능 (관리자용 모니터)
2. PWA 메타데이터: `manifest-bus-monitor.json`, apple-touch-icon, 테마 컬러 `#1e293b`
3. `<head>` 태그에 manifest, apple-touch-icon 직접 삽입
4. 별도 헤더/네비게이션 없음 (전체 화면 모니터링용)

### page.tsx — SSR 초기 데이터 페칭
1. `getTodayIsoDayKst()`로 KST 기준 오늘 요일 계산 (주말은 5=금으로 매핑)
2. `getDateForIsoDayKst(initialIsoDay)`로 해당 요일의 YYYY-MM-DD 산출
3. `listBusTimeSlots()` + `getDailyBusManifest(initialDate)` **병렬 SSR fetch**
4. `busTimeSlots`, `initialIsoDay`, `initialManifest.groups`를 `BusMonitorClient`에 props로 전달 → 초기 HTML에 실제 카드가 렌더링됨 (hydration 후 추가 fetch 없음)
5. 상단에 `/m`(메뉴) 뒤로가기 링크, 나머지는 `BusMonitorClient`에 위임

> ⚠️ mount 시점 Supabase 호출을 제거해서 LCP의 render delay와 CLS(0.28 → 0.00)를 해소한 구조. 클라이언트에서 초기 로드용 fetch를 다시 추가하지 말 것.

### BusMonitorClient
1. **초기 상태**: props로 받은 `initialGroups`를 `buildTimeGroups()`로 변환해 `allGroups` 초기값으로 사용. `initialIsoDay`를 `dayOfWeek`, `getDefaultSlotId(busTimeSlots)`를 `slotFilter`, `loadedKeyRef`를 `${initialIsoDay}`로 세팅 — 이 상태만으로 완전한 화면이 즉시 렌더
2. **자정 경계 보정**: mount 후 `useEffect` 1회만 `getTodayIsoDayKst()`를 재확인해, SSR 시점과 isoDay가 달라졌고 사용자가 요일을 바꾸지 않은 경우에 한해 오늘로 재fetch (희귀 케이스)
3. **요일 변경**: `handleDayChange(day)` → `allGroups=[]` + `loadData(day)`. `loadData`는 `getDateForIsoDayKst(day)`로 날짜 계산 후 `getDailyBusManifest` 재호출, Race condition 방지용 `loadIdRef` 사용
4. **시간대 선택**: `handleSlotSelect(slotId)` — 필터만 바꾸고 추가 fetch 없음
5. **새로고침 버튼**: `handleRefresh()` — `loadedKeyRef`를 지우고 현재 요일 재호출
6. **Realtime 구독**: `useBusRealtime(todayDate, { onCheckRecord, onChangeRequest }, { enabled: isViewingToday })` — 오늘 탭일 때만 활성화. 이벤트 수신 시 `applyCheckRecord` / `applyChangeRequest` 유틸로 `allGroups`를 낙관적 패치 (학생 profile_id 없거나 change/DELETE면 `reloadToday()`로 full refresh)
7. **호차 색상 매핑**: `allGroups` 변화를 감지해 `useMemo`로 호차 라벨 알파벳순 → `BUS_CARD_COLORS` 인덱스 할당
8. **필터링 렌더**: `filteredGroups`는 선택된 `slotFilter`의 카드만 포함. 시간대 헤더(HH:MM + "하원" + slotLabel) → 호차 카드 그리드(md 이상 2열)
9. **나이 범례**: 상단 우측 5세(pink)·6세(sky)·7세(emerald)·기타(slate) 고정 표시

### 관련 훅
| 파일 | 역할 |
|------|------|
| `src/lib/hooks/use-bus-realtime.ts` | Supabase Realtime 구독 — `bus_check_records` + `bus_change_requests` 변경 감지, 500ms 디바운스, `enabled` 옵션으로 조건부 활성화 |

## 의존성
- `@/app/(admin)/admin/actions` — `listBusTimeSlots`, `getDailyBusManifest` (barrel export)
- `@/lib/bus/monitor-date` — `getTodayIsoDayKst()`, `getDateForIsoDayKst(isoDay)` (서버/클라 공용 KST 요일·날짜 유틸)
- `@/lib/bus/utils` — `formatTime(t)` (HH:MM 포맷)
- `@/lib/bus/realtime-utils` — `applyCheckRecord`, `applyChangeRequest` (낙관적 패치)
- `@/lib/hooks/use-bus-realtime` — Realtime 구독 훅
- `@/components/bus/MonitorBusCard` — 호차 카드 + `BUS_CARD_COLORS`
- `@/components/ui/button` — 요일/시간대/새로고침 버튼

## 주의사항
- **인증 불필요**: layout에 인증 체크 없음 — 관리자 사무실 모니터/TV용
- **읽기 전용**: 탑승/하차 체크 기능 없음 (BusStaffMonitor와 다름)
- **SSR 초기 데이터 유지**: page.tsx에서 `getDailyBusManifest`를 SSR로 받아 `initialGroups`로 내려주는 구조를 깨지 말 것. 클라이언트 mount 시 초기 fetch 복귀 금지 (LCP·CLS 회귀 원인)
- **스켈레톤 없음**: 초기 렌더 스켈레톤은 제거됨 (CLS 0 보장). 날짜 전환 중에는 `allGroups=[]` + 새로고침 버튼 "로딩..." 라벨로 피드백
- **KST 요일/날짜 단일 소스**: `getTodayIsoDayKst()` / `getDateForIsoDayKst(isoDay)` 만 사용. `new Date().getDay()`·`toLocaleDateString` 직접 사용 금지
- **대형 화면 최적화**: 호차 카드 md 이상 2열 그리드, `MonitorBusCard`에서 학생 이름 대형 폰트
- **PWA 지원**: 별도 manifest (manifest-bus-monitor.json), 전체 화면 모니터링
- **호차 색상 일관성**: 호차 라벨 알파벳순 정렬 후 팔레트 인덱스 매핑 → 호차 색상 일관 유지
- **빈 정류장 표시**: `bus_time_slots.show_empty_stops=true` 시간대는 `getDailyBusManifest`가 `extra_stops`로 학생 0명 호차/정류장도 내려줌 → `MonitorBusCard`가 `mergeStopGroups()`로 병합해 "배정 학생 없음" 플레이스홀더로 렌더 (오후반 16:20/17:45 등)
