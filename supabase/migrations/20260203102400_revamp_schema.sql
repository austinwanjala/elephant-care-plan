-- Update app_role enum with new roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'receptionist';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'doctor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'branch_director';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'marketer';

-- Dependants table
CREATE TABLE public.dependants (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    member_id UUID REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
    full_name TEXT NOT NULL,
    dob DATE NOT NULL,
    identification_number TEXT, -- Birth cert or Student ID
    relationship TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Marketers table
CREATE TABLE public.marketers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    phone TEXT,
    is_active BOOLEAN DEFAULT true,
    total_earnings DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Link members to marketers
ALTER TABLE public.members ADD COLUMN marketer_id UUID REFERENCES public.marketers(id);

-- Service Costing Table
CREATE TABLE public.services (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'consultation', 'dental', 'optical', 'procedure', etc.
    real_cost DECIMAL(10,2) NOT NULL,
    branch_compensation DECIMAL(10,2) NOT NULL,
    benefit_cost DECIMAL(10,2) NOT NULL,
    profit_loss DECIMAL(10,2) GENERATED ALWAYS AS (benefit_cost - (real_cost + branch_compensation)) STORED,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Pre-approved branches for services (Many-to-Many)
CREATE TABLE public.service_branches (
    service_id UUID REFERENCES public.services(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    PRIMARY KEY (service_id, branch_id)
);

-- Visits
CREATE TABLE public.visits (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    member_id UUID REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
    branch_id UUID REFERENCES public.branches(id) NOT NULL,
    receptionist_id UUID REFERENCES auth.users(id),
    doctor_id UUID REFERENCES auth.users(id),
    visit_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    status TEXT DEFAULT 'registered', -- registered, with_doctor, billed, completed
    biometrics_verified BOOLEAN DEFAULT false,
    diagnosis TEXT,
    staff_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Bills
CREATE TABLE public.bills (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    visit_id UUID REFERENCES public.visits(id) ON DELETE CASCADE NOT NULL UNIQUE,
    total_benefit_cost DECIMAL(10,2) DEFAULT 0,
    total_branch_compensation DECIMAL(10,2) DEFAULT 0,
    total_real_cost DECIMAL(10,2) DEFAULT 0,
    total_profit_loss DECIMAL(10,2) DEFAULT 0,
    is_finalized BOOLEAN DEFAULT false,
    finalized_by UUID REFERENCES auth.users(id), -- Receptionist who finalized
    finalized_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Bill Items
CREATE TABLE public.bill_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    bill_id UUID REFERENCES public.bills(id) ON DELETE CASCADE NOT NULL,
    service_id UUID REFERENCES public.services(id) NOT NULL,
    service_name TEXT NOT NULL, -- Snapshot in case service changes
    benefit_cost DECIMAL(10,2) NOT NULL, -- Snapshot
    branch_compensation DECIMAL(10,2) NOT NULL, -- Snapshot
    real_cost DECIMAL(10,2) NOT NULL, -- Snapshot
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Dental Charts (Per visit or member? Usually per member but tracked over time. Let's do per member state + visit log if needed, simple first)
-- We need to track which procedure was done on which visit.
-- Dental Records Table
CREATE TABLE public.dental_records (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    visit_id UUID REFERENCES public.visits(id) ON DELETE CASCADE,
    member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
    tooth_number INTEGER NOT NULL,
    procedure_notes TEXT,
    status TEXT, -- treated, planned, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS Policies

-- Dependants
ALTER TABLE public.dependants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view own dependants" ON public.dependants FOR SELECT USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));
CREATE POLICY "Staff view all dependants" ON public.dependants FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'receptionist') OR public.has_role(auth.uid(), 'doctor'));
CREATE POLICY "Admins manage dependants" ON public.dependants FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Marketers
ALTER TABLE public.marketers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Marketers view self" ON public.marketers FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins manage marketers" ON public.marketers FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Services
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read services" ON public.services FOR SELECT USING (true);
CREATE POLICY "Admins manage services" ON public.services FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Visits
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view own visits" ON public.visits FOR SELECT USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));
CREATE POLICY "Staff view visits" ON public.visits FOR ALL USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'receptionist') OR 
  public.has_role(auth.uid(), 'doctor') OR
  public.has_role(auth.uid(), 'branch_director')
);

-- Bills
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
-- Receptionist and Director and Admin and Doctor (read only)
CREATE POLICY "Staff view bills" ON public.bills FOR SELECT USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'receptionist') OR 
  public.has_role(auth.uid(), 'doctor') OR
  public.has_role(auth.uid(), 'branch_director')
);
CREATE POLICY "Doctor create bill" ON public.bills FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'doctor'));
CREATE POLICY "Receptionist update bill" ON public.bills FOR UPDATE USING (public.has_role(auth.uid(), 'receptionist'));

-- Bill Items
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view bill items" ON public.bill_items FOR SELECT USING (
   public.has_role(auth.uid(), 'admin') OR 
   public.has_role(auth.uid(), 'receptionist') OR 
   public.has_role(auth.uid(), 'doctor') OR
   public.has_role(auth.uid(), 'branch_director')
);

-- Functions

-- Function to finalize bill and deduct coverage
CREATE OR REPLACE FUNCTION public.finalize_bill(_bill_id UUID, _receptionist_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_visit_id UUID;
    v_member_id UUID;
    v_total_benefit DECIMAL;
    v_current_coverage DECIMAL;
    v_branch_id UUID;
    v_total_compensation DECIMAL;
BEGIN
    -- Get bill details
    SELECT visit_id, total_benefit_cost, total_branch_compensation 
    INTO v_visit_id, v_total_benefit, v_total_compensation
    FROM public.bills WHERE id = _bill_id;

    -- Get visit details
    SELECT member_id, branch_id INTO v_member_id, v_branch_id
    FROM public.visits WHERE id = v_visit_id;

    -- Check coverage
    SELECT coverage_balance INTO v_current_coverage
    FROM public.members WHERE id = v_member_id;

    IF v_current_coverage < v_total_benefit THEN
        RAISE EXCEPTION 'Insufficient coverage balance';
    END IF;

    -- Deduct coverage
    UPDATE public.members 
    SET coverage_balance = coverage_balance - v_total_benefit
    WHERE id = v_member_id;

    -- Mark bill as finalized
    UPDATE public.bills 
    SET is_finalized = true, finalized_by = _receptionist_id, finalized_at = now()
    WHERE id = _bill_id;

    -- Update visit status
    UPDATE public.visits
    SET status = 'completed'
    WHERE id = v_visit_id;

    -- Note: We could record branch revenue here or simple query it from bills table when needed.
    -- For now, the bills table serves as the ledger.

END;
$$;
