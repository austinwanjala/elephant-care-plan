-- MIGRATION 2: Create all new tables

-- Add new columns to members table
ALTER TABLE public.members 
ADD COLUMN IF NOT EXISTS age INTEGER,
ADD COLUMN IF NOT EXISTS marketer_code TEXT,
ADD COLUMN IF NOT EXISTS scheme_selected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS data_consent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS digital_signature TEXT;

-- Create dependants table
CREATE TABLE IF NOT EXISTS public.dependants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    document_type TEXT NOT NULL CHECK (document_type IN ('birth_certificate', 'student_id')),
    document_number TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create marketers table
CREATE TABLE IF NOT EXISTS public.marketers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    marketer_code TEXT UNIQUE NOT NULL DEFAULT '',
    commission_type TEXT NOT NULL DEFAULT 'fixed' CHECK (commission_type IN ('fixed', 'percentage')),
    commission_value NUMERIC NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create receptionists table
CREATE TABLE IF NOT EXISTS public.receptionists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    branch_id UUID REFERENCES public.branches(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create doctors table
CREATE TABLE IF NOT EXISTS public.doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    branch_id UUID REFERENCES public.branches(id),
    specialization TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create branch_directors table
CREATE TABLE IF NOT EXISTS public.branch_directors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    branch_id UUID REFERENCES public.branches(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create member_visits table
CREATE TABLE IF NOT EXISTS public.member_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id),
    dependant_id UUID REFERENCES public.dependants(id),
    branch_id UUID NOT NULL REFERENCES public.branches(id),
    receptionist_id UUID,
    doctor_id UUID,
    visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    check_in_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    check_out_time TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'checked_in' CHECK (status IN ('checked_in', 'with_doctor', 'billing_pending', 'completed', 'cancelled')),
    biometric_verified BOOLEAN DEFAULT FALSE,
    biometric_verified_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bills table
CREATE TABLE IF NOT EXISTS public.bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL REFERENCES public.member_visits(id),
    member_id UUID NOT NULL REFERENCES public.members(id),
    doctor_id UUID,
    branch_id UUID NOT NULL REFERENCES public.branches(id),
    diagnosis TEXT,
    treatment_notes TEXT,
    total_benefit_cost NUMERIC NOT NULL DEFAULT 0,
    total_branch_compensation NUMERIC NOT NULL DEFAULT 0,
    total_real_cost NUMERIC NOT NULL DEFAULT 0,
    total_profit_loss NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'finalized', 'cancelled')),
    submitted_at TIMESTAMP WITH TIME ZONE,
    finalized_at TIMESTAMP WITH TIME ZONE,
    finalized_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bill_items table
CREATE TABLE IF NOT EXISTS public.bill_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.services(id),
    tooth_number TEXT,
    benefit_cost NUMERIC NOT NULL,
    branch_compensation NUMERIC NOT NULL,
    real_cost NUMERIC NOT NULL,
    profit_loss NUMERIC NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create dental_chart_records table (FDI notation)
CREATE TABLE IF NOT EXISTS public.dental_chart_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id),
    dependant_id UUID REFERENCES public.dependants(id),
    tooth_number TEXT NOT NULL,
    service_id UUID NOT NULL REFERENCES public.services(id),
    bill_id UUID REFERENCES public.bills(id),
    treated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    treated_by UUID,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create marketer_earnings table
CREATE TABLE IF NOT EXISTS public.marketer_earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    marketer_id UUID NOT NULL REFERENCES public.marketers(id),
    member_id UUID NOT NULL REFERENCES public.members(id),
    amount NUMERIC NOT NULL,
    payment_id UUID REFERENCES public.payments(id),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all new tables
ALTER TABLE public.dependants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receptionists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_directors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dental_chart_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketer_earnings ENABLE ROW LEVEL SECURITY;

-- Generate marketer code sequence
CREATE SEQUENCE IF NOT EXISTS marketer_code_seq START 1000;