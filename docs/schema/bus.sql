-- =============================================================
-- Bus Domain Schema
-- 승하차 시스템: 버스 노선, 정류장, 시간대, 배정, 체크, 변경 요청
-- =============================================================

-- 버스 노선
CREATE TABLE bus_numbers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label       text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- 버스 시간대 (등원/하원 시간 슬롯)
CREATE TABLE bus_time_slots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction   text NOT NULL,              -- 'pickup' | 'dropoff'
  label       text NOT NULL,
  time        time NOT NULL,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- 정류장
CREATE TABLE bus_stops (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_number_id uuid REFERENCES bus_numbers(id),
  name          text NOT NULL,
  sort_order    integer NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- 정류장-요일 배정 (정류장이 어떤 버스에 어떤 요일에 속하는지)
CREATE TABLE bus_stop_day_assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_stop_id   uuid NOT NULL REFERENCES bus_stops(id),
  bus_number_id uuid NOT NULL REFERENCES bus_numbers(id),
  day_of_week   integer NOT NULL,           -- 1=월 ~ 5=금
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (bus_stop_id, day_of_week)
);

-- 정류장 시간 스케줄
CREATE TABLE bus_stop_schedules (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_stop_id      uuid NOT NULL REFERENCES bus_stops(id),
  day_of_week      integer NOT NULL,
  direction        text NOT NULL,
  estimated_time   time NOT NULL,
  bus_time_slot_id uuid REFERENCES bus_time_slots(id),
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  UNIQUE (bus_stop_id, day_of_week, direction, bus_time_slot_id)
);

-- 학생 기본 버스 배정
CREATE TABLE student_bus_defaults (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_profile_id uuid NOT NULL REFERENCES profiles(id),
  day_of_week        integer NOT NULL,
  direction          text NOT NULL,
  bus_number_id      uuid NOT NULL REFERENCES bus_numbers(id),
  bus_time_slot_id   uuid NOT NULL REFERENCES bus_time_slots(id),
  bus_stop_id        uuid REFERENCES bus_stops(id),
  estimated_time     time,
  note               text,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now(),
  UNIQUE (student_profile_id, day_of_week, direction)
);

-- 버스 탑승 체크 기록
CREATE TABLE bus_check_records (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_profile_id uuid NOT NULL REFERENCES profiles(id),
  check_date         date NOT NULL,
  direction          text NOT NULL,
  bus_time_slot_id   uuid NOT NULL REFERENCES bus_time_slots(id),
  bus_number_id      uuid NOT NULL REFERENCES bus_numbers(id),
  checked_at         timestamptz,
  checked_by         uuid REFERENCES profiles(id),
  boarded_at         timestamptz,
  created_at         timestamptz DEFAULT now(),
  UNIQUE (student_profile_id, check_date, direction)
);

-- 버스 변경 요청
CREATE TABLE bus_change_requests (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_profile_id   uuid NOT NULL REFERENCES profiles(id),
  request_date         date NOT NULL,
  direction            text NOT NULL,
  change_type          text NOT NULL,
  new_bus_number_id    uuid REFERENCES bus_numbers(id),
  new_bus_time_slot_id uuid REFERENCES bus_time_slots(id),
  new_bus_stop_id      uuid REFERENCES bus_stops(id),
  reason               text,
  status               text NOT NULL DEFAULT 'pending',
  reviewed_by          uuid REFERENCES profiles(id),
  reviewed_at          timestamptz,
  review_note          text,
  requested_at         timestamptz DEFAULT now(),
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now(),
  UNIQUE (student_profile_id, request_date, direction)
);

-- 버스 스태프
CREATE TABLE bus_staff (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid NOT NULL REFERENCES profiles(id) UNIQUE,
  name          text NOT NULL,
  bus_number_id uuid REFERENCES bus_numbers(id),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
