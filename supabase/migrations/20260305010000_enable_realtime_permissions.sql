-- Enable Realtime for role_permissions and permissions
-- Migration: 20260305010000_enable_realtime_permissions.sql

-- We assume 'supabase_realtime' publication exists (standard in Supabase).
-- If not, this will fail, but we cannot create it inside a transaction block safely here.

ALTER PUBLICATION supabase_realtime ADD TABLE public.role_permissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.permissions;
