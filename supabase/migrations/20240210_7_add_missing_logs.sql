-- Create SMS Logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.sms_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient_phone TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'sent', -- sent, failed, pending
    member_id UUID REFERENCES public.members(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

-- Create Biometric Logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.biometric_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    member_id UUID REFERENCES public.members(id),
    staff_id UUID REFERENCES public.staff(id),
    visitor_id UUID REFERENCES public.visits(id),
    scan_status TEXT NOT NULL, -- success, failed
    device_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

-- Enable RLS
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biometric_logs ENABLE ROW LEVEL SECURITY;

-- Policies for Auditor (Read-only)
CREATE POLICY "Auditors can view all sms logs" ON public.sms_logs
    FOR SELECT
    TO authenticated
    USING (public.is_auditor());

CREATE POLICY "Auditors can view all biometric logs" ON public.biometric_logs
    FOR SELECT
    TO authenticated
    USING (public.is_auditor());

-- Grant access to admin/staff as needed (simplified for now to ensure Auditor access)
-- Assuming public.is_admin() or similar exists, but adding basic auth read for now to prevent lockout if needed, 
-- or stick to strict roles. 

-- Let's ensure Admins can also view
CREATE POLICY "Admins can view all sms logs" ON public.sms_logs
    FOR SELECT
    TO authenticated
    USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'super_admin')));

CREATE POLICY "Admins can view all biometric logs" ON public.biometric_logs
    FOR SELECT
    TO authenticated
    USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'super_admin')));
