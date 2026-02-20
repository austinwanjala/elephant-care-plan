-- Migration: 20260309000002_create_pending_claims.sql
-- Description: Creates the pending_claims table and adds reference to service_stages.

-- 1. Create pending_claims table
CREATE TABLE IF NOT EXISTS public.pending_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    member_id UUID REFERENCES public.members(id),
    service_id UUID REFERENCES public.services(id),
    visit_id UUID REFERENCES public.visits(id),
    bill_id UUID REFERENCES public.bills(id),
    locked_amount NUMERIC NOT NULL DEFAULT 0,
    is_multi_stage BOOLEAN DEFAULT false,
    status TEXT CHECK (status IN ('locked', 'released', 'rejected')) DEFAULT 'locked',
    released_to_director BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.pending_claims ENABLE ROW LEVEL SECURITY;

-- 3. Policies
CREATE POLICY "Staff can insert pending claims" ON public.pending_claims
FOR INSERT TO authenticated
WITH CHECK (true); 

CREATE POLICY "Staff can view branch pending claims" ON public.pending_claims
FOR SELECT TO authenticated
USING (
    branch_id IN (
        SELECT branch_id FROM public.staff WHERE user_id = auth.uid()
    ) OR 
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'director')
);

CREATE POLICY "Directors can update claim status" ON public.pending_claims
FOR UPDATE TO authenticated
USING (
    public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
    public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'admin')
);

-- 4. Index for performance
CREATE INDEX IF NOT EXISTS idx_pending_claims_visit ON public.pending_claims(visit_id);
CREATE INDEX IF NOT EXISTS idx_pending_claims_branch ON public.pending_claims(branch_id);

-- 5. Update service_stages to link to pending_claims
ALTER TABLE public.service_stages 
ADD COLUMN IF NOT EXISTS pending_claim_id UUID REFERENCES public.pending_claims(id) ON DELETE SET NULL;
