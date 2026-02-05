-- Add dependant_id to visits table
ALTER TABLE public.visits
ADD COLUMN dependant_id UUID REFERENCES public.dependants(id);

-- Update RLS for dependants to allow Staff viewership
CREATE POLICY "Staff can view all dependants."
ON public.dependants
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.staff WHERE user_id = auth.uid()
  )
);
