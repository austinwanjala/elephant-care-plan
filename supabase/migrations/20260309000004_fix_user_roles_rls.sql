-- Migration: 20260309000004_fix_user_roles_rls.sql
-- Description: Allow authenticated users to read user_roles.

-- Enable Row Level Security (should already be enabled, but good practice)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Drop existing read policy if it exists to avoid conflicts (optional, but safer)
DROP POLICY IF EXISTS "Allow authenticated to read user roles" ON public.user_roles;

-- Create policy to allow all authenticated users to read roles
-- detailed permission logic is handled by the application or specific RPCs.
-- Reading roles is generally needed for UI display.
CREATE POLICY "Allow authenticated to read user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (true);
