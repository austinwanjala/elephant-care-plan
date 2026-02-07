-- ============================================================
-- ELEPHANT DENTAL - FULL DATABASE MIGRATION
-- Generated: 2026-02-07
-- Includes: Schema, Enums, Functions, Triggers, RLS, Sequences, Data
-- ============================================================

-- ============================================================
-- 1. CUSTOM ENUMS
-- ============================================================
CREATE TYPE public.app_role AS ENUM (
  'admin', 'staff', 'member', 'receptionist', 'doctor', 'branch_director', 'marketer'
);

CREATE TYPE public.approval_type AS ENUM ('all_branches', 'pre_approved_only');

CREATE TYPE public.claim_status AS ENUM ('pending', 'approved', 'rejected', 'completed');

CREATE TYPE public.membership_level AS ENUM (
  'level_1', 'level_2', 'level_3', 'level_4', 'level_5', 'level_6'
);

CREATE TYPE public.payment_status AS ENUM ('pending', 'completed', 'failed');


-- ============================================================
-- 2. SEQUENCES
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.member_number_seq START WITH 1026;
CREATE SEQUENCE IF NOT EXISTS public.marketer_code_seq START WITH 1001;


-- ============================================================
-- 3. TABLES
-- ============================================================

-- branches
CREATE TABLE public.branches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN DEFAULT true,
  is_globally_preapproved_for_services BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- membership_categories
CREATE TABLE public.membership_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  level public.membership_level NOT NULL,
  payment_amount NUMERIC NOT NULL,
  benefit_amount NUMERIC NOT NULL,
  registration_fee NUMERIC NOT NULL DEFAULT 500,
  management_fee NUMERIC NOT NULL DEFAULT 1000,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- services
CREATE TABLE public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  real_cost NUMERIC NOT NULL,
  benefit_cost NUMERIC NOT NULL,
  branch_compensation NUMERIC NOT NULL,
  profit_loss NUMERIC,
  approval_type public.approval_type NOT NULL DEFAULT 'all_branches',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- user_roles
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role public.app_role NOT NULL
);

-- staff
CREATE TABLE public.staff (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  branch_id UUID REFERENCES public.branches(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- marketers
CREATE TABLE public.marketers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  code TEXT NOT NULL,
  marketer_code TEXT NOT NULL DEFAULT '',
  commission_type TEXT NOT NULL DEFAULT 'fixed',
  commission_value NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- members
CREATE TABLE public.members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  id_number TEXT NOT NULL,
  age INTEGER,
  member_number TEXT NOT NULL,
  coverage_balance NUMERIC DEFAULT 0,
  benefit_limit NUMERIC DEFAULT 0,
  total_contributions NUMERIC DEFAULT 0,
  rollover_balance NUMERIC DEFAULT 0,
  rollover_years INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  scheme_selected BOOLEAN DEFAULT false,
  data_consent BOOLEAN DEFAULT false,
  biometric_data TEXT,
  digital_signature TEXT,
  qr_code_data TEXT,
  marketer_id UUID REFERENCES public.marketers(id),
  marketer_code TEXT,
  membership_category_id UUID REFERENCES public.membership_categories(id),
  branch_id UUID REFERENCES public.branches(id),
  next_of_kin_name TEXT,
  next_of_kin_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- doctors
CREATE TABLE public.doctors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  specialization TEXT,
  branch_id UUID REFERENCES public.branches(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- receptionists
CREATE TABLE public.receptionists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  branch_id UUID REFERENCES public.branches(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- branch_directors
CREATE TABLE public.branch_directors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  branch_id UUID REFERENCES public.branches(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- dependants
CREATE TABLE public.dependants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id),
  full_name TEXT NOT NULL,
  dob DATE NOT NULL,
  id_number TEXT,
  relationship TEXT,
  document_type TEXT,
  document_number TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- payments
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id),
  amount NUMERIC NOT NULL,
  coverage_added NUMERIC NOT NULL,
  status public.payment_status DEFAULT 'pending',
  payment_date TIMESTAMPTZ DEFAULT now(),
  mpesa_reference TEXT,
  mpesa_checkout_request_id TEXT,
  mpesa_merchant_request_id TEXT,
  mpesa_result_code INTEGER,
  mpesa_result_desc TEXT,
  phone_used TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- visits
CREATE TABLE public.visits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id),
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  service_id UUID REFERENCES public.services(id),
  doctor_id UUID REFERENCES public.staff(id),
  receptionist_id UUID REFERENCES public.staff(id),
  staff_id UUID REFERENCES public.staff(id),
  dependant_id UUID REFERENCES public.dependants(id),
  benefit_deducted NUMERIC NOT NULL,
  branch_compensation NUMERIC NOT NULL,
  profit_loss NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'registered',
  diagnosis TEXT,
  treatment_notes TEXT,
  notes TEXT,
  biometrics_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- bills
CREATE TABLE public.bills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_id UUID NOT NULL REFERENCES public.visits(id),
  member_id UUID REFERENCES public.members(id),
  doctor_id UUID,
  branch_id UUID REFERENCES public.branches(id),
  receptionist_id UUID REFERENCES public.staff(id),
  claim_id UUID,
  total_benefit_cost NUMERIC NOT NULL DEFAULT 0,
  total_branch_compensation NUMERIC NOT NULL DEFAULT 0,
  total_profit_loss NUMERIC NOT NULL DEFAULT 0,
  total_real_cost NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  is_finalized BOOLEAN DEFAULT false,
  finalized_at TIMESTAMPTZ,
  finalized_by UUID,
  diagnosis TEXT,
  treatment_notes TEXT,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- bill_items
CREATE TABLE public.bill_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id UUID NOT NULL REFERENCES public.bills(id),
  service_id UUID NOT NULL REFERENCES public.services(id),
  service_name TEXT NOT NULL DEFAULT '',
  real_cost NUMERIC NOT NULL,
  benefit_cost NUMERIC NOT NULL,
  branch_compensation NUMERIC NOT NULL,
  profit_loss NUMERIC,
  notes TEXT,
  tooth_number TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- claims
CREATE TABLE public.claims (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id),
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  staff_id UUID REFERENCES public.staff(id),
  amount NUMERIC NOT NULL,
  diagnosis TEXT NOT NULL,
  treatment TEXT NOT NULL,
  notes TEXT,
  status public.claim_status DEFAULT 'pending',
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- member_visits
CREATE TABLE public.member_visits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id),
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  dependant_id UUID REFERENCES public.dependants(id),
  doctor_id UUID,
  receptionist_id UUID,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'checked_in',
  check_in_time TIMESTAMPTZ DEFAULT now(),
  check_out_time TIMESTAMPTZ,
  biometric_verified BOOLEAN DEFAULT false,
  biometric_verified_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- branch_revenue
CREATE TABLE public.branch_revenue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_compensation NUMERIC NOT NULL DEFAULT 0,
  total_benefit_deductions NUMERIC NOT NULL DEFAULT 0,
  total_profit_loss NUMERIC NOT NULL DEFAULT 0,
  visit_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(branch_id, date)
);

-- branch_payments
CREATE TABLE public.branch_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  amount_paid NUMERIC NOT NULL,
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,
  paid_by_user_id UUID,
  notes TEXT,
  payment_date TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- revenue_claims
