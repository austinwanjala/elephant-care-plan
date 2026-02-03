-- Create revenue_claims table and update bills to support claims
-- Migration: 20260219000000_add_revenue_claims.sql

DO $$
BEGIN
    -- 1. Create revenue_claims table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'revenue_claims') THEN
        CREATE TABLE public.revenue_claims (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
            director_id UUID NOT NULL REFERENCES public.staff(id),
            amount NUMERIC NOT NULL CHECK (amount > 0),
            status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'rejected')),
            notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            paid_at TIMESTAMP WITH TIME ZONE,
            paid_by UUID REFERENCES public.staff(id)
        );
    END IF;

    -- 2. Add claim_id to bills table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bills' AND column_name = 'claim_id') THEN
        ALTER TABLE public.bills ADD COLUMN claim_id UUID REFERENCES public.revenue_claims(id) ON DELETE SET NULL;
    END IF;

    -- 3. RLS for revenue_claims
    ALTER TABLE public.revenue_claims ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Directors can manage their own branch claims" ON public.revenue_claims;
    DROP POLICY IF EXISTS "Admins can manage all claims" ON public.revenue_claims;
    DROP POLICY IF EXISTS "Staff can view their branch claims" ON public.revenue_claims;

    -- Directors can view and insert claims for their branch
    CREATE POLICY "Directors can manage their own branch claims" ON public.revenue_claims
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.staff 
            WHERE user_id = auth.uid() 
            AND id = revenue_claims.director_id
            AND branch_id = revenue_claims.branch_id
        ) OR public.has_role(auth.uid(), 'admin')
    );

    -- Admins can do everything
    CREATE POLICY "Admins can manage all claims" ON public.revenue_claims
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

END $$;
