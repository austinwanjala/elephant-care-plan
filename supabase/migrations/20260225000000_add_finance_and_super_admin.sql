-- Update app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'finance';

-- Add image_url to dependants
ALTER TABLE public.dependants ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Update existing 'admin' roles to 'super_admin' for a clean transition
UPDATE public.user_roles SET role = 'super_admin' WHERE role = 'admin';

-- Ensure RLS for dependants allows reading by staff/finance
CREATE POLICY "Staff and Finance can view dependants" ON public.dependants
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('super_admin', 'admin', 'receptionist', 'doctor', 'branch_director', 'finance')
  )
);