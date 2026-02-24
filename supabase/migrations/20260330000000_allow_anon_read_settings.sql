-- Allow anonymous users to read system settings for branding purposes
DROP POLICY IF EXISTS "allow_anon_read_settings" ON public.system_settings;
CREATE POLICY "allow_anon_read_settings" ON public.system_settings
FOR SELECT TO anon
USING (true);

-- Also ensure authenticated users can read them (this was already there but good to be explicit)
DROP POLICY IF EXISTS "authenticated_read_settings" ON public.system_settings;
CREATE POLICY "authenticated_read_settings" ON public.system_settings
FOR SELECT TO authenticated
USING (true);
