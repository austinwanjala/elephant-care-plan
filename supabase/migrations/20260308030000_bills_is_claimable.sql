-- Add is_claimable column to bills table
ALTER TABLE public.bills 
ADD COLUMN IF NOT EXISTS is_claimable BOOLEAN DEFAULT TRUE;

-- Update existing bills to be claimable (migration safety)
UPDATE public.bills SET is_claimable = TRUE WHERE is_claimable IS NULL;

-- Index for performance when filtering claimable bills
CREATE INDEX IF NOT EXISTS idx_bills_is_claimable ON public.bills(is_claimable);