CREATE TABLE public.revenue_claims (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  director_id UUID NOT NULL REFERENCES public.staff(id),
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  paid_at TIMESTAMPTZ,
  paid_by UUID REFERENCES public.staff(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add FK for bills.claim_id after revenue_claims exists
ALTER TABLE public.bills ADD CONSTRAINT bills_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES public.revenue_claims(id);

-- marketer_commissions
CREATE TABLE public.marketer_commissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  marketer_id UUID NOT NULL REFERENCES public.marketers(id),
  member_id UUID NOT NULL REFERENCES public.members(id),
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'unclaimed',
  claimed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  paid_by UUID REFERENCES public.staff(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(marketer_id, member_id)
);

-- marketer_claims
CREATE TABLE public.marketer_claims (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  marketer_id UUID NOT NULL REFERENCES public.marketers(id),
  amount NUMERIC NOT NULL,
  referral_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  paid_at TIMESTAMPTZ,
  paid_by UUID REFERENCES public.staff(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- marketer_earnings
CREATE TABLE public.marketer_earnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  marketer_id UUID NOT NULL REFERENCES public.marketers(id),
  member_id UUID NOT NULL REFERENCES public.members(id),
  payment_id UUID REFERENCES public.payments(id),
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- marketer_commission_config
CREATE TABLE public.marketer_commission_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  commission_per_referral NUMERIC NOT NULL DEFAULT 50,
  updated_by UUID REFERENCES public.staff(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- dental_records
CREATE TABLE public.dental_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id),
  tooth_number INTEGER NOT NULL,
  status TEXT NOT NULL,
  notes TEXT,
  visit_id UUID REFERENCES public.visits(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- dental_chart_records
CREATE TABLE public.dental_chart_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id),
  tooth_number TEXT NOT NULL,
  service_id UUID NOT NULL REFERENCES public.services(id),
  bill_id UUID REFERENCES public.bills(id),
  dependant_id UUID REFERENCES public.dependants(id),
  notes TEXT,
  treated_by UUID,
  treated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- service_preapprovals
CREATE TABLE public.service_preapprovals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.services(id),
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- system_settings
CREATE TABLE public.system_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES public.staff(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- system_logs
CREATE TABLE public.system_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- otp_verifications
CREATE TABLE public.otp_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '10 minutes'),
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- 4. DATABASE FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_auth_user_branch_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT branch_id FROM public.staff WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_branch_doctors(branch_id_input uuid)
RETURNS TABLE(id uuid, full_name text, user_id uuid)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.full_name, s.user_id
  FROM public.staff s
  JOIN public.user_roles ur ON s.user_id = ur.user_id
  WHERE s.branch_id = branch_id_input
  AND s.is_active = true
  AND ur.role = 'doctor';
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_member_number()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  NEW.member_number := 'ED' || LPAD(NEXTVAL('member_number_seq')::TEXT, 6, '0');
  NEW.qr_code_data := NEW.id::TEXT;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_marketer_code()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
    IF NEW.marketer_code IS NULL OR NEW.marketer_code = '' THEN
        NEW.marketer_code := 'MKT' || LPAD(NEXTVAL('marketer_code_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_coverage_on_payment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE public.members
    SET 
      coverage_balance = coverage_balance + NEW.coverage_added,
      total_contributions = total_contributions + NEW.amount,
      updated_at = now()
    WHERE id = NEW.member_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_coverage_on_claim()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE public.members
    SET 
      coverage_balance = coverage_balance - NEW.amount,
      updated_at = now()
    WHERE id = NEW.member_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_visit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.members
  SET 
    coverage_balance = coverage_balance - NEW.benefit_deducted,
    updated_at = now()
  WHERE id = NEW.member_id;

  INSERT INTO public.branch_revenue (branch_id, date, total_compensation, total_benefit_deductions, total_profit_loss, visit_count)
  VALUES (NEW.branch_id, CURRENT_DATE, NEW.branch_compensation, NEW.benefit_deducted, NEW.profit_loss, 1)
  ON CONFLICT (branch_id, date) 
  DO UPDATE SET
    total_compensation = branch_revenue.total_compensation + NEW.branch_compensation,
    total_benefit_deductions = branch_revenue.total_benefit_deductions + NEW.benefit_deducted,
    total_profit_loss = branch_revenue.total_profit_loss + NEW.profit_loss,
    visit_count = branch_revenue.visit_count + 1,
    updated_at = now();

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_bill(_bill_id uuid, _receptionist_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_visit_id UUID;
    v_member_id UUID;
    v_total_benefit DECIMAL;
    v_current_coverage DECIMAL;
    v_branch_id UUID;
    v_total_compensation DECIMAL;
BEGIN
    SELECT visit_id, total_benefit_cost, total_branch_compensation 
    INTO v_visit_id, v_total_benefit, v_total_compensation
    FROM public.bills WHERE id = _bill_id;

    SELECT member_id, branch_id INTO v_member_id, v_branch_id
    FROM public.visits WHERE id = v_visit_id;

    SELECT coverage_balance INTO v_current_coverage
    FROM public.members WHERE id = v_member_id;

    IF v_current_coverage < v_total_benefit THEN
        RAISE EXCEPTION 'Insufficient coverage balance';
    END IF;

    UPDATE public.members 
    SET coverage_balance = coverage_balance - v_total_benefit
    WHERE id = v_member_id;

    UPDATE public.bills 
    SET is_finalized = true, 
        finalized_at = now(),
        branch_id = v_branch_id,
        receptionist_id = _receptionist_id
    WHERE id = _bill_id;

    UPDATE public.visits
    SET status = 'completed', 
        biometrics_verified = true,
        benefit_deducted = v_total_benefit,
        branch_compensation = v_total_compensation,
        updated_at = now()
    WHERE id = v_visit_id;

    INSERT INTO public.branch_revenue (branch_id, date, total_compensation, total_benefit_deductions, visit_count)
    VALUES (v_branch_id, CURRENT_DATE, v_total_compensation, v_total_benefit, 1)
    ON CONFLICT (branch_id, date) 
    DO UPDATE SET
        total_compensation = branch_revenue.total_compensation + EXCLUDED.total_compensation,
        total_benefit_deductions = branch_revenue.total_benefit_deductions + EXCLUDED.total_benefit_deductions,
        visit_count = branch_revenue.visit_count + 1,
        updated_at = now();

    DROP TRIGGER IF EXISTS on_visit_created ON public.visits;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_yearly_rollover()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.members
  SET 
    rollover_balance = CASE 
      WHEN rollover_years < 3 THEN rollover_balance + (coverage_balance * 0.10)
      ELSE rollover_balance
    END,
    rollover_years = CASE 
      WHEN rollover_years < 3 THEN rollover_years + 1
      ELSE rollover_years
    END,
    coverage_balance = coverage_balance * 0.90,
    updated_at = now()
  WHERE is_active = true AND coverage_balance > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_marketer_commission()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    commission_amount NUMERIC;
BEGIN
    IF NEW.is_active = TRUE AND OLD.is_active = FALSE AND NEW.marketer_id IS NOT NULL THEN
        SELECT value::NUMERIC INTO commission_amount
        FROM public.system_settings
        WHERE key = 'marketer_commission_per_referral';
        
        INSERT INTO public.marketer_commissions (marketer_id, member_id, amount, status)
        VALUES (NEW.marketer_id, NEW.id, commission_amount, 'unclaimed')
        ON CONFLICT (marketer_id, member_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    _role public.app_role;
    _full_name TEXT;
    _phone TEXT;
    _id_number TEXT;
    _age INTEGER;
    _branch_id UUID;
    _marketer_code TEXT;
    _marketer_id UUID;
BEGIN
    _role := NEW.raw_user_meta_data->>'role';
    _full_name := NEW.raw_user_meta_data->>'full_name';
    _phone := NEW.raw_user_meta_data->>'phone';
    _id_number := NEW.raw_user_meta_data->>'id_number';
    _age := (NEW.raw_user_meta_data->>'age')::INTEGER;
    _branch_id := NEW.raw_user_meta_data->>'branch_id';
    _marketer_code := NEW.raw_user_meta_data->>'marketer_code';

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, _role);

    IF _role = 'member' THEN
        IF _marketer_code IS NOT NULL THEN
            SELECT id INTO _marketer_id FROM public.marketers WHERE code = _marketer_code;
        END IF;

        INSERT INTO public.members (
            user_id, full_name, email, phone, id_number, age, is_active, 
            member_number, coverage_balance, benefit_limit, total_contributions, marketer_id
        )
        VALUES (
            NEW.id, _full_name, NEW.email, _phone, _id_number, _age,
            FALSE, 'ED' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0'),
            0, 0, 0, _marketer_id
        );
    ELSIF _role IN ('receptionist', 'doctor', 'branch_director', 'admin') THEN
        INSERT INTO public.staff (user_id, full_name, email, phone, branch_id, is_active)
        VALUES (NEW.id, _full_name, NEW.email, _phone, _branch_id, TRUE);
    ELSIF _role = 'marketer' THEN
        INSERT INTO public.marketers (user_id, full_name, email, phone, code, is_active)
        VALUES (NEW.id, _full_name, NEW.email, _phone, COALESCE(_marketer_code, 'MKT' || LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0')), TRUE);
    END IF;

    RETURN NEW;
END;
$$;


-- ============================================================
-- 5. TRIGGERS (create on auth.users in your Supabase project)
-- ============================================================
-- NOTE: The handle_new_user trigger must be created on auth.users:
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger for member number generation
CREATE TRIGGER generate_member_number_trigger
  BEFORE INSERT ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.generate_member_number();

-- Trigger for marketer code generation
CREATE TRIGGER generate_marketer_code_trigger
  BEFORE INSERT ON public.marketers
  FOR EACH ROW EXECUTE FUNCTION public.generate_marketer_code();

-- Trigger for payment coverage update
CREATE TRIGGER on_payment_update
  AFTER UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_coverage_on_payment();

-- Trigger for claim coverage deduction
CREATE TRIGGER on_claim_update
  AFTER UPDATE ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.deduct_coverage_on_claim();

-- Trigger for marketer commission creation
CREATE TRIGGER on_member_activated
  AFTER UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.create_marketer_commission();


-- ============================================================
-- 6. ENABLE ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receptionists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_directors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dependants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketer_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketer_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketer_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketer_commission_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dental_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dental_chart_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_preapprovals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 7. RLS POLICIES
-- ============================================================

-- branches
CREATE POLICY "Admins can manage branches" ON public.branches FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can view branches" ON public.branches FOR SELECT USING (true);

-- membership_categories
CREATE POLICY "Admins can manage membership categories" ON public.membership_categories FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can view membership categories" ON public.membership_categories FOR SELECT USING (true);

-- services
CREATE POLICY "Admins can manage services" ON public.services FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can view active services" ON public.services FOR SELECT USING (true);

-- user_roles
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can read own role." ON public.user_roles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff can read user roles." ON public.user_roles FOR SELECT USING (get_auth_user_branch_id() IS NOT NULL);
CREATE POLICY "Allow authenticated users to insert their own member role" ON public.user_roles FOR INSERT WITH CHECK ((auth.uid() = user_id) AND (role = 'member'));

-- staff
CREATE POLICY "Admins can manage staff" ON public.staff FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff can view own profile" ON public.staff FOR SELECT USING ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff can view colleagues in their branch." ON public.staff FOR SELECT USING (branch_id = get_auth_user_branch_id());

-- marketers
CREATE POLICY "marketers_admin_manage" ON public.marketers FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));
CREATE POLICY "marketers_public_select" ON public.marketers FOR SELECT USING (true);
CREATE POLICY "marketers_select_own_permissive" ON public.marketers FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "marketers_update_own_permissive" ON public.marketers FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Allow public read access to active marketers" ON public.marketers FOR SELECT USING (is_active = true);

-- members
CREATE POLICY "Admins can manage members" ON public.members FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Members can view own profile" ON public.members FOR SELECT USING ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));
CREATE POLICY "Members can insert own profile" ON public.members FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Members can update own profile" ON public.members FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Staff can view all members." ON public.members FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = ANY(ARRAY['receptionist','doctor','branch_director','admin'])));
CREATE POLICY "Staff can view members in their branch." ON public.members FOR SELECT USING (branch_id = get_auth_user_branch_id());
CREATE POLICY "marketers_view_referred_members" ON public.members FOR SELECT USING (marketer_id IN (SELECT marketers.id FROM marketers WHERE marketers.user_id = auth.uid()));

-- doctors
CREATE POLICY "Admins can manage doctors" ON public.doctors FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Doctors can view own profile" ON public.doctors FOR SELECT USING ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'));

-- receptionists
CREATE POLICY "Admins can manage receptionists" ON public.receptionists FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Receptionists can view own profile" ON public.receptionists FOR SELECT USING ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'));

-- branch_directors
CREATE POLICY "Admins can manage branch directors" ON public.branch_directors FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Branch directors can view own profile" ON public.branch_directors FOR SELECT USING ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'));

-- dependants
CREATE POLICY "Members can view own dependants" ON public.dependants FOR SELECT USING ((member_id IN (SELECT members.id FROM members WHERE members.user_id = auth.uid())) OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'receptionist') OR has_role(auth.uid(), 'doctor'));
CREATE POLICY "Members can insert own dependants" ON public.dependants FOR INSERT WITH CHECK ((member_id IN (SELECT members.id FROM members WHERE members.user_id = auth.uid())) OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Members can update own dependants" ON public.dependants FOR UPDATE USING ((member_id IN (SELECT members.id FROM members WHERE members.user_id = auth.uid())) OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete dependants" ON public.dependants FOR DELETE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff can view all dependants." ON public.dependants FOR SELECT USING (EXISTS (SELECT 1 FROM staff WHERE staff.user_id = auth.uid()));

-- payments
CREATE POLICY "Admins can manage payments" ON public.payments FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Members can view own payments" ON public.payments FOR SELECT USING ((member_id IN (SELECT members.id FROM members WHERE members.user_id = auth.uid())) OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));
CREATE POLICY "Members can create payments" ON public.payments FOR INSERT WITH CHECK (member_id IN (SELECT members.id FROM members WHERE members.user_id = auth.uid()));

-- visits
CREATE POLICY "Members can view own visits" ON public.visits FOR SELECT USING ((member_id IN (SELECT members.id FROM members WHERE members.user_id = auth.uid())) OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));
CREATE POLICY "visits_insert_staff" ON public.visits FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = ANY(ARRAY['receptionist','admin','branch_director'])));
CREATE POLICY "visits_select_member" ON public.visits FOR SELECT USING (member_id IN (SELECT members.id FROM members WHERE members.user_id = auth.uid()));
CREATE POLICY "visits_select_staff" ON public.visits FOR SELECT USING ((EXISTS (SELECT 1 FROM staff WHERE staff.user_id = auth.uid() AND staff.branch_id = visits.branch_id)) OR has_role(auth.uid(), 'admin'));
CREATE POLICY "visits_update_staff" ON public.visits FOR UPDATE USING ((EXISTS (SELECT 1 FROM staff WHERE staff.user_id = auth.uid() AND staff.branch_id = visits.branch_id)) OR has_role(auth.uid(), 'admin'));

-- bills
CREATE POLICY "View bills" ON public.bills FOR SELECT USING ((member_id IN (SELECT members.id FROM members WHERE members.user_id = auth.uid())) OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'receptionist') OR has_role(auth.uid(), 'doctor') OR has_role(auth.uid(), 'branch_director'));
CREATE POLICY "Doctors can create bills" ON public.bills FOR INSERT WITH CHECK (has_role(auth.uid(), 'doctor') OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Doctors and receptionists can update bills" ON public.bills FOR UPDATE USING (has_role(auth.uid(), 'doctor') OR has_role(auth.uid(), 'receptionist') OR has_role(auth.uid(), 'admin'));
CREATE POLICY "bills_all_staff" ON public.bills FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = ANY(ARRAY['doctor','receptionist','admin','branch_director'])));

