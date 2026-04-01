-- Helper function to fetch branch suspension status regardless of RLS
CREATE OR REPLACE FUNCTION public.check_user_branch_status(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_branch_id UUID;
    v_status TEXT;
BEGIN
    -- Try reading from staff first
    SELECT branch_id INTO v_branch_id
    FROM public.staff
    WHERE user_id = p_user_id
    LIMIT 1;

    -- If not found, try reading from members
    IF v_branch_id IS NULL THEN
        SELECT branch_id INTO v_branch_id
        FROM public.members
        WHERE user_id = p_user_id
        LIMIT 1;
    END IF;

    -- If no branch found, return active to not block login
    IF v_branch_id IS NULL THEN
        RETURN 'active';
    END IF;

    -- Get the branch status
    SELECT status INTO v_status
    FROM public.branches
    WHERE id = v_branch_id
    LIMIT 1;

    -- If status is null, return active (e.g. branch didn't have status set)
    IF v_status IS NULL THEN
        RETURN 'active';
    END IF;

    RETURN v_status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_user_branch_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_branch_status(UUID) TO anon;

-- Helper function to correctly send notifications to admins / super_admins
CREATE OR REPLACE FUNCTION public.notify_admins(
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
    SELECT ur.user_id, auth.uid(), p_title, p_message, p_type
    FROM public.user_roles ur
    WHERE ur.role IN ('admin', 'super_admin');
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_admins(TEXT, TEXT, TEXT) TO authenticated;
