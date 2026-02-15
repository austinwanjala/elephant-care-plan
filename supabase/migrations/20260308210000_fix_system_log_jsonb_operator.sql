-- Migration: 20260308210000_fix_system_log_jsonb_operator.sql
-- Purpose: Fix 'operator does not exist: jsonb - jsonb' error in auto_log_timestamped_activity function.

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
        v_action := 'CREATE_' || UPPER(TRIM(TRAILING 's' FROM v_table_name));
        v_details := row_to_json(NEW);
    ELSIF (TG_OP = 'UPDATE') THEN
        v_action := 'UPDATE_' || UPPER(TRIM(TRAILING 's' FROM v_table_name));
        -- Fix: Avoid using '-' operator on JSONB. 
        -- Instead, log both old and new states for clarity, or just NEW.
        -- Logging 'changes' properly requires a complex recursive function or extension.
        -- For robust logging, let's store both states.
        v_details := jsonb_build_object(
            'id', NEW.id,
            'old_state', to_jsonb(OLD),
            'new_state', to_jsonb(NEW)
        );
        
    ELSIF (TG_OP = 'DELETE') THEN
        v_action := 'DELETE_' || UPPER(TRIM(TRAILING 's' FROM v_table_name));
        v_details := row_to_json(OLD);
    END IF;

    -- Insert Log
    INSERT INTO public.system_logs (action, details, user_id)
    VALUES (v_action, v_details, v_user_id);

    RETURN NULL;
END;
$$;
