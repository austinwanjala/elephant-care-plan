-- Allow Auditor to view revenue claims and marketer claims

DROP POLICY IF EXISTS "Auditors can view revenue claims" ON public.revenue_claims;
CREATE POLICY "Auditors can view revenue claims" ON public.revenue_claims
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'auditor'::public.app_role)
);

DROP POLICY IF EXISTS "Auditors can view marketer claims" ON public.marketer_claims;
CREATE POLICY "Auditors can view marketer claims" ON public.marketer_claims
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'auditor'::public.app_role)
);
