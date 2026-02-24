-- Migration: 20260328000000_add_mpesa_code_column.sql
-- Add explicit mpesa_code column as requested

ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS mpesa_code TEXT;

-- Create index for the new column
CREATE INDEX IF NOT EXISTS idx_payments_mpesa_code ON public.payments(mpesa_code);

-- Update RLS if necessary (usually public.payments already has roles)
