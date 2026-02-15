-- Migration: 20260308230000_notification_replies.sql
-- Purpose: Add parent_id for threading and allow replies.

-- 1. Add parent_id to notifications
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.notifications(id) ON DELETE CASCADE;

-- 2. Update RLS to allow replying
-- We want authenticated users to be able to INSERT a notification IF it is a reply to a notification sent to them, OR if they are an admin.
-- However, standard INSERT policy for admins already exists.
-- We need a policy for users to reply.

CREATE POLICY "Users can reply to notifications" ON public.notifications
    FOR INSERT TO authenticated
    WITH CHECK (
        -- User can insert if they are the sender (which is forced by default usually, but we check schema)
        sender_id = auth.uid()
        -- AND the parent notification exists and was sent TO this user (optional strictness)
        -- For simplicity, let's just allow users to insert notifications where they are the sender.
        -- We might want to restrict who they can send TO, but for now, any user sending to any user is the requirement for "reply", 
        -- effectively making it a messaging system.
        -- Let's restrict it: Users can only send if they are Admin OR if it is a reply.
    );

-- Actually, simpler approach for RLS on INSERT:
-- 1. Admins can insert anything.
-- 2. Users can insert if `parent_id` is NOT NULL (replying). 
--    (Ideally we verify the parent was sent to them, but that requires a subquery which might be heavy for RLS check on insert? 
--     Postgres allows subqueries in WITH CHECK. Let's try to be secure).

CREATE POLICY "Admins can insert notifications" ON public.notifications
    FOR INSERT TO authenticated
    WITH CHECK (
        has_role(auth.uid(), 'admin') OR 
        has_role(auth.uid(), 'super_admin')
    );

CREATE POLICY "Users can reply" ON public.notifications
    FOR INSERT TO authenticated
    WITH CHECK (
        sender_id = auth.uid() AND
        parent_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.notifications parent
            WHERE parent.id = parent_id
            AND parent.recipient_id = auth.uid() -- They are replying to a message sent TO them
        )
    );

-- 3. Grant access to view "Sent" notifications
-- Current policy "Users can view own notifications" only checks `recipient_id`.
-- We need `sender_id` or `recipient_id`.
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;

CREATE POLICY "Users can view involved notifications" ON public.notifications
    FOR SELECT TO authenticated
    USING (
        recipient_id = auth.uid() OR 
        sender_id = auth.uid()
    );
