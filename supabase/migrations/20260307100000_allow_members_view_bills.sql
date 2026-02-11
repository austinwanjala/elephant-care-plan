-- Allow members to view their own bills ONLY if finalized
CREATE POLICY "Members view own bills" ON public.bills
FOR SELECT
USING (
  is_finalized = true AND
  visit_id IN (
    SELECT id FROM public.visits
    WHERE member_id IN (
      SELECT id FROM public.members WHERE user_id = auth.uid()
    )
  )
);

-- Allow members to view their own bill items ONLY if bill is finalized
CREATE POLICY "Members view own bill items" ON public.bill_items
FOR SELECT
USING (
  bill_id IN (
    SELECT id FROM public.bills
    WHERE is_finalized = true AND visit_id IN (
      SELECT id FROM public.visits
      WHERE member_id IN (
        SELECT id FROM public.members WHERE user_id = auth.uid()
      )
    )
  )
);
