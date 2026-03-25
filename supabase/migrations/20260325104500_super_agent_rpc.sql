-- Allow Super Agents to securely query all marketers bypassing complex table RLS
CREATE OR REPLACE FUNCTION public.super_agent_get_marketers()
RETURNS TABLE (
    user_id UUID,
    full_name TEXT,
    is_active BOOLEAN,
    total_members BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH marketer_roles AS (
        SELECT ur.user_id 
        FROM public.user_roles ur 
        WHERE ur.role = 'marketer'
    ),
    marketer_profiles AS (
        SELECT s.user_id, s.full_name, s.is_active
        FROM public.staff s
        INNER JOIN marketer_roles mr ON s.user_id = mr.user_id
        
        UNION
        
        SELECT m.user_id, m.full_name, m.is_active
        FROM public.marketers m
        INNER JOIN marketer_roles mr ON m.user_id = mr.user_id
    )
    SELECT 
        mp.user_id,
        mp.full_name,
        mp.is_active,
        (SELECT COUNT(*) FROM public.members mb WHERE mb.marketer_id = mp.user_id) as total_members
    FROM marketer_profiles mp;
END;
$$;

-- Allow Super Agents to see members (Needed for the Commissions join to work perfectly if RLS blocks it)
CREATE POLICY "Super agents can view all members"
ON public.members
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_agent'));
