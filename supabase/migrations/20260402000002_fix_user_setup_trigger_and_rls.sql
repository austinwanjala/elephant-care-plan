-- Migration: 20260402000002_fix_user_setup_trigger_and_rls.sql
-- Description: Robust user setup trigger and comprehensive RLS for all roles

-- 1. Ensure all roles exist in the app_role enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'super_admin') THEN
        ALTER TYPE public.app_role ADD VALUE 'super_admin';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'finance') THEN
        ALTER TYPE public.app_role ADD VALUE 'finance';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'auditor') THEN
        ALTER TYPE public.app_role ADD VALUE 'auditor';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'doctor') THEN
        ALTER TYPE public.app_role ADD VALUE 'doctor';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'receptionist') THEN
        ALTER TYPE public.app_role ADD VALUE 'receptionist';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'branch_director') THEN
        ALTER TYPE public.app_role ADD VALUE 'branch_director';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'marketer') THEN
        ALTER TYPE public.app_role ADD VALUE 'marketer';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2. Ensure Unique Constraint exists on user_roles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_role_key'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid JOIN pg_attribute a ON a.attrelid = c.oid 
        WHERE c.relname = 'user_roles' AND i.indisunique AND a.attname IN ('user_id', 'role')
        GROUP BY i.indexrelid HAVING count(*) = 2
    ) THEN
        ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
    END IF;
EXCEPTION
    WHEN OTHERS THEN RAISE NOTICE 'Could not add unique constraint: %', SQLERRM;
END $$;

-- 3. Enhanced has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND (
        role::text = _role 
        OR (role::text = 'super_admin') -- Super Admin has all roles
      )
  )
$$;

-- 3. Robust User Setup Trigger Function
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

  -- Log attempt
  RAISE NOTICE 'Trigger: Creating profile for % (Role: %)', NEW.email, v_role;

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
      false, -- Default members to inactive until payment/approval
      v_dob,
      COALESCE(v_age, 0),
      'ED' || lpad(floor(random() * 1000000)::text, 6, '0')
    ) ON CONFLICT (user_id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      dob = EXCLUDED.dob,
      age = EXCLUDED.age;

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
  RAISE WARNING 'User setup trigger failed for %: %', NEW.email, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Unified and Inclusive RLS Policies

-- STAFF Table
DROP POLICY IF EXISTS "Staff can view own profile" ON public.staff;
DROP POLICY IF EXISTS "Admins can manage staff" ON public.staff;
CREATE POLICY "Staff view policy" ON public.staff FOR SELECT 
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'branch_director') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admin staff management" ON public.staff FOR ALL 
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- USER_ROLES Table
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Roles view policy" ON public.user_roles FOR SELECT
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'branch_director'));

CREATE POLICY "Admin role management" ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- REBIND TRIGGER
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_creation_setup();