-- bill_items
CREATE POLICY "View bill items" ON public.bill_items FOR SELECT USING ((bill_id IN (SELECT bills.id FROM bills WHERE bills.member_id IN (SELECT members.id FROM members WHERE members.user_id = auth.uid()))) OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'receptionist') OR has_role(auth.uid(), 'doctor') OR has_role(auth.uid(), 'branch_director'));
CREATE POLICY "Doctors can insert bill items" ON public.bill_items FOR INSERT WITH CHECK (has_role(auth.uid(), 'doctor') OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Doctors can update bill items" ON public.bill_items FOR UPDATE USING (has_role(auth.uid(), 'doctor') OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Doctors can delete bill items" ON public.bill_items FOR DELETE USING (has_role(auth.uid(), 'doctor') OR has_role(auth.uid(), 'admin'));
CREATE POLICY "bill_items_all_staff" ON public.bill_items FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = ANY(ARRAY['doctor','receptionist','admin','branch_director'])));

-- claims
CREATE POLICY "Admins can manage claims" ON public.claims FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Members can view own claims" ON public.claims FOR SELECT USING ((member_id IN (SELECT members.id FROM members WHERE members.user_id = auth.uid())) OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));
CREATE POLICY "Allow members to insert their own claims" ON public.claims FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM members WHERE members.user_id = auth.uid() AND claims.member_id = members.id));
CREATE POLICY "Staff can create claims" ON public.claims FOR INSERT WITH CHECK (has_role(auth.uid(), 'staff') OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff can update claims" ON public.claims FOR UPDATE USING (has_role(auth.uid(), 'staff') OR has_role(auth.uid(), 'admin'));

-- member_visits
CREATE POLICY "View member visits" ON public.member_visits FOR SELECT USING ((member_id IN (SELECT members.id FROM members WHERE members.user_id = auth.uid())) OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'receptionist') OR has_role(auth.uid(), 'doctor') OR has_role(auth.uid(), 'branch_director'));
CREATE POLICY "Receptionists can create visits" ON public.member_visits FOR INSERT WITH CHECK (has_role(auth.uid(), 'receptionist') OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Receptionists and doctors can update visits" ON public.member_visits FOR UPDATE USING (has_role(auth.uid(), 'receptionist') OR has_role(auth.uid(), 'doctor') OR has_role(auth.uid(), 'admin'));

-- branch_revenue
CREATE POLICY "Staff can view branch revenue" ON public.branch_revenue FOR SELECT USING (has_role(auth.uid(), 'staff') OR has_role(auth.uid(), 'admin'));
CREATE POLICY "System can update branch revenue" ON public.branch_revenue FOR ALL USING (has_role(auth.uid(), 'admin'));

-- branch_payments
CREATE POLICY "Admins can manage branch payments" ON public.branch_payments FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Branch directors can view branch payments" ON public.branch_payments FOR SELECT USING (has_role(auth.uid(), 'branch_director'));

-- revenue_claims
CREATE POLICY "Admins can manage all claims" ON public.revenue_claims FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Directors can manage their own branch claims" ON public.revenue_claims FOR ALL USING ((EXISTS (SELECT 1 FROM staff WHERE staff.user_id = auth.uid() AND staff.id = revenue_claims.director_id AND staff.branch_id = revenue_claims.branch_id)) OR has_role(auth.uid(), 'admin'));

-- marketer_commissions
CREATE POLICY "admins_manage_commissions" ON public.marketer_commissions FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "marketers_view_own_commissions_permissive" ON public.marketer_commissions FOR SELECT USING (marketer_id IN (SELECT marketers.id FROM marketers WHERE marketers.user_id = auth.uid()));
CREATE POLICY "marketers_claim_commissions" ON public.marketer_commissions FOR UPDATE USING ((marketer_id IN (SELECT marketers.id FROM marketers WHERE marketers.user_id = auth.uid())) AND (status = 'unclaimed'));

-- marketer_claims
CREATE POLICY "marketer_claims_select_own" ON public.marketer_claims FOR SELECT USING ((marketer_id IN (SELECT marketers.id FROM marketers WHERE marketers.user_id = auth.uid())) OR (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin')));
CREATE POLICY "marketer_claims_insert_own" ON public.marketer_claims FOR INSERT WITH CHECK (marketer_id IN (SELECT marketers.id FROM marketers WHERE marketers.user_id = auth.uid()));
CREATE POLICY "marketer_claims_admin_all" ON public.marketer_claims FOR UPDATE USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

-- marketer_earnings
CREATE POLICY "Admins can manage marketer earnings" ON public.marketer_earnings FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Marketers can view own earnings" ON public.marketer_earnings FOR SELECT USING ((marketer_id IN (SELECT marketers.id FROM marketers WHERE marketers.user_id = auth.uid())) OR has_role(auth.uid(), 'admin'));

-- marketer_commission_config
CREATE POLICY "commission_config_admin_all" ON public.marketer_commission_config FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));
CREATE POLICY "commission_config_admin_update" ON public.marketer_commission_config FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));
CREATE POLICY "commission_config_read" ON public.marketer_commission_config FOR SELECT USING (true);

