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
      conversations: {
        Row: {
          created_at: string
          id: string
          subject: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          subject?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          subject?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      department_admins: {
        Row: {
          created_at: string
          department: string
          id: string
          level: string
          university: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department: string
          id?: string
          level: string
          university: string
          user_id: string
        }
        Update: {
          created_at?: string
          department?: string
          id?: string
          level?: string
          university?: string
          user_id?: string
        }
        Relationships: []
      }
      exam_attempts: {
        Row: {
          answers: Json
          completed_at: string | null
          course: string
          created_at: string
          exam_type: string
          id: string
          max_score: number
          questions: Json
          score: number | null
          started_at: string
          status: string
          time_limit_minutes: number
          user_id: string
        }
        Insert: {
          answers?: Json
          completed_at?: string | null
          course: string
          created_at?: string
          exam_type: string
          id?: string
          max_score?: number
          questions?: Json
          score?: number | null
          started_at?: string
          status?: string
          time_limit_minutes?: number
          user_id: string
        }
        Update: {
          answers?: Json
          completed_at?: string | null
          course?: string
          created_at?: string
          exam_type?: string
          id?: string
          max_score?: number
          questions?: Json
          score?: number | null
          started_at?: string
          status?: string
          time_limit_minutes?: number
          user_id?: string
        }
        Relationships: []
      }
      exam_samples: {
        Row: {
          course: string
          created_at: string
          file_id: string | null
          id: string
          sample_text: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          course: string
          created_at?: string
          file_id?: string | null
          id?: string
          sample_text?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          course?: string
          created_at?: string
          file_id?: string | null
          id?: string
          sample_text?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_samples_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "uploaded_files"
            referencedColumns: ["id"]
          },
        ]
      }
      group_wallets: {
        Row: {
          balance: number
          created_at: string
          group_id: string
          id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          group_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          group_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_wallets_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_warnings: {
        Row: {
          group_id: string
          id: string
          reason: string
          session_id: string | null
          warned_at: string
        }
        Insert: {
          group_id: string
          id?: string
          reason: string
          session_id?: string | null
          warned_at?: string
        }
        Update: {
          group_id?: string
          id?: string
          reason?: string
          session_id?: string | null
          warned_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_warnings_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_warnings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "study_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ku_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          group_id: string | null
          id: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          group_id?: string | null
          id?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          group_id?: string | null
          id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ku_transactions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      ku_wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          library_slots: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          library_slots?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          library_slots?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_quiz: boolean | null
          quiz_passed: boolean | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_quiz?: boolean | null
          quiz_passed?: boolean | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_quiz?: boolean | null
          quiz_passed?: boolean | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_history: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          paystack_reference: string
          plan: string
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          paystack_reference: string
          plan: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          paystack_reference?: string
          plan?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      pending_checkouts: {
        Row: {
          created_at: string
          custom_units: number | null
          expected_amount: number
          expires_at: string
          group_id: string | null
          id: string
          package_type: string | null
          reference: string
          status: string
          target: string
          units: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_units?: number | null
          expected_amount: number
          expires_at?: string
          group_id?: string | null
          id?: string
          package_type?: string | null
          reference: string
          status?: string
          target?: string
          units: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_units?: number | null
          expected_amount?: number
          expires_at?: string
          group_id?: string | null
          id?: string
          package_type?: string | null
          reference?: string
          status?: string
          target?: string
          units?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          scheduled_deletion_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          scheduled_deletion_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          scheduled_deletion_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      session_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_ai_message: boolean | null
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_ai_message?: boolean | null
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_ai_message?: boolean | null
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "study_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_participants: {
        Row: {
          id: string
          is_active: boolean | null
          joined_at: string
          session_id: string
          user_id: string
        }
        Insert: {
          id?: string
          is_active?: boolean | null
          joined_at?: string
          session_id: string
          user_id: string
        }
        Update: {
          id?: string
          is_active?: boolean | null
          joined_at?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "study_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_quiz_responses: {
        Row: {
          correct_answer: string | null
          id: string
          is_correct: boolean | null
          points_earned: number | null
          quiz_question: string
          session_id: string
          submitted_at: string
          user_answer: string
          user_id: string
        }
        Insert: {
          correct_answer?: string | null
          id?: string
          is_correct?: boolean | null
          points_earned?: number | null
          quiz_question: string
          session_id: string
          submitted_at?: string
          user_answer: string
          user_id: string
        }
        Update: {
          correct_answer?: string | null
          id?: string
          is_correct?: boolean | null
          points_earned?: number | null
          quiz_question?: string
          session_id?: string
          submitted_at?: string
          user_answer?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_quiz_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "study_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_files: {
        Row: {
          course_code: string
          created_at: string
          department: string
          extracted_text: string | null
          file_category: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          level: string
          university: string
          uploaded_by: string
        }
        Insert: {
          course_code: string
          created_at?: string
          department: string
          extracted_text?: string | null
          file_category?: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          level: string
          university: string
          uploaded_by: string
        }
        Update: {
          course_code?: string
          created_at?: string
          department?: string
          extracted_text?: string | null
          file_category?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          level?: string
          university?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      study_group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      study_groups: {
        Row: {
          admin_id: string
          created_at: string
          field_of_study: string | null
          id: string
          name: string
          suspended_until: string | null
          updated_at: string
          warning_count: number | null
        }
        Insert: {
          admin_id: string
          created_at?: string
          field_of_study?: string | null
          id?: string
          name: string
          suspended_until?: string | null
          updated_at?: string
          warning_count?: number | null
        }
        Update: {
          admin_id?: string
          created_at?: string
          field_of_study?: string | null
          id?: string
          name?: string
          suspended_until?: string | null
          updated_at?: string
          warning_count?: number | null
        }
        Relationships: []
      }
      study_mates: {
        Row: {
          created_at: string
          id: string
          mate_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mate_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mate_id?: string
          user_id?: string
        }
        Relationships: []
      }
      study_requests: {
        Row: {
          created_at: string
          from_user_id: string
          id: string
          status: string
          to_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_user_id: string
          id?: string
          status?: string
          to_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_user_id?: string
          id?: string
          status?: string
          to_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      study_sessions: {
        Row: {
          course: string
          created_at: string
          created_by: string
          duration_minutes: number
          ends_at: string | null
          group_id: string
          id: string
          started_at: string | null
          status: string
          topic: string
        }
        Insert: {
          course: string
          created_at?: string
          created_by: string
          duration_minutes?: number
          ends_at?: string | null
          group_id: string
          id?: string
          started_at?: string | null
          status?: string
          topic: string
        }
        Update: {
          course?: string
          created_at?: string
          created_by?: string
          duration_minutes?: number
          ends_at?: string | null
          group_id?: string
          id?: string
          started_at?: string | null
          status?: string
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          paystack_customer_code: string | null
          paystack_subscription_code: string | null
          plan: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          paystack_customer_code?: string | null
          paystack_subscription_code?: string | null
          plan?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          paystack_customer_code?: string | null
          paystack_subscription_code?: string | null
          plan?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      uploaded_files: {
        Row: {
          conversation_id: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          summary: string | null
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          summary?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          summary?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "uploaded_files_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_tracking: {
        Row: {
          chats_started: number
          created_at: string
          date: string
          id: string
          prompts_today: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          chats_started?: number
          created_at?: string
          date?: string
          id?: string
          prompts_today?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          chats_started?: number
          created_at?: string
          date?: string
          id?: string
          prompts_today?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          ai_personality: string[] | null
          bio: string | null
          country: string | null
          courses: string[] | null
          created_at: string
          exam_sample_file_id: string | null
          exam_sample_text: string | null
          explanation_style: string | null
          field_of_study: string | null
          id: string
          preferred_name: string | null
          quiz_score_percentage: number | null
          star_rating: number | null
          student_type: string | null
          total_quizzes_taken: number | null
          university: string | null
          university_level: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_personality?: string[] | null
          bio?: string | null
          country?: string | null
          courses?: string[] | null
          created_at?: string
          exam_sample_file_id?: string | null
          exam_sample_text?: string | null
          explanation_style?: string | null
          field_of_study?: string | null
          id?: string
          preferred_name?: string | null
          quiz_score_percentage?: number | null
          star_rating?: number | null
          student_type?: string | null
          total_quizzes_taken?: number | null
          university?: string | null
          university_level?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_personality?: string[] | null
          bio?: string | null
          country?: string | null
          courses?: string[] | null
          created_at?: string
          exam_sample_file_id?: string | null
          exam_sample_text?: string | null
          explanation_style?: string | null
          field_of_study?: string | null
          id?: string
          preferred_name?: string | null
          quiz_score_percentage?: number | null
          star_rating?: number | null
          student_type?: string | null
          total_quizzes_taken?: number | null
          university?: string | null
          university_level?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_exam_sample_file_id_fkey"
            columns: ["exam_sample_file_id"]
            isOneToOne: false
            referencedRelation: "uploaded_files"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      are_study_mates: {
        Args: { _user_id1: string; _user_id2: string }
        Returns: boolean
      }
      get_admin_assignments: {
        Args: { _user_id: string }
        Returns: {
          department: string
          level: string
          university: string
        }[]
      }
      get_public_profiles: {
        Args: never
        Returns: {
          field_of_study: string
          star_rating: number
          user_id: string
        }[]
      }
      is_any_department_admin: { Args: { _user_id: string }; Returns: boolean }
      is_department_admin: {
        Args: {
          _department: string
          _level: string
          _university: string
          _user_id: string
        }
        Returns: boolean
      }
      is_group_admin: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_session_participant: {
        Args: { _session_id: string; _user_id: string }
        Returns: boolean
      }
      user_matches_shared_file: {
        Args: {
          _department: string
          _level: string
          _university: string
          _user_id: string
        }
        Returns: boolean
      }
      users_share_group: {
        Args: { _user_id1: string; _user_id2: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
