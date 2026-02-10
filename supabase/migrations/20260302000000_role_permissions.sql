-- Role-based Permissions System
-- Migration: 20260302000000_role_permissions.sql

DO $$
BEGIN
    -- 1. Create permissions table
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'permissions') THEN
        CREATE TABLE public.permissions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            resource TEXT NOT NULL, -- e.g., 'members', 'financials'
            action TEXT NOT NULL,   -- e.g., 'view', 'create', 'edit', 'delete'
            description TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            UNIQUE(resource, action)
        );
    END IF;

    -- 2. Create role_permissions table
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'role_permissions') THEN
        CREATE TABLE public.role_permissions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            role public.app_role NOT NULL,
            permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            UNIQUE(role, permission_id)
        );
    END IF;

    -- 3. Enable RLS
    ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

    -- 4. Policies for permissions/role_permissions (Super Admin only for editing, Everyone for viewing if needed by app logic)
    -- Ideally, only admins manage this. Applications usually check permissions server-side or via secure functions.
    
    DROP POLICY IF EXISTS "Admins can view permissions" ON public.permissions;
    CREATE POLICY "Admins can view permissions" ON public.permissions
    FOR SELECT TO authenticated
    USING (true); -- Allow all authenticated users to load permissions (needed for UI logic)

    DROP POLICY IF EXISTS "Super Admins can manage permissions" ON public.permissions;
    CREATE POLICY "Super Admins can manage permissions" ON public.permissions
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'super_admin'));

    DROP POLICY IF EXISTS "Admins can view role_permissions" ON public.role_permissions;
    CREATE POLICY "Admins can view role_permissions" ON public.role_permissions
    FOR SELECT TO authenticated
    USING (true);

    DROP POLICY IF EXISTS "Super Admins can manage role_permissions" ON public.role_permissions;
    CREATE POLICY "Super Admins can manage role_permissions" ON public.role_permissions
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'super_admin'));

END $$;

-- 5. Helper Function: has_permission()
-- Checks if a user has a specific permission based on their assigned role
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _resource TEXT, _action TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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

-- 6. Seed Default Permissions (Idempotent)
INSERT INTO public.permissions (resource, action, description)
VALUES 
    -- Members
    ('members', 'view', 'View member profiles'),
    ('members', 'create', 'Register new members'),
    ('members', 'edit', 'Edit member details'),
    ('members', 'delete', 'Delete members'),
    -- Financials
    ('financials', 'view', 'View financial reports'),
    ('financials', 'manage', 'Approve/Pay claims'),
    -- Staff
    ('staff', 'view', 'View staff list'),
    ('staff', 'manage', 'Create/Edit staff'),
    -- Visits
    ('visits', 'view', 'View patient visits'),
    ('visits', 'create', 'Register new visits'),
    ('visits', 'edit', 'Update visit details'),
    -- Claims
    ('claims', 'view', 'View marketer/branch claims'),
    ('claims', 'approve', 'Approve claims (Director)'),
    ('claims', 'pay', 'Pay claims (Finance)'),
    -- System
    ('audit_logs', 'view', 'View system audit logs'),
    ('settings', 'manage', 'Manage system settings')
ON CONFLICT (resource, action) DO NOTHING;

-- 7. Seed Default Role Assignments
DO $$
DECLARE
    -- Roles
    r_admin public.app_role := 'admin';
    r_super_admin public.app_role := 'super_admin';
    r_doctor public.app_role := 'doctor';
    r_receptionist public.app_role := 'receptionist';
    r_finance public.app_role := 'finance';
    r_auditor public.app_role := 'auditor';
    r_director public.app_role := 'branch_director';
    r_marketer public.app_role := 'marketer';
    
    v_perm_id UUID;
BEGIN
    -- Helper to assign permission
    -- Using a temp function or just repetitive blocks for clarity in DO block
    
    -- SUPER ADMIN: Everything (handled by policy usually, but let's be explicit in UI)
    FOR v_perm_id IN SELECT id FROM public.permissions LOOP
        INSERT INTO public.role_permissions (role, permission_id) VALUES (r_super_admin, v_perm_id) ON CONFLICT DO NOTHING;
    END LOOP;

    -- ADMIN: Most things except pure finance paying maybe? Let's give all for now matching current 'admin' power
    FOR v_perm_id IN SELECT id FROM public.permissions WHERE resource != 'financials' LOOP
         INSERT INTO public.role_permissions (role, permission_id) VALUES (r_admin, v_perm_id) ON CONFLICT DO NOTHING;
    END LOOP;
    -- Admin can view financials
    INSERT INTO public.role_permissions (role, permission_id) 
    SELECT r_admin, id FROM public.permissions WHERE resource = 'financials' AND action = 'view'
    ON CONFLICT DO NOTHING;

    -- DOCTOR: Visits (view/edit own), Members (view), Dental Records
    INSERT INTO public.role_permissions (role, permission_id)
    SELECT r_doctor, id FROM public.permissions 
    WHERE (resource = 'visits' AND action IN ('view', 'edit'))
       OR (resource = 'members' AND action = 'view')
    ON CONFLICT DO NOTHING;

    -- RECEPTIONIST: Visits (create/view), Members (create/view/edit), Claims (view?)
    INSERT INTO public.role_permissions (role, permission_id)
    SELECT r_receptionist, id FROM public.permissions 
    WHERE (resource = 'visits' AND action IN ('view', 'create'))
       OR (resource = 'members' AND action IN ('view', 'create', 'edit'))
    ON CONFLICT DO NOTHING;

    -- FINANCE: Financials, Claims (pay)
    INSERT INTO public.role_permissions (role, permission_id)
    SELECT r_finance, id FROM public.permissions 
    WHERE resource = 'financials'
       OR (resource = 'claims' AND action IN ('view', 'pay'))
    ON CONFLICT DO NOTHING;

    -- AUDITOR: Logs, Financials (view), Visits (view)
    INSERT INTO public.role_permissions (role, permission_id)
    SELECT r_auditor, id FROM public.permissions 
    WHERE (resource = 'audit_logs')
       OR (resource = 'financials' AND action = 'view')
       OR (resource = 'visits' AND action = 'view')
    ON CONFLICT DO NOTHING;

    -- DIRECTOR: Claims (approve), Staff (view), Financials (view branch)
    INSERT INTO public.role_permissions (role, permission_id)
    SELECT r_director, id FROM public.permissions 
    WHERE (resource = 'claims' AND action IN ('view', 'approve'))
       OR (resource = 'staff' AND action = 'view')
       OR (resource = 'financials' AND action = 'view')
    ON CONFLICT DO NOTHING;

END $$;
