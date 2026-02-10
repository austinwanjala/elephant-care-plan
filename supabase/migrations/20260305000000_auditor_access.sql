-- Grant Auditor role read access to business tables
-- Migration: 20260305000000_auditor_access.sql

-- Helper macro for concise policy creation
-- Note: We can't use macros in standard SQL migrations easy without setup, so we'll just write them out.

-- 1. Members
DROP POLICY IF EXISTS "Auditors view members" ON public.members;
CREATE POLICY "Auditors view members" ON public.members
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'auditor'::app_role));

-- 2. Visits
DROP POLICY IF EXISTS "Auditors view visits" ON public.visits;
CREATE POLICY "Auditors view visits" ON public.visits
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'auditor'::app_role));

-- 3. Payments (Member Contributions)
DROP POLICY IF EXISTS "Auditors view payments" ON public.payments;
CREATE POLICY "Auditors view payments" ON public.payments
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'auditor'::app_role));

-- 4. Marketer Claims
DROP POLICY IF EXISTS "Auditors view marketer claims" ON public.marketer_claims;
CREATE POLICY "Auditors view marketer claims" ON public.marketer_claims
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'auditor'::app_role));

-- 5. Revenue Claims (Branch Payouts)
DROP POLICY IF EXISTS "Auditors view revenue claims" ON public.revenue_claims;
CREATE POLICY "Auditors view revenue claims" ON public.revenue_claims
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'auditor'::app_role));

-- 6. Branches
DROP POLICY IF EXISTS "Auditors view branches" ON public.branches;
CREATE POLICY "Auditors view branches" ON public.branches
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'auditor'::app_role));

-- 7. Branch Revenue
DROP POLICY IF EXISTS "Auditors view branch revenue" ON public.branch_revenue;
CREATE POLICY "Auditors view branch revenue" ON public.branch_revenue
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'auditor'::app_role));

-- 8. Bills
DROP POLICY IF EXISTS "Auditors view bills" ON public.bills;
CREATE POLICY "Auditors view bills" ON public.bills
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'auditor'::app_role));

-- 9. Bill Items
DROP POLICY IF EXISTS "Auditors view bill items" ON public.bill_items;
CREATE POLICY "Auditors view bill items" ON public.bill_items
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'auditor'::app_role));

-- 10. Staff (to see who approved what)
DROP POLICY IF EXISTS "Auditors view staff" ON public.staff;
CREATE POLICY "Auditors view staff" ON public.staff
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'auditor'::app_role));
