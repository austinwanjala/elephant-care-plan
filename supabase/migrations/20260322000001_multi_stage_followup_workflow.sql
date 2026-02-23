-- Migration: 20260322000001_multi_stage_followup_workflow.sql
-- Description: Adds doctor_notes column, DB trigger for auto-releasing pending claims
--              on final stage completion, and helper function for fetching active stages.

-- 1. Add doctor_notes column to service_stages (if not exists)
ALTER TABLE public.service_stages
    ADD COLUMN IF NOT EXISTS doctor_notes TEXT;

-- 2. Create or replace the trigger function that auto-releases pending_claims
--    when service_stages.status changes to 'completed'
CREATE OR REPLACE FUNCTION public.release_pending_claim_on_stage_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only act when status transitions to 'completed'
    IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
        -- Release the pending claim linked to this stage
        UPDATE public.pending_claims
        SET 
            status = 'awaiting_approval',
            released_to_director = TRUE,
            updated_at = now()
        WHERE id = NEW.pending_claim_id
          AND released_to_director = FALSE;

        -- Also unlock the related bill for director review
        IF NEW.related_bill_id IS NOT NULL THEN
            UPDATE public.bills
            SET is_claimable = TRUE
            WHERE id = NEW.related_bill_id
              AND is_claimable = FALSE;
        END IF;

        -- Audit log
        INSERT INTO public.system_logs (action, details)
        VALUES (
            'multi_stage_service_completed',
            jsonb_build_object(
                'service_stage_id', NEW.id,
                'service_id', NEW.service_id,
                'member_id', NEW.member_id,
                'tooth_number', NEW.tooth_number,
                'current_stage', NEW.current_stage,
                'total_stages', NEW.total_stages,
                'pending_claim_id', NEW.pending_claim_id,
                'related_bill_id', NEW.related_bill_id,
                'completed_at', now()
            )
        );
    END IF;
    RETURN NEW;
END;
$$;

-- Drop trigger if exists and re-create
DROP TRIGGER IF EXISTS trg_release_claim_on_stage_complete ON public.service_stages;
CREATE TRIGGER trg_release_claim_on_stage_complete
    AFTER UPDATE ON public.service_stages
    FOR EACH ROW
    EXECUTE FUNCTION public.release_pending_claim_on_stage_complete();

-- 3. Create a function to fetch active (in_progress) stages for a patient
--    Used by doctor portal on visit load to detect ongoing treatments
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
    updated_at TIMESTAMPTZ
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
        ss.updated_at
    FROM public.service_stages ss
    JOIN public.services s ON s.id = ss.service_id
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

-- 4. Ensure system_logs has a user_id nullable column (for trigger inserts without user context)
ALTER TABLE public.system_logs
    ALTER COLUMN user_id DROP NOT NULL;
