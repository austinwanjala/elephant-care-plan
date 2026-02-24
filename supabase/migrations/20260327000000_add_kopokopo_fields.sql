-- Add KopoKopo fields to payments table
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS kopo_resource_id TEXT,
ADD COLUMN IF NOT EXISTS payment_channel TEXT DEFAULT 'M-PESA STK Push',
ADD COLUMN IF NOT EXISTS kopokopo_metadata JSONB,
ADD COLUMN IF NOT EXISTS reference TEXT;

-- Create index for faster lookups during callbacks
CREATE INDEX IF NOT EXISTS idx_payments_kopo_resource_id ON public.payments(kopo_resource_id);

-- Add unique constraint to mpesa_checkout_request_id if not exists
-- This helps prevent duplicate payments if needed, but we may want to keep it flexible
