-- Fix infinite recursion in user_roles policies

-- 1. Create a secure function to check for auditor role without triggering RLS recursively
CREATE OR REPLACE FUNCTION public.is_auditor()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER -- Bypass RLS
SET search_path = public -- Secure search path
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'auditor'::public.app_role
  );
$$;

-- 2. Drop potential recursive policies on user_roles
DROP POLICY IF EXISTS "Auditors view user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;
DROP POLICY IF EXISTS "Allow users to read own role" ON public.user_roles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.user_roles;

-- 3. Create clean policies
-- Allow users to read THEIR OWN role (Critical for login)
CREATE POLICY "Users can read own role" ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow Auditors to read ALL roles (For log name resolution)
-- Uses the SECURITY DEFINER function to avoid recursion
CREATE POLICY "Auditors can read all roles" ON public.user_roles
FOR SELECT
TO authenticated
USING (public.is_auditor());
