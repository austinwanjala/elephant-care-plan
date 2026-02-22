-- Migration: 20260311000002_fix_login_and_staff_recursion.sql
-- Description: Fixes handle_new_user trigger roles and resolves staff table RLS recursion

-- 1. Restore handle_new_user with ALL roles and correct staff injection
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    _role public.app_role;
    _full_name TEXT;
    _phone TEXT;
    _id_number TEXT;
    _age INTEGER;
    _branch_id UUID;
    _marketer_code TEXT;
    _marketer_id UUID;
BEGIN
    _role := NEW.raw_user_meta_data->>'role';
    _full_name := NEW.raw_user_meta_data->>'full_name';
    _phone := NEW.raw_user_meta_data->>'phone';
    _id_number := NEW.raw_user_meta_data->>'id_number';
    _age := (NEW.raw_user_meta_data->>'age')::INTEGER;
    _branch_id := NULLIF(NEW.raw_user_meta_data->>'branch_id', '')::UUID;
    _marketer_code := NEW.raw_user_meta_data->>'marketer_code';

    -- Insert into user_roles (idempotent)
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id AND role = _role::public.app_role) THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (NEW.id, _role::public.app_role);
    END IF;

    IF _role = 'member' THEN
        -- Find marketer_id if code is provided
        IF _marketer_code IS NOT NULL THEN
            SELECT id INTO _marketer_id FROM public.marketers WHERE code = _marketer_code;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM public.members WHERE user_id = NEW.id) THEN
            INSERT INTO public.members (user_id, full_name, email, phone, id_number, age, is_active, member_number, coverage_balance, benefit_limit, total_contributions, marketer_id)
            VALUES (
                NEW.id,
                _full_name,
                NEW.email,
                _phone,
                _id_number,
                _age,
                FALSE,
                'ED' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0'),
                0, 0, 0,
                _marketer_id
            );
        END IF;
    ELSIF _role IN ('receptionist', 'doctor', 'branch_director', 'admin', 'super_admin', 'finance', 'auditor') THEN
        IF NOT EXISTS (SELECT 1 FROM public.staff WHERE user_id = NEW.id) THEN
            INSERT INTO public.staff (user_id, full_name, email, phone, branch_id, is_active, role)
            VALUES (NEW.id, _full_name, NEW.email, _phone, _branch_id, TRUE, _role::text);
        ELSE
            -- Update role column
            UPDATE public.staff 
            SET role = _role::text 
            WHERE user_id = NEW.id AND (role IS NULL OR role = '');
        END IF;
    ELSIF _role = 'marketer' THEN
        IF NOT EXISTS (SELECT 1 FROM public.marketers WHERE user_id = NEW.id) THEN
            INSERT INTO public.marketers (user_id, full_name, email, phone, code, is_active)
            VALUES (NEW.id, _full_name, NEW.email, _phone, COALESCE(_marketer_code, 'MKT' || LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0')), TRUE);
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fix staff RLS recursion by using user_roles instead of staff table for permission checks
DROP POLICY IF EXISTS "Staff can view all staff members" ON public.staff;
DROP POLICY IF EXISTS "Staff can view own profile" ON public.staff;
DROP POLICY IF EXISTS "Admins can manage all staff." ON public.staff;
DROP POLICY IF EXISTS "Auditors view staff" ON public.staff;

-- Comprehensive Staff Visibility Policy (Non-Recursive)
CREATE POLICY "Staff visibility"
ON public.staff
FOR SELECT
USING (
  user_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'super_admin', 'receptionist', 'doctor', 'branch_director', 'finance', 'auditor')
  )
);

-- Admin Management Policy
CREATE POLICY "Admins manage all staff"
ON public.staff
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
);

-- 3. Restore clean user_roles read policy to ensure login works for everyone
DROP POLICY IF EXISTS "Staff can view user roles." ON public.user_roles;
DROP POLICY IF EXISTS "Allow authenticated to read user roles" ON public.user_roles;
CREATE POLICY "Allow authenticated to read user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (true);

-- 4. Final Sync for staff role column
UPDATE public.staff s
SET role = ur.role::text
FROM public.user_roles ur
WHERE s.user_id = ur.user_id;
