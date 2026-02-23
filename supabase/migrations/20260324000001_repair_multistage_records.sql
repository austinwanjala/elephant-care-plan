-- Migration: 20260324000001_repair_multistage_records.sql
-- Description: Ensures service_stages data consistency and numeric logic integrity.

-- 1. Repair total_stages in service_stages table
-- Some records might have been created with total_stages=1 because of a UI bug
-- when is_multi_stage boolean was not ticked but total_stages was > 1 in services.
UPDATE public.service_stages ss
SET total_stages = s.total_stages
FROM public.services s
WHERE ss.service_id = s.id
  AND ss.status = 'in_progress'
  AND ss.total_stages <> s.total_stages;

-- 2. Ensure current_stage is never null or zero
UPDATE public.service_stages
SET current_stage = 1
WHERE current_stage IS NULL OR current_stage < 1;

-- 3. Robust get_active_stages_for_patient to ensure we join correctly
DROP FUNCTION IF EXISTS public.get_active_stages_for_patient(UUID, UUID);

CREATE OR REPLACE FUNCTION public.get_active_stages_for_patient(
    p_member_id UUID,
    p_dependant_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    service_id UUID,
    service_name TEXT,
    member_id UUID,
    dependant_id UUID,
    tooth_number INTEGER,
    current_stage INTEGER,
    total_stages INTEGER,
    status TEXT,
    notes TEXT,
    doctor_notes TEXT,
    related_bill_id UUID,
    pending_claim_id UUID,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    service_stage_names JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ss.id,
        ss.service_id,
        s.name::TEXT AS service_name,
        ss.member_id,
        ss.dependant_id,
        ss.tooth_number,
        ss.current_stage,
        ss.total_stages,
        ss.status,
        ss.notes,
        ss.doctor_notes,
        ss.related_bill_id,
        ss.pending_claim_id,
        ss.created_at,
        ss.updated_at,
        s.stage_names AS service_stage_names
    FROM public.service_stages ss
    LEFT JOIN public.services s ON s.id = ss.service_id
    WHERE ss.member_id = p_member_id
      AND ss.status = 'in_progress'
      AND (
          (p_dependant_id IS NULL AND ss.dependant_id IS NULL)
          OR (p_dependant_id IS NOT NULL AND ss.dependant_id = p_dependant_id)
      )
    ORDER BY ss.updated_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_stages_for_patient TO authenticated;
