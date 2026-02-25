-- Migration: 20260402000004_undo_recent_user_fixes.sql
-- Description: Reverts changes made in migrations 02 and 03 of 20260402.

-- 1. Drop repair function
DROP FUNCTION IF EXISTS public.repair_orphaned_accounts();

-- 2. Drop unique constraint on user_roles (if it was added)
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;

-- 3. Revert RLS policies on staff
DROP POLICY IF EXISTS "Staff view policy" ON public.staff;
DROP POLICY IF EXISTS "Admin staff management" ON public.staff;

-- Restore original staff policies
CREATE POLICY "Staff can view own profile" ON public.staff 
FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage staff" ON public.staff 
FOR ALL USING (public.has_role(auth.uid(), 'admin'));


-- 4. Revert RLS policies on user_roles
DROP POLICY IF EXISTS "Roles view policy" ON public.user_roles;
DROP POLICY IF EXISTS "Admin role management" ON public.user_roles;

-- Restore original user_roles policies (simplest version from 20260309)
CREATE POLICY "Allow authenticated to read user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (true);


-- 5. Revert has_role function (Original from 20260128)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
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
      AND role = _role
  )
$$;


-- 6. Revert handle_user_creation_setup trigger function (Original from 20260203)
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


-- 7. Ensure on_auth_user_created binds correctly to the original function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_creation_setup();
