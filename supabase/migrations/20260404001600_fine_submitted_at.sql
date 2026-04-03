ALTER TABLE public.branch_fines ADD COLUMN IF NOT EXISTS payment_submitted_at TIMESTAMP WITH TIME ZONE;
