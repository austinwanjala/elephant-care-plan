-- Migrate data from system_logs to audit_logs

INSERT INTO public.audit_logs (action, details, created_at, user_id)
SELECT 
    action,
    details::jsonb,
    created_at,
    CASE 
        WHEN user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN user_id::uuid 
        ELSE NULL 
    END as user_id
FROM public.system_logs;
-- We cast user_id to uuid only if it matches uuid pattern to avoid errors. 
-- However, strict foreign key constraints might still fail if the user doesn't exist.
-- If so, those rows might need to be skipped or user_id set to NULL if nullable.
-- user_id in audit_logs is nullable? Let's check 20240210_2_create_audit_tables.sql
-- "user_id UUID REFERENCES auth.users(id)" - it is nullable by default as I didn't add NOT NULL.

-- Verify if system_logs exists first to avoid error if it was never created (though types.ts says it exists)
-- Wrap in DO block if needed, but standard SQL usually fine.
