export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      academy_closed_days: {
        Row: {
          closed_date: string
          created_at: string
          created_by: string | null
          id: string
          label: string | null
        }
        Insert: {
          closed_date: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
        }
        Update: {
          closed_date?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academy_closed_days_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_periods: {
        Row: {
          created_at: string
          end_time: string
          group_type: Database["public"]["Enums"]["class_group"]
          id: string
          name: string
          sort_order: number
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_time: string
          group_type: Database["public"]["Enums"]["class_group"]
          id?: string
          name: string
          sort_order?: number
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_time?: string
          group_type?: Database["public"]["Enums"]["class_group"]
          id?: string
          name?: string
          sort_order?: number
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      afterschool_enrollments: {
        Row: {
          academy_period_id: string | null
          class_id: string
          created_at: string
          day_of_week: number
          id: string
          student_id: string
        }
        Insert: {
          academy_period_id?: string | null
          class_id: string
          created_at?: string
          day_of_week: number
          id?: string
          student_id: string
        }
        Update: {
          academy_period_id?: string | null
          class_id?: string
          created_at?: string
          day_of_week?: number
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "afterschool_enrollments_academy_period_id_fkey"
            columns: ["academy_period_id"]
            isOneToOne: false
            referencedRelation: "academy_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afterschool_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afterschool_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          attendance_date: string
          created_at: string
          id: string
          note: string | null
          recorded_by: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          attendance_date: string
          created_at?: string
          id?: string
          note?: string | null
          recorded_by?: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          attendance_date?: string
          created_at?: string
          id?: string
          note?: string | null
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      bus_change_requests: {
        Row: {
          change_type: Database["public"]["Enums"]["bus_change_type"]
          created_at: string
          id: string
          new_bus_number_id: string | null
          new_bus_stop_id: string | null
          new_bus_time_slot_id: string | null
          reason: string | null
          request_date: string
          requested_at: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["bus_change_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          change_type: Database["public"]["Enums"]["bus_change_type"]
          created_at?: string
          id?: string
          new_bus_number_id?: string | null
          new_bus_stop_id?: string | null
          new_bus_time_slot_id?: string | null
          reason?: string | null
          request_date: string
          requested_at?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["bus_change_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          change_type?: Database["public"]["Enums"]["bus_change_type"]
          created_at?: string
          id?: string
          new_bus_number_id?: string | null
          new_bus_stop_id?: string | null
          new_bus_time_slot_id?: string | null
          reason?: string | null
          request_date?: string
          requested_at?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["bus_change_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bus_change_requests_new_bus_number_id_fkey"
            columns: ["new_bus_number_id"]
            isOneToOne: false
            referencedRelation: "bus_numbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bus_change_requests_new_bus_stop_id_fkey"
            columns: ["new_bus_stop_id"]
            isOneToOne: false
            referencedRelation: "bus_stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bus_change_requests_new_bus_time_slot_id_fkey"
            columns: ["new_bus_time_slot_id"]
            isOneToOne: false
            referencedRelation: "bus_time_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bus_change_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bus_change_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      bus_check_records: {
        Row: {
          boarded_at: string | null
          bus_number_id: string | null
          bus_time_slot_id: string | null
          check_date: string
          checked_at: string | null
          checked_by: string | null
          created_at: string
          id: string
          student_id: string
        }
        Insert: {
          boarded_at?: string | null
          bus_number_id?: string | null
          bus_time_slot_id?: string | null
          check_date: string
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          id?: string
          student_id: string
        }
        Update: {
          boarded_at?: string | null
          bus_number_id?: string | null
          bus_time_slot_id?: string | null
          check_date?: string
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bus_check_records_bus_number_id_fkey"
            columns: ["bus_number_id"]
            isOneToOne: false
            referencedRelation: "bus_numbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bus_check_records_bus_time_slot_id_fkey"
            columns: ["bus_time_slot_id"]
            isOneToOne: false
            referencedRelation: "bus_time_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bus_check_records_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bus_check_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      bus_numbers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      bus_stop_day_assignments: {
        Row: {
          bus_number_id: string
          bus_stop_id: string
          bus_time_slot_id: string | null
          created_at: string
          day_of_week: number
          id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          bus_number_id: string
          bus_stop_id: string
          bus_time_slot_id?: string | null
          created_at?: string
          day_of_week: number
          id?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          bus_number_id?: string
          bus_stop_id?: string
          bus_time_slot_id?: string | null
          created_at?: string
          day_of_week?: number
          id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bus_stop_day_assignments_bus_number_id_fkey"
            columns: ["bus_number_id"]
            isOneToOne: false
            referencedRelation: "bus_numbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bus_stop_day_assignments_bus_stop_id_fkey"
            columns: ["bus_stop_id"]
            isOneToOne: false
            referencedRelation: "bus_stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bus_stop_day_assignments_bus_time_slot_id_fkey"
            columns: ["bus_time_slot_id"]
            isOneToOne: false
            referencedRelation: "bus_time_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      bus_stop_schedules: {
        Row: {
          bus_stop_id: string
          bus_time_slot_id: string | null
          created_at: string
          day_of_week: number
          estimated_time: string
          id: string
          updated_at: string
        }
        Insert: {
          bus_stop_id: string
          bus_time_slot_id?: string | null
          created_at?: string
          day_of_week: number
          estimated_time: string
          id?: string
          updated_at?: string
        }
        Update: {
          bus_stop_id?: string
          bus_time_slot_id?: string | null
          created_at?: string
          day_of_week?: number
          estimated_time?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bus_stop_schedules_bus_stop_id_fkey"
            columns: ["bus_stop_id"]
            isOneToOne: false
            referencedRelation: "bus_stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bus_stop_schedules_bus_time_slot_id_fkey"
            columns: ["bus_time_slot_id"]
            isOneToOne: false
            referencedRelation: "bus_time_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      bus_stops: {
        Row: {
          bus_number_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          bus_number_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          bus_number_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bus_stops_bus_number_id_fkey"
            columns: ["bus_number_id"]
            isOneToOne: false
            referencedRelation: "bus_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      bus_time_slots: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          show_empty_stops: boolean
          time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          show_empty_stops?: boolean
          time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          show_empty_stops?: boolean
          time?: string
          updated_at?: string
        }
        Relationships: []
      }
      class_homework_books: {
        Row: {
          class_id: string
          homework_days: number[]
          id: string
          note: string | null
          skip_dates: string[]
          start_date: string | null
          start_unit: number
          textbook_id: string
        }
        Insert: {
          class_id: string
          homework_days?: number[]
          id?: string
          note?: string | null
          skip_dates?: string[]
          start_date?: string | null
          start_unit?: number
          textbook_id: string
        }
        Update: {
          class_id?: string
          homework_days?: number[]
          id?: string
          note?: string | null
          skip_dates?: string[]
          start_date?: string | null
          start_unit?: number
          textbook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_textbooks_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_textbooks_textbook_id_fkey"
            columns: ["textbook_id"]
            isOneToOne: false
            referencedRelation: "homework_books"
            referencedColumns: ["id"]
          },
        ]
      }
      class_schedules: {
        Row: {
          academy_period_id: string
          class_id: string
          class_teacher_id: string | null
          created_at: string
          day_of_week: number
          id: string
          label: string | null
          updated_at: string
        }
        Insert: {
          academy_period_id: string
          class_id: string
          class_teacher_id?: string | null
          created_at?: string
          day_of_week: number
          id?: string
          label?: string | null
          updated_at?: string
        }
        Update: {
          academy_period_id?: string
          class_id?: string
          class_teacher_id?: string | null
          created_at?: string
          day_of_week?: number
          id?: string
          label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_schedules_academy_period_id_fkey"
            columns: ["academy_period_id"]
            isOneToOne: false
            referencedRelation: "academy_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedules_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedules_class_teacher_id_fkey"
            columns: ["class_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      class_students: {
        Row: {
          class_id: string
          id: string
          is_active: boolean
          joined_at: string
          student_id: string
        }
        Insert: {
          class_id: string
          id?: string
          is_active?: boolean
          joined_at?: string
          student_id: string
        }
        Update: {
          class_id?: string
          id?: string
          is_active?: boolean
          joined_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      class_teachers: {
        Row: {
          class_id: string
          created_at: string
          id: string
          teacher_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          teacher_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_teachers_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_teachers_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          color_index: number | null
          created_at: string
          days_of_week: number[]
          group_type: Database["public"]["Enums"]["class_group"]
          id: string
          is_active: boolean
          lunch_group: string | null
          name: string
          period_id: string | null
          updated_at: string
        }
        Insert: {
          color_index?: number | null
          created_at?: string
          days_of_week?: number[]
          group_type: Database["public"]["Enums"]["class_group"]
          id?: string
          is_active?: boolean
          lunch_group?: string | null
          name: string
          period_id?: string | null
          updated_at?: string
        }
        Update: {
          color_index?: number | null
          created_at?: string
          days_of_week?: number[]
          group_type?: Database["public"]["Enums"]["class_group"]
          id?: string
          is_active?: boolean
          lunch_group?: string | null
          name?: string
          period_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "academy_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_books: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean
          level: string | null
          publisher: string | null
          series_id: string | null
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          level?: string | null
          publisher?: string | null
          series_id?: string | null
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          level?: string | null
          publisher?: string | null
          series_id?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "textbooks_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      lunch_class_order_anchors: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          first_class_id: string
          id: string
          lunch_group: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from: string
          first_class_id: string
          id?: string
          lunch_group: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          first_class_id?: string
          id?: string
          lunch_group?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lunch_class_order_anchors_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lunch_class_order_anchors_first_class_id_fkey"
            columns: ["first_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      lunch_leader_anchors: {
        Row: {
          class_id: string
          created_at: string
          created_by: string | null
          effective_from: string
          id: string
          leader_student_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          created_by?: string | null
          effective_from: string
          id?: string
          leader_student_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          leader_student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lunch_leader_anchors_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lunch_leader_anchors_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lunch_leader_anchors_leader_student_id_fkey"
            columns: ["leader_student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      notices: {
        Row: {
          author_id: string | null
          content: string | null
          created_at: string
          excerpt: string | null
          id: string
          is_pinned: boolean
          is_published: boolean
          published_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          content?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          is_pinned?: boolean
          is_published?: boolean
          published_at?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          content?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          is_pinned?: boolean
          is_published?: boolean
          published_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notices_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"] | null
          username: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"] | null
          username?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"] | null
          username?: string | null
        }
        Relationships: []
      }
      publishers: {
        Row: {
          created_at: string
          homepage_url: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          homepage_url?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          homepage_url?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      report_cards: {
        Row: {
          class_student_id: string
          class_teacher_id: string | null
          content_en: string | null
          content_ko: string | null
          created_at: string
          id: string
          month: number
          reply_en: string | null
          reply_ko: string | null
          updated_at: string
          year: number
        }
        Insert: {
          class_student_id: string
          class_teacher_id?: string | null
          content_en?: string | null
          content_ko?: string | null
          created_at?: string
          id?: string
          month: number
          reply_en?: string | null
          reply_ko?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          class_student_id?: string
          class_teacher_id?: string | null
          content_en?: string | null
          content_ko?: string | null
          created_at?: string
          id?: string
          month?: number
          reply_en?: string | null
          reply_ko?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "report_cards_class_student_id_fkey"
            columns: ["class_student_id"]
            isOneToOne: false
            referencedRelation: "class_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_cards_class_teacher_id_fkey"
            columns: ["class_teacher_id"]
            isOneToOne: false
            referencedRelation: "class_teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      series: {
        Row: {
          cover_image_url: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          publisher_id: string | null
          total_units: number
          updated_at: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          publisher_id?: string | null
          total_units?: number
          updated_at?: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          publisher_id?: string | null
          total_units?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "publishers"
            referencedColumns: ["id"]
          },
        ]
      }
      student_bus_defaults: {
        Row: {
          bus_stop_id: string | null
          bus_time_slot_id: string
          created_at: string
          day_of_week: number
          direction: Database["public"]["Enums"]["bus_direction"]
          note: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          bus_stop_id?: string | null
          bus_time_slot_id: string
          created_at?: string
          day_of_week: number
          direction: Database["public"]["Enums"]["bus_direction"]
          note?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          bus_stop_id?: string | null
          bus_time_slot_id?: string
          created_at?: string
          day_of_week?: number
          direction?: Database["public"]["Enums"]["bus_direction"]
          note?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_bus_defaults_bus_stop_id_fkey"
            columns: ["bus_stop_id"]
            isOneToOne: false
            referencedRelation: "bus_stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_bus_defaults_bus_time_slot_id_fkey"
            columns: ["bus_time_slot_id"]
            isOneToOne: false
            referencedRelation: "bus_time_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_bus_defaults_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_homework_books: {
        Row: {
          class_homework_book_id: string
          class_student_id: string
          id: string
          start_date: string | null
        }
        Insert: {
          class_homework_book_id: string
          class_student_id: string
          id?: string
          start_date?: string | null
        }
        Update: {
          class_homework_book_id?: string
          class_student_id?: string
          id?: string
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_homework_books_class_homework_book_id_fkey"
            columns: ["class_homework_book_id"]
            isOneToOne: false
            referencedRelation: "class_homework_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_homework_books_class_student_id_fkey"
            columns: ["class_student_id"]
            isOneToOne: false
            referencedRelation: "class_students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_homework_progress: {
        Row: {
          created_at: string
          status: string
          student_homework_book_id: string
          unit_number: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          status?: string
          student_homework_book_id: string
          unit_number: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          status?: string
          student_homework_book_id?: string
          unit_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_homework_progress_student_homework_book_id_fkey"
            columns: ["student_homework_book_id"]
            isOneToOne: false
            referencedRelation: "student_homework_books"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          age: number | null
          created_at: string
          english_name: string | null
          group_type: string | null
          id: string
          is_active: boolean
          korean_name: string
          updated_at: string
        }
        Insert: {
          age?: number | null
          created_at?: string
          english_name?: string | null
          group_type?: string | null
          id?: string
          is_active?: boolean
          korean_name: string
          updated_at?: string
        }
        Update: {
          age?: number | null
          created_at?: string
          english_name?: string | null
          group_type?: string | null
          id?: string
          is_active?: boolean
          korean_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_profiles_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string | null
          teacher_type: Database["public"]["Enums"]["teacher_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string | null
          teacher_type?: Database["public"]["Enums"]["teacher_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string | null
          teacher_type?: Database["public"]["Enums"]["teacher_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teachers_profiles_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_sentence_config: {
        Row: {
          auto_base_sunday: string
          auto_base_week: number
          id: number
          manual_week: number | null
          mode: Database["public"]["Enums"]["weekly_sentence_mode"]
          updated_at: string
        }
        Insert: {
          auto_base_sunday?: string
          auto_base_week?: number
          id: number
          manual_week?: number | null
          mode?: Database["public"]["Enums"]["weekly_sentence_mode"]
          updated_at?: string
        }
        Update: {
          auto_base_sunday?: string
          auto_base_week?: number
          id?: number
          manual_week?: number | null
          mode?: Database["public"]["Enums"]["weekly_sentence_mode"]
          updated_at?: string
        }
        Relationships: []
      }
      weekly_sentences: {
        Row: {
          answer: string | null
          created_at: string
          english: string
          example: string | null
          id: string
          korean: string
          level: number
          updated_at: string
          week_number: number
        }
        Insert: {
          answer?: string | null
          created_at?: string
          english: string
          example?: string | null
          id?: string
          korean?: string
          level: number
          updated_at?: string
          week_number: number
        }
        Update: {
          answer?: string | null
          created_at?: string
          english?: string
          example?: string | null
          id?: string
          korean?: string
          level?: number
          updated_at?: string
          week_number?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      attendance_status:
        | "present"
        | "absent"
        | "late"
        | "early_leave"
        | "excused"
      bus_change_status: "pending" | "approved" | "rejected"
      bus_change_type: "absent" | "change" | "no_ride" | "temporary_change"
      bus_direction: "pickup" | "dropoff"
      class_group: "kindergarten" | "afterschool" | "afternoon"
      teacher_type: "korean" | "native"
      user_role: "admin" | "teacher" | "student"
      weekly_sentence_mode: "auto" | "manual"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      attendance_status: [
        "present",
        "absent",
        "late",
        "early_leave",
        "excused",
      ],
      bus_change_status: ["pending", "approved", "rejected"],
      bus_change_type: ["absent", "change", "no_ride", "temporary_change"],
      bus_direction: ["pickup", "dropoff"],
      class_group: ["kindergarten", "afterschool", "afternoon"],
      teacher_type: ["korean", "native"],
      user_role: ["admin", "teacher", "student"],
      weekly_sentence_mode: ["auto", "manual"],
    },
  },
} as const
