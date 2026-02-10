-- Grant Super Admin (and ensure Admin) full read access to all relevant tables

-- 1. Members
DROP POLICY IF EXISTS "Super Admins view all members" ON public.members;
CREATE POLICY "Super Admins view all members" ON public.members
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 2. Staff
DROP POLICY IF EXISTS "Super Admins view all staff" ON public.staff;
CREATE POLICY "Super Admins view all staff" ON public.staff
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 3. Dependants
DROP POLICY IF EXISTS "Super Admins view all dependants" ON public.dependants;
CREATE POLICY "Super Admins view all dependants" ON public.dependants
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 4. Visits (Medical Record)
DROP POLICY IF EXISTS "Super Admins view all visits" ON public.visits;
CREATE POLICY "Super Admins view all visits" ON public.visits
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 5. Dental Records (Medical Record)
DROP POLICY IF EXISTS "Super Admins view all dental_records" ON public.dental_records;
CREATE POLICY "Super Admins view all dental_records" ON public.dental_records
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 6. Bills
DROP POLICY IF EXISTS "Super Admins view all bills" ON public.bills;
CREATE POLICY "Super Admins view all bills" ON public.bills
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 7. Bill Items
DROP POLICY IF EXISTS "Super Admins view all bill_items" ON public.bill_items;
CREATE POLICY "Super Admins view all bill_items" ON public.bill_items
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 8. Services (if exists, checking existence first to avoid error if I missed it, but likely exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'services') THEN
        DROP POLICY IF EXISTS "Super Admins view all services" ON public.services;
        CREATE POLICY "Super Admins view all services" ON public.services
        FOR SELECT TO authenticated
        USING (has_role(auth.uid(), 'super_admin'::app_role));
    END IF;
END
$$;

-- 9. Marketers
DROP POLICY IF EXISTS "Super Admins view all marketers" ON public.marketers;
CREATE POLICY "Super Admins view all marketers" ON public.marketers
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 10. Branches
DROP POLICY IF EXISTS "Super Admins view all branches" ON public.branches;
CREATE POLICY "Super Admins view all branches" ON public.branches
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 11. Branch Revenue
DROP POLICY IF EXISTS "Super Admins view all branch_revenue" ON public.branch_revenue;
CREATE POLICY "Super Admins view all branch_revenue" ON public.branch_revenue
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 12. Branch Payments
DROP POLICY IF EXISTS "Super Admins view all branch_payments" ON public.branch_payments;
CREATE POLICY "Super Admins view all branch_payments" ON public.branch_payments
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 13. Payments (Members)
DROP POLICY IF EXISTS "Super Admins view all payments" ON public.payments;
CREATE POLICY "Super Admins view all payments" ON public.payments
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Ensure User Roles visibility for Super Admin
DROP POLICY IF EXISTS "Super Admins view all user_roles" ON public.user_roles;
CREATE POLICY "Super Admins view all user_roles" ON public.user_roles
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));