-- dental_records
CREATE POLICY "dental_records_all_staff" ON public.dental_records FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = ANY(ARRAY['doctor','receptionist','admin','branch_director'])));
CREATE POLICY "dental_records_select_member" ON public.dental_records FOR SELECT USING (member_id IN (SELECT members.id FROM members WHERE members.user_id = auth.uid()));

-- dental_chart_records
CREATE POLICY "Doctors can create dental records" ON public.dental_chart_records FOR INSERT WITH CHECK (has_role(auth.uid(), 'doctor') OR has_role(auth.uid(), 'admin'));
CREATE POLICY "View dental chart records" ON public.dental_chart_records FOR SELECT USING ((member_id IN (SELECT members.id FROM members WHERE members.user_id = auth.uid())) OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'receptionist') OR has_role(auth.uid(), 'doctor'));

-- service_preapprovals
CREATE POLICY "Admins can manage service preapprovals" ON public.service_preapprovals FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can view service preapprovals" ON public.service_preapprovals FOR SELECT USING (true);

-- system_settings
CREATE POLICY "admins_manage_settings" ON public.system_settings FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "authenticated_read_settings" ON public.system_settings FOR SELECT USING (auth.role() = 'authenticated');

-- system_logs
CREATE POLICY "Admins can view all logs" ON public.system_logs FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));
CREATE POLICY "Users can insert logs" ON public.system_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- otp_verifications
CREATE POLICY "Allow public insert otp" ON public.otp_verifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public select otp" ON public.otp_verifications FOR SELECT USING ((verified_at IS NULL) AND (expires_at > now()));
CREATE POLICY "Allow public update otp" ON public.otp_verifications FOR UPDATE USING ((verified_at IS NULL) AND (expires_at > now()));


-- ============================================================
-- 8. ENABLE REALTIME (if needed)
-- ============================================================
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;


-- ============================================================
-- 9. DATA INSERTS
-- ============================================================

-- 9.1 Branches
INSERT INTO public.branches (id, name, location, phone, email, is_active, is_globally_preapproved_for_services) VALUES
  ('c042d31f-1e8d-4846-956e-59148482c454', 'Main Branch - Nairobi', 'Kenyatta Avenue, Nairobi', '+254700000001', 'nairobi@elephantdental.co.ke', true, false),
  ('86ffbf98-fca1-4d9d-84fe-e3748f1beb3b', 'Mombasa Branch', 'Moi Avenue, Mombasa', '+254700000002', 'mombasa@elephantdental.co.ke', true, false),
  ('dec4611b-6f6a-4b91-b532-2bc69f74565b', 'Meru Branch', 'Meru', '0723500500', 'meru@elephantdental.co.ke', true, false),
  ('1e9877d8-544c-4e9e-9dba-3c34848f58bd', 'Kisumu Branch', 'Oginga Odinga Street, Kisumu', '+254700000003', 'kisumu@elephantdental.co.ke', true, true);

