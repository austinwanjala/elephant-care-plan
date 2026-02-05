-- Fix RLS to allow receptionists to view other staff (doctors) in their branch
-- CRITICAL: Includes "Read Own Role" policy to ensure Login does not break.

-- 1. Update staff policies to allow viewing colleagues in the same branch
-- First drop existing if needed to avoid conflict
DROP POLICY IF EXISTS "Staff can view colleagues in their branch." ON public.staff;

CREATE POLICY "Staff can view colleagues in their branch."
ON public.staff
FOR SELECT
USING (
  branch_id IN (
    SELECT branch_id FROM public.staff WHERE user_id = auth.uid()
  )
);

-- 2. Update user_roles RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- DROP existing policies to be safe/clean
DROP POLICY IF EXISTS "Users can read own role." ON public.user_roles;
DROP POLICY IF EXISTS "Staff can read user roles." ON public.user_roles;
DROP POLICY IF EXISTS "Staff can read roles of colleagues." ON public.user_roles;

-- Policy A: Read Own Role (REQUIRED FOR LOGIN)
CREATE POLICY "Users can read own role."
ON public.user_roles
FOR SELECT
USING (
  user_id = auth.uid()
);

-- Policy B: Staff can read roles (Required for Filtering Doctors)
-- We check if the current user is a staff member
CREATE POLICY "Staff can read user roles."
ON public.user_roles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.staff WHERE user_id = auth.uid()
  )
);
