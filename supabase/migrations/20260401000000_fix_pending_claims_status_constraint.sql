-- Migration: 20260401000000_fix_pending_claims_status_constraint.sql
-- Description: Updates the pending_claims status check constraint to include all required statuses used in the application logic.

ALTER TABLE public.pending_claims 
DROP CONSTRAINT IF EXISTS pending_claims_status_check;

ALTER TABLE public.pending_claims 
ADD CONSTRAINT pending_claims_status_check 
CHECK (status IN ('locked', 'awaiting_approval', 'approved', 'rejected', 'released'));

-- Re-sync any claims that might have been stuck or missed due to the constraint
-- (Optional, but safe to ensure consistency)
COMMENT ON CONSTRAINT pending_claims_status_check ON public.pending_claims IS 'Allows statuses: locked, awaiting_approval, approved, rejected, released';