-- 9.2 Membership Categories
INSERT INTO public.membership_categories (id, name, level, payment_amount, benefit_amount, registration_fee, management_fee) VALUES
  ('40c08d2d-aebb-4676-a539-3f9dc971cd5f', 'Level I', 'level_1', 5000, 10000, 500, 1000),
  ('164328ef-8380-4a11-bc6e-357335a4fc6f', 'Level II', 'level_2', 10000, 20000, 500, 1000),
  ('361ef329-41a4-4c51-98a7-f70b6d23e6ac', 'Level III', 'level_3', 20000, 40000, 500, 1000),
  ('5a2bad54-e79e-4016-bcac-6c9e43e89784', 'Level IV', 'level_4', 40000, 80000, 500, 1000),
  ('2a0f3b7c-19c4-4c9e-9f4c-ea38f3f20607', 'Level V', 'level_5', 60000, 120000, 500, 1000),
  ('737d2b21-59fb-4358-a2bf-83221775d076', 'Level VI', 'level_6', 80000, 160000, 500, 1000);

-- 9.3 Services
INSERT INTO public.services (id, name, real_cost, benefit_cost, branch_compensation, profit_loss, approval_type) VALUES
  ('36f7dba5-3e61-45de-9337-b1460f6db4f6', 'Consultation', 300, 500, 300, 200, 'all_branches'),
  ('266ae4d8-8868-4aed-a6fa-64de5b20bd37', 'X-Ray (IOPA)', 300, 500, 300, 200, 'all_branches'),
  ('62fe03bf-3dbb-4319-bd05-bd511d4e690c', 'Scaling and Polishing', 600, 3500, 1200, 2300, 'all_branches'),
  ('2277ddaf-7f8a-4f4d-992b-c8819a9d9a59', 'Permanent Filling / Pulp Capping', 800, 3500, 1600, 1900, 'all_branches'),
  ('afeb63bf-abc5-4331-9995-8a7ba64c3814', 'Pins and Posts', 200, 1500, 500, 1000, 'all_branches'),
  ('6cf905b9-f8e8-475b-9cbc-143ddf91da43', 'Root Canal Therapy / Re-RCT', 1400, 9000, 2800, 6200, 'pre_approved_only'),
  ('fe71c13c-b79a-4c87-9379-7c6ba7135969', 'Pulpotomy / Pulpectomy', 800, 4500, 1600, 2900, 'all_branches'),
  ('78c13991-d50d-4278-b336-aee17b6c223d', 'Milk Tooth Extraction', 700, 1500, 1200, 300, 'all_branches'),
  ('8186a91d-224d-44a6-af95-5928842e3cef', 'Normal Extraction', 700, 1500, 1200, 300, 'all_branches'),
  ('783a3c3c-a2f6-440c-b42d-943120ffb393', 'Closed Dis-impaction / Difficult Extraction', 900, 4500, 2500, 2000, 'all_branches'),
  ('a7a39354-8e4f-45d8-8440-cb4317e0a322', 'Surgical Dis-impaction', 1300, 10000, 4000, 6000, 'pre_approved_only'),
  ('fa1cbb03-1bac-470c-a78d-8e891fec846a', 'Apicectomy', 1300, 12000, 4000, 8000, 'pre_approved_only'),
  ('e5686b1e-f35c-4c7c-92be-5f9665870a9c', 'Denture 1st Tooth', 1300, 8000, 2600, 5400, 'all_branches'),
  ('63df24e4-cfd6-4200-97e6-08fccee0db75', 'Additional Tooth into Partial Denture', 50, 800, 200, 600, 'all_branches'),
  ('dd24e450-1b01-48be-9daa-76288657fa3f', 'Crown / Bridge per Unit / Veneers', 4000, 15000, 5500, 9500, 'pre_approved_only'),
  ('e27523ee-1ef1-49f2-b6db-8c038e40c0ad', 'Complete Denture', 8000, 30000, 11000, 19000, 'pre_approved_only'),
  ('843bcd89-96c5-45e9-af19-b06d46040dab', 'Removable Orthodontic Appliance', 3000, 18000, 5000, 13000, 'pre_approved_only'),
  ('16a8c2e5-d2c8-49d1-9d46-144a131d9d10', 'Braces (Per Arch)', 3000, 60000, 20000, 40000, 'pre_approved_only');

-- 9.4 User Roles
-- NOTE: user_id values reference auth.users. You must create these users in Supabase Auth first.
INSERT INTO public.user_roles (id, user_id, role) VALUES
  ('328ee179-39be-4e2b-9f9c-b4a1d34f8736', 'ad7554ed-b523-48c8-925a-29e3609baf79', 'admin'),
  ('a8f00468-6406-4258-a185-8b0dae93dbe3', '7ec9fa7d-704c-4e65-bf7e-f69034b8a8f2', 'receptionist'),
  ('9f27f38c-968f-487a-9e18-9f6fb9f7f2c5', '1f030c0c-9116-475a-bb05-7f943b345e79', 'doctor'),
  ('aa3b5bde-3c7a-4e36-91b6-a048c0af6ecd', '08c14f60-7a25-4213-b992-1c81540ae284', 'doctor'),
  ('45a7afc2-54b3-46bb-ac1c-14ec51ef8e4c', '551c9f43-432a-4e63-a00e-ae6f6ce2811d', 'receptionist'),
  ('a689fd99-c397-4fda-9d43-824474c49099', '7a6fa206-d2d0-4f6d-9004-cbffa07efbc7', 'marketer'),
  ('f754be6e-aa61-4437-8722-024f69f80a02', 'e53939ff-324f-40d9-8ded-80e81e013a13', 'member'),
  ('a370d4b1-5bcb-4cd7-839e-3c5c3ff2f851', '9ed0cc50-4fee-45c1-89fe-a6adcc4e9a28', 'branch_director'),
  ('c868d18f-3bf0-44ef-8323-261b2e4d134c', 'e76ec3fe-c79a-4cd7-921d-cc649c54325c', 'member'),
  ('f694c053-5610-4a95-b948-3ad430a02416', '658138c4-0145-4d3f-bf40-9869d2fd4ab7', 'member'),
  ('71261cf1-4ad2-4251-9717-3d0270dc84fb', '109e9f41-27e3-41c6-a754-2dacf23d4104', 'member'),
  ('d2f3a228-9312-4ef2-8a68-ac2be9e89cda', '45b56423-4e85-472b-be4f-81dbdec30abe', 'member'),
  ('cecaa3af-c737-42d1-9b28-7bfa13d0ddeb', '6eb1f7e0-a6ff-4fc2-93f3-9c549fe055c9', 'member'),
  ('51095fe0-1f5d-4d68-8146-0cb343743fbd', '20729ec4-c0dd-4330-bec1-0283a3773f7b', 'member'),
  ('46df1623-7d36-449b-bfd1-ef725bb2d5ba', '5313d2d9-a98a-495b-835f-141c41f46b6c', 'member'),
  ('9ce78242-e402-426c-9bba-aeb68f4fc1e1', 'ac949b89-2451-43a5-9859-e7df85faf6de', 'branch_director'),
  ('6dc4f282-db20-40bd-b048-2513525690e7', '2aba1b3e-03b7-4557-b948-1ae766df7eac', 'branch_director'),
  ('d5949e5c-2df5-4365-ac23-5a81459f8e71', '5e253956-e5e0-4e3d-9c07-94aeb13b7486', 'member'),
  ('fac495b0-4ab8-4eb3-a66b-0db2800b3591', '69c089de-39bc-4447-a74b-ff143e0f576a', 'member'),
  ('680d40b7-3c1a-4a81-ace9-544f3c2d1c0c', 'b1815c36-00ea-480d-8561-3d1885f6a52e', 'member'),
  ('077b40eb-c9db-4a46-9549-3f7dec47ebc6', 'a1e26a1d-e444-4fab-8b9c-f8205db9ba96', 'member'),
  ('2138e046-c382-44e0-865d-32a91443e7c7', '16efc915-55f7-4bcd-887e-91316cac0264', 'member'),
  ('752e0160-b529-40a0-8d52-9139eb95538d', '52bc8503-11cc-42b7-b9a1-ec45b9eff057', 'member'),
  ('c2691f19-6255-40ad-afed-4b656e1d8e8a', 'e809d77e-4318-4883-a6cf-2dfb65225304', 'member'),
  ('fd8bd53d-ae1b-4525-9783-148860c4376f', '191c9f4f-ce29-4ae0-a779-3bc00ce28a4f', 'doctor'),
  ('64e96c69-885a-4709-8766-ba819843fbdf', '74c9ece3-96e5-4dbc-9c4a-76c0387ff1c8', 'doctor'),
  ('2000b880-8e34-456d-ba5a-2b3675eece53', '692d5a0d-2c3a-495d-99ec-1a8ff5ea27d1', 'member'),
  ('e57ca249-7a63-4c57-821b-35333f617440', '9f132334-9840-44c6-b5db-2fbc0ae71c0b', 'member');

