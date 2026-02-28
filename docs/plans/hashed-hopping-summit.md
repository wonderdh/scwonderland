# 승하차(버스) 시스템 설계

## Context

학원 학생들의 등·하원 버스 승하차 정보를 관리하는 시스템. 학생별 요일/방향별 기본 버스 배정, 학생의 특정 날짜 변경 요청(승인제), 버스 동승자가 호차별 학생 목록을 한눈에 확인하는 기능이 핵심.

## 확정 요구사항

- **시간대와 호차 별개**: 시간대(9:00, 9:20...) + 호차(1호차, 2호차...) 각각 관리, 학생에게 조합 배정
- **승차/하차 분리**: 각 요일마다 등원 버스와 하원 버스를 따로 설정
- **변경 요청**: 특정 날짜만 변경 or 미승차/미하차 요청 → 관리자/교사 승인 필요
- **동승자 뷰**: 한국인 교사 + 관리자가 시간대·호차별 학생 목록 확인, 당일 변경 건 별도 표시
- **Admin 전용 페이지**: `/admin/bus`에서 호차 CRUD + 시간대 CRUD + 대시보드 + 변경 요청 승인

---

## DB 스키마

### 테이블 구조

```
bus_numbers (호차)
├── id (PK, UUID)
├── label ("1호차", "2호차"...)
├── sort_order (정렬 순서)
├── is_active (soft delete)
└── created_at, updated_at

bus_time_slots (시간대)
├── id (PK, UUID)
├── direction ("pickup" | "dropoff")
├── slot_time (TIME, "09:00")
├── label (선택, "오전 1차")
├── sort_order
├── is_active (soft delete)
└── created_at, updated_at

student_bus_defaults (학생별 주간 기본 배정)
├── id (PK, UUID)
├── student_profile_id (FK → profiles, CASCADE)
├── day_of_week (1~5, 1=월 ~ 5=금)
├── direction ("pickup" | "dropoff")
├── bus_time_slot_id (FK → bus_time_slots, RESTRICT)
├── bus_number_id (FK → bus_numbers, RESTRICT)
├── UNIQUE(student_profile_id, day_of_week, direction)
└── created_at, updated_at

bus_change_requests (날짜별 변경 요청)
├── id (PK, UUID)
├── student_profile_id (FK → profiles, CASCADE)
├── request_date (DATE)
├── direction ("pickup" | "dropoff")
├── change_type ("change" | "no_ride")
├── new_bus_time_slot_id (FK, nullable - change시 필수)
├── new_bus_number_id (FK, nullable - change시 필수)
├── reason (사유)
├── status ("pending" | "approved" | "rejected")
├── reviewed_by (FK → profiles, SET NULL)
├── reviewed_at, review_note
├── UNIQUE(student_profile_id, request_date, direction)
├── CHECK: no_ride이면 new 필드 null 가능, change이면 필수
└── created_at, updated_at
```

### ER 다이어그램

```
┌─────────────────┐       ┌──────────────────────┐
│  bus_numbers     │       │  bus_time_slots       │
│─────────────────│       │──────────────────────│
│ id (PK)         │       │ id (PK)              │
│ label           │       │ direction            │
│ sort_order      │       │ slot_time            │
│ is_active       │       │ label                │
└────────┬────────┘       │ sort_order, is_active│
         │                └──────────┬───────────┘
         │                           │
         │  ┌────────────────────────┴──────────────┐
         │  │    student_bus_defaults                │
         │  │───────────────────────────────────────│
         │  │ id (PK)                               │
         ├──│ bus_number_id (FK)                     │
            │ bus_time_slot_id (FK) ────────────────┤
            │ student_profile_id (FK → profiles)    │
            │ day_of_week (1~5, 월~금)               │
            │ direction ("pickup"|"dropoff")         │
            │ UNIQUE(student, day, direction)        │
            └──────────────┬────────────────────────┘
                           │
            ┌──────────────┴────────────────────────┐
            │    bus_change_requests                  │
            │───────────────────────────────────────│
            │ id (PK)                               │
            │ student_profile_id (FK → profiles)    │
            │ request_date (DATE)                   │
            │ direction, change_type                 │
            │ new_bus_time_slot_id (FK, nullable)   │
            │ new_bus_number_id (FK, nullable)      │
            │ reason, status                         │
            │ reviewed_by (FK → profiles)           │
            │ UNIQUE(student, date, direction)       │
            └───────────────────────────────────────┘
```

### SQL 마이그레이션

