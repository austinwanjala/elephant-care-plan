-- Migration: 20260308180000_update_rls_to_use_permissions.sql
-- Purpose: Switch RLS policies from hardcoded roles to dynamic role_permissions checks.

-- ==============================================================================
-- 1. MEMBERS
-- ==============================================================================
-- Drop known legacy policies
DROP POLICY IF EXISTS "Staff can view all members." ON public.members;
DROP POLICY IF EXISTS "Staff can view members in their branch." ON public.members;
-- These might have different names, but dropping common ones helps cleanup.
-- Note: Policies are additive. If an old "Admins only" policy remains, these new policies will ADD access for others.

CREATE POLICY "rbac_view_members" ON public.members FOR SELECT TO authenticated USING (
  has_permission(auth.uid(), 'members', 'view')
);

CREATE POLICY "rbac_create_members" ON public.members FOR INSERT TO authenticated WITH CHECK (
  has_permission(auth.uid(), 'members', 'create')
);

CREATE POLICY "rbac_edit_members" ON public.members FOR UPDATE TO authenticated USING (
  has_permission(auth.uid(), 'members', 'edit')
);

CREATE POLICY "rbac_delete_members" ON public.members FOR DELETE TO authenticated USING (
  has_permission(auth.uid(), 'members', 'delete')
);

-- ==============================================================================
-- 2. STAFF
-- ==============================================================================
-- Drop known legacy policies
DROP POLICY IF EXISTS "Management view all staff" ON public.staff;

CREATE POLICY "rbac_view_staff" ON public.staff FOR SELECT TO authenticated USING (
  has_permission(auth.uid(), 'staff', 'view')
);

CREATE POLICY "rbac_manage_staff" ON public.staff FOR ALL TO authenticated USING (
  has_permission(auth.uid(), 'staff', 'manage')
);

-- ==============================================================================
-- 3. VISITS
-- ==============================================================================
DROP POLICY IF EXISTS "Management view all visits" ON public.visits;

CREATE POLICY "rbac_view_visits" ON public.visits FOR SELECT TO authenticated USING (
  has_permission(auth.uid(), 'visits', 'view')
);

CREATE POLICY "rbac_create_visits" ON public.visits FOR INSERT TO authenticated WITH CHECK (
  has_permission(auth.uid(), 'visits', 'create')
);

CREATE POLICY "rbac_process_visits" ON public.visits FOR UPDATE TO authenticated USING (
  has_permission(auth.uid(), 'visits', 'process')
);

-- Allow deletion by admins (special case often needed) or mapped to delete permission if exists
-- Assuming visits.delete logic might be separate or part of process. 
-- For now, let's allow 'visits.process' to update.

-- ==============================================================================
-- 4. FINANCIALS (Bills, Payments)
-- ==============================================================================
DROP POLICY IF EXISTS "Management view all bills" ON public.bills;

CREATE POLICY "rbac_view_bills" ON public.bills FOR SELECT TO authenticated USING (
  has_permission(auth.uid(), 'financials', 'view')
);

CREATE POLICY "rbac_manage_bills" ON public.bills FOR ALL TO authenticated USING (
  has_permission(auth.uid(), 'financials', 'manage')
);

-- ==============================================================================
-- 5. APPOINTMENTS
-- ==============================================================================
-- Mapping appointments to 'visits' resource for simplicity as they are pre-visits.

CREATE POLICY "rbac_view_appointments" ON public.appointments FOR SELECT TO authenticated USING (
  has_permission(auth.uid(), 'visits', 'view')
);

CREATE POLICY "rbac_manage_appointments" ON public.appointments FOR ALL TO authenticated USING (
  has_permission(auth.uid(), 'visits', 'create')
);

-- ==============================================================================
-- 6. SYSTEM LOGS & AUDIT LOGS
-- ==============================================================================
-- Ensure auditors can view logs
CREATE POLICY "rbac_view_system_logs" ON public.system_logs FOR SELECT TO authenticated USING (
  has_permission(auth.uid(), 'system_logs', 'view')
);

CREATE POLICY "rbac_view_audit_logs" ON public.audit_logs FOR SELECT TO authenticated USING (
  has_permission(auth.uid(), 'audit_logs', 'view')
);
