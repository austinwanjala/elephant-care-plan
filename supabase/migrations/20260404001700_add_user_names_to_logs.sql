-- Add actor_name to logging tables
ALTER TABLE public.system_logs ADD COLUMN IF NOT EXISTS actor_name TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_name TEXT;

-- Create a function to automatically fetch and set the actor_name based on user_id
CREATE OR REPLACE FUNCTION public.populate_log_actor_name()
RETURNS TRIGGER AS $$
DECLARE
    v_name TEXT;
BEGIN
    IF NEW.user_id IS NOT NULL AND NEW.actor_name IS NULL THEN
        -- Check staff table first
        SELECT full_name INTO v_name FROM public.staff WHERE user_id = NEW.user_id LIMIT 1;
        
        -- If not found, check members table
        IF v_name IS NULL THEN
            SELECT full_name INTO v_name FROM public.members WHERE user_id = NEW.user_id LIMIT 1;
        END IF;

        -- Fallback to system for special system-level jobs if needed, but leaving null is fine if no match
        NEW.actor_name := COALESCE(v_name, 'System User');
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for system_logs
DROP TRIGGER IF EXISTS tr_populate_system_logs_actor ON public.system_logs;
CREATE TRIGGER tr_populate_system_logs_actor
BEFORE INSERT ON public.system_logs
FOR EACH ROW
EXECUTE FUNCTION public.populate_log_actor_name();

-- Create trigger for audit_logs
DROP TRIGGER IF EXISTS tr_populate_audit_logs_actor ON public.audit_logs;
CREATE TRIGGER tr_populate_audit_logs_actor
BEFORE INSERT ON public.audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.populate_log_actor_name();

-- Optionally update existing records (can take time on large tables, but usually fine for simple apps)
UPDATE public.system_logs SET actor_name = (
    SELECT COALESCE(
        (SELECT full_name FROM public.staff WHERE user_id = public.system_logs.user_id LIMIT 1),
        (SELECT full_name FROM public.members WHERE user_id = public.system_logs.user_id LIMIT 1),
        'System User'
    )
) WHERE user_id IS NOT NULL AND actor_name IS NULL;
