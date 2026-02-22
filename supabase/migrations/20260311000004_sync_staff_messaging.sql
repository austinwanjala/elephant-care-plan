-- Migration: 20260311000004_sync_staff_messaging.sql
-- Description: Syncs all staff-related roles into the staff table to ensure they are visible in messaging

-- Sync ALL internal roles to the staff table
-- This handles users created before the staff injection was added to handle_new_user
INSERT INTO public.staff (user_id, full_name, email, phone, role, is_active)
SELECT 
    ur.user_id, 
    COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', 'Staff Member'), 
    au.email, 
    au.raw_user_meta_data->>'phone', 
    ur.role::text, 
    TRUE
FROM public.user_roles ur
JOIN auth.users au ON ur.user_id = au.id
WHERE ur.role IN ('admin', 'super_admin', 'finance', 'auditor', 'marketer', 'doctor', 'receptionist', 'branch_director')
AND NOT EXISTS (
    SELECT 1 FROM public.staff s WHERE s.user_id = ur.user_id
);

-- Ensure the role column is up to date for existing staff records
UPDATE public.staff s
SET role = ur.role::text
FROM public.user_roles ur
WHERE s.user_id = ur.user_id
AND (s.role IS NULL OR s.role = '');

-- Final check: Ensure RLS is still correct (should be from previous migrations, but good to reinforce)
DROP POLICY IF EXISTS "Staff visibility" ON public.staff;
CREATE POLICY "Staff visibility"
ON public.staff
FOR SELECT
USING (
  user_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'super_admin', 'receptionist', 'doctor', 'branch_director', 'finance', 'auditor', 'marketer')
  )
);
