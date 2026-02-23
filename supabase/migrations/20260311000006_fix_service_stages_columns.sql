-- Migration: 20260311000006_fix_service_stages_columns.sql
-- Description: Adds missing related_bill_id column to service_stages and ensures
--              proper updated_at tracking for the Ongoing Treatment Panel to work.

-- 1. Add related_bill_id so the doctor portal can link stages back to their originating bill
ALTER TABLE public.service_stages
    ADD COLUMN IF NOT EXISTS related_bill_id UUID REFERENCES public.bills(id) ON DELETE SET NULL;

-- 2. Ensure updated_at column exists (needed for ordering in Member Dashboard)
ALTER TABLE public.service_stages
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- 3. Create a trigger to auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION public.update_service_stages_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_service_stages_updated_at ON public.service_stages;
CREATE TRIGGER set_service_stages_updated_at
    BEFORE UPDATE ON public.service_stages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_service_stages_updated_at();
