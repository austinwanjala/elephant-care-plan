-- Migration: 20260308140000_multi_stage_workflow_tables.sql
-- Description: Creates pending_claims table and updates service_stages for multi-stage workflow

-- 1. Create pending_claims table
CREATE TABLE IF NOT EXISTS public.pending_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES public.branches(id),
    member_id UUID NOT NULL REFERENCES public.members(id),
    service_id UUID NOT NULL REFERENCES public.services(id),
    visit_id UUID REFERENCES public.visits(id), -- The visit where it originated
    bill_id UUID REFERENCES public.bills(id), -- The bill that funded this claim
    locked_amount NUMERIC NOT NULL DEFAULT 0,
    is_multi_stage BOOLEAN DEFAULT TRUE,
    released_to_director BOOLEAN DEFAULT FALSE, -- Flips to TRUE when stages complete
    approved_by_director BOOLEAN DEFAULT FALSE, -- Flips to TRUE when director asserts
    director_notes TEXT,
    status TEXT DEFAULT 'locked' CHECK (status IN ('locked', 'awaiting_approval', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Add RLS for pending_claims
ALTER TABLE public.pending_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors can view unlocked claims for their branch" ON public.pending_claims
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.staff 
        WHERE user_id = auth.uid() 
        AND branch_id = pending_claims.branch_id
        AND (role = 'branch_director' OR role = 'admin')
    ) AND released_to_director = true
);

CREATE POLICY "Directors can update claims for their branch" ON public.pending_claims
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.staff 
        WHERE user_id = auth.uid() 
        AND branch_id = pending_claims.branch_id
        AND (role = 'branch_director' OR role = 'admin')
    )
);

CREATE POLICY "System/Admin can manage all pending claims" ON public.pending_claims
FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR 
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('doctor', 'receptionist')) -- Allow creation
);

-- 3. Update service_stages table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'service_stages' AND column_name = 'selected_tooth') THEN
        ALTER TABLE public.service_stages ADD COLUMN selected_tooth INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'service_stages' AND column_name = 'pending_claim_id') THEN
        ALTER TABLE public.service_stages ADD COLUMN pending_claim_id UUID REFERENCES public.pending_claims(id);
    END IF;
END $$;
