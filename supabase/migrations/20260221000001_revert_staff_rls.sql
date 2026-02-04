-- Revert the changes from 20260221000000_fix_staff_rls.sql

-- Drop the policies that allowed global/branch visibility
DROP POLICY IF EXISTS "Staff can view colleagues in their branch." ON public.staff;
DROP POLICY IF EXISTS "Staff can view user roles." ON public.user_roles;
