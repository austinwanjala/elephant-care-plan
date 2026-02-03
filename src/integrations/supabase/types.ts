export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      bill_items: {
        Row: {
          benefit_cost: number
          bill_id: string
          branch_compensation: number
          created_at: string
          id: string
          real_cost: number
          service_id: string
          service_name: string
        }
        Insert: {
          benefit_cost: number
          bill_id: string
          branch_compensation: number
          created_at?: string
          id?: string
          real_cost: number
          service_id: string
          service_name: string
        }
        Update: {
          benefit_cost?: number
          bill_id?: string
          branch_compensation?: number
          created_at?: string
          id?: string
          real_cost?: number
          service_id?: string
          service_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_items_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          created_at: string
          finalized_at: string | null
          id: string
          is_finalized: boolean | null
          receptionist_id: string | null
          total_benefit_cost: number
          total_branch_compensation: number
          total_profit_loss: number
          total_real_cost: number
          visit_id: string
        }
        Insert: {
          created_at?: string
          finalized_at?: string | null
          id?: string
          is_finalized?: boolean | null
          receptionist_id?: string | null
          total_benefit_cost: number
          total_branch_compensation: number
          total_profit_loss: number
          total_real_cost: number
          visit_id: string
        }
        Update: {
          created_at?: string
          finalized_at?: string | null
          id?: string
          is_finalized?: boolean | null
          receptionist_id?: string | null
          total_benefit_cost?: number
          total_branch_compensation?: number
          total_profit_loss?: number
          total_real_cost?: number
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_receptionist_id_fkey"
            columns: ["receptionist_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: true
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
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
      dental_records: {
        Row: {
          created_at: string
          id: string
          member_id: string
          notes: string | null
          status: string
          tooth_number: number
          updated_at: string
          visit_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          notes?: string | null
          status: string
          tooth_number: number
          updated_at?: string
          visit_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          notes?: string | null
          status?: string
          tooth_number?: number
          updated_at?: string
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dental_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dental_records_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      dependants: {
        Row: {
          created_at: string
          dob: string
          full_name: string
          id: string
          id_number: string
          member_id: string
          relationship: string
        }
        Insert: {
          created_at?: string
          dob: string
          full_name: string
          id?: string
          id_number: string
          member_id: string
          relationship: string
        }
        Update: {
          created_at?: string
          dob?: string
          full_name?: string
          id?: string
          id_number?: string
          member_id?: string
          relationship?: string
        }
        Relationships: [
          {
            foreignKeyName: "dependants_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      marketers: {
        Row: {
          code: string
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          phone: string | null
          total_earnings: number | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          total_earnings?: number | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          total_earnings?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          age: number | null
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
          marketer_id: string | null
          next_of_kin_name: string | null
          next_of_kin_phone: string | null
          phone: string
          rollover_balance: number | null
          rollover_years: number | null
          total_contributions: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          age?: number | null
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
          marketer_id?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          phone: string
          rollover_balance?: number | null
          rollover_years?: number | null
          total_contributions?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          age?: number | null
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
          marketer_id?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          phone?: string
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
            foreignKeyName: "members_marketer_id_fkey"
            columns: ["marketer_id"]
            isOneToOne: false
            referencedRelation: "marketers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_membership_category_id_fkey"
            columns: ["membership_category_id"]
            isOneToOne: false
            referencedRelation: "membership_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
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
          {
            foreignKeyName: "staff_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
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
          biometrics_verified: boolean | null
          branch_compensation: number
          branch_id: string
          created_at: string
          diagnosis: string | null
          doctor_id: string | null
          id: string
          member_id: string
          notes: string | null
          profit_loss: number
          receptionist_id: string | null
          service_id: string
          staff_id: string | null
          status: string | null
          treatment_notes: string | null
        }
        Insert: {
          benefit_deducted: number
          biometrics_verified?: boolean | null
          branch_compensation: number
          branch_id: string
          created_at?: string
          diagnosis?: string | null
          doctor_id?: string | null
          id?: string
          member_id: string
          notes?: string | null
          profit_loss: number
          receptionist_id?: string | null
          service_id: string
          staff_id?: string | null
          status?: string | null
          treatment_notes?: string | null
        }
        Update: {
          benefit_deducted?: number
          biometrics_verified?: boolean | null
          branch_compensation?: number
          branch_id?: string
          created_at?: string
          diagnosis?: string | null
          doctor_id?: string | null
          id?: string
          member_id?: string
          notes?: string | null
          profit_loss?: number
          receptionist_id?: string | null
          service_id?: string
          staff_id?: string | null
          status?: string | null
          treatment_notes?: string | null
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
            foreignKeyName: "visits_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "staff"
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
            foreignKeyName: "visits_receptionist_id_fkey"
            columns: ["receptionist_id"]
            isOneToOne: false
            referencedRelation: "staff"
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
      finalize_bill: {
        Args: { _bill_id: string; _receptionist_id: string }
        Returns: undefined
      }
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
      app_role: "admin" | "staff" | "member" | "receptionist" | "doctor" | "branch_director" | "marketer"
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