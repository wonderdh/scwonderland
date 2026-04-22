import type { BusChangeType, BusRequestStatus, NoRideChangeType } from "@/lib/bus/state";

// ── Admin 타입 ──

export type TeacherOption = {
  id: string;
  name: string;
  teacher_type: "korean" | "native";
};

export type UserWithProfile = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  korean_name?: string | null;
  english_name?: string | null;
  age?: number | null;
  student_number?: string | null;
  name?: string | null;
  teacher_number?: string | null;
  teacher_type?: "korean" | "native";
  group_type?: "유치부" | "오후반" | null;
};

export type DashboardStats = {
  studentCount: number;
  teacherCount: number;
  classCount: number;
  reportCardCount: number;
  noticeCount: number;
};

export type ClassTeacherInfo = {
  profile_id: string;
  name: string | null;
  teacher_type: "korean" | "native";
};

export type ClassWithDetails = {
  id: string;
  name: string;
  group_label: "유치부" | "방과후" | "오후반" | null;
  color_index: number | null;
  teachers: ClassTeacherInfo[];
  student_count: number;
  schedule_count: number;
  created_at: string;
  updated_at: string;
};

export type ClassStudentRow = {
  id: string;
  student_profile_id: string;
  korean_name: string | null;
  english_name: string | null;
  age?: number | null;
  student_number: string | null;
};

// ── Academy 타입 ──

export type StudentProfile = {
  id: string;
  email: string;
  korean_name: string | null;
  english_name: string | null;
  age?: number | null;
  student_number: string | null;
};

export type StudentClassItem = {
  class_name: string;
  teachers: { name: string | null; teacher_type: "korean" | "native" }[];
};

export type TeacherProfile = {
  id: string;
  email: string;
  name: string | null;
  teacher_number: string | null;
  teacher_type: "korean" | "native";
};

export type TeacherClassWithStudents = {
  id: string;
  name: string;
  students: {
    profile_id: string;
    korean_name: string | null;
    english_name: string | null;
    student_number: string | null;
    age: number | null;
  }[];
};

export type ReportCardStatus = {
  student_profile_id: string;
  korean_name: string | null;
  english_name: string | null;
  student_number: string | null;
  has_report: boolean;
  has_reply: boolean;
  report_id: string | null;
};

export type TeacherClassTextbook = {
  id: string;
  textbook_title: string;
  textbook_series: string | null;
  textbook_level: string | null;
  textbook_category: string;
  total_units: number;
};

export type StudentTextbookItem = {
  id: string;
  textbook_title: string;
  textbook_series: string | null;
  textbook_level: string | null;
  textbook_category: string;
  textbook_cover_image: string | null;
  total_units: number;
  source_type: "class" | "individual";
  source_class_name: string | null;
  status: "not_started" | "in_progress" | "completed";
  completed_units: number;
};

// ── 교재 진도 타입 ──

export type ClassTextbookProgressRow = {
  student_profile_id: string;
  korean_name: string | null;
  english_name: string | null;
  student_number: string | null;
  progress_id: string | null;
  status: "not_started" | "in_progress" | "completed";
  completed_units: number;
  note: string | null;
};

// ── Admin 학생 반 조회 타입 ──

export type AdminStudentClassItem = {
  id: string;
  name: string;
  teachers: { name: string | null; teacher_type: "korean" | "native" }[];
};

// ── 출결 타입 ──

export type StudentWithAttendance = {
  student_profile_id: string;
  korean_name: string | null;
  english_name: string | null;
  age: number | null;
  status: "present" | "absent" | "late" | "early_leave" | null;
  note: string | null;
};

