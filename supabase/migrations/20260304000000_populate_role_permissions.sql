-- Role-based Permissions System
-- Migration: 20260304000000_populate_role_permissions.sql

-- 1. Create permissions table
CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource TEXT NOT NULL, -- e.g., 'members', 'financials'
    action TEXT NOT NULL,   -- e.g., 'view', 'create', 'edit', 'delete'
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(resource, action)
);

-- 2. Create role_permissions table
CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role public.app_role NOT NULL,
    permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(role, permission_id)
);

-- 3. Enable RLS
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- 4. Policies
-- Allow all authenticated users to read permissions (needed for UI)
DROP POLICY IF EXISTS "Authenticated users can view permissions" ON public.permissions;
CREATE POLICY "Authenticated users can view permissions" ON public.permissions
FOR SELECT TO authenticated
USING (true);

-- Allow Admins and Super Admins to manage permissions
DROP POLICY IF EXISTS "Management can manage permissions" ON public.permissions;
CREATE POLICY "Management can manage permissions" ON public.permissions
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

DROP POLICY IF EXISTS "Authenticated users can view role_permissions" ON public.role_permissions;
CREATE POLICY "Authenticated users can view role_permissions" ON public.role_permissions
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Management can manage role_permissions" ON public.role_permissions;
CREATE POLICY "Management can manage role_permissions" ON public.role_permissions
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- 5. Helper Function: has_permission()
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _resource TEXT, _action TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Super Admin bypass (Optional but good for fallback)
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin') THEN
        RETURN TRUE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.role_permissions rp ON ur.role = rp.role
        JOIN public.permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = _user_id
        AND p.resource = _resource
        AND p.action = _action
    );
END;
$$;

-- 6. Seed Default Permissions
INSERT INTO public.permissions (resource, action, description)
VALUES 
    -- Dashboard
    ('dashboard', 'view', 'View the dashboard'),
    
    -- Members
    ('members', 'view', 'View member profiles'),
    ('members', 'create', 'Register new members'),
    ('members', 'edit', 'Edit member details'),
    ('members', 'delete', 'Delete/Deactivate members'),
    
    -- Staff
    ('staff', 'view', 'View staff directory'),
    ('staff', 'manage', 'Create and edit staff accounts'),
    
    -- Visits
    ('visits', 'view', 'View visits'),
    ('visits', 'create', 'Create new visits'),
    ('visits', 'process', 'Process medical/dental details'),
    
    -- Financials
    ('financials', 'view', 'View billing and claims'),
    ('financials', 'manage', 'Approve claims and process payments'),
    
    -- System
    ('system_logs', 'view', 'View system logs'),
    ('audit_logs', 'view', 'View audit logs'),
    ('settings', 'manage', 'Manage system settings')
ON CONFLICT (resource, action) DO NOTHING;

-- 7. Seed Default Role Assignments
DO $$
DECLARE
    -- Roles
    r_admin public.app_role := 'admin';
    r_receptionist public.app_role := 'receptionist';
    r_doctor public.app_role := 'doctor';
    r_finance public.app_role := 'finance';
    r_auditor public.app_role := 'auditor';
    r_marketer public.app_role := 'marketer';
    r_director public.app_role := 'branch_director';
    -- permission id variable
    p_id UUID;
BEGIN
    -- Helper to insert if permission exists
    -- Usage: perform assign_perm(role, resource, action);
    
    -- ADMINISTRATIVE ROLE
    FOR p_id IN SELECT id FROM public.permissions LOOP
        INSERT INTO public.role_permissions (role, permission_id) VALUES (r_admin, p_id) ON CONFLICT DO NOTHING;
    END LOOP;

    -- RECEPTIONIST ROLE
    INSERT INTO public.role_permissions (role, permission_id)
    SELECT r_receptionist, id FROM public.permissions WHERE resource = 'dashboard' AND action = 'view'
    UNION ALL SELECT r_receptionist, id FROM public.permissions WHERE resource = 'members' AND action IN ('view', 'create', 'edit')
    UNION ALL SELECT r_receptionist, id FROM public.permissions WHERE resource = 'visits' AND action IN ('view', 'create')
    UNION ALL SELECT r_receptionist, id FROM public.permissions WHERE resource = 'financials' AND action = 'view' -- Billing view
    ON CONFLICT DO NOTHING;

    -- DOCTOR ROLE
    INSERT INTO public.role_permissions (role, permission_id)
    SELECT r_doctor, id FROM public.permissions WHERE resource = 'dashboard' AND action = 'view'
    UNION ALL SELECT r_doctor, id FROM public.permissions WHERE resource = 'members' AND action = 'view'
    UNION ALL SELECT r_doctor, id FROM public.permissions WHERE resource = 'visits' AND action IN ('view', 'process')
    ON CONFLICT DO NOTHING;

    -- FINANCE ROLE
    INSERT INTO public.role_permissions (role, permission_id)
    SELECT r_finance, id FROM public.permissions WHERE resource = 'dashboard' AND action = 'view'
    UNION ALL SELECT r_finance, id FROM public.permissions WHERE resource = 'financials' AND action IN ('view', 'manage')
    ON CONFLICT DO NOTHING;

    -- AUDITOR ROLE
    INSERT INTO public.role_permissions (role, permission_id)
    SELECT r_auditor, id FROM public.permissions WHERE resource = 'dashboard' AND action = 'view'
    UNION ALL SELECT r_auditor, id FROM public.permissions WHERE resource = 'system_logs' AND action = 'view'
    UNION ALL SELECT r_auditor, id FROM public.permissions WHERE resource = 'audit_logs' AND action = 'view'
    ON CONFLICT DO NOTHING;

    -- MARKETER ROLE
    INSERT INTO public.role_permissions (role, permission_id)
    SELECT r_marketer, id FROM public.permissions WHERE resource = 'dashboard' AND action = 'view'
    ON CONFLICT DO NOTHING;
    
    -- BRANCH DIRECTOR ROLE
    INSERT INTO public.role_permissions (role, permission_id)
    SELECT r_director, id FROM public.permissions WHERE resource = 'dashboard' AND action = 'view'
    UNION ALL SELECT r_director, id FROM public.permissions WHERE resource = 'members' AND action = 'view'
    UNION ALL SELECT r_director, id FROM public.permissions WHERE resource = 'staff' AND action = 'view'
    UNION ALL SELECT r_director, id FROM public.permissions WHERE resource = 'visits' AND action = 'view'
    UNION ALL SELECT r_director, id FROM public.permissions WHERE resource = 'financials' AND action = 'view'
    ON CONFLICT DO NOTHING;

END $$;
