-- Fix super_agent_get_marketers RPC to properly count total_members recruited
-- The previous version compared members.marketer_id with user_id instead of the marketer's primary key (id).

DROP FUNCTION IF EXISTS public.super_agent_get_marketers();

CREATE OR REPLACE FUNCTION public.super_agent_get_marketers()
RETURNS TABLE (
    id UUID,
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
        -- For staff who are also marketers, they don't natively have a marketers.id, 
        -- but we assume they can't be assigned members directly if members.marketer_id FK points strictly to marketers table.
        -- We will join them with marketers if they exist, or just return NULL id.
        SELECT 
            m_alt.id as marketer_primary_key, 
            s.user_id, 
            s.full_name, 
            s.is_active
        FROM public.staff s
        INNER JOIN marketer_roles mr ON s.user_id = mr.user_id
        LEFT JOIN public.marketers m_alt ON m_alt.user_id = s.user_id
        
        UNION
        
        SELECT 
            m.id as marketer_primary_key, 
            m.user_id, 
            m.full_name, 
            m.is_active
        FROM public.marketers m
        INNER JOIN marketer_roles mr ON m.user_id = mr.user_id
    )
    SELECT 
        mp.marketer_primary_key as id,
        mp.user_id,
        mp.full_name,
        mp.is_active,
        (SELECT COUNT(*) FROM public.members mb WHERE mb.marketer_id = mp.marketer_primary_key AND mp.marketer_primary_key IS NOT NULL) as total_members
    FROM marketer_profiles mp;
END;
$$;
