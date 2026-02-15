-- Migration: 20260308200000_appointment_permissions.sql
-- Purpose: Create specific 'appointments' permissions and assign to Receptionists.

-- 1. Create Permissions
INSERT INTO public.permissions (resource, action, description)
VALUES 
    ('appointments', 'view', 'View appointments'),
    ('appointments', 'create', 'Book new appointments'),
    ('appointments', 'manage', 'Approve, reject, or reschedule appointments')
ON CONFLICT (resource, action) DO NOTHING;

-- 2. Assign Permissions to Roles

-- Admin (All)
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin'::app_role, id FROM public.permissions WHERE resource = 'appointments'
ON CONFLICT (role, permission_id) DO NOTHING;

-- Super Admin (via implicit logic, but explicit helps)
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'super_admin'::app_role, id FROM public.permissions WHERE resource = 'appointments'
ON CONFLICT (role, permission_id) DO NOTHING;

-- Receptionist (All - View, Create, Manage)
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'receptionist'::app_role, id FROM public.permissions WHERE resource = 'appointments'
ON CONFLICT (role, permission_id) DO NOTHING;

-- Doctor (View only)
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'doctor'::app_role, id FROM public.permissions WHERE resource = 'appointments' AND action = 'view'
ON CONFLICT (role, permission_id) DO NOTHING;

-- Director (View only)
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'branch_director'::app_role, id FROM public.permissions WHERE resource = 'appointments' AND action = 'view'
ON CONFLICT (role, permission_id) DO NOTHING;

-- 3. Update RLS Policies for Appointments
-- Drop old policies that might be using 'visits' permissions
DROP POLICY IF EXISTS "rbac_view_appointments" ON public.appointments;
DROP POLICY IF EXISTS "rbac_manage_appointments" ON public.appointments;

-- Create new robust policies
CREATE POLICY "rbac_view_appointments" ON public.appointments FOR SELECT TO authenticated USING (
  has_permission(auth.uid(), 'appointments', 'view')
);

CREATE POLICY "rbac_create_appointments" ON public.appointments FOR INSERT TO authenticated WITH CHECK (
  has_permission(auth.uid(), 'appointments', 'create')
);

CREATE POLICY "rbac_update_appointments" ON public.appointments FOR UPDATE TO authenticated USING (
  has_permission(auth.uid(), 'appointments', 'manage')
  OR
  -- Allow editing own appointments? Usually staff don't edit own unless reception.
  -- Let's stick to strict permissions. 
  -- Maybe 'create' allows editing pending ones? No, keep it simple.
  -- Add exception: Doctors might need to update status to 'completed' via visits, 
  -- but that's usually done on 'visits' table.
  -- However, if 'appointments' status tracks visited state, doctors might need it.
  -- For now, Receptionist manages appointment state.
  has_permission(auth.uid(), 'appointments', 'manage')
);

CREATE POLICY "rbac_delete_appointments" ON public.appointments FOR DELETE TO authenticated USING (
  has_permission(auth.uid(), 'appointments', 'manage')
);
