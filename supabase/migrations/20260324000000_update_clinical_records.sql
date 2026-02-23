-- Migration: 20260324000000_update_clinical_records.sql
-- Description: Updates periodontal status options and adds a specific table for patient X-rays.

-- 1. Update periodontal status options in visits table
-- First, drop the old constraint
ALTER TABLE public.visits 
DROP CONSTRAINT IF EXISTS visits_periodontal_status_check;

-- Add the new constraint including 'gingivitis'
ALTER TABLE public.visits
ADD CONSTRAINT visits_periodontal_status_check 
CHECK (periodontal_status IN ('staining', 'calculus', 'periodontitis', 'gingivitis'));

-- 2. Create patient_xrays table for more structured storage
CREATE TABLE IF NOT EXISTS public.patient_xrays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
    visit_id UUID REFERENCES public.visits(id) ON DELETE CASCADE,
    diagnosis_id UUID, -- Optional: for linking to specific diagnosis records if any
    image_url TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Enable RLS for patient_xrays
ALTER TABLE public.patient_xrays ENABLE ROW LEVEL SECURITY;

-- 4. Policies for patient_xrays
CREATE POLICY "Admins can view all X-Rays" ON public.patient_xrays
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Doctors can view and upload X-Rays" ON public.patient_xrays
FOR SELECT USING (EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND role = 'doctor'));

CREATE POLICY "Doctors can upload X-Rays" ON public.patient_xrays
FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND role = 'doctor'));

-- Note: Members should NOT see X-rays in their portal, so no policy for members.

-- 5. Add index for performance
CREATE INDEX IF NOT EXISTS idx_patient_xrays_member ON public.patient_xrays(member_id);
CREATE INDEX IF NOT EXISTS idx_patient_xrays_visit ON public.patient_xrays(visit_id);
