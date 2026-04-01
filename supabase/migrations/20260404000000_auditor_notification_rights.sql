-- Allow auditors to send notifications to branch directors
-- Update RLS to allow auditors to insert notifications

DROP POLICY IF EXISTS "Admins can manage notifications" ON public.notifications;

CREATE POLICY "Admins and Auditors can manage notifications" ON public.notifications
    FOR ALL TO authenticated
    USING (
        has_role(auth.uid(), 'admin') OR 
        has_role(auth.uid(), 'super_admin') OR
        has_role(auth.uid(), 'auditor')
    );

-- Also add a helper function to send targeted notification so we don't have to manually fetch user_ids in the frontend
CREATE OR REPLACE FUNCTION public.notify_branch_directors(
    p_branch_id UUID,
    p_title TEXT,
    p_message TEXT,
    p_type TEXT DEFAULT 'info'
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INT := 0;
BEGIN
    INSERT INTO public.notifications (recipient_id, sender_id, title, message, type)
    SELECT s.user_id, auth.uid(), p_title, p_message, p_type
    FROM public.staff s
    INNER JOIN public.user_roles ur ON s.user_id = ur.user_id
    WHERE s.branch_id = p_branch_id AND ur.role = 'branch_director';
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_branch_directors(UUID, TEXT, TEXT, TEXT) TO authenticated;