-- 9.5 Staff
INSERT INTO public.staff (id, user_id, full_name, email, phone, branch_id) VALUES
  ('2e3b708f-90f8-42a8-8559-c67daee78446', '2e3b708f-90f8-42a8-8559-c67daee78446', 'ken', 'ken@elephantdental.co.ke', '1234554321', '86ffbf98-fca1-4d9d-84fe-e3748f1beb3b'),
  ('58cde73a-30f6-457b-854d-576b194fc013', '08c14f60-7a25-4213-b992-1c81540ae284', 'peter', 'pe@mail.com', '12345676', '86ffbf98-fca1-4d9d-84fe-e3748f1beb3b'),
  ('a1df04e8-1465-486c-9524-a25f8cece06c', '551c9f43-432a-4e63-a00e-ae6f6ce2811d', 'wambo', 'wa@mail.com', '33322233', '86ffbf98-fca1-4d9d-84fe-e3748f1beb3b'),
  ('1dfbdc3b-785d-4f43-a414-b938c5ab1487', '9ed0cc50-4fee-45c1-89fe-a6adcc4e9a28', 'test', 'test@mail.com', '12312356', '86ffbf98-fca1-4d9d-84fe-e3748f1beb3b'),
  ('7512cd01-25d6-489b-a32f-f441b5798289', 'ac949b89-2451-43a5-9859-e7df85faf6de', 'nn', 'nm@mail.com', '44332222', '86ffbf98-fca1-4d9d-84fe-e3748f1beb3b'),
  ('b662aad0-57ef-4da1-b090-836ca2dbab5c', '2aba1b3e-03b7-4557-b948-1ae766df7eac', 'eeww', 'ru@mail.com', '22233344', 'dec4611b-6f6a-4b91-b532-2bc69f74565b'),
  ('25d3ec2a-5d88-476f-9c26-20bcf50d351f', '191c9f4f-ce29-4ae0-a779-3bc00ce28a4f', 'Micah', 'mic@gmail.com', '098765433', '86ffbf98-fca1-4d9d-84fe-e3748f1beb3b'),
  ('5d6d529b-1211-45f2-b74e-6597db4933a9', '74c9ece3-96e5-4dbc-9c4a-76c0387ff1c8', 'Zippy', 'zip@mail.com', '0999887', 'dec4611b-6f6a-4b91-b532-2bc69f74565b');

-- 9.6 Marketers
INSERT INTO public.marketers (id, user_id, full_name, email, phone, code, marketer_code, commission_type, commission_value) VALUES
  ('ac1c68c1-9424-4ab3-9b87-71e09e9805af', '7a6fa206-d2d0-4f6d-9004-cbffa07efbc7', 'ken', 'kenn@mail.com', '3333333', 'Agent 001', 'MKT1000', 'fixed', 0);

-- 9.7 Members (disable trigger temporarily to insert with specific member_numbers)
-- NOTE: You may need to disable the generate_member_number trigger before inserting, 
-- or adjust the sequence after. Below inserts use ON CONFLICT DO NOTHING for safety.
INSERT INTO public.members (id, user_id, full_name, email, phone, id_number, age, member_number, coverage_balance, benefit_limit, total_contributions, marketer_id, membership_category_id, is_active, scheme_selected, branch_id, qr_code_data, rollover_balance, rollover_years) VALUES
  ('328ee179-39be-4e2b-9f9c-b4a1d34f8736', 'ad7554ed-b523-48c8-925a-29e3609baf79', 'john', 'john@mail.com', '0798765432', '2345678', NULL, 'ED001000', -600.00, 0, 500.00, NULL, NULL, false, false, '86ffbf98-fca1-4d9d-84fe-e3748f1beb3b', 'MEMBER-ED001000', 0, 0),
  ('6fea85c5-f598-4b1c-812f-5158aeb1c622', '26a7b85d-1bb5-48b7-bd85-c885aa784598', 'Austine Wanjala', 'wanjalaaustine819@gmail.com', '0703804559', '222222', NULL, 'ED001002', 10000.00, 10000, 6500.00, NULL, '40c08d2d-aebb-4676-a539-3f9dc971cd5f', true, false, 'dec4611b-6f6a-4b91-b532-2bc69f74565b', '6fea85c5-f598-4b1c-812f-5158aeb1c622', 0, 0),
  ('6b82173f-4880-4465-ab8d-fc5b84d225d7', 'b8aa4fd3-4f2e-4ca1-a802-9e53fab9d6ba', 'autyyy', 'austi@mail.com', '111222', '2223344', NULL, 'ED001003', 10200.00, 10000, 13000.00, NULL, '40c08d2d-aebb-4676-a539-3f9dc971cd5f', true, false, 'dec4611b-6f6a-4b91-b532-2bc69f74565b', 'MEMBER-ED001003', 0, 0),
  ('33af42ef-8de7-43a2-b0f3-9ac274e6491f', 'e76ec3fe-c79a-4cd7-921d-cc649c54325c', 'dad', 'da@mail.com', '555555', '444444', 30, 'ED001011', 20000.00, 10000, 11500.00, 'ac1c68c1-9424-4ab3-9b87-71e09e9805af', '40c08d2d-aebb-4676-a539-3f9dc971cd5f', true, false, NULL, 'MEMBER-ED001011', 0, 0),
  ('024ccdb0-d6ac-4e82-bf67-01b8098852dc', '658138c4-0145-4d3f-bf40-9869d2fd4ab7', 'doe', 'do@mail.com', '555555', '66666', 43, 'ED001012', 20000.00, 10000, 11500.00, NULL, '40c08d2d-aebb-4676-a539-3f9dc971cd5f', true, false, NULL, 'MEMBER-ED001012', 0, 0),
  ('e236804a-5a43-426c-bc4a-fed6202421d3', '109e9f41-27e3-41c6-a754-2dacf23d4104', 'eee', 'wer@mail.com', '66665', '3333332', 21, 'ED001013', 20000.00, 10000, 11500.00, NULL, '40c08d2d-aebb-4676-a539-3f9dc971cd5f', true, false, NULL, 'MEMBER-ED001013', 0, 0),
  ('c6f63398-6899-46dc-a5ec-a0fc6b3a151d', '45b56423-4e85-472b-be4f-81dbdec30abe', 'yyy', 'mr@mail.com', '556677', '3344', 21, 'ED001014', 10000.00, 10000, 6500.00, NULL, '40c08d2d-aebb-4676-a539-3f9dc971cd5f', true, false, NULL, 'MEMBER-ED001014', 0, 0),
  ('1d73f758-dab4-4a1b-a9b2-fca00876fd2e', '5e253956-e5e0-4e3d-9c07-94aeb13b7486', 'davy', 'ds@mail.com', '22222333', '111111', 22, 'ED001018', 0.00, 0, 0.00, 'ac1c68c1-9424-4ab3-9b87-71e09e9805af', NULL, false, false, NULL, '1d73f758-dab4-4a1b-a9b2-fca00876fd2e', 0, 0),
  ('58cbf0ee-c0bc-41c0-93e3-31e494b9b5f0', '69c089de-39bc-4447-a74b-ff143e0f576a', 'HU', 'hu@mail.com', '0703804559', '111222', 12, 'ED001019', 0.00, 0, 0.00, NULL, NULL, false, false, NULL, '58cbf0ee-c0bc-41c0-93e3-31e494b9b5f0', 0, 0),
  ('b41ed99c-c58e-4e76-bd44-0fdd6c89d7ab', '692d5a0d-2c3a-495d-99ec-1a8ff5ea27d1', 'ggg', 'gg@mail.com', '6655544', '112233', 22, 'ED001025', 0.00, 0, 0.00, NULL, NULL, false, false, NULL, 'b41ed99c-c58e-4e76-bd44-0fdd6c89d7ab', 0, 0);