export type AttendanceRecord = {
  id: string;
  student_profile_id: string;
  attendance_date: string;
  status: "present" | "absent" | "late" | "early_leave";
  note: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AttendanceStats = {
  total: number;
  present: number;
  absent: number;
  late: number;
  early_leave: number;
};

// ── 반별 공지 타입 ──

export type ClassNotice = {
  id: string;
  class_id: string;
  class_name?: string;
  author_id: string;
  author_name?: string;
  title: string;
  content: string | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  attachment_count?: number;
};

export type ClassNoticeAttachment = {
  id: string;
  class_notice_id: string;
  storage_path: string;
  public_url: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  file_type: string;
  sort_order: number;
  created_at: string;
};

// ── Academy 공지 타입 ──

export type AcademyNotice = {
  id: string;
  title: string;
  content: string | null;
  excerpt: string | null;
  author_id: string | null;
  is_published: boolean;
  is_pinned: boolean;
  published_at: string;
  created_at: string;
  updated_at: string;
  image_count?: number;
  attachment_count?: number;
};

export type AcademyNoticeAttachment = {
  id: string;
  academy_notice_id: string;
  storage_path: string;
  public_url: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  file_type: string;
  sort_order: number;
  created_at: string;
};

// ── 숙제 타입 ──

export type HomeworkAssignment = {
  id: string;
  class_id: string;
  class_name?: string;
  teacher_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  submission_count?: number;
  total_students?: number;
};

export type HomeworkSubmission = {
  id: string;
  assignment_id: string;
  student_profile_id: string;
  student_name?: string;
  status: "pending" | "submitted" | "reviewed";
  text_content: string | null;
  submitted_at: string | null;
  teacher_feedback: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  files?: HomeworkSubmissionFile[];
};

export type HomeworkSubmissionFile = {
  id: string;
  submission_id: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  created_at: string;
  signed_url?: string;
};

// ── 공지사항 타입 (사이트 공개) ──

export type Notice = {
  id: string;
  title: string;
  content: string | null;
  excerpt: string | null;
  author_id: string | null;
  is_published: boolean;
  is_pinned: boolean;
  published_at: string;
  created_at: string;
  updated_at: string;
};

export type NoticeAttachment = {
  id: string;
  notice_id: string;
  storage_path: string;
  public_url: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  file_type: "image" | "attachment";
  sort_order: number;
  created_at: string;
};

// ── 승하차(버스) 타입 ──

export type StudentBusDefault = {
  id: string;
  student_profile_id: string;
  day_of_week: number;
  bus_time_slot_id: string;
  bus_stop_id?: string | null;
  bus_stop_name?: string | null;
  estimated_time?: string | null;
  note?: string | null;
  time_slot_label?: string;
  time_slot_time?: string;
  bus_label?: string;
  created_at: string;
  updated_at: string;
};

export type BusChangeRequest = {
  id: string;
  student_profile_id: string;
  request_date: string;
  change_type: BusChangeType;
  new_bus_time_slot_id: string | null;
  new_bus_number_id: string | null;
  new_bus_stop_id: string | null;
  reason: string | null;
  status: BusRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  requested_at: string;
  new_time_slot_label?: string;
  new_time_slot_time?: string;
  new_bus_label?: string;
  new_bus_stop_name?: string;
  korean_name?: string | null;
  english_name?: string | null;
  student_number?: string | null;
  orig_time_slot_time?: string;
  orig_time_slot_label?: string;
  orig_bus_label?: string;
  orig_bus_stop_name?: string;
  created_at: string;
  updated_at: string;
};

export type BusManifestEntry = {
  student_profile_id: string;
  korean_name: string | null;
  english_name: string | null;
  student_number: string | null;
  age: number | null;
  is_changed: boolean;
  is_absent?: boolean;
  estimated_time?: string | null;
  note?: string | null;
  bus_stop_name?: string | null;
  bus_stop_sort_order?: number | null;
  original_slot_time?: string;
  original_bus_label?: string;
  boarded_at?: string | null;
  checked_at?: string | null;
  check_record_id?: string | null;
};

export type BusManifestExtraStop = {
  bus_stop_id: string;
  bus_stop_name: string;
  bus_stop_sort_order: number | null;
  estimated_time: string | null;
};

export type BusManifestGroup = {
  bus_time_slot_id: string;
  slot_time: string;
  slot_label: string;
  bus_number_id: string;
  bus_label: string;
  students: BusManifestEntry[];
  // show_empty_stops=true 시간대에서 학생은 없지만 (요일·슬롯)에 배정된 정류장 목록.
  // 모니터 카드에서 빈 그룹 헤더로 표시할 때 사용.
  extra_stops?: BusManifestExtraStop[];
};

export type NoRideEntry = {
  student_profile_id: string;
  korean_name: string | null;
  english_name: string | null;
  student_number: string | null;
  original_slot_time?: string;
  original_bus_label?: string;
  change_type?: NoRideChangeType;
  request_id?: string;
};

export type AfterSchoolBusEntry = {
  student_profile_id: string;
  korean_name: string | null;
  english_name: string | null;
  age: number | null;
};

// ── 버스 담당자 타입 ──

export type BusStaffProfile = {
  id: string;          // bus_staff.id
  profile_id: string;
  email: string;
  name: string;
  bus_number_id: string | null;
  bus_label: string | null;
  created_at: string;
};

// ── 정류장 조인 타입 ──

export type BusDefaultAssignment = {
  id: string;
  student_profile_id: string;
  korean_name: string | null;
  english_name: string | null;
  age: number | null;
  bus_number_id: string | null;
  bus_stop_id: string | null;
  bus_stop_name: string | null;
  bus_time_slot_id: string;
  estimated_time: string | null;
  note: string | null;
};

// ── 교재 조인 타입 ──

export type ClassTextbook = {
  id: string;
  class_id: string;
  textbook_id: string;
  textbook_title: string;
  textbook_series: string | null;
  textbook_level: string | null;
  textbook_category: string;
  total_units: number;
  assigned_at: string;
};

export type StudentTextbookProgress = {
  id: string;
  student_profile_id: string;
  textbook_id: string;
  textbook_title: string;
  textbook_series: string | null;
  textbook_level: string | null;
  textbook_category: string;
  textbook_cover_image: string | null;
  total_units: number;
  source_type: "class" | "individual";
  source_class_id: string | null;
  source_class_name: string | null;
  status: "not_started" | "in_progress" | "completed";
  completed_units: number;
  assigned_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

// ── 방과후 타입 ──

export type AfterschoolStatus = "none" | "first_only" | "both";

export type DayEnrollment = {
  day: number;
  second_period: boolean;
};

export type AfterschoolStudentEnrollment = {
  student_profile_id: string;
  korean_name: string | null;
  english_name: string | null;
  age: number | null;
  days: DayEnrollment[];
  class_name: string | null;
};

// ── 버스 수출 타입 ──

export type DropoffExportRow = {
  day: number;
  profile_id: string;
  slotLabel: string;
  slotTime: string;
  busLabel: string;
  stopName: string;
  stopSortOrder: number;
  korean_name: string | null;
  english_name: string | null;
  age: number | null;
  note: string | null;
};

export type DropoffExportData = {
  rows: DropoffExportRow[];
  unassigned: {
    day: number;
    profile_id: string;
    korean_name: string | null;
    english_name: string | null;
    age: number | null;
  }[];
  slots: import("./database").BusTimeSlot[];
  busNumbers: import("./database").BusNumber[];
  afterschoolEnrollments: { profile_id: string; day: number }[];
};

// ── 시간표 조인 타입 ──

export type ClassScheduleWithDetails = {
  id: string;
  class_id: string | null;
  student_profile_id: string | null;
  academy_period_id: string;
  day_of_week: number;
  teacher_profile_id: string | null;
  label: string | null;
  textbook_id: string | null;
  period_name: string;
  period_start_time: string;
  period_end_time: string;
  teacher_name: string | null;
  teacher_type: "korean" | "native";
};

export type StudentTimetableCell = {
  schedule_id: string | null;
  class_id: string | null;
  class_name: string | null;
  label: string | null;
  teacher_profile_id: string | null;
  teacher_name: string | null;
  teacher_type: "korean" | "native";
  textbook_id: string | null;
  source: "class" | "individual";
};

export type StudentTimetableRow = {
  academy_period_id: string;
  period_name: string;
  start_time: string;
  end_time: string;
  cells: Record<number, StudentTimetableCell | null>; // day_of_week 1~5
};

// ── 그룹 시간표 그리드 타입 ──

export type CellEntry = {
  scheduleId: string;
  label: string | null;
  teacherId: string | null;
  teacherName: string | null;
  teacherType: "korean" | "native";
  textbookId: string | null;
};

export type GroupTimetableData = {
  periods: { id: string; name: string; start_time: string; end_time: string }[];
  classes: { id: string; name: string; english_name: string | null }[];
  /** key: `${classId}_${periodId}_${dayOfWeek}`, 슬롯당 복수 교사 지원 */
  cells: Record<string, CellEntry[]>;
  teachers: { id: string; name: string; teacher_type: "korean" | "native" }[];
  textbooks: { id: string; title: string; series: string | null }[];
};

// ── 버스 배치 체크 타입 ──

export type BusCheckBatchItem = {
  action: "board" | "unboard" | "check" | "uncheck";
  studentProfileId: string;
  busTimeSlotId: string;
  busNumberId: string;
};

// ── 리포트카드 번역 / 작성 현황 타입 ──

export type UntranslatedReport = {
  id: string;
  student_name: string;
  class_name: string;
  content: string | null;
  content_ko: string | null;
  reply: string | null;
  reply_en: string | null;
};

export type ClassReportSummary = {
  classId: string;
  className: string;
  written: number;
  total: number;
};

// ── 예약 현황 타입 ──

export type ReservationAttendance = {
  id: string;
  student_profile_id: string;
  student_name: string;
  attendance_date: string;
  status: string;
  note: string | null;
};

export type ReservationBusChange = {
  id: string;
  student_profile_id: string;
  student_name: string;
  request_date: string;
  change_type: string;
  status: string;
  reason: string | null;
  new_bus_number_label?: string | null;
  new_bus_time_slot_label?: string | null;
};
