ALTER TABLE public.branch_fines ADD COLUMN payment_amount_submitted NUMERIC;
ALTER TABLE public.branch_fines ADD COLUMN payment_reason TEXT;
ALTER TABLE public.branch_fines ADD COLUMN mpesa_reference TEXT;
