-- Create a secure function to check auditor role
-- This bypasses RLS to avoid recursion when querying user_roles
CREATE OR REPLACE FUNCTION public.is_auditor()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'auditor'::public.app_role
  );
$$;

-- Drop the recursive policy on user_roles
DROP POLICY IF EXISTS "Auditors view user_roles" ON public.user_roles;

-- Create the safe policy for user_roles
CREATE POLICY "Auditors view user_roles" ON public.user_roles
FOR SELECT TO authenticated
USING (
  public.is_auditor()
);

-- Update other policies to use the helper function (Cleaner and more performant)
-- We drop and recreate to ensure they use the new function

DROP POLICY IF EXISTS "Auditors view audit logs" ON public.audit_logs;
CREATE POLICY "Auditors view audit logs" ON public.audit_logs
FOR SELECT TO authenticated
USING ( public.is_auditor() );

DROP POLICY IF EXISTS "Auditors view members" ON public.members;
CREATE POLICY "Auditors view members" ON public.members
FOR SELECT TO authenticated
USING ( public.is_auditor() );

DROP POLICY IF EXISTS "Auditors view dependants" ON public.dependants;
CREATE POLICY "Auditors view dependants" ON public.dependants
FOR SELECT TO authenticated
USING ( public.is_auditor() );

DROP POLICY IF EXISTS "Auditors view visits" ON public.visits;
CREATE POLICY "Auditors view visits" ON public.visits
FOR SELECT TO authenticated
USING ( public.is_auditor() );

DROP POLICY IF EXISTS "Auditors view bills" ON public.bills;
CREATE POLICY "Auditors view bills" ON public.bills
FOR SELECT TO authenticated
USING ( public.is_auditor() );

DROP POLICY IF EXISTS "Auditors view bill_items" ON public.bill_items;
CREATE POLICY "Auditors view bill_items" ON public.bill_items
FOR SELECT TO authenticated
USING ( public.is_auditor() );

DROP POLICY IF EXISTS "Auditors view staff" ON public.staff;
CREATE POLICY "Auditors view staff" ON public.staff
FOR SELECT TO authenticated
USING ( public.is_auditor() );

DROP POLICY IF EXISTS "Auditors view branches" ON public.branches;
CREATE POLICY "Auditors view branches" ON public.branches
FOR SELECT TO authenticated
USING ( public.is_auditor() );

DROP POLICY IF EXISTS "Auditors view branch_payments" ON public.branch_payments;
CREATE POLICY "Auditors view branch_payments" ON public.branch_payments
FOR SELECT TO authenticated
USING ( public.is_auditor() );

DROP POLICY IF EXISTS "Auditors view branch_revenue" ON public.branch_revenue;
CREATE POLICY "Auditors view branch_revenue" ON public.branch_revenue
FOR SELECT TO authenticated
USING ( public.is_auditor() );

DROP POLICY IF EXISTS "Auditors view marketers" ON public.marketers;
CREATE POLICY "Auditors view marketers" ON public.marketers
FOR SELECT TO authenticated
USING ( public.is_auditor() );

DROP POLICY IF EXISTS "Auditors view marketer_commissions" ON public.marketer_commissions;
CREATE POLICY "Auditors view marketer_commissions" ON public.marketer_commissions
FOR SELECT TO authenticated
USING ( public.is_auditor() );

DROP POLICY IF EXISTS "Auditors view marketer_claims" ON public.marketer_claims;
CREATE POLICY "Auditors view marketer_claims" ON public.marketer_claims
FOR SELECT TO authenticated
USING ( public.is_auditor() );

-- Also creating a generic admin/super_admin/authed check might be good, 
-- but we focus on fixing the auditor issue here.
