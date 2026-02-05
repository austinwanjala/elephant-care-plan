-- Fix infinite recursion by using a security definer function for branch lookup

-- 1. Create a helper function to get the current user's branch ID
-- This runs as the table owner (SECURITY DEFINER), bypassing RLS on 'staff' to avoid recursion
CREATE OR REPLACE FUNCTION public.get_auth_user_branch_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT branch_id FROM public.staff WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 2. Update staff policy to use the non-recursive function
DROP POLICY IF EXISTS "Staff can view colleagues in their branch." ON public.staff;

CREATE POLICY "Staff can view colleagues in their branch."
ON public.staff
FOR SELECT
USING (
  branch_id = public.get_auth_user_branch_id()
);

-- 3. Update user_roles policy to use the helper (avoids querying staff table directly in policy)
DROP POLICY IF EXISTS "Staff can read user roles." ON public.user_roles;

CREATE POLICY "Staff can read user roles."
ON public.user_roles
FOR SELECT
USING (
  public.get_auth_user_branch_id() IS NOT NULL
);

-- 4. Update members policy (Optimization + Recursion safety)
DROP POLICY IF EXISTS "Staff can view members in their branch." ON public.members;

CREATE POLICY "Staff can view members in their branch."
ON public.members
FOR SELECT
USING (
  branch_id = public.get_auth_user_branch_id()
);
