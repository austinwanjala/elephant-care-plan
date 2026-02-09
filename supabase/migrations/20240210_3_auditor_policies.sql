-- Auditor Policy Helper
-- We repeat this check for clarity and independence of policies
-- Policy: Auditors can view audit logs
CREATE POLICY "Auditors view audit logs" ON public.audit_logs
FOR SELECT TO authenticated
USING (
  exists (
    select 1 from public.user_roles 
    where user_roles.user_id = auth.uid() 
    and user_roles.role = 'auditor'::public.app_role
  )
);

-- Grant Auditor Read Access to Critical Tables

-- Members
CREATE POLICY "Auditors view members" ON public.members
FOR SELECT TO authenticated
USING (
  exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'auditor'::public.app_role)
);

-- Dependants
CREATE POLICY "Auditors view dependants" ON public.dependants
FOR SELECT TO authenticated
USING (
  exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'auditor'::public.app_role)
);

-- Visits
CREATE POLICY "Auditors view visits" ON public.visits
FOR SELECT TO authenticated
USING (
  exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'auditor'::public.app_role)
);

-- Bills
CREATE POLICY "Auditors view bills" ON public.bills
FOR SELECT TO authenticated
USING (
  exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'auditor'::public.app_role)
);

-- Bill Items
CREATE POLICY "Auditors view bill_items" ON public.bill_items
FOR SELECT TO authenticated
USING (
  exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'auditor'::public.app_role)
);

-- Staff
CREATE POLICY "Auditors view staff" ON public.staff
FOR SELECT TO authenticated
USING (
  exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'auditor'::public.app_role)
);

-- Branches
CREATE POLICY "Auditors view branches" ON public.branches
FOR SELECT TO authenticated
USING (
  exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'auditor'::public.app_role)
);

-- Branch Payments
CREATE POLICY "Auditors view branch_payments" ON public.branch_payments
FOR SELECT TO authenticated
USING (
  exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'auditor'::public.app_role)
);

-- Branch Revenue
CREATE POLICY "Auditors view branch_revenue" ON public.branch_revenue
FOR SELECT TO authenticated
USING (
  exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'auditor'::public.app_role)
);

-- Marketers
CREATE POLICY "Auditors view marketers" ON public.marketers
FOR SELECT TO authenticated
USING (
  exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'auditor'::public.app_role)
);

-- Marketer Commissions
CREATE POLICY "Auditors view marketer_commissions" ON public.marketer_commissions
FOR SELECT TO authenticated
USING (
  exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'auditor'::public.app_role)
);

-- Marketer Claims
CREATE POLICY "Auditors view marketer_claims" ON public.marketer_claims
FOR SELECT TO authenticated
USING (
  exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'auditor'::public.app_role)
);

-- User Roles
CREATE POLICY "Auditors view user_roles" ON public.user_roles
FOR SELECT TO authenticated
USING (
  exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'auditor'::public.app_role)
);

-- Payments
CREATE POLICY "Auditors view payments" ON public.payments
FOR SELECT TO authenticated
USING (
  exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'auditor'::public.app_role)
);
