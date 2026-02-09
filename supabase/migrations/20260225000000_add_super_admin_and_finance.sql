Finance Payment workflow.">
-- 1. Add new roles to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'finance';

-- 2. Add image_url to dependants
ALTER TABLE public.dependants ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 3. Update revenue_claims for Approval workflow
ALTER TABLE public.revenue_claims ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.revenue_claims ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.staff(id);
ALTER TABLE public.revenue_claims ADD COLUMN IF NOT EXISTS finance_paid_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.revenue_claims ADD COLUMN IF NOT EXISTS finance_paid_by UUID REFERENCES public.staff(id);

-- 4. Update marketer_claims for Approval workflow
ALTER TABLE public.marketer_claims ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.marketer_claims ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.staff(id);
ALTER TABLE public.marketer_claims ADD COLUMN IF NOT EXISTS finance_paid_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.marketer_claims ADD COLUMN IF NOT EXISTS finance_paid_by UUID REFERENCES public.staff(id);

-- 5. Update RLS for Finance and Super Admin
-- Note: Existing policies using has_role(auth.uid(), 'admin') will need to be updated or new ones added.
-- For brevity, we'll ensure basic access here.

CREATE POLICY "Finance can view all claims" ON public.revenue_claims
FOR SELECT TO authenticated USING (has_role(auth.uid(), 'finance') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Finance can view all marketer claims" ON public.marketer_claims
FOR SELECT TO authenticated USING (has_role(auth.uid(), 'finance') OR has_role(auth.uid(), 'super_admin'));