-- NOTE: There are more members in the database. The above covers the ones retrieved.
-- You should query SELECT * FROM members in your current database to get all records.

-- 9.8 Dependants
INSERT INTO public.dependants (id, member_id, full_name, dob, id_number, relationship) VALUES
  ('718f09ec-3aba-4869-86c3-aebf292f28b1', 'b8b56371-76db-4734-a2e4-6b7a7adda60c', 'purity', '2025-12-24', '33333', 'child'),
  ('9f7e1d71-cb3e-4f52-a50b-4cdf6bfaf737', '33af42ef-8de7-43a2-b0f3-9ac274e6491f', 'ma', '2026-02-04', '333344', 'child');

-- 9.9 Payments
INSERT INTO public.payments (id, member_id, amount, coverage_added, status, mpesa_reference, payment_date) VALUES
  ('6b5d0e28-307c-446d-a88e-93d08c4c2404', '328ee179-39be-4e2b-9f9c-b4a1d34f8736', 500.00, 1000.00, 'completed', 'MPE1769618799660', '2026-01-28 16:46:39.879213+00'),
  ('2df15a95-e747-4cdd-ac6a-7d4ac87478f8', '6b82173f-4880-4465-ab8d-fc5b84d225d7', 6500.00, 10000.00, 'completed', 'wwwwww', '2026-01-30 09:10:47.589+00'),
  ('681773d1-60b8-4eed-ab89-55820e46f506', 'b8b56371-76db-4734-a2e4-6b7a7adda60c', 6500.00, 10000.00, 'completed', 'wwwwww', '2026-02-03 10:39:29.84+00'),
  ('f46225fc-97ad-4063-8acc-1c24736c7470', '33af42ef-8de7-43a2-b0f3-9ac274e6491f', 6500.00, 10000.00, 'completed', 'ggggg', '2026-02-03 15:36:15.343+00'),
  ('82959049-6e3d-463d-9c6a-7b8f7b5babfb', '024ccdb0-d6ac-4e82-bf67-01b8098852dc', 6500.00, 10000.00, 'completed', 'ggggggtt', '2026-02-03 15:40:29.734+00'),
  ('2a56e378-e268-4617-950c-a30e9ea84287', 'e236804a-5a43-426c-bc4a-fed6202421d3', 6500.00, 10000.00, 'completed', 'yyytt', '2026-02-03 15:44:25.005+00'),
  ('d086ddad-211f-40e2-be1e-d148a857bf71', 'c6f63398-6899-46dc-a5ec-a0fc6b3a151d', 6500.00, 10000.00, 'completed', 'eeerr', '2026-02-03 15:49:59.55+00'),
  ('715aeba7-a4e3-4082-a22e-30e44cf620b2', '039c4d08-2510-4994-864e-b685f178b6af', 6500.00, 10000.00, 'completed', 'qqwee', '2026-02-04 05:51:19.579+00'),
  ('6850c69c-22a2-4d59-9069-6dbec93a7ae5', 'b663a1cb-9fa5-436f-9c5b-884aa3d53383', 6500.00, 10000.00, 'completed', 'wweee', '2026-02-05 18:08:14.888+00'),
  ('73aec128-190f-4e45-bda0-f2190f8d75cb', 'be026d12-48b0-4422-99e4-ec3f3e04e8a7', 6500.00, 10000.00, 'completed', 'eeerrt', '2026-02-05 18:19:18.45+00'),
  ('982948f4-e6ae-4d9a-b9b6-b6b9a0e98cc7', 'b6c94178-3b73-48df-a3f1-fc49ed7d4a6a', 6500.00, 10000.00, 'completed', 'bbbcbbc', '2026-02-06 06:35:39.46+00');

-- 9.10 Claims
INSERT INTO public.claims (id, member_id, branch_id, staff_id, amount, diagnosis, treatment, notes, status, processed_at) VALUES
  ('7b6ca3bf-1f93-4ced-bd5a-66da821e5c28', '6b82173f-4880-4465-ab8d-fc5b84d225d7', '86ffbf98-fca1-4d9d-84fe-e3748f1beb3b', NULL, 500.00, 'dd', 'X-Ray (IOPA)', 'ddd', 'completed', '2026-01-30 14:33:35.771+00'),
  ('fac937fc-3815-46e9-966f-aa4f1006a943', '6b82173f-4880-4465-ab8d-fc5b84d225d7', '86ffbf98-fca1-4d9d-84fe-e3748f1beb3b', NULL, 800.00, 'rrr', 'Additional Tooth into Partial Denture', 'eee', 'completed', '2026-01-30 14:45:42.665+00'),
  ('98da48d2-541b-4dbb-a2a1-a1818cea4244', '6b82173f-4880-4465-ab8d-fc5b84d225d7', '86ffbf98-fca1-4d9d-84fe-e3748f1beb3b', NULL, 1500.00, 'wwee', 'Normal Extraction', 'eee', 'completed', '2026-01-30 14:53:29.144+00'),
  ('1f8e8119-4ce2-4419-84c5-89077927b984', '6b82173f-4880-4465-ab8d-fc5b84d225d7', '86ffbf98-fca1-4d9d-84fe-e3748f1beb3b', '2e3b708f-90f8-42a8-8559-c67daee78446', 3500.00, 'dd', 'Scaling and Polishing', 'ddd', 'completed', '2026-01-30 14:59:03.039+00'),
  ('b51c4605-1ae1-4779-8e31-ef1fbb948a37', '328ee179-39be-4e2b-9f9c-b4a1d34f8736', '86ffbf98-fca1-4d9d-84fe-e3748f1beb3b', '2e3b708f-90f8-42a8-8559-c67daee78446', 800.00, 'ggg', 'Additional Tooth into Partial Denture', NULL, 'completed', '2026-02-02 15:04:00.564+00'),
  ('c57350cc-5c92-4898-a301-9252e8794ded', '565e284b-0c99-4687-940d-0971890dd48f', 'dec4611b-6f6a-4b91-b532-2bc69f74565b', NULL, 3500.00, 'check', 'Permanent Filling / Pulp Capping', NULL, 'approved', '2026-02-02 15:59:54.667+00'),
  ('8235c99e-7a32-4c5f-ad8f-1e5879b1872f', '565e284b-0c99-4687-940d-0971890dd48f', '86ffbf98-fca1-4d9d-84fe-e3748f1beb3b', '2e3b708f-90f8-42a8-8559-c67daee78446', 3500.00, 'rr', 'Permanent Filling / Pulp Capping', NULL, 'completed', '2026-02-02 16:09:49.601+00');

