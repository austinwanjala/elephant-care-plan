-- Migration: 20260329000000_enable_realtime_messaging.sql
-- Description: Enables Realtime for portal_messages table

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'portal_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.portal_messages;
    END IF;
END $$;
