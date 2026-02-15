-- Migration to fix orphaned members (users with role 'member' but not in members table)

DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT au.id, au.email, au.raw_user_meta_data
        FROM auth.users au
        JOIN public.user_roles ur ON au.id = ur.user_id
        LEFT JOIN public.members m ON au.id = m.user_id
        WHERE ur.role = 'member' AND m.id IS NULL
    LOOP
        -- Insert missing member record
        INSERT INTO public.members (
            user_id, 
            full_name, 
            email, 
            phone, 
            id_number, 
            age, 
            is_active, 
            member_number, 
            coverage_balance, 
            benefit_limit, 
            total_contributions
        )
        VALUES (
            r.id,
            COALESCE(r.raw_user_meta_data->>'full_name', r.raw_user_meta_data->>'name', 'New Member'),
            r.email,
            COALESCE(r.raw_user_meta_data->>'phone', 'PENDING'),
            COALESCE(r.raw_user_meta_data->>'id_number', 'PENDING-' || SUBSTRING(r.id::TEXT, 1, 8)),
            COALESCE((r.raw_user_meta_data->>'age')::INTEGER, 0), 
            TRUE, 
            'TEMP', 
            0,
            0,
            0
        );
    END LOOP;
END $$;
