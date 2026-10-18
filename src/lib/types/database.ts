// ── 순수 DB Row 타입 (테이블 컬럼 1:1 대응) ──

// ── 리포트카드 타입 ──

export type ReportCard = {
  id: string;
  /** 호출자가 기대하는 student profile id (students.id = profiles.id). report-actions 내부에서 변환 후 세팅. */
  student_profile_id: string;
  year: number;
  month: number;
  /** DB 컬럼명은 class_teacher_id ("담임" 의미). 작성자 의미 검증 필요 — written_by 컬럼 도입 plan 참조. */
  class_teacher_id: string | null;
  author_name?: string | null;
  content_en: string | null;
  content_ko: string | null;
  reply_ko: string | null;
  reply_en: string | null;
  created_at: string;
  updated_at: string;
};

export type ReportCardListItem = {
  id: string;
  year: number;
  month: number;
};

// ── 학습관리 타입 ──

export type LearningRecord = {
  id: string;
  student_profile_id: string;
  record_date: string;
  category: "test" | "assessment" | "note" | "level_change";
  title: string;
  content: string | null;
  score: number | null;
  max_score: number | null;
  author_id: string | null;
  created_at: string;
  updated_at: string;
};

// ── 승하차(버스) DB Row 타입 ──

export type BusNumber = {
  id: string;
  label: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type BusTimeSlot = {
  id: string;
  label: string;
  time: string;
  is_active: boolean;
  show_empty_stops: boolean;
  created_at: string;
  updated_at: string;
};

export type AcademyPeriod = {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  group_type: "kindergarten" | "afternoon" | "afterschool";
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type BusCheckRecord = {
  id: string;
  student_profile_id: string;
  check_date: string;
  bus_time_slot_id: string;
  bus_number_id: string;
  boarded_at: string | null;
  checked_at: string;
  checked_by: string | null;
  created_at: string;
};

export type BusStopDayAssignment = {
  id: string;
  bus_stop_id: string;
  bus_number_id: string;
  day_of_week: number;
  bus_time_slot_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type BusStop = {
  id: string;
  bus_number_id: string | null;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type BusStopSchedule = {
  id: string;
  bus_stop_id: string;
  /** 같은 정류장이라도 호차별로 도착 시각이 다르다. */
  bus_number_id: string | null;
  day_of_week: number;
  bus_time_slot_id: string | null;
  estimated_time: string;
  created_at: string;
  updated_at: string;
};

// ── 방과후 등록 타입 ──

export type AfterschoolEnrollment = {
  id: string;
  class_id: string;
  student_profile_id: string;
  day_of_week: number; // 1=월 ~ 5=금
  created_at: string;
};

// ── 수업 시간표(class_schedules) 타입 ──

export type ClassSchedule = {
  id: string;
  class_id: string | null;
  student_profile_id: string | null;
  academy_period_id: string;
  day_of_week: number; // 1=월 ~ 5=금
  teacher_profile_id: string | null;
  label: string | null;
  created_at: string;
  updated_at: string;
};

// ── 주간 문장 (Sentence of the Week) ──

export type WeeklySentence = {
  id: string;
  week_number: number;
  level: number; // 1~3 (기초/중급/상급)
  english: string;
  korean: string;
  example: string | null;
  answer: string | null; // 기초(level 1) Q&A 응답
  created_at: string;
  updated_at: string;
};

export type WeeklySentenceConfig = {
  id: number;
  mode: "auto" | "manual";
  manual_week: number | null;
  auto_base_week: number;
  auto_base_sunday: string;
  updated_at: string;
};

// ── 교재 타입 ──

export type Textbook = {
  id: string;
  title: string;
  series: string | null;
  level: string | null;
  category: string;
  total_units: number;
  cover_image: string | null;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
