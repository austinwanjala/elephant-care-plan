-- Migration: 20260306030000_enable_booking_rls.sql
-- Description: Updates RLS to allow members to view doctors and their own dependants for booking.

-- 1. Staff (Doctors) Visibility
-- Members need to see basic details of doctors to book appointments.
-- We'll allow authenticated users to view active staff who potentially have the doctor role.
-- (Or just all active staff to be safe for now, filtering is done in UI/Query)

DROP POLICY IF EXISTS "Authenticated users can view active staff" ON public.staff;

CREATE POLICY "Authenticated users can view active staff" ON public.staff
FOR SELECT
TO authenticated
USING (
    is_active = true
);

-- 2. Dependants Visibility
-- Members should see their own dependants.
-- Existing policies might cover this, but ensuring it here.

DROP POLICY IF EXISTS "Members can view own dependants" ON public.dependants;

CREATE POLICY "Members can view own dependants" ON public.dependants
FOR SELECT
TO authenticated
USING (
    member_id IN (
        SELECT id FROM public.members WHERE user_id = auth.uid()
    )
);

-- 3. User Roles Visibility
-- Frontend queries user_roles to filter staff by 'doctor'.
-- Members need to read user_roles to know who is a doctor.

DROP POLICY IF EXISTS "Authenticated users can view user roles" ON public.user_roles;

CREATE POLICY "Authenticated users can view user roles" ON public.user_roles
FOR SELECT
TO authenticated
USING (true); -- Or restrict to role='doctor' if sensitive, but role info is generally low risk here.
