-- Migration: 20260310000000_whatsapp_setup.sql
-- Description: Sets up WhatsApp logs and member opt-in column.

-- 1. Add WhatsApp opt-in to members table
ALTER TABLE public.members 
ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN DEFAULT FALSE;

-- 2. Create whatsapp_logs table
CREATE TABLE IF NOT EXISTS public.whatsapp_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES public.members(id),
    type TEXT NOT NULL, -- e.g. 'member_welcome', 'payment_confirmation', etc.
    phone TEXT NOT NULL,
    template_name TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, delivered, read, failed
    error_message TEXT,
    meta_payload JSONB, -- store full API response or webhook event
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexing for performance and lookup
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_member_id ON public.whatsapp_logs(member_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_phone ON public.whatsapp_logs(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_status ON public.whatsapp_logs(status);

-- Enable RLS
ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (staff/admin) to select logs
CREATE POLICY "Allow read access for authenticated staff" 
ON public.whatsapp_logs FOR SELECT 
TO authenticated 
USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'super_admin', 'auditor')
));

-- Allow service role to do everything
CREATE POLICY "Allow service role full access" 
ON public.whatsapp_logs FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);
