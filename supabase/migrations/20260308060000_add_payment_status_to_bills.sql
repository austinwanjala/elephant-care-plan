-- Add payment_status column to bills table
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
