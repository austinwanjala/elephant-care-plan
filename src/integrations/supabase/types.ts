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
      bill_items: {
        Row: {
          benefit_cost: number
          bill_id: string
          branch_compensation: number
          created_at: string | null
          id: string
          notes: string | null
          profit_loss: number | null
          real_cost: number
          service_id: string
          service_name: string
          tooth_number: string | null
        }
        Insert: {
          benefit_cost: number
          bill_id: string
          branch_compensation: number
          created_at?: string | null
          id?: string
          notes?: string | null
          profit_loss?: number | null
          real_cost: number
          service_id: string
          service_name?: string
          tooth_number?: string | null
        }
        Update: {
          benefit_cost?: number
          bill_id?: string
          branch_compensation?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          profit_loss?: number | null
          real_cost?: number
          service_id?: string
          service_name?: string
          tooth_number?: string | null
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
          branch_id: string | null
          claim_id: string | null
          created_at: string | null
          diagnosis: string | null
          doctor_id: string | null
          finalized_at: string | null
          finalized_by: string | null
          id: string
          is_finalized: boolean | null
          member_id: string | null
          receptionist_id: string | null
          status: string
          submitted_at: string | null
          total_benefit_cost: number
          total_branch_compensation: number
          total_profit_loss: number
          total_real_cost: number
          treatment_notes: string | null
          updated_at: string | null
          visit_id: string
        }
        Insert: {
          branch_id?: string | null
          claim_id?: string | null
          created_at?: string | null
          diagnosis?: string | null
          doctor_id?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          is_finalized?: boolean | null
          member_id?: string | null
          receptionist_id?: string | null
          status?: string
          submitted_at?: string | null
          total_benefit_cost?: number
          total_branch_compensation?: number
          total_profit_loss?: number
          total_real_cost?: number
          treatment_notes?: string | null
          updated_at?: string | null
          visit_id: string
        }
        Update: {
          branch_id?: string | null
          claim_id?: string | null
          created_at?: string | null
          diagnosis?: string | null
          doctor_id?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          is_finalized?: boolean | null
          member_id?: string | null
          receptionist_id?: string | null
          status?: string
          submitted_at?: string | null
          total_benefit_cost?: number
          total_branch_compensation?: number
          total_profit_loss?: number
          total_real_cost?: number
          treatment_notes?: string | null
          updated_at?: string | null
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "revenue_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
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
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_directors: {
        Row: {
          branch_id: string | null
          created_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          phone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_directors_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
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
      dental_chart_records: {
        Row: {
          bill_id: string | null
          created_at: string | null
          dependant_id: string | null
          id: string
          member_id: string
          notes: string | null
          service_id: string
          tooth_number: string
          treated_at: string | null
          treated_by: string | null
        }
        Insert: {
          bill_id?: string | null
          created_at?: string | null
          dependant_id?: string | null
          id?: string
          member_id: string
          notes?: string | null
          service_id: string
          tooth_number: string
          treated_at?: string | null
          treated_by?: string | null
        }
        Update: {
          bill_id?: string | null
          created_at?: string | null
          dependant_id?: string | null
          id?: string
          member_id?: string
          notes?: string | null
          service_id?: string
          tooth_number?: string
          treated_at?: string | null
          treated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dental_chart_records_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dental_chart_records_dependant_id_fkey"
            columns: ["dependant_id"]
            isOneToOne: false
            referencedRelation: "dependants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dental_chart_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dental_chart_records_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      dental_records: {
        Row: {
          created_at: string | null
          id: string
          member_id: string
          notes: string | null
          status: string
          tooth_number: number
          updated_at: string | null
          visit_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          member_id: string
          notes?: string | null
          status: string
          tooth_number: number
          updated_at?: string | null
          visit_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          member_id?: string
          notes?: string | null
          status?: string
          tooth_number?: number
          updated_at?: string | null
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
          created_at: string | null
          dob: string
          document_number: string | null
          document_type: string | null
          full_name: string
          id: string
          id_number: string | null
          is_active: boolean | null
          member_id: string
          relationship: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          dob: string
          document_number?: string | null
          document_type?: string | null
          full_name: string
          id?: string
          id_number?: string | null
          is_active?: boolean | null
          member_id: string
          relationship?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          dob?: string
          document_number?: string | null
          document_type?: string | null
          full_name?: string
          id?: string
          id_number?: string | null
          is_active?: boolean | null
          member_id?: string
          relationship?: string | null
          updated_at?: string | null
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
      doctors: {
        Row: {
          branch_id: string | null
          created_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          phone: string | null
          specialization: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          specialization?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          specialization?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctors_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      marketer_claims: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          marketer_id: string
          notes: string | null
          paid_at: string | null
          paid_by: string | null
          referral_count: number
          status: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          marketer_id: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          referral_count: number
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          marketer_id?: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          referral_count?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketer_claims_marketer_id_fkey"
            columns: ["marketer_id"]
            isOneToOne: false
            referencedRelation: "marketers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketer_claims_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      marketer_commission_config: {
        Row: {
          commission_per_referral: number
          id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          commission_per_referral?: number
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          commission_per_referral?: number
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketer_commission_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      marketer_commissions: {
        Row: {
          amount: number
          claimed_at: string | null
          created_at: string | null
          id: string
          marketer_id: string
          member_id: string
          notes: string | null
          paid_at: string | null
          paid_by: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          claimed_at?: string | null
          created_at?: string | null
          id?: string
          marketer_id: string
          member_id: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          claimed_at?: string | null
          created_at?: string | null
          id?: string
          marketer_id?: string
          member_id?: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketer_commissions_marketer_id_fkey"
            columns: ["marketer_id"]
            isOneToOne: false
            referencedRelation: "marketers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketer_commissions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketer_commissions_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      marketer_earnings: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          marketer_id: string
          member_id: string
          paid_at: string | null
          payment_id: string | null
          status: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          marketer_id: string
          member_id: string
          paid_at?: string | null
          payment_id?: string | null
          status?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          marketer_id?: string
          member_id?: string
          paid_at?: string | null
          payment_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketer_earnings_marketer_id_fkey"
            columns: ["marketer_id"]
            isOneToOne: false
            referencedRelation: "marketers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketer_earnings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketer_earnings_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      marketers: {
        Row: {
          code: string
          commission_type: string
          commission_value: number
          created_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          marketer_code: string
          phone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          code: string
          commission_type?: string
          commission_value?: number
          created_at?: string | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean | null
          marketer_code?: string
          phone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          code?: string
          commission_type?: string
          commission_value?: number
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          marketer_code?: string
          phone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      member_visits: {
        Row: {
          biometric_verified: boolean | null
          biometric_verified_at: string | null
          branch_id: string
          check_in_time: string | null
          check_out_time: string | null
          created_at: string | null
          dependant_id: string | null
          doctor_id: string | null
          id: string
          member_id: string
          notes: string | null
          receptionist_id: string | null
          status: string
          updated_at: string | null
          visit_date: string
        }
        Insert: {
          biometric_verified?: boolean | null
          biometric_verified_at?: string | null
          branch_id: string
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string | null
          dependant_id?: string | null
          doctor_id?: string | null
          id?: string
          member_id: string
          notes?: string | null
          receptionist_id?: string | null
          status?: string
          updated_at?: string | null
          visit_date?: string
        }
        Update: {
          biometric_verified?: boolean | null
          biometric_verified_at?: string | null
          branch_id?: string
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string | null
          dependant_id?: string | null
          doctor_id?: string | null
          id?: string
          member_id?: string
          notes?: string | null
          receptionist_id?: string | null
          status?: string
          updated_at?: string | null
          visit_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_visits_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_visits_dependant_id_fkey"
            columns: ["dependant_id"]
            isOneToOne: false
            referencedRelation: "dependants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_visits_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
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
          data_consent: boolean | null
          digital_signature: string | null
          email: string
          full_name: string
          id: string
          id_number: string
          is_active: boolean | null
          marketer_code: string | null
          marketer_id: string | null
          member_number: string
          membership_category_id: string | null
          next_of_kin_name: string | null
          next_of_kin_phone: string | null
          phone: string
          qr_code_data: string | null
          rollover_balance: number | null
          rollover_years: number | null
          scheme_selected: boolean | null
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
          data_consent?: boolean | null
          digital_signature?: string | null
          email: string
          full_name: string
          id?: string
          id_number: string
          is_active?: boolean | null
          marketer_code?: string | null
          marketer_id?: string | null
          member_number: string
          membership_category_id?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          phone: string
          qr_code_data?: string | null
          rollover_balance?: number | null
          rollover_years?: number | null
          scheme_selected?: boolean | null
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
          data_consent?: boolean | null
          digital_signature?: string | null
          email?: string
          full_name?: string
          id?: string
          id_number?: string
          is_active?: boolean | null
          marketer_code?: string | null
          marketer_id?: string | null
          member_number?: string
          membership_category_id?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          phone?: string
          qr_code_data?: string | null
          rollover_balance?: number | null
          rollover_years?: number | null
          scheme_selected?: boolean | null
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
      otp_verifications: {
        Row: {
          code: string
          created_at: string | null
          expires_at: string | null
          id: string
          phone: string
          verified_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          phone: string
          verified_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          phone?: string
          verified_at?: string | null
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
          mpesa_checkout_request_id: string | null
          mpesa_merchant_request_id: string | null
          mpesa_reference: string | null
          mpesa_result_code: number | null
          mpesa_result_desc: string | null
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
          mpesa_checkout_request_id?: string | null
          mpesa_merchant_request_id?: string | null
          mpesa_reference?: string | null
          mpesa_result_code?: number | null
          mpesa_result_desc?: string | null
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
          mpesa_checkout_request_id?: string | null
          mpesa_merchant_request_id?: string | null
          mpesa_reference?: string | null
          mpesa_result_code?: number | null
          mpesa_result_desc?: string | null
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
      receptionists: {
        Row: {
          branch_id: string | null
          created_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          phone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receptionists_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_claims: {
        Row: {
          amount: number
          branch_id: string
          created_at: string | null
          director_id: string
          id: string
          notes: string | null
          paid_at: string | null
          paid_by: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          branch_id: string
          created_at?: string | null
          director_id: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string
          created_at?: string | null
          director_id?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revenue_claims_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_claims_director_id_fkey"
            columns: ["director_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_claims_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "staff"
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
      system_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: string
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: string
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
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
          dependant_id: string | null
          diagnosis: string | null
          doctor_id: string | null
          id: string
          member_id: string
          notes: string | null
          profit_loss: number
          receptionist_id: string | null
          service_id: string | null
          staff_id: string | null
          status: string
          treatment_notes: string | null
          updated_at: string | null
        }
        Insert: {
          benefit_deducted: number
          biometrics_verified?: boolean | null
          branch_compensation: number
          branch_id: string
          created_at?: string
          dependant_id?: string | null
          diagnosis?: string | null
          doctor_id?: string | null
          id?: string
          member_id: string
          notes?: string | null
          profit_loss: number
          receptionist_id?: string | null
          service_id?: string | null
          staff_id?: string | null
          status?: string
          treatment_notes?: string | null
          updated_at?: string | null
        }
        Update: {
          benefit_deducted?: number
          biometrics_verified?: boolean | null
          branch_compensation?: number
          branch_id?: string
          created_at?: string
          dependant_id?: string | null
          diagnosis?: string | null
          doctor_id?: string | null
          id?: string
          member_id?: string
          notes?: string | null
          profit_loss?: number
          receptionist_id?: string | null
          service_id?: string | null
          staff_id?: string | null
          status?: string
          treatment_notes?: string | null
          updated_at?: string | null
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
            foreignKeyName: "visits_dependant_id_fkey"
            columns: ["dependant_id"]
            isOneToOne: false
            referencedRelation: "dependants"
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
      get_auth_user_branch_id: { Args: never; Returns: string }
      get_branch_doctors: {
        Args: { branch_id_input: string }
        Returns: {
          full_name: string
          id: string
          user_id: string
        }[]
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
      update_staff_role: {
        Args: { target_user_id: string; new_role: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
      | "admin"
      | "staff"
      | "member"
      | "receptionist"
      | "doctor"
      | "branch_director"
      | "marketer"
      | "super_admin"
      | "finance"
      | "auditor"
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
      app_role: [
        "admin",
        "staff",
        "member",
        "receptionist",
        "doctor",
        "branch_director",
        "marketer",
        "super_admin",
        "finance",
        "auditor",
      ],
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