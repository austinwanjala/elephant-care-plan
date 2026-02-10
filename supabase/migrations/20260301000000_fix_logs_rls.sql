-- Fix RLS policies for audit_logs and system_logs using the secure has_role function

-- 1. Fix audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies likely causing recursion or insufficient access
DROP POLICY IF EXISTS "Auditors view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "System/Admins can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can insert logs" ON public.audit_logs;

-- Create new policies using has_role()

-- Admins and Super Admins can view all logs
CREATE POLICY "Admins view audit logs" ON public.audit_logs
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Auditors can view all logs
CREATE POLICY "Auditors view audit logs" ON public.audit_logs
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'auditor'::app_role)
);

-- Allow authenticated users to insert logs (needed for AuditTrail component)
CREATE POLICY "Authenticated insert audit logs" ON public.audit_logs
FOR INSERT TO authenticated
WITH CHECK (true);

-- 2. Fix system_logs (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'system_logs') THEN
        
        -- Drop existing policies
        DROP POLICY IF EXISTS "Admins can view all logs" ON public.system_logs;
        DROP POLICY IF EXISTS "Users can insert logs" ON public.system_logs;
        
        -- Admins and Super Admins
        CREATE POLICY "Admins view system logs" ON public.system_logs
        FOR SELECT TO authenticated
        USING (
          has_role(auth.uid(), 'admin'::app_role) OR 
          has_role(auth.uid(), 'super_admin'::app_role)
        );
        
        -- Auditors
        CREATE POLICY "Auditors view system logs" ON public.system_logs
        FOR SELECT TO authenticated
        USING (
          has_role(auth.uid(), 'auditor'::app_role)
        );
        
        -- Insert policy
        CREATE POLICY "Authenticated insert system logs" ON public.system_logs
        FOR INSERT TO authenticated
        WITH CHECK (true);
        
    END IF;
END
$$;
