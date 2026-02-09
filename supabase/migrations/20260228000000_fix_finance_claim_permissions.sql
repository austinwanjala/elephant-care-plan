-- Allow Finance and Super Admin to update revenue claims (to mark as paid)
CREATE POLICY "Finance and Super Admin can update revenue claims" ON public.revenue_claims
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'finance'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Allow Finance and Super Admin to update marketer claims (to mark as paid)
CREATE POLICY "Finance and Super Admin can update marketer claims" ON public.marketer_claims
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'finance'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Ensure Super Admin has full access to everything (safety net)
CREATE POLICY "Super Admin full access on revenue_claims" ON public.revenue_claims
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super Admin full access on marketer_claims" ON public.marketer_claims
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));