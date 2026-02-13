-- Add related_bill_id to service_stages to track the initial payment
ALTER TABLE public.service_stages 
ADD COLUMN IF NOT EXISTS related_bill_id UUID REFERENCES public.bills(id);

-- Ensure is_claimable exists on bills (redundant safety check)
ALTER TABLE public.bills 
ADD COLUMN IF NOT EXISTS is_claimable BOOLEAN DEFAULT TRUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_service_stages_bill 
ON public.service_stages(related_bill_id);
