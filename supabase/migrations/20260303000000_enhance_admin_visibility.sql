-- Grant Admin (and Super Admin) full read access to medical records globally

-- 1. Visits
DROP POLICY IF EXISTS "Admins view all visits" ON public.visits;
-- Ensure we drop the Super Admin one from previous migration if we want to combine them, 
-- OR just make a new one that covers 'admin' specifically (which is inclusive of super_admin usually if we treat them hierarchically, but here we use checking both).
-- Actually, the previous migration made "Super Admins view all visits".
-- This one adds "Admins view all visits".
-- It is cleaner to have separate policies or one combined. 
-- Let's add a comprehensive "Management view all visits" policy.

DROP POLICY IF EXISTS "Management view all visits" ON public.visits;
CREATE POLICY "Management view all visits" ON public.visits
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- 2. Dental Records
DROP POLICY IF EXISTS "Management view all dental_records" ON public.dental_records;
CREATE POLICY "Management view all dental_records" ON public.dental_records
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- 3. Bills
DROP POLICY IF EXISTS "Management view all bills" ON public.bills;
CREATE POLICY "Management view all bills" ON public.bills
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- 4. Bill Items
DROP POLICY IF EXISTS "Management view all bill_items" ON public.bill_items;
CREATE POLICY "Management view all bill_items" ON public.bill_items
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- 5. Marketers (Admins should see all)
DROP POLICY IF EXISTS "Management view all marketers" ON public.marketers;
CREATE POLICY "Management view all marketers" ON public.marketers
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- 6. Clean up intersection policies if needed
-- (The previous Super Admin policies might be redundant now if this covers both, but having both is harmless usually, though ideally we consolidate).
-- I'll leave the previous ones as they are specific to Super Admin in the 20260302... file. 
-- These new ones grant access to 'admin' (and explicitly 'super_admin' again just to be safe).

