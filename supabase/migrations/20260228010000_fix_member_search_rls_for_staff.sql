-- Migration: 20260228010000_fix_member_search_rls_for_staff.sql
-- Purpose: Fix "no member found" for receptionist and doctor searches.
--
-- ROOT CAUSE: The `rbac_view_members` policy on `members` relies on the
-- `has_permission()` function which reads `role_permissions`. If that table
-- is missing rows for a role (e.g. due to seed timing), ALL queries return
-- nothing — silently looking like "member not found".
--
-- FIX: Replace the RBAC policy with a direct role-check policy that cannot
-- be broken by missing seed data. This is simpler, faster, and more reliable.
-- We also ensure the permissions + role_permissions are correctly seeded as a
-- secondary measure.

-- ─── 1. Fix the members table RLS ────────────────────────────────────────────

-- Drop all known SELECT policies on members (clean slate)
DROP POLICY IF EXISTS "rbac_view_members"                      ON public.members;
DROP POLICY IF EXISTS "Staff can view all members."            ON public.members;
DROP POLICY IF EXISTS "Staff can view members in their branch." ON public.members;
DROP POLICY IF EXISTS "Members can view own profile"           ON public.members;
DROP POLICY IF EXISTS "Members can view their own profile."    ON public.members;
DROP POLICY IF EXISTS "members_self_read"                      ON public.members;
DROP POLICY IF EXISTS "Marketers can view basic info of their referred members." ON public.members;

-- Create a single, clear SELECT policy that covers all legitimate roles
CREATE POLICY "staff_and_member_view_members"
ON public.members
FOR SELECT
TO authenticated
USING (
  -- Members can see their own profile
  auth.uid() = user_id
  OR
  -- All staff roles can search/view all members
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN (
        'admin',
        'receptionist',
        'doctor',
        'branch_director',
        'finance',
        'auditor',
        'super_admin'
      )
  )
  OR
  -- Marketers can see their referred members
  EXISTS (
    SELECT 1 FROM public.marketers
    WHERE user_id = auth.uid()
      AND id = public.members.marketer_id
  )
);

-- ─── 2. Fix the dependants table RLS (same issue affects dependant search) ───

DROP POLICY IF EXISTS "Staff view all dependants" ON public.dependants;

CREATE POLICY "staff_view_all_dependants"
ON public.dependants
FOR SELECT
TO authenticated
USING (
  -- The principal member can see their own dependants
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = member_id AND m.user_id = auth.uid()
  )
  OR
  -- All clinical/admin staff can view dependants
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN (
        'admin',
        'receptionist',
        'doctor',
        'branch_director',
        'finance',
        'auditor',
        'super_admin'
      )
  )
);

-- ─── 3. Re-seed permissions table (idempotent) ───────────────────────────────

INSERT INTO public.permissions (resource, action, description)
VALUES
  ('dashboard',    'view',    'View the dashboard'),
  ('members',      'view',    'View member profiles'),
  ('members',      'create',  'Register new members'),
  ('members',      'edit',    'Edit member details'),
  ('members',      'delete',  'Delete/Deactivate members'),
  ('staff',        'view',    'View staff directory'),
  ('staff',        'manage',  'Create and edit staff accounts'),
  ('visits',       'view',    'View visits'),
  ('visits',       'create',  'Create new visits'),
  ('visits',       'process', 'Process medical/dental details'),
  ('financials',   'view',    'View billing and claims'),
  ('financials',   'create',  'Initiate billing records'),
  ('financials',   'manage',  'Approve claims and process payments'),
  ('system_logs',  'view',    'View system logs'),
  ('audit_logs',   'view',    'View audit logs'),
  ('settings',     'manage',  'Manage system settings'),
  ('appointments', 'view',    'View appointments'),
  ('appointments', 'create',  'Create appointments'),
  ('appointments', 'manage',  'Manage appointments')
ON CONFLICT (resource, action) DO NOTHING;

-- ─── 4. Re-seed role_permissions for all roles (idempotent) ─────────────────

-- ADMIN: all permissions
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin'::public.app_role, id FROM public.permissions
ON CONFLICT (role, permission_id) DO NOTHING;

-- SUPER_ADMIN: all permissions
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'super_admin'::public.app_role, id FROM public.permissions
ON CONFLICT (role, permission_id) DO NOTHING;

-- RECEPTIONIST
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'receptionist'::public.app_role, p.id
FROM public.permissions p
WHERE (p.resource = 'dashboard'    AND p.action = 'view')
   OR (p.resource = 'members'      AND p.action IN ('view', 'create', 'edit'))
   OR (p.resource = 'visits'       AND p.action IN ('view', 'create'))
   OR (p.resource = 'financials'   AND p.action IN ('view', 'create'))
   OR (p.resource = 'appointments' AND p.action IN ('view', 'create'))
ON CONFLICT (role, permission_id) DO NOTHING;

-- DOCTOR
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'doctor'::public.app_role, p.id
FROM public.permissions p
WHERE (p.resource = 'dashboard'    AND p.action = 'view')
   OR (p.resource = 'members'      AND p.action = 'view')
   OR (p.resource = 'visits'       AND p.action IN ('view', 'process'))
   OR (p.resource = 'appointments' AND p.action IN ('view', 'create', 'manage'))
ON CONFLICT (role, permission_id) DO NOTHING;

-- BRANCH DIRECTOR
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'branch_director'::public.app_role, p.id
FROM public.permissions p
WHERE (p.resource = 'dashboard'  AND p.action = 'view')
   OR (p.resource = 'members'    AND p.action = 'view')
   OR (p.resource = 'staff'      AND p.action = 'view')
   OR (p.resource = 'visits'     AND p.action = 'view')
   OR (p.resource = 'financials' AND p.action = 'view')
ON CONFLICT (role, permission_id) DO NOTHING;

-- FINANCE
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'finance'::public.app_role, p.id
FROM public.permissions p
WHERE (p.resource = 'dashboard'  AND p.action = 'view')
   OR (p.resource = 'members'    AND p.action = 'view')
   OR (p.resource = 'financials' AND p.action IN ('view', 'manage', 'create'))
ON CONFLICT (role, permission_id) DO NOTHING;

-- AUDITOR
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'auditor'::public.app_role, p.id
FROM public.permissions p
WHERE (p.resource = 'dashboard'   AND p.action = 'view')
   OR (p.resource = 'system_logs' AND p.action = 'view')
   OR (p.resource = 'audit_logs'  AND p.action = 'view')
ON CONFLICT (role, permission_id) DO NOTHING;
