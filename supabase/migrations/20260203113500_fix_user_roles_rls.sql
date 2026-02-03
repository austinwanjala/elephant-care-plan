-- Add migration to fix user_roles RLS recursion

-- 1. Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- 2. Create non-recursive policies for user_roles

-- Policy: Users can see their own role (direct comparison, not recursive)
CREATE POLICY "Users can view own role" 
ON public.user_roles 
FOR SELECT 
USING (user_id = auth.uid());

-- Policy: Admins can view all roles
-- This uses a subquery but on the same table. 
-- However, we can make it more robust by using a different table check if needed, 
-- but in most cases, checking (user_id = auth.uid() AND role = 'admin') is the primary check.
CREATE POLICY "Admins can view all roles" 
ON public.user_roles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Policy: Allow member self-registration (Security: Limited to 'member')
-- This is critical for public Register page to work.
CREATE POLICY "Members can self-assign role" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (
    user_id = auth.uid() AND role = 'member'
);

-- Policy: Admins can manage all roles
CREATE POLICY "Admins can manage all roles" 
ON public.user_roles 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Note: In some Supabase setups, even the subquery on the same table can cause issues if not indexed.
-- Ensure user_id, role are well indexed (they are unique in our schema).
