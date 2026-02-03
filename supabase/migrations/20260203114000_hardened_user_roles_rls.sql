-- Clean up and apply robust RLS for user_roles
-- This uses the has_role security definer function to avoid infinite recursion

DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Members can self-assign role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;

-- 1. Users can always see their own role
CREATE POLICY "user_roles_select_own" ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 2. Admins can see all roles 
-- We use has_role function which is SECURITY DEFINER (bypasses RLS)
CREATE POLICY "user_roles_select_admin" ON public.user_roles
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3. Admins can insert/update/delete any roles
CREATE POLICY "user_roles_admin_all" ON public.user_roles
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. Enable members to self-register (only to 'member' role)
-- This allows the Register page to work for new users
CREATE POLICY "user_roles_member_insert" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND role = 'member');
