-- Migration: 20260309000006_fix_update_staff_role.sql
-- Description: Fixes type casting for role update and restricts Finance role from Directors.

-- Drop the old function first to avoid signature conflicts if we were changing arguments (we aren't, but safer)
DROP FUNCTION IF EXISTS public.update_staff_role(uuid, text);

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
        -- Cast new_role to app_role enum type
        UPDATE public.user_roles SET role = new_role::public.app_role WHERE user_id = target_user_id;
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

        -- 3. Cannot promote TO Auditor 
        IF new_role = 'auditor' AND requesting_user_role != 'admin' THEN 
             IF requesting_user_role = 'branch_director' THEN
                RAISE EXCEPTION 'Unauthorized: Directors cannot assign Auditor role.';
             END IF;
        END IF;

         -- 4. Branch Directors specific restriction
         IF requesting_user_role = 'branch_director' THEN
            -- Can only assign: receptionist, doctor, branch_director (lateral?), marketer
            -- REMOVED: finance
            IF new_role NOT IN ('receptionist', 'doctor', 'branch_director', 'marketer') THEN
                RAISE EXCEPTION 'Unauthorized: Invalid role assignment for Director.';
            END IF;
         END IF;

        -- If checks pass, perform update with casting
        UPDATE public.user_roles SET role = new_role::public.app_role WHERE user_id = target_user_id;
        
        RETURN;
    END IF;

    RAISE EXCEPTION 'Unauthorized: User does not have permission to change roles.';
END;
$$;
