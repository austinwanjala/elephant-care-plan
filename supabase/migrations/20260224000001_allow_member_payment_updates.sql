-- Allow members to update their own payment records (needed for test-mode auto-completion)
CREATE POLICY "Members can update own payments" ON public.payments
FOR UPDATE TO authenticated
USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()))
WITH CHECK (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));