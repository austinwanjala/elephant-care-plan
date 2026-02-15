-- Migration: 20260308220000_notifications_module.sql
-- Purpose: Create notifications system for broadcast and targeted messages.

-- 1. Create Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Null means broadcast? Or should we use explicit rows? Explicit rows better for read status.
    -- Let's stick to explicit recipient_id. For broadcasts, we insert multiple rows.
    sender_id UUID REFERENCES auth.users(id),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info', -- info, warning, success, etc.
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies

-- Recipients can view their own notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT TO authenticated
    USING (recipient_id = auth.uid());

-- Recipients can update 'is_read' status
CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE TO authenticated
    USING (recipient_id = auth.uid())
    WITH CHECK (recipient_id = auth.uid());

-- Admins can view and create notifications (and delete if needed)
CREATE POLICY "Admins can manage notifications" ON public.notifications
    FOR ALL TO authenticated
    USING (
        has_role(auth.uid(), 'admin') OR 
        has_role(auth.uid(), 'super_admin')
    );

-- 4. Function to Broadcast Notification
-- Useful for admins to send to "All Doctors" etc without fetching all IDs on client
CREATE OR REPLACE FUNCTION public.send_broadcast_notification(
    p_title TEXT,
    p_message TEXT,
    p_role public.app_role DEFAULT NULL -- If null, send to everyone? Or require role.
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INT := 0;
BEGIN
    -- If role is specified, send to users with that role
    IF p_role IS NOT NULL THEN
        INSERT INTO public.notifications (recipient_id, sender_id, title, message, type)
        SELECT user_id, auth.uid(), p_title, p_message, 'info'
        FROM public.user_roles
        WHERE role = p_role;
        
        GET DIAGNOSTICS v_count = ROW_COUNT;
    ELSE
        -- Send to ALL users
        INSERT INTO public.notifications (recipient_id, sender_id, title, message, type)
        SELECT id, auth.uid(), p_title, p_message, 'info'
        FROM auth.users; -- Note: accessing auth.users directly might need permissions.
        -- Ideally join with public.members/staff to be safe and cleaner?
        -- System is designed with public.user_roles as the source of truth for "active" users.
        
        -- Let's use user_roles to get all active users provided they have a role.
        INSERT INTO public.notifications (recipient_id, sender_id, title, message, type)
        SELECT DISTINCT user_id, auth.uid(), p_title, p_message, 'info'
        FROM public.user_roles;
        
        GET DIAGNOSTICS v_count = ROW_COUNT;
    END IF;

    RETURN v_count;
END;
$$;

-- 5. Grant Execute
GRANT EXECUTE ON FUNCTION public.send_broadcast_notification(TEXT, TEXT, public.app_role) TO authenticated;
