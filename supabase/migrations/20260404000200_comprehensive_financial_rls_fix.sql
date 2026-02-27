-- Migration: 20260404000200_comprehensive_financial_rls_fix.sql
-- Purpose: Properly integrate payments into RBAC and grant receptionists necessary permissions.

-- 1. Grant receptionists the ability to initiate payments (financials.create)
DO $$
DECLARE
    p_id UUID;
BEGIN
    SELECT id INTO p_id FROM public.permissions WHERE resource = 'financials' AND action = 'create';
    
    -- If 'create' doesn't exist for financials, let's ensure it does (it was 'manage' and 'view' in previous seed)
    IF p_id IS NULL THEN
        INSERT INTO public.permissions (resource, action, description)
        VALUES ('financials', 'create', 'Initiate payments and STK pushes')
        ON CONFLICT (resource, action) DO NOTHING
        RETURNING id INTO p_id;
    END IF;

    -- Assign to receptionist
    IF p_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role, permission_id)
        VALUES ('receptionist', p_id)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- 2. Update Payments RLS to use RBAC
-- Drop all legacy policies first
DROP POLICY IF EXISTS "Members can view own payments" ON public.payments;
DROP POLICY IF EXISTS "Members can create payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can manage payments" ON public.payments;
DROP POLICY IF EXISTS "Staff can create payments for members" ON public.payments;

-- View Policy
CREATE POLICY "rbac_view_payments" ON public.payments FOR SELECT TO authenticated USING (
    member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()) -- Member view own
    OR public.has_permission(auth.uid(), 'financials', 'view')             -- Staff/Admin view
);

-- Create Policy
CREATE POLICY "rbac_create_payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (
    member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()) -- Member self-topup
    OR public.has_permission(auth.uid(), 'financials', 'create')           -- Receptionist/Staff initiate
);

-- Manage Policy
CREATE POLICY "rbac_manage_payments" ON public.payments FOR ALL TO authenticated USING (
    public.has_permission(auth.uid(), 'financials', 'manage')
);
