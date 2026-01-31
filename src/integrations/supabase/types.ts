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
      branch_payments: {
        Row: {
          amount_paid: number
          branch_id: string
          created_at: string | null
          id: string
          notes: string | null
          paid_by_user_id: string | null
          payment_date: string | null
          period_month: number
          period_year: number
        }
        Insert: {
          amount_paid: number
          branch_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          paid_by_user_id?: string | null
          payment_date?: string | null
          period_month: number
          period_year: number
        }
        Update: {
          amount_paid?: number
          branch_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          paid_by_user_id?: string | null
          payment_date?: string | null
          period_month?: number
          period_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "branch_payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_revenue: {
        Row: {
          branch_id: string
          created_at: string
          date: string
          id: string
          total_benefit_deductions: number
          total_compensation: number
          total_profit_loss: number
          updated_at: string
          visit_count: number
        }
        Insert: {
          branch_id: string
          created_at?: string
          date?: string
          id?: string
          total_benefit_deductions?: number
          total_compensation?: number
          total_profit_loss?: number
          updated_at?: string
          visit_count?: number
        }
        Update: {
          branch_id?: string
          created_at?: string
          date?: string
          id?: string
          total_benefit_deductions?: number
          total_compensation?: number
          total_profit_loss?: number
          updated_at?: string
          visit_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "branch_revenue_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean | null
          is_globally_preapproved_for_services: boolean | null
          location: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_globally_preapproved_for_services?: boolean | null
          location: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_globally_preapproved_for_services?: boolean | null
          location?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      claims: {
        Row: {
          amount: number
          branch_id: string
          created_at: string
          diagnosis: string
          id: string
          member_id: string
          notes: string | null
          processed_at: string | null
          staff_id: string | null
          status: Database["public"]["Enums"]["claim_status"] | null
          treatment: string
        }
        Insert: {
          amount: number
          branch_id: string
          created_at?: string
          diagnosis: string
          id?: string
          member_id: string
          notes?: string | null
          processed_at?: string | null
          staff_id?: string | null
          status?: Database["public"]["Enums"]["claim_status"] | null
          treatment: string
        }
        Update: {
          amount?: number
          branch_id?: string
          created_at?: string
          diagnosis?: string
          id?: string
          member_id?: string
          notes?: string | null
          processed_at?: string | null
          staff_id?: string | null
          status?: Database["public"]["Enums"]["claim_status"] | null
          treatment?: string
        }
        Relationships: [
          {
            foreignKeyName: "claims_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          benefit_limit: number | null
          biometric_data: string | null
          branch_id: string | null
          coverage_balance: number | null
          created_at: string
          email: string
          full_name: string
          id: string
          id_number: string
          is_active: boolean | null
          member_number: string
          membership_category_id: string | null
          next_of_kin_name: string | null
          next_of_kin_phone: string | null
          phone: string
          qr_code_data: string | null
          rollover_balance: number | null
          rollover_years: number | null
          total_contributions: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          benefit_limit?: number | null
          biometric_data?: string | null
          branch_id?: string | null
          coverage_balance?: number | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          id_number: string
          is_active?: boolean | null
          member_number: string
          membership_category_id?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          phone: string
          qr_code_data?: string | null
          rollover_balance?: number | null
          rollover_years?: number | null
          total_contributions?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          benefit_limit?: number | null
          biometric_data?: string | null
          branch_id?: string | null
          coverage_balance?: number | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          id_number?: string
          is_active?: boolean | null
          member_number?: string
          membership_category_id?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          phone?: string
          qr_code_data?: string | null
          rollover_balance?: number | null
          rollover_years?: number | null
          total_contributions?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_membership_category_id_fkey"
            columns: ["membership_category_id"]
            isOneToOne: false
            referencedRelation: "membership_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_categories: {
        Row: {
          benefit_amount: number
          created_at: string
          id: string
          is_active: boolean
          level: Database["public"]["Enums"]["membership_level"]
          management_fee: number
          name: string
          payment_amount: number
          registration_fee: number
          updated_at: string
        }
        Insert: {
          benefit_amount: number
          created_at?: string
          id?: string
          is_active?: boolean
          level: Database["public"]["Enums"]["membership_level"]
          management_fee?: number
          name: string
          payment_amount: number
          registration_fee?: number
          updated_at?: string
        }
        Update: {
          benefit_amount?: number
          created_at?: string
          id?: string
          is_active?: boolean
          level?: Database["public"]["Enums"]["membership_level"]
          management_fee?: number
          name?: string
          payment_amount?: number
          registration_fee?: number
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          coverage_added: number
          created_at: string
          id: string
          member_id: string
          mpesa_reference: string | null
          payment_date: string | null
          phone_used: string | null
          status: Database["public"]["Enums"]["payment_status"] | null
        }
        Insert: {
          amount: number
          coverage_added: number
          created_at?: string
          id?: string
          member_id: string
          mpesa_reference?: string | null
          payment_date?: string | null
          phone_used?: string | null
          status?: Database["public"]["Enums"]["payment_status"] | null
        }
        Update: {
          amount?: number
          coverage_added?: number
          created_at?: string
          id?: string
          member_id?: string
          mpesa_reference?: string | null
          payment_date?: string | null
          phone_used?: string | null
          status?: Database["public"]["Enums"]["payment_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      service_preapprovals: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          service_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          service_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_preapprovals_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_preapprovals_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          approval_type: Database["public"]["Enums"]["approval_type"]
          benefit_cost: number
          branch_compensation: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          profit_loss: number | null
          real_cost: number
          updated_at: string
        }
        Insert: {
          approval_type?: Database["public"]["Enums"]["approval_type"]
          benefit_cost: number
          branch_compensation: number
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          profit_loss?: number | null
          real_cost: number
          updated_at?: string
        }
        Update: {
          approval_type?: Database["public"]["Enums"]["approval_type"]
          benefit_cost?: number
          branch_compensation?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          profit_loss?: number | null
          real_cost?: number
          updated_at?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          branch_id: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visits: {
        Row: {
          benefit_deducted: number
          branch_compensation: number
          branch_id: string
          created_at: string
          id: string
          member_id: string
          notes: string | null
          profit_loss: number
          service_id: string
          staff_id: string | null
        }
        Insert: {
          benefit_deducted: number
          branch_compensation: number
          branch_id: string
          created_at?: string
          id?: string
          member_id: string
          notes?: string | null
          profit_loss: number
          service_id: string
          staff_id?: string | null
        }
        Update: {
          benefit_deducted?: number
          branch_compensation?: number
          branch_id?: string
          created_at?: string
          id?: string
          member_id?: string
          notes?: string | null
          profit_loss?: number
          service_id?: string
          staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visits_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_yearly_rollover: { Args: never; Returns: undefined }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "member"
      approval_type: "all_branches" | "pre_approved_only"
      claim_status: "pending" | "approved" | "rejected" | "completed"
      membership_level:
        | "level_1"
        | "level_2"
        | "level_3"
        | "level_4"
        | "level_5"
        | "level_6"
      payment_status: "pending" | "completed" | "failed"
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
      app_role: ["admin", "staff", "member"],
      approval_type: ["all_branches", "pre_approved_only"],
      claim_status: ["pending", "approved", "rejected", "completed"],
      membership_level: [
        "level_1",
        "level_2",
        "level_3",
        "level_4",
        "level_5",
        "level_6",
      ],
      payment_status: ["pending", "completed", "failed"],
    },
  },
} as const
