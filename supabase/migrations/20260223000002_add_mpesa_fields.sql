-- Add M-Pesa specific text fields to payments table
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS mpesa_checkout_request_id TEXT,
ADD COLUMN IF NOT EXISTS mpesa_merchant_request_id TEXT,
ADD COLUMN IF NOT EXISTS mpesa_result_code INTEGER,
ADD COLUMN IF NOT EXISTS mpesa_result_desc TEXT;

-- Create index for faster lookups during callbacks
CREATE INDEX IF NOT EXISTS idx_payments_checkout_req_id ON public.payments(mpesa_checkout_request_id);