```sql
-- ============================================
-- 승하차(버스) 시스템 테이블
-- Supabase SQL Editor에서 직접 실행
-- ============================================

-- 1. bus_numbers (호차)
CREATE TABLE public.bus_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX uq_bus_numbers_label ON public.bus_numbers (label) WHERE is_active = true;

-- 2. bus_time_slots (시간대)
CREATE TABLE public.bus_time_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  direction TEXT NOT NULL CHECK (direction IN ('pickup', 'dropoff')),
  slot_time TIME NOT NULL,
  label TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX uq_bus_time_slots ON public.bus_time_slots (direction, slot_time) WHERE is_active = true;

-- 3. student_bus_defaults (학생별 주간 기본 배정)
CREATE TABLE public.student_bus_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),  -- 1=월 ~ 5=금 (ISO 8601)
  direction TEXT NOT NULL CHECK (direction IN ('pickup', 'dropoff')),
  bus_time_slot_id UUID NOT NULL REFERENCES public.bus_time_slots(id) ON DELETE RESTRICT,
  bus_number_id UUID NOT NULL REFERENCES public.bus_numbers(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (student_profile_id, day_of_week, direction)
);
CREATE INDEX idx_sbd_student ON public.student_bus_defaults (student_profile_id);
CREATE INDEX idx_sbd_day_direction ON public.student_bus_defaults (day_of_week, direction);

-- 4. bus_change_requests (날짜별 변경 요청)
CREATE TABLE public.bus_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_date DATE NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('pickup', 'dropoff')),
  change_type TEXT NOT NULL CHECK (change_type IN ('change', 'no_ride')),
  new_bus_time_slot_id UUID REFERENCES public.bus_time_slots(id) ON DELETE RESTRICT,
  new_bus_number_id UUID REFERENCES public.bus_numbers(id) ON DELETE RESTRICT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_change_refs CHECK (
    change_type = 'no_ride' OR (new_bus_time_slot_id IS NOT NULL AND new_bus_number_id IS NOT NULL)
  ),
  UNIQUE (student_profile_id, request_date, direction)
);
CREATE INDEX idx_bcr_date_direction ON public.bus_change_requests (request_date, direction);
CREATE INDEX idx_bcr_pending ON public.bus_change_requests (status) WHERE status = 'pending';
CREATE INDEX idx_bcr_student ON public.bus_change_requests (student_profile_id);

-- 5. RLS 정책
ALTER TABLE public.bus_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bus_time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_bus_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bus_change_requests ENABLE ROW LEVEL SECURITY;

-- bus_numbers: 인증 사용자 읽기, admin 전체
CREATE POLICY "bus_numbers_auth_read" ON public.bus_numbers
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "bus_numbers_admin_all" ON public.bus_numbers
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  );

-- bus_time_slots: 인증 사용자 읽기, admin 전체
CREATE POLICY "bus_time_slots_auth_read" ON public.bus_time_slots
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "bus_time_slots_admin_all" ON public.bus_time_slots
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  );

-- student_bus_defaults: 본인 읽기, admin 전체, 한국인 교사 읽기
CREATE POLICY "sbd_self_read" ON public.student_bus_defaults
  FOR SELECT USING (auth.uid() = student_profile_id);
CREATE POLICY "sbd_admin_all" ON public.student_bus_defaults
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  );
CREATE POLICY "sbd_korean_teacher_read" ON public.student_bus_defaults
  FOR SELECT USING (
    auth.uid() IN (
      SELECT profile_id FROM public.teachers WHERE teacher_type = 'korean'
    )
  );

-- bus_change_requests: 본인 읽기/생성, admin 전체, 한국인 교사 읽기
CREATE POLICY "bcr_self_read" ON public.bus_change_requests
  FOR SELECT USING (auth.uid() = student_profile_id);
CREATE POLICY "bcr_self_insert" ON public.bus_change_requests
  FOR INSERT WITH CHECK (auth.uid() = student_profile_id);
CREATE POLICY "bcr_admin_all" ON public.bus_change_requests
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  );
CREATE POLICY "bcr_korean_teacher_read" ON public.bus_change_requests
  FOR SELECT USING (
    auth.uid() IN (
      SELECT profile_id FROM public.teachers WHERE teacher_type = 'korean'
    )
  );
```

---

## 변경 요청 흐름

```
학생 요청 제출 → status = 'pending'
  ├─ 관리자/교사 승인 → status = 'approved' → 동승자 뷰에 반영 (변경됨 표시)
  ├─ 관리자/교사 거절 → status = 'rejected' + review_note
  └─ 학생 취소 → pending 상태만 삭제 가능
```

---

## 일일 매니페스트 쿼리 로직

특정 날짜의 버스별 학생 목록 생성:

1. 날짜에서 `day_of_week` 추출 (ISO 8601: 1=월 ~ 5=금. JS `getDay()`는 0=일요일이므로 변환 필요: `getDay() || 7` 또는 직접 매핑)
2. `student_bus_defaults`에서 해당 요일+방향의 기본 배정 조회
3. `bus_change_requests`에서 해당 날짜+방향의 승인된 변경 조회
4. TypeScript에서 병합:
   - 기본 배정 순회 → 승인된 변경이 있으면 덮어씀
   - `no_ride`이면 목록에서 제외 (미탑승 목록에 별도 표시)
   - `change`이면 새 시간대/호차로 이동 + `isChanged = true` 표시

