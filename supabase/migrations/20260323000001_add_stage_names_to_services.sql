-- Migration: 20260323000001_add_stage_names_to_services.sql
-- Description: Adds a stage_names column to the services table so admins can
--              label each stage of a multi-stage service (e.g., ["Consultation", "Extraction", "Review"]).
--              The doctor portal will display the name of the current stage during treatment.

ALTER TABLE public.services
    ADD COLUMN IF NOT EXISTS stage_names JSONB DEFAULT '[]'::jsonb;

-- Add a helpful comment
COMMENT ON COLUMN public.services.stage_names IS
    'Array of stage name strings for multi-stage services. e.g. ["Consultation","Procedure","Review"]. Length should equal total_stages.';
