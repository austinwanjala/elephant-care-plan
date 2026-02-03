-- Definitive User Creation & Role Association
-- This migration ensures that every user created (Admin or Register)
-- is automatically linked to their role and profile via trigger.

-- 1. Ensure all roles exist in the system
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'member', 'receptionist', 'doctor', 'branch_director', 'marketer');
    ELSE
        ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'receptionist';
        ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'doctor';
        ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'branch_director';
        ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'marketer';
    END IF;
END $$;

-- 2. Hardened Role & Profile Trigger
CREATE OR REPLACE FUNCTION public.handle_user_creation_setup()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
  v_marketer_id UUID;
  v_branch_id UUID;
BEGIN
  -- Extract role from metadata
  v_role := new.raw_user_meta_data->>'role';
  
  -- Logic only runs if a role is specified in metadata
  IF v_role IS NOT NULL THEN
    
    -- A. Assign Role (user_roles table)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, v_role::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    -- B. Profile Association Logic
    CASE 
      WHEN v_role = 'member' THEN
        -- Resolve Marketer ID if code was provided
        IF new.raw_user_meta_data->>'marketer_code' IS NOT NULL THEN
          SELECT id INTO v_marketer_id FROM public.marketers WHERE code = new.raw_user_meta_data->>'marketer_code';
        END IF;

        INSERT INTO public.members (
          user_id, full_name, phone, email, id_number, 
          member_number, marketer_id, is_active, coverage_balance, total_contributions
        )
        VALUES (
          new.id, 
          COALESCE(new.raw_user_meta_data->>'full_name', 'Member'), 
          COALESCE(new.raw_user_meta_data->>'phone', ''), 
          new.email,
          COALESCE(new.raw_user_meta_data->>'id_number', 'PENDING-' || floor(random()*1000000)::text),
          'ED' || LPAD(nextval('member_number_seq')::TEXT, 6, '0'),
          v_marketer_id,
          false, 0, 0
        ) ON CONFLICT (user_id) DO NOTHING;

      WHEN v_role IN ('receptionist', 'doctor', 'branch_director', 'admin') THEN
        -- Safely cast branch_id
        IF new.raw_user_meta_data->>'branch_id' IS NOT NULL THEN
            v_branch_id := (new.raw_user_meta_data->>'branch_id')::uuid;
        END IF;

        INSERT INTO public.staff (user_id, full_name, email, phone, branch_id, is_active)
        VALUES (
          new.id,
          COALESCE(new.raw_user_meta_data->>'full_name', 'Staff Member'),
          new.email,
          new.raw_user_meta_data->>'phone',
          v_branch_id,
          true
        ) ON CONFLICT (user_id) DO NOTHING;

      WHEN v_role = 'marketer' THEN
        INSERT INTO public.marketers (user_id, full_name, phone, code, is_active)
        VALUES (
          new.id,
          COALESCE(new.raw_user_meta_data->>'full_name', 'Marketer'),
          new.raw_user_meta_data->>'phone',
          COALESCE(new.raw_user_meta_data->>'marketer_code', 'M' || floor(random() * 9000 + 1000)::text),
          true
        ) ON CONFLICT (user_id) DO NOTHING;
        
    END CASE;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Re-bind the trigger to ensure it captures all creation events
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_creation_setup();
