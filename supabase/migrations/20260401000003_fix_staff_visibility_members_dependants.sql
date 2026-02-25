-- Migration: 20260401000003_fix_staff_visibility_members_dependants.sql
-- Description: Updates RLS policies to allow staff members to view all members and dependants, 
-- ensuring that patients can visit any branch and can be found by staff regardless of their registered branch.

-- 1. Update members visibility for staff
-- Drop the restrictive branch-specific policy if it exists
DROP POLICY IF EXISTS "Staff can view members in their branch." ON public.members;

-- Add a more flexible policy allowing all staff to view all members
CREATE POLICY "Staff can view all members" ON public.members
FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- 2. Update dependants visibility for staff
DROP POLICY IF EXISTS "Staff can view all dependants" ON public.dependants;
CREATE POLICY "Staff can view all dependants" ON public.dependants
FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
);
