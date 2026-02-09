-- Grant Admins and Super Admins access to audit_logs

-- Policy: Admins view audit logs
CREATE POLICY "Admins view audit logs" ON public.audit_logs
FOR SELECT TO authenticated
USING (
  exists (
    select 1 from public.user_roles 
    where user_roles.user_id = auth.uid() 
    and user_roles.role IN ('admin'::public.app_role, 'super_admin'::public.app_role)
  )
);

-- Policy: Admins/System can insert audit logs (if not already covered)
-- We previously added "System/Admins can insert audit logs" with CHECK (true) 
-- but that might be too broad if not careful. 
-- Ideally we want specific roles.
-- But for now, let's ensure they can SELECT.

-- Check if we need to drop previous broad insert policy if it exists?
-- No, let's just ensure SELECT access for now to fix the visibility issue.
