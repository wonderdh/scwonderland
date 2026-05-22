# lib/bus/

버스 도메인 단일 소스. 상태 enum / realtime patch / 날짜 / afterschool 동기화.

| 파일 | 역할 |
|---|---|
| `state.ts` | `BusChangeType` / `StudentSubmittableChangeType` / `BusRequestStatus` enum 단일 소스. `as const` + 파생 타입 re-export. |
| `realtime-utils.ts` | Supabase Postgres CDC 페이로드 → `BusManifestGroup[]` / `NoRideEntry[]` patch. `applyCheckRecord`, `applyChangeRequest`. |
| `utils.ts` | 잡 헬퍼. |
| `monitor-date.ts` | `/bus-monitor` (TV 디스플레이) 의 날짜 계산. |
| `afterschool-sync.ts` | 방과후 ↔ 버스 변경 자동 동기화. |

## 규칙

- `"change" | "no_ride" | "absent" | "temporary_change"` 같은 **리터럴 인라인 금지**. `BUS_CHANGE_TYPES` / `BusChangeType` 만 import. 동일 churn 으로 인라인 중복이 10+ 파일에 퍼졌던 이력 있음 (M-09 Phase 1-A).
- CDC payload 는 `student_id` 와 `student_profile_id` **양쪽 호환** (shared PK). 신규 핸들러는 `row.student_id ?? row.student_profile_id` 패턴 유지.
- UI 표시용 config (label / icon / badge class) 는 여기 X, `src/lib/constants/bus.ts` 에. 데이터 모델과 표시는 분리.
- DELETE 이벤트는 realtime patch 로 처리하지 말고 **호출자가 refetch** — `applyChangeRequest` 가 그렇게 동작.

## 주의

- 새 change_type 추가 시 (a) `BUS_CHANGE_TYPES` 에 추가, (b) Postgres enum `public.bus_change_type` 마이그레이션, (c) `lib/constants/bus.ts` 의 label/badge 매핑 — 3곳 동시 갱신. 빠뜨리면 unknown 라벨로 빈 칸 렌더.
- realtime 갱신이 걸린 admin 컴포넌트 (`AdminBusChangeDnD`, `BusChangeRequestsPanel`, `BusStaffMonitor` 등) 는 이 파일들과 동기 유지. admin/actions/bus/AGENTS.md 도 함께 확인.
