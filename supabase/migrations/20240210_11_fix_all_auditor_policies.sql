-- Standardize all Auditor policies to use the secure is_auditor() function
-- This avoids RLS recursion and ensures consistent access control

-- Branches
DROP POLICY IF EXISTS "Auditors view branches" ON public.branches;
CREATE POLICY "Auditors view branches" ON public.branches
FOR SELECT TO authenticated
USING (public.is_auditor());

-- Staff
DROP POLICY IF EXISTS "Auditors view staff" ON public.staff;
CREATE POLICY "Auditors view staff" ON public.staff
FOR SELECT TO authenticated
USING (public.is_auditor());

-- Members
DROP POLICY IF EXISTS "Auditors view members" ON public.members;
CREATE POLICY "Auditors view members" ON public.members
FOR SELECT TO authenticated
USING (public.is_auditor());

-- Dependants
DROP POLICY IF EXISTS "Auditors view dependants" ON public.dependants;
CREATE POLICY "Auditors view dependants" ON public.dependants
FOR SELECT TO authenticated
USING (public.is_auditor());

-- Visits
DROP POLICY IF EXISTS "Auditors view visits" ON public.visits;
CREATE POLICY "Auditors view visits" ON public.visits
FOR SELECT TO authenticated
USING (public.is_auditor());

-- Bills
DROP POLICY IF EXISTS "Auditors view bills" ON public.bills;
CREATE POLICY "Auditors view bills" ON public.bills
FOR SELECT TO authenticated
USING (public.is_auditor());

-- Bill Items
DROP POLICY IF EXISTS "Auditors view bill_items" ON public.bill_items;
CREATE POLICY "Auditors view bill_items" ON public.bill_items
FOR SELECT TO authenticated
USING (public.is_auditor());

-- Branch Payments
DROP POLICY IF EXISTS "Auditors view branch_payments" ON public.branch_payments;
CREATE POLICY "Auditors view branch_payments" ON public.branch_payments
FOR SELECT TO authenticated
USING (public.is_auditor());

-- Branch Revenue
DROP POLICY IF EXISTS "Auditors view branch_revenue" ON public.branch_revenue;
CREATE POLICY "Auditors view branch_revenue" ON public.branch_revenue
FOR SELECT TO authenticated
USING (public.is_auditor());

-- Marketers
DROP POLICY IF EXISTS "Auditors view marketers" ON public.marketers;
CREATE POLICY "Auditors view marketers" ON public.marketers
FOR SELECT TO authenticated
USING (public.is_auditor());

-- Marketer Commissions
DROP POLICY IF EXISTS "Auditors view marketer_commissions" ON public.marketer_commissions;
CREATE POLICY "Auditors view marketer_commissions" ON public.marketer_commissions
FOR SELECT TO authenticated
USING (public.is_auditor());

-- Marketer Claims
DROP POLICY IF EXISTS "Auditors view marketer_claims" ON public.marketer_claims;
CREATE POLICY "Auditors view marketer_claims" ON public.marketer_claims
FOR SELECT TO authenticated
USING (public.is_auditor());

-- Payments
DROP POLICY IF EXISTS "Auditors view payments" ON public.payments;
CREATE POLICY "Auditors view payments" ON public.payments
FOR SELECT TO authenticated
USING (public.is_auditor());
