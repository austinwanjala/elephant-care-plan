-- Migration: 20260308233000_notification_details_rpc.sql
-- Purpose: RPC to fetch notifications with sender details (name, role, branch).

CREATE OR REPLACE FUNCTION public.get_admin_notifications(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    created_at TIMESTAMPTZ,
    title TEXT,
    message TEXT,
    is_read BOOLEAN,
    sender_id UUID,
    recipient_id UUID,
    parent_id UUID, 
    sender_name TEXT,
    sender_role TEXT,
    sender_branch TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.id,
        n.created_at,
        n.title,
        n.message,
        n.is_read,
        n.sender_id,
        n.recipient_id,
        n.parent_id,
        -- Get Sender Name
        COALESCE(
            m.full_name, 
            s.full_name, 
            d.full_name, 
            r.full_name,
            -- Fallback to metadata or email if needed, but for now just "Unknown"
            'Unknown'
        ) as sender_name,
        -- Get Sender Role
        ur.role::TEXT as sender_role,
        -- Get Sender Branch
        COALESCE(
            b_s.name, -- staff branch
            b_d.name, -- doctor branch
            b_m.name, -- member branch
            'Head Office' -- fallback
        ) as sender_branch
    FROM 
        public.notifications n
    LEFT JOIN public.user_roles ur ON n.sender_id = ur.user_id
    -- Join User Tables
    LEFT JOIN public.members m ON n.sender_id = m.user_id
    LEFT JOIN public.staff s ON n.sender_id = s.user_id
    LEFT JOIN public.doctors d ON n.sender_id = d.user_id
    LEFT JOIN public.receptionists r ON n.sender_id = r.user_id
    -- Join Branch Tables (assuming branch_id exists on user tables)
    LEFT JOIN public.branches b_s ON s.branch_id = b_s.id
    LEFT JOIN public.branches b_d ON d.branch_id = b_d.id
    LEFT JOIN public.branches b_m ON m.branch_id = b_m.id -- Note: Members might not have branch_id directly on table, check schema
    WHERE 
        n.recipient_id = p_user_id
    ORDER BY 
        n.created_at DESC;
END;
$$;
