-- Migration: 20260402000003_repair_missing_profiles_and_roles.sql
-- Description: Corrects accounts that were created with missing profiles or roles due to trigger failures.

-- This function can be called manually or run once to fix existing users
CREATE OR REPLACE FUNCTION public.repair_orphaned_accounts()
RETURNS void AS $$
DECLARE
    r RECORD;
    v_role TEXT;
    v_full_name TEXT;
    v_phone TEXT;
    v_branch_id UUID;
    v_marketer_id UUID;
    v_dob DATE;
    v_age INTEGER;
BEGIN
    FOR r IN SELECT id, email, raw_user_meta_data FROM auth.users
    LOOP
        -- Extract metadata
        v_role := r.raw_user_meta_data->>'role';
        v_full_name := COALESCE(r.raw_user_meta_data->>'full_name', r.raw_user_meta_data->>'name', 'Unnamed User');
        v_phone := r.raw_user_meta_data->>'phone';
        
        -- Default role to member if missing
        IF v_role IS NULL THEN
            v_role := 'member';
        END IF;

        -- 1. Ensure Exactly One Role Entry (Cleanup duplicates/old roles)
        IF v_role IS NOT NULL THEN
            -- First check if they already have the correct role
            IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = r.id AND role = v_role::public.app_role) THEN
                -- If they don't have the correct one, we replace what they have
                DELETE FROM public.user_roles WHERE user_id = r.id;
                INSERT INTO public.user_roles (user_id, role)
                VALUES (r.id, v_role::public.app_role);
            ELSE
                -- If they have the correct one, ensure they ONLY have that one
                DELETE FROM public.user_roles WHERE user_id = r.id AND role != v_role::public.app_role;
            END IF;
        END IF;

        -- 2. Ensure Profile Entry
        IF v_role = 'member' THEN
            IF NOT EXISTS (SELECT 1 FROM public.members WHERE user_id = r.id) THEN
                -- Handle DOB/Age
                IF r.raw_user_meta_data->>'dob' IS NOT NULL THEN
                    v_dob := (r.raw_user_meta_data->>'dob')::DATE;
                    v_age := DATE_PART('year', AGE(v_dob))::INTEGER;
                ELSE
                    v_age := (r.raw_user_meta_data->>'age')::INTEGER;
                END IF;

                INSERT INTO public.members (user_id, full_name, email, phone, id_number, is_active, dob, age, member_number)
                VALUES (
                    r.id, 
                    v_full_name, 
                    COALESCE(v_phone, 'PENDING'), 
                    r.email,
                    COALESCE(r.raw_user_meta_data->>'id_number', 'REP-' || substring(r.id::text, 1, 8)),
                    false,
                    v_dob,
                    COALESCE(v_age, 0),
                    'ED' || lpad(floor(random() * 1000000)::text, 6, '0')
                );
            END IF;
        ELSIF v_role IN ('receptionist', 'doctor', 'branch_director', 'admin', 'super_admin', 'finance', 'auditor') THEN
            IF NOT EXISTS (SELECT 1 FROM public.staff WHERE user_id = r.id) THEN
                v_branch_id := NULLIF(r.raw_user_meta_data->>'branch_id', '')::UUID;
                INSERT INTO public.staff (user_id, full_name, email, phone, branch_id, is_active)
                VALUES (r.id, v_full_name, r.email, v_phone, v_branch_id, true);
            END IF;
        ELSIF v_role = 'marketer' THEN
            IF NOT EXISTS (SELECT 1 FROM public.marketers WHERE user_id = r.id) THEN
                INSERT INTO public.marketers (user_id, full_name, email, phone, code, is_active)
                VALUES (
                    r.id, 
                    v_full_name, 
                    r.email, 
                    v_phone, 
                    COALESCE(r.raw_user_meta_data->>'marketer_code', 'MKT' || lpad(floor(random() * 90000 + 10000)::text, 5, '0')), 
                    true
                );
            END IF;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the repair once immediately
SELECT public.repair_orphaned_accounts();