-- 9.11 Revenue Claims
INSERT INTO public.revenue_claims (id, branch_id, director_id, amount, status, notes, paid_at) VALUES
  ('57b0ba0e-7f88-4aee-a20c-e3687245fee5', '86ffbf98-fca1-4d9d-84fe-e3748f1beb3b', '1dfbdc3b-785d-4f43-a414-b938c5ab1487', 1500, 'paid', 'payment', '2026-02-03 19:11:18.474+00'),
  ('ef3259bf-65a6-48e6-b446-fa43257b0450', '86ffbf98-fca1-4d9d-84fe-e3748f1beb3b', '1dfbdc3b-785d-4f43-a414-b938c5ab1487', 1500, 'paid', NULL, '2026-02-03 20:19:39.38+00'),
  ('741b57f0-2d08-4755-a245-8e071f26a585', '86ffbf98-fca1-4d9d-84fe-e3748f1beb3b', '1dfbdc3b-785d-4f43-a414-b938c5ab1487', 3700, 'paid', 'bank', '2026-02-04 15:42:03.065+00');

-- 9.12 Branch Revenue
INSERT INTO public.branch_revenue (id, branch_id, date, total_compensation, total_benefit_deductions, total_profit_loss, visit_count) VALUES
  ('d58204a8-b50d-4ab0-a20e-e8f8cd6a5994', '86ffbf98-fca1-4d9d-84fe-e3748f1beb3b', '2026-01-30', 4000, 8100, 4100, 5),
  ('7ec8fb45-ead6-41bf-a3cd-353349fe2c35', '86ffbf98-fca1-4d9d-84fe-e3748f1beb3b', '2026-02-02', 1800, 4300, 2500, 2),
  ('161ab871-f9d3-40dc-8e63-6f871c2ba07e', '86ffbf98-fca1-4d9d-84fe-e3748f1beb3b', '2026-02-03', 1500, 2000, 0, 3),
  ('a7df93bd-7dd9-401c-9fd8-179aa86588ce', '86ffbf98-fca1-4d9d-84fe-e3748f1beb3b', '2026-02-04', 3700, 6500, 0, 2),
  ('d011e46e-d0c4-4315-8cbe-b7b1d93f1ab3', '86ffbf98-fca1-4d9d-84fe-e3748f1beb3b', '2026-02-05', 1800, 2500, 0, 2),
  ('58429a14-a28e-4d51-9527-f9bd5d546994', '86ffbf98-fca1-4d9d-84fe-e3748f1beb3b', '2026-02-06', 1900, 4000, 0, 2);

-- 9.13 Branch Payments
INSERT INTO public.branch_payments (id, branch_id, amount_paid, period_month, period_year, paid_by_user_id) VALUES
  ('758d617d-3018-4ea5-8f46-242230c4793d', '86ffbf98-fca1-4d9d-84fe-e3748f1beb3b', 7000, 2, 2026, 'ad7554ed-b523-48c8-925a-29e3609baf79');

-- 9.14 Marketer Commissions
INSERT INTO public.marketer_commissions (id, marketer_id, member_id, amount, status) VALUES
  ('496fc2e9-e62e-4e60-a30d-1ce2693341d1', 'ac1c68c1-9424-4ab3-9b87-71e09e9805af', 'b663a1cb-9fa5-436f-9c5b-884aa3d53383', 500, 'unclaimed'),
  ('6cf41cfe-9fed-4f08-9073-4f0b80ebf667', 'ac1c68c1-9424-4ab3-9b87-71e09e9805af', 'be026d12-48b0-4422-99e4-ec3f3e04e8a7', 500, 'unclaimed');

-- 9.15 Marketer Claims
INSERT INTO public.marketer_claims (id, marketer_id, amount, referral_count, status, notes, paid_at) VALUES
  ('5f035abf-2303-4428-a7f9-e4113e983311', 'ac1c68c1-9424-4ab3-9b87-71e09e9805af', 996, 2, 'paid', 'gggg', '2026-02-04 05:07:17.215+00'),
  ('5df89f89-5046-435d-afa1-7e2a7bd5e8d1', 'ac1c68c1-9424-4ab3-9b87-71e09e9805af', 204, 4, 'pending', NULL, NULL);

-- 9.16 Marketer Commission Config
INSERT INTO public.marketer_commission_config (id, commission_per_referral) VALUES
  ('4cc65e47-d0be-4a36-9468-83cbd09d0a8b', 500);

-- 9.17 Service Preapprovals
INSERT INTO public.service_preapprovals (id, service_id, branch_id) VALUES
  ('50a8ecdc-e5c6-46bb-855a-d7632d0685c9', 'fa1cbb03-1bac-470c-a78d-8e891fec846a', '1e9877d8-544c-4e9e-9dba-3c34848f58bd');

-- 9.18 System Settings
INSERT INTO public.system_settings (id, key, value, description) VALUES
  ('a37dfdb0-6bc1-412d-8542-2b6dbf37789d', 'marketer_commission_per_referral', '500', 'Commission amount (KES) paid to marketers per active referral');

-- 9.19 Dental Records
INSERT INTO public.dental_records (id, member_id, tooth_number, status, notes, visit_id) VALUES
  ('8622e63a-6668-444a-9e9c-69de3802e951', '565e284b-0c99-4687-940d-0971890dd48f', 23, 'completed', 'Updated in visit e9be5c62-7c32-4dda-92d1-e897df53b458', 'e9be5c62-7c32-4dda-92d1-e897df53b458'),
  ('6a8ee3e2-c6a3-4edc-98bb-8ca12146854c', 'b8b56371-76db-4734-a2e4-6b7a7adda60c', 23, 'completed', 'Updated in visit 25d15536-197c-4c4a-8cb9-3b904aa5bc87', '25d15536-197c-4c4a-8cb9-3b904aa5bc87'),
  ('a803eddb-4f12-48e8-80ec-5426036638b5', 'b8b56371-76db-4734-a2e4-6b7a7adda60c', 24, 'healthy', 'Updated in visit 25d15536-197c-4c4a-8cb9-3b904aa5bc87', '25d15536-197c-4c4a-8cb9-3b904aa5bc87');


-- ============================================================
-- 10. IMPORTANT NOTES
-- ============================================================
-- 1. You MUST create the auth.users entries FIRST in your target Supabase project
--    (via Supabase Auth dashboard or API) before running the data inserts.
--    The user_id values in user_roles, staff, members, etc. reference auth.users.
--
-- 2. The handle_new_user() trigger should be created on auth.users:
--    CREATE TRIGGER on_auth_user_created
--      AFTER INSERT ON auth.users
--      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
--
-- 3. Some member IDs referenced in payments/visits/bills may not be included
--    in the members INSERT above (truncated data). Query your live database for
--    the complete dataset.
--
-- 4. The member_number_seq should be set to a value higher than your max member number.
--    After import: SELECT setval('member_number_seq', (SELECT MAX(CAST(SUBSTRING(member_number FROM 3) AS INT)) FROM members) + 1);
--
-- 5. Edge Functions (mpesa-stk-push, mpesa-callback, send-sms, send-welcome-sms)
--    must be deployed separately. They are in supabase/functions/.
--
-- 6. Required secrets for Edge Functions:
--    - MPESA_CONSUMER_KEY
--    - MPESA_CONSUMER_SECRET
--    - MPESA_PASSKEY
--    - MPESA_BUSINESS_SHORTCODE
--    - MPESA_CALLBACK_URL
--    - AFRICASTALKING_API_KEY
--    - AFRICASTALKING_USERNAME
--    - RESEND_API_KEY
-- ============================================================
