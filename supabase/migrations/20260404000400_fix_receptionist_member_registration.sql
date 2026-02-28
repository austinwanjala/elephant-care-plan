-- Migration: 20260404000400_fix_receptionist_member_registration.sql
-- Description: Fixes the member creation from receptionist portal by adding membership_category_id to the trigger, but restricts the failure exception to only apply to Receptionist creations (members created by staff) to prevent breaking self-registration flows.

CREATE OR REPLACE FUNCTION public.handle_user_creation_setup()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
  v_marketer_id UUID;
  v_branch_id UUID;
  v_membership_category_id UUID;
  v_full_name TEXT;
  v_dob DATE;
  v_age INTEGER;
  v_phone TEXT;
BEGIN
  -- Extract info from metadata
  v_role := NEW.raw_user_meta_data->>'role';
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Unnamed User');
  v_phone := NEW.raw_user_meta_data->>'phone';
  
  -- Handle DOB and Age calculation
  IF NEW.raw_user_meta_data->>'dob' IS NOT NULL AND NEW.raw_user_meta_data->>'dob' <> '' THEN
    BEGIN
      v_dob := (NEW.raw_user_meta_data->>'dob')::DATE;
      v_age := DATE_PART('year', AGE(v_dob))::INTEGER;
    EXCEPTION WHEN OTHERS THEN
      v_dob := NULL;
      v_age := NULL;
    END;
  ELSE
    v_age := (NEW.raw_user_meta_data->>'age')::INTEGER;
  END IF;

  -- Default to 'member' if no role provided (e.g. social login)
  IF v_role IS NULL THEN
    v_role := 'member';
  END IF;

  -- Step A: Set User Role (Crucial for RLS)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Step B: Profile Setup based on role
  IF v_role = 'member' THEN
    -- Resolve Marketer ID if code provided
    IF NEW.raw_user_meta_data->>'marketer_code' IS NOT NULL AND NEW.raw_user_meta_data->>'marketer_code' <> '' THEN
      SELECT id INTO v_marketer_id FROM public.marketers WHERE code = NEW.raw_user_meta_data->>'marketer_code';
    END IF;

    -- Resolve Membership Category ID if provided (this is key for receptionist portal)
    IF NEW.raw_user_meta_data->>'membership_category_id' IS NOT NULL AND NEW.raw_user_meta_data->>'membership_category_id' <> '' THEN
      BEGIN
        v_membership_category_id := (NEW.raw_user_meta_data->>'membership_category_id')::uuid;
      EXCEPTION WHEN OTHERS THEN
        v_membership_category_id := NULL;
      END;
    END IF;

    -- Insert Member
    INSERT INTO public.members (
      user_id, full_name, phone, email, id_number, marketer_id, is_active, dob, age, member_number, membership_category_id
    )
    VALUES (
      NEW.id, 
      v_full_name, 
      COALESCE(v_phone, 'PENDING'), 
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'id_number', 'PENDING-' || substring(NEW.id::text, 1, 8)),
      v_marketer_id,
      false, -- Default members to inactive until payment/approval
      v_dob,
      COALESCE(v_age, 0),
      'ED' || lpad(floor(random() * 1000000)::text, 6, '0'),
      v_membership_category_id
    ) ON CONFLICT (user_id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      dob = EXCLUDED.dob,
      age = EXCLUDED.age,
      membership_category_id = COALESCE(EXCLUDED.membership_category_id, members.membership_category_id);

    -- Handle Dependants if provided in metadata
    IF NEW.raw_user_meta_data->'dependants' IS NOT NULL THEN
      DECLARE
        v_dep JSONB;
        v_member_id UUID;
      BEGIN
        SELECT id INTO v_member_id FROM public.members WHERE user_id = NEW.id;
        IF v_member_id IS NOT NULL THEN
          FOR v_dep IN SELECT * FROM jsonb_array_elements(NEW.raw_user_meta_data->'dependants')
          LOOP
            INSERT INTO public.dependants (member_id, full_name, relationship, dob, id_number, gender, is_active)
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

  ELSIF v_role IN ('receptionist', 'doctor', 'branch_director', 'admin', 'super_admin', 'finance', 'auditor') THEN
    -- Resolve Branch ID
    IF NEW.raw_user_meta_data->>'branch_id' IS NOT NULL AND NEW.raw_user_meta_data->>'branch_id' <> '' THEN
      BEGIN
        v_branch_id := (NEW.raw_user_meta_data->>'branch_id')::uuid;
      EXCEPTION WHEN OTHERS THEN
        v_branch_id := NULL;
      END;
    END IF;

    INSERT INTO public.staff (user_id, full_name, email, phone, branch_id, is_active)
    VALUES (NEW.id, v_full_name, NEW.email, v_phone, v_branch_id, true)
    ON CONFLICT (user_id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      phone = EXCLUDED.phone,
      branch_id = COALESCE(EXCLUDED.branch_id, staff.branch_id);

  ELSIF v_role = 'marketer' THEN
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
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Only raise exception and rollback if the user was created specifically from the Receptionist Portal as a member.
  -- We identify receptionist member creations by checking if the role is 'member' AND the membership_category_id is passed.
  IF NEW.raw_user_meta_data->>'role' = 'member' AND NEW.raw_user_meta_data->>'membership_category_id' IS NOT NULL THEN
    RAISE EXCEPTION 'Receptionist member registration failed: %', SQLERRM;
  ELSE
    -- For any other role creations (doctor, admin) or self-registering members, we swallow the error 
    -- and return NEW so Supabase Auth can complete cleanly without breaking those flows.
    RAISE WARNING 'User setup trigger failed for %: %', NEW.email, SQLERRM;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
