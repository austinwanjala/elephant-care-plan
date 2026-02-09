-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "admins_manage_settings" ON public.system_settings;

-- Create a new policy that allows both admin and super_admin to manage settings
CREATE POLICY "admins_and_super_admins_manage_settings" ON public.system_settings
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Ensure authenticated users can still read settings (needed for frontend display)
DROP POLICY IF EXISTS "authenticated_read_settings" ON public.system_settings;
CREATE POLICY "authenticated_read_settings" ON public.system_settings
FOR SELECT TO authenticated
USING (true);