---

## 페이지 구조

### Admin

| 경로 | 기능 |
|------|------|
| `/admin/bus?tab=dashboard` | 일일 버스별 학생 목록 (날짜 선택, 등원/하원 토글) |
| `/admin/bus?tab=numbers` | 호차 CRUD |
| `/admin/bus?tab=timeslots` | 시간대 CRUD (등원/하원 구분) |
| `/admin/bus?tab=requests` | 변경 요청 승인/거절 큐 |
| `/admin/students?tab=bus` | 개별 학생 주간 버스 스케줄 편집 |

### Academy

| 경로 | 기능 |
|------|------|
| `/academy/student/bus` | 내 주간 스케줄 조회 + 변경 요청 제출/취소 |
| `/academy/teacher/bus` | 일일 버스 현황 (Korean 교사 전용, 읽기 전용) |

---

## 주요 파일

### 신규 생성

| 파일 | 용도 |
|------|------|
| `app/(admin)/admin/actions/bus-actions.ts` | 버스 Server Actions (CRUD + 매니페스트 + 변경 요청) |
| `app/(admin)/admin/bus/page.tsx` | Admin 버스 관리 페이지 |
| `app/(admin)/admin/bus/components/` | BusTabNav, BusDashboard, BusNumbersManager, BusTimeSlotsManager, BusChangeRequestsPanel |
| `app/(admin)/admin/students/components/StudentBusTab.tsx` | 학생 버스 탭 |
| `app/(academy)/academy/student/bus/page.tsx` | 학생 버스 페이지 |
| `app/(academy)/academy/student/bus/StudentBusClient.tsx` | 학생 버스 클라이언트 |
| `app/(academy)/academy/teacher/bus/page.tsx` | 교사 버스 페이지 |
| `app/(academy)/academy/teacher/bus/components/TeacherBusClient.tsx` | 교사 버스 클라이언트 |

### 수정 필요

| 파일 | 변경 |
|------|------|
| `lib/types/database.ts` | BusNumber, BusTimeSlot, StudentBusDefault, BusChangeRequest 등 타입 추가 |
| `lib/types/index.ts` | 배럴 export 추가 |
| `lib/teacher-labels.ts` | busLabels 추가 |
| `app/(admin)/admin/actions.ts` | bus-actions 배럴 re-export |
| `app/(admin)/admin/components/AdminSidebar.tsx` | "승하차" 링크 추가 |
| `app/(admin)/admin/students/components/StudentTabNav.tsx` | "bus" 탭 추가 |
| `app/(admin)/admin/students/page.tsx` | bus 탭 렌더링 추가 |
| `app/(academy)/academy/student/components/StudentNav.tsx` | "승하차" 링크 추가 |
| `app/(academy)/academy/teacher/components/TeacherNav.tsx` | Korean 링크에 "승하차" 추가 |
| `app/(academy)/academy/actions.ts` | 학생/교사용 버스 액션 추가 |

---

## 구현 순서

### Phase 1: DB + 타입 + Server Actions
1. SQL 마이그레이션 실행 (4 테이블)
2. `lib/types/database.ts`에 타입 추가
3. `bus-actions.ts` 생성 (호차 CRUD, 시간대 CRUD, 학생 기본 배정, 매니페스트, 변경 요청)
4. 배럴 re-export 연결

### Phase 2: Admin 버스 관리 페이지
1. `/admin/bus` 페이지 + 탭 구성
2. 호차/시간대 CRUD UI
3. 일일 대시보드 (버스별 학생 목록)
4. 변경 요청 승인 큐
5. AdminSidebar에 링크 추가

### Phase 3: Admin 학생 버스 탭
1. StudentTabNav에 bus 탭 추가
2. StudentBusTab 컴포넌트 (주간 스케줄 편집)

### Phase 4: 학생 포털
1. `/academy/student/bus` 페이지
2. 주간 스케줄 조회 + 변경 요청 폼
3. StudentNav에 링크 추가

### Phase 5: 교사 포털
1. `/academy/teacher/bus` 페이지 (Korean 전용)
2. 일일 버스 현황 읽기 전용 뷰
3. TeacherNav + busLabels 추가

---

## 검증 방법

1. Supabase에서 마이그레이션 실행 후 테이블/제약조건 확인
2. Admin에서 호차 3개, 시간대 4개(등원2 + 하원2) 생성
3. 학생 2명에게 기본 배정 설정 (월/수/금)
4. 일일 대시보드에서 버스별 학생 목록 정상 표시 확인
5. 학생 포털에서 변경 요청 제출 → Admin에서 승인 → 대시보드에 "변경됨" 표시 확인
6. no_ride 요청 → 승인 → 미탑승 처리 확인
7. `npm run build` 성공 확인
