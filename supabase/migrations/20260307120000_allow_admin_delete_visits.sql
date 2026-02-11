-- Allow Super Admins to DELETE visits
-- This is required because previous policies only granted SELECT access to Super Admins
-- and the 'Staff view visits' policy (FOR ALL) did not include 'super_admin' role.

CREATE POLICY "Super Admins delete visits" ON public.visits
FOR DELETE
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- Also ensure 'admin' role has explicit delete if needed, though they were covered by 'Staff view visits' FOR ALL.
-- Adding it explicitly for clarity/redundancy doesn't hurt but 'FOR ALL' covers it.
-- We will just stick to fixing the Super Admin gap.
