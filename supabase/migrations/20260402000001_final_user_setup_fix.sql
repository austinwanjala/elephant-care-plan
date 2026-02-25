-- Consolidated and Fixed User Setup Trigger
-- Ensures DOB and Age are correctly extracted and stored for members.
-- Also ensures all roles (including super_admin and finance) are handled.

-- 1. Ensure dob column exists in members
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS dob DATE;

-- 2. Consolidate the trigger function
CREATE OR REPLACE FUNCTION public.handle_user_creation_setup()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
  v_marketer_id UUID;
  v_branch_id UUID;
  v_full_name TEXT;
  v_dob DATE;
  v_age INTEGER;
  v_phone TEXT;
BEGIN
  -- Extract info from metadata
  v_role := NEW.raw_user_meta_data->>'role';
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Unnamed User');
  v_phone := NEW.raw_user_meta_data->>'phone';
  
  -- Handle DOB and Age
  IF NEW.raw_user_meta_data->>'dob' IS NOT NULL AND NEW.raw_user_meta_data->>'dob' <> '' THEN
    BEGIN
      v_dob := (NEW.raw_user_meta_data->>'dob')::DATE;
      v_age := EXTRACT(YEAR FROM age(v_dob))::INTEGER;
    EXCEPTION WHEN OTHERS THEN
      v_dob := NULL;
      v_age := NULL;
    END;
  ELSE
    v_age := (NEW.raw_user_meta_data->>'age')::INTEGER;
  END IF;

  RAISE NOTICE 'Processing user % with role % and DOB % (Age %)', NEW.email, v_role, v_dob, v_age;

  IF v_role IS NOT NULL THEN
    -- Step A: Set User Role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, v_role::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Step B: Profile Setup
    CASE v_role
      WHEN 'member' THEN
        -- Marketer resolving
        IF NEW.raw_user_meta_data->>'marketer_code' IS NOT NULL AND NEW.raw_user_meta_data->>'marketer_code' <> '' THEN
          SELECT id INTO v_marketer_id FROM public.marketers WHERE code = NEW.raw_user_meta_data->>'marketer_code';
        END IF;

        INSERT INTO public.members (
          user_id, full_name, phone, email, id_number, marketer_id, is_active, dob, age, member_number
        )
        VALUES (
          NEW.id, 
          v_full_name, 
          COALESCE(v_phone, 'PENDING'), 
          NEW.email,
          COALESCE(NEW.raw_user_meta_data->>'id_number', 'PENDING-' || substring(NEW.id::text, 1, 8)),
          v_marketer_id,
          false,
          v_dob,
          COALESCE(v_age, 0),
          'ED' || lpad(floor(random() * 1000000)::text, 6, '0')
        ) ON CONFLICT (user_id) DO UPDATE SET
          dob = EXCLUDED.dob,
          age = EXCLUDED.age,
          full_name = EXCLUDED.full_name;

      WHEN 'receptionist', 'doctor', 'branch_director', 'admin', 'super_admin', 'finance', 'auditor' THEN
        -- Branch ID resolving
        IF NEW.raw_user_meta_data->>'branch_id' IS NOT NULL AND NEW.raw_user_meta_data->>'branch_id' <> '' THEN
          BEGIN
            v_branch_id := (NEW.raw_user_meta_data->>'branch_id')::uuid;
          EXCEPTION WHEN OTHERS THEN
            v_branch_id := NULL;
          END;
        END IF;

        INSERT INTO public.staff (user_id, full_name, email, phone, branch_id, is_active)
        VALUES (
          NEW.id,
          v_full_name,
          NEW.email,
          v_phone,
          v_branch_id,
          true
        ) ON CONFLICT (user_id) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          phone = EXCLUDED.phone,
          branch_id = COALESCE(EXCLUDED.branch_id, public.staff.branch_id);

      WHEN 'marketer' THEN
        INSERT INTO public.marketers (user_id, full_name, email, phone, code, is_active)
        VALUES (
          NEW.id,
          v_full_name,
          NEW.email,
          v_phone,
          COALESCE(NEW.raw_user_meta_data->>'marketer_code', 'MKT' || lpad(floor(random() * 90000 + 10000)::text, 5, '0')),
          true
        ) ON CONFLICT (user_id) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          phone = EXCLUDED.phone;

    END CASE;

    -- Step C: Handle Dependants if provided in metadata
    IF v_role = 'member' AND NEW.raw_user_meta_data->'dependants' IS NOT NULL THEN
      DECLARE
        v_dep JSONB;
        v_member_id UUID;
      BEGIN
        -- Get the member id we just created or updated
        SELECT id INTO v_member_id FROM public.members WHERE user_id = NEW.id;
        
        IF v_member_id IS NOT NULL THEN
          FOR v_dep IN SELECT * FROM jsonb_array_elements(NEW.raw_user_meta_data->'dependants')
          LOOP
            INSERT INTO public.dependants (
              member_id, 
              full_name, 
              relationship, 
              dob, 
              id_number, 
              gender, 
              is_active
            )
            VALUES (
              v_member_id,
              v_dep->>'fullName',
              v_dep->>'relationship',
              (v_dep->>'dob')::DATE,
              COALESCE(v_dep->>'idNumber', v_dep->>'id_number'),
              COALESCE(v_dep->>'gender', 'male'),
              true
            ) ON CONFLICT DO NOTHING;
          END LOOP;
        END IF;
      END;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'User setup trigger failed for %: %', NEW.email, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Re-bind Trigger to ensure it points to this function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_creation_setup();
