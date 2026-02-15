-- Migration: 20260308170000_create_system_log_function.sql

-- 1. Create a helper function to insert logs (can be called manually if needed)
CREATE OR REPLACE FUNCTION public.log_system_activity(
    p_action TEXT,
    p_details JSONB,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.system_logs (action, details, user_id, created_at)
    VALUES (p_action, p_details, p_user_id, now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_system_activity(TEXT, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_system_activity(TEXT, JSONB, UUID) TO service_role;

-- 2. Create a generic trigger function to auto-log table changes
CREATE OR REPLACE FUNCTION public.auto_log_timestamped_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_action TEXT;
    v_details JSONB;
    v_user_id UUID;
    v_table_name TEXT := TG_TABLE_NAME;
BEGIN
    -- Try to get user_id from auth, fallback to null (system action)
    v_user_id := auth.uid();

    -- Determine Action based on Operation
    IF (TG_OP = 'INSERT') THEN
        v_action := 'CREATE_' || UPPER(TRIM(TRAILING 's' FROM v_table_name)); -- e.g. CREATE_VISIT
        v_details := row_to_json(NEW);
    ELSIF (TG_OP = 'UPDATE') THEN
        v_action := 'UPDATE_' || UPPER(TRIM(TRAILING 's' FROM v_table_name)); -- e.g. UPDATE_VISIT
        -- Only log changed columns to save space, but for simplicity log old/new diff?
        -- Let's log NEW state for critical fields or just full NEW row
        v_details := jsonb_build_object(
            'id', NEW.id,
            'changes', (to_jsonb(NEW) - to_jsonb(OLD))
        );
        
        -- Ignore empty updates (timestamps only)
        -- IF v_details->>'changes' = '{}' THEN RETURN NEW; END IF;
        
    ELSIF (TG_OP = 'DELETE') THEN
        v_action := 'DELETE_' || UPPER(TRIM(TRAILING 's' FROM v_table_name));
        v_details := row_to_json(OLD);
    END IF;

    -- Insert Log
    INSERT INTO public.system_logs (action, details, user_id)
    VALUES (v_action, v_details, v_user_id);

    RETURN NULL; -- Trigger result doesn't matter for AFTER trigger
END;
$$;

-- 3. Attach Triggers to Key Tables
-- Drop existing first to avoid conflicts if re-running
DROP TRIGGER IF EXISTS trg_log_visits ON public.visits;
CREATE TRIGGER trg_log_visits
AFTER INSERT OR UPDATE OR DELETE ON public.visits
FOR EACH ROW EXECUTE FUNCTION public.auto_log_timestamped_activity();

DROP TRIGGER IF EXISTS trg_log_bills ON public.bills;
CREATE TRIGGER trg_log_bills
AFTER INSERT OR UPDATE OR DELETE ON public.bills
FOR EACH ROW EXECUTE FUNCTION public.auto_log_timestamped_activity();

DROP TRIGGER IF EXISTS trg_log_members ON public.members;
CREATE TRIGGER trg_log_members
AFTER INSERT OR UPDATE OR DELETE ON public.members
FOR EACH ROW EXECUTE FUNCTION public.auto_log_timestamped_activity();

DROP TRIGGER IF EXISTS trg_log_payments ON public.payments;
CREATE TRIGGER trg_log_payments
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.auto_log_timestamped_activity();

DROP TRIGGER IF EXISTS trg_log_appointments ON public.appointments;
CREATE TRIGGER trg_log_appointments
AFTER INSERT OR UPDATE OR DELETE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.auto_log_timestamped_activity();
