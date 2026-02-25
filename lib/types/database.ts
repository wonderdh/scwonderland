// ── Admin 타입 ──

export type UserWithProfile = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  korean_name?: string | null;
  english_name?: string | null;
  student_number?: string | null;
  name?: string | null;
  teacher_number?: string | null;
};

export type DashboardStats = {
  studentCount: number;
  teacherCount: number;
  classCount: number;
  reportCardCount: number;
};

export type ReportCard = {
  id: string;
  student_profile_id: string;
  year: number;
  month: number;
  author_id: string | null;
  content: string | null;
  reply: string | null;
  created_at: string;
  updated_at: string;
};

export type ReportCardListItem = {
  id: string;
  year: number;
  month: number;
};

export type ClassWithDetails = {
  id: string;
  name: string;
  teacher_profile_id: string | null;
  teacher_name: string | null;
  student_count: number;
  created_at: string;
  updated_at: string;
};

export type ClassStudentRow = {
  id: string;
  student_profile_id: string;
  korean_name: string | null;
  english_name: string | null;
  student_number: string | null;
};

// ── Academy 타입 ──

export type StudentProfile = {
  id: string;
  email: string;
  korean_name: string | null;
  english_name: string | null;
  student_number: string | null;
};

export type StudentClassItem = {
  class_name: string;
  teacher_name: string | null;
};

export type TeacherProfile = {
  id: string;
  email: string;
  name: string | null;
  teacher_number: string | null;
};

export type TeacherClassWithStudents = {
  id: string;
  name: string;
  students: {
    profile_id: string;
    korean_name: string | null;
    english_name: string | null;
    student_number: string | null;
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
  total_units: number;
  source_type: "class" | "individual";
  source_class_name: string | null;
  status: "not_started" | "in_progress" | "completed";
  completed_units: number;
};
