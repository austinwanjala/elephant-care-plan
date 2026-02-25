-- Migration: 20260401000002_fix_portal_messages_update_policy.sql
-- Description: Adds missing UPDATE policy for portal_messages to allow recipients to mark messages as read.

-- 1. Add UPDATE policy for portal_messages
DROP POLICY IF EXISTS "Staff can update own messages (mark as read)" ON public.portal_messages;
CREATE POLICY "Staff can update own messages (mark as read)" ON public.portal_messages
FOR UPDATE TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND id = recipient_id)
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND id = recipient_id)
);

-- 2. Ensure admins/super_admins can also update if needed (e.g. for maintenance)
CREATE POLICY "Admins can update portal messages" ON public.portal_messages
FOR UPDATE TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
);
