-- Migration: 20260308000000_add_dependant_id_to_dental_records.sql
-- Description: Adds dependant_id to dental records tables to separate dependant history.

ALTER TABLE public.dental_records
ADD COLUMN IF NOT EXISTS dependant_id UUID REFERENCES public.dependants(id) ON DELETE CASCADE;

ALTER TABLE public.dental_chart_records
ADD COLUMN IF NOT EXISTS dependant_id UUID REFERENCES public.dependants(id) ON DELETE CASCADE;

-- Validation ensure either member_id OR dependant_id is present (or both if we want to query by family, but usually one is the patient).
-- Actually, member_id is NN in dental_records currently. We keep it as the "Account Holder".
-- But we need to distinguish patient.

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_dental_records_dependant ON public.dental_records(dependant_id);
CREATE INDEX IF NOT EXISTS idx_dental_chart_records_dependant ON public.dental_chart_records(dependant_id);

-- RLS Updates (optional if policy uses member_id which is still present)
-- Existing polices usually check if auth.uid() is the member_id owner. 
-- For dependants, member_id is still the parent, so strictly speaking existing RLS might work for "viewing", 
-- but we need to ensure "viewing specific dependant" logic works.

-- No changes to RLS needed if we continue to set member_id to the principal.
-- We just add dependant_id for filtering.
