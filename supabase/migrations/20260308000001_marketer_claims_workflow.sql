-- Migration: 20260308000001_marketer_claims_workflow.sql
-- Description: Updates marketer_claims to support admin approval -> finance review workflow.

-- Add approval tracking columns
ALTER TABLE public.marketer_claims
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.staff(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Update status check constraint
-- First drop existing constraint if named predictably (supabase usually names it table_column_check)
-- We'll use a DO block to safely handle constraint update
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketer_claims_status_check') THEN
        ALTER TABLE public.marketer_claims DROP CONSTRAINT marketer_claims_status_check;
    END IF;
END $$;

ALTER TABLE public.marketer_claims
ADD CONSTRAINT marketer_claims_status_check 
CHECK (status IN ('pending', 'approved', 'rejected', 'finance_review', 'paid', 'cancelled'));

-- Create index for status to speed up filtering
CREATE INDEX IF NOT EXISTS idx_marketer_claims_status ON public.marketer_claims(status);

-- Update RLS if needed (Admin and Finance need access)
-- Assuming existing policies cover "staff with permission" or broadly "authenticated staff".
