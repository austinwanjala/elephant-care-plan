-- Migration: 20260308150000_unlock_claims_trigger.sql
-- Description: Unlocks pending claims when a service_stage is marked as completed

CREATE OR REPLACE FUNCTION public.handle_stage_completion()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if the stage is now completed (and wasn't before)
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        
        -- If it's a multi-stage service, check if we reached the final stage
        -- (OR rely on the fact that frontend/backend sets status='completed' only at the end)
        -- We will trust status='completed' as the signal.

        -- Update the associated pending claim
        IF NEW.pending_claim_id IS NOT NULL THEN
            UPDATE public.pending_claims
            SET 
                released_to_director = TRUE,
                status = 'awaiting_approval',
                updated_at = now()
            WHERE id = NEW.pending_claim_id;
        END IF;

        -- Fallback: If no direct link, try to find by service/member/locked status
        -- (This is less precise, better to rely on pending_claim_id)
    END IF;
    RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS on_stage_completed ON public.service_stages;

CREATE TRIGGER on_stage_completed
AFTER UPDATE ON public.service_stages
FOR EACH ROW
EXECUTE FUNCTION public.handle_stage_completion();
