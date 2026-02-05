-- Fix RLS to allow receptionists to view other staff (doctors) in their branch

-- Drop existing policies if they conflict (safeguard)
DROP POLICY IF EXISTS "Staff can view colleagues in their branch." ON public.staff;
DROP POLICY IF EXISTS "Staff can view user roles." ON public.user_roles;

-- Update staff policies to allow viewing colleagues in the same branch
CREATE POLICY "Staff can view colleagues in their branch."
ON public.staff
FOR SELECT
USING (
  branch_id IN (
    SELECT branch_id FROM public.staff WHERE user_id = auth.uid()
  )
);

-- Ensure user_roles is readable by staff so they can filter by 'doctor' role
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view user roles."
ON public.user_roles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.staff WHERE user_id = auth.uid()
  )
);
