-- Enable Realtime for role_permissions and permissions
-- Migration: 20260305030000_enable_realtime_robust.sql

DO $$
BEGIN
    -- Ensure publication exists
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    -- Add role_permissions
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'role_permissions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.role_permissions;
    END IF;

    -- Add permissions
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'permissions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.permissions;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not update publication: %', SQLERRM;
END $$;
