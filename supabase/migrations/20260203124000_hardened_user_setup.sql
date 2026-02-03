-- Hardened Database User Setup
-- This version includes better safety checks and error handling.

-- 1. Ensure Enum Values exist
DO $$
BEGIN
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'receptionist';
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'doctor';
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'branch_director';
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'marketer';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2. Consolidated High-Reliability Trigger
CREATE OR REPLACE FUNCTION public.handle_user_creation_setup()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
  v_marketer_id UUID;
  v_branch_id UUID;
  v_full_name TEXT;
BEGIN
  -- Extract basic info
  v_role := new.raw_user_meta_data->>'role';
  v_full_name := COALESCE(new.raw_user_meta_data->>'full_name', 'Unnamed User');

  -- Log basic info for debugging (visible in Postgres logs)
  RAISE NOTICE 'Processing new user % with role %', new.email, v_role;

  IF v_role IS NOT NULL THEN
    
    -- Step A: Set User Role (Critical for login)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, v_role::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Step B: Profile Setup based on role
    CASE v_role
      WHEN 'member' THEN
        -- Resolve Marketer ID safely
        IF new.raw_user_meta_data->>'marketer_code' IS NOT NULL AND new.raw_user_meta_data->>'marketer_code' <> '' THEN
          SELECT id INTO v_marketer_id FROM public.marketers WHERE code = new.raw_user_meta_data->>'marketer_code';
        END IF;

        INSERT INTO public.members (
          user_id, full_name, phone, email, id_number, marketer_id, is_active
        )
        VALUES (
          new.id, 
          v_full_name, 
          COALESCE(new.raw_user_meta_data->>'phone', ''), 
          new.email,
          COALESCE(new.raw_user_meta_data->>'id_number', 'PENDING' || floor(random()*1000)::text),
          v_marketer_id,
          false
        ) ON CONFLICT (user_id) DO NOTHING;

      WHEN 'receptionist', 'doctor', 'branch_director', 'admin' THEN
        -- Safely handle UUID cast for branch_id (handle empty strings)
        IF new.raw_user_meta_data->>'branch_id' IS NOT NULL AND new.raw_user_meta_data->>'branch_id' <> '' THEN
            BEGIN
                v_branch_id := (new.raw_user_meta_data->>'branch_id')::uuid;
            EXCEPTION WHEN OTHERS THEN
                v_branch_id := NULL;
            END;
        END IF;

        INSERT INTO public.staff (user_id, full_name, email, phone, branch_id, is_active)
        VALUES (
          new.id,
          v_full_name,
          new.email,
          new.raw_user_meta_data->>'phone',
          v_branch_id,
          true
        ) ON CONFLICT (user_id) DO NOTHING;

      WHEN 'marketer' THEN
        INSERT INTO public.marketers (user_id, full_name, phone, code, is_active)
        VALUES (
          new.id,
          v_full_name,
          new.raw_user_meta_data->>'phone',
          COALESCE(new.raw_user_meta_data->>'marketer_code', 'M' || floor(random() * 9000 + 1000)::text),
          true
        ) ON CONFLICT (user_id) DO NOTHING;

    END CASE;
  END IF;

  RETURN new;

EXCEPTION WHEN OTHERS THEN
  -- Log error but don't crash auth creation (allows manual fixup)
  RAISE WARNING 'User setup trigger failed for %: %', new.email, SQLERRM;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Bind Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_creation_setup();
