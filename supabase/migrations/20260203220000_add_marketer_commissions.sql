-- Marketer Commission System Migration
-- This migration creates tables for tracking marketer commissions and claims

-- 1. Create commission configuration table (admin sets the rate)
CREATE TABLE IF NOT EXISTS public.marketer_commission_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commission_per_referral NUMERIC NOT NULL DEFAULT 50,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID REFERENCES public.staff(id)
);

-- Insert default configuration
INSERT INTO public.marketer_commission_config (commission_per_referral)
VALUES (50)
ON CONFLICT DO NOTHING;

-- 2. Create marketer claims table
CREATE TABLE IF NOT EXISTS public.marketer_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    marketer_id UUID NOT NULL REFERENCES public.marketers(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    referral_count INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    paid_at TIMESTAMP WITH TIME ZONE,
    paid_by UUID REFERENCES public.staff(id),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'paid', 'rejected'))
);

-- 3. Enable RLS on both tables
ALTER TABLE public.marketer_commission_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketer_claims ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for commission config
DROP POLICY IF EXISTS "commission_config_read" ON public.marketer_commission_config;
CREATE POLICY "commission_config_read" ON public.marketer_commission_config
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "commission_config_admin_all" ON public.marketer_commission_config;
CREATE POLICY "commission_config_admin_all" ON public.marketer_commission_config
FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 5. RLS Policies for marketer claims
DROP POLICY IF EXISTS "marketer_claims_select_own" ON public.marketer_claims;
CREATE POLICY "marketer_claims_select_own" ON public.marketer_claims
FOR SELECT USING (
    marketer_id IN (SELECT id FROM public.marketers WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "marketer_claims_insert_own" ON public.marketer_claims;
CREATE POLICY "marketer_claims_insert_own" ON public.marketer_claims
FOR INSERT WITH CHECK (
    marketer_id IN (SELECT id FROM public.marketers WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "marketer_claims_admin_all" ON public.marketer_claims;
CREATE POLICY "marketer_claims_admin_all" ON public.marketer_claims
FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 6. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_marketer_claims_marketer_id ON public.marketer_claims(marketer_id);
CREATE INDEX IF NOT EXISTS idx_marketer_claims_status ON public.marketer_claims(status);
