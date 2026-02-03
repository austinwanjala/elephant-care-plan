-- Migration to fix member search RLS and logic
-- Purpose: Allow all staff roles to search and view all members regardless of branch.

-- 1. Drop the restrictive branch-based policy if it exists
DROP POLICY IF EXISTS "Staff can view members in their branch." ON public.members;

-- 2. Create a new policy that allows all staff roles (receptionist, doctor, branch_director, admin)
-- to view all members. This is necessary for lookup and history purposes across branches.
CREATE POLICY "Staff can view all members." 
ON public.members 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('receptionist', 'doctor', 'branch_director', 'admin')
  )
);

-- 3. Ensure branch directors can also view members (already covered above, but being explicit if needed)
-- Note: The logic in user_roles policy already allows them to see their role.
