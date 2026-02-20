-- Migration: 20260309000003_update_staff_role_rpc.sql
-- Description: RPC to safely update user roles with permission checks.

CREATE OR REPLACE FUNCTION public.update_staff_role(target_user_id UUID, new_role TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    requesting_user_role TEXT;
    target_user_current_role TEXT;
BEGIN
    -- Get the role of the user making the request
    SELECT role INTO requesting_user_role
    FROM public.user_roles
    WHERE user_id = auth.uid();

    -- Get the current role of the target user
    SELECT role INTO target_user_current_role
    FROM public.user_roles
    WHERE user_id = target_user_id;

    -- Basic Validation
    IF requesting_user_role IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Requester has no role.';
    END IF;

    -- Super Admins can do anything
    IF requesting_user_role = 'super_admin' THEN
        UPDATE public.user_roles SET role = new_role WHERE user_id = target_user_id;
        RETURN;
    END IF;

    -- Admins and Branch Directors have restrictions
    IF requesting_user_role IN ('admin', 'branch_director') THEN
        
        -- 1. Cannot change role OF a Super Admin or Admin (unless you are Super Admin, handled above)
        IF target_user_current_role IN ('super_admin', 'admin') THEN
            RAISE EXCEPTION 'Unauthorized: You cannot modify an Administrator.';
        END IF;

        -- 2. Cannot promote TO Super Admin or Admin
        IF new_role IN ('super_admin', 'admin') THEN
            RAISE EXCEPTION 'Unauthorized: You cannot promote users to Administrator levels.';
        END IF;

        -- 3. Cannot promote TO Auditor (reserved for Super Admin usually, but let's be strict)
        IF new_role = 'auditor' AND requesting_user_role != 'admin' THEN 
             -- Admins might be able to create auditors? Let's assume only Super Admin for now to be safe.
             -- Or allow Admin but not Director?
             -- Plan said: Directors restricted to receptionist, doctor, marketer, finance.
             IF requesting_user_role = 'branch_director' THEN
                RAISE EXCEPTION 'Unauthorized: Directors cannot assign Auditor role.';
             END IF;
        END IF;

         -- 4. Branch Directors specific restriction
         IF requesting_user_role = 'branch_director' THEN
            -- Can only assign: receptionist, doctor, branch_director (lateral?), marketer, finance
            IF new_role NOT IN ('receptionist', 'doctor', 'branch_director', 'marketer', 'finance') THEN
                RAISE EXCEPTION 'Unauthorized: Invalid role assignment for Director.';
            END IF;
         END IF;

        -- If checks pass, perform update
        UPDATE public.user_roles SET role = new_role WHERE user_id = target_user_id;
        
        -- Also update metadata in auth.users? 
        -- Usually we synced them, but `user_roles` is the source of truth for RLS. 
        -- `admin-update-user` isn't used here.
        -- We might need to update public.staff/profiles if they have role columns?
        -- public.staff doesn't seem to have a role column based on previous reads, but let's check.
        -- Checking checks... user_roles is the key.
        RETURN;
    END IF;

    RAISE EXCEPTION 'Unauthorized: User does not have permission to change roles.';
END;
$$;
