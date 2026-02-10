-- Migration: 20260303010000_robust_has_role.sql

-- 1. Create the new robust text-based function FIRST
CREATE OR REPLACE FUNCTION public.has_role_text(_user_id UUID, _role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
        AND role::text = _role
    );
END;
$$;

-- 2. Update the existing ENUM-based function to use the new logic
-- This preserves the signature so existing policies don't need to be dropped
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.has_role_text(_user_id, _role::text);
END;
$$;

-- 3. Create/Replace the overload for TEXT input that points to the same logic
-- This handles cases where we pass a string literal 'super_admin' that Postgres treats as text
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.has_role_text(_user_id, _role);
END;
$$;

-- 4. Recreate the policy for role_permissions using the TEXT overload specifically
-- We drop and recreate just this one to be sure it binds to the text version
DROP POLICY IF EXISTS "Super Admins can manage role permissions" ON public.role_permissions;

CREATE POLICY "Super Admins can manage role permissions" ON public.role_permissions
    FOR ALL
    USING (public.has_role(auth.uid(), 'super_admin'::text));
