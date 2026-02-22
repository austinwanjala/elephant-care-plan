-- Migration: 20260311000001_fix_staff_messaging_visibility.sql
-- Description: Allows staff members to view each other and adds role column for easier querying

-- 1. Add role column to staff table if it doesn't exist
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS role TEXT;

-- 2. Populate existing roles from user_roles
UPDATE public.staff s
SET role = ur.role::text
FROM public.user_roles ur
WHERE s.user_id = ur.user_id;

-- 3. Drop restrictive policy if it exists
DROP POLICY IF EXISTS "Staff can view own profile" ON public.staff;
DROP POLICY IF EXISTS "Staff can view all staff members" ON public.staff;

-- 4. Create new policy allowing all staff members to view each other
CREATE POLICY "Staff can view all staff members"
ON public.staff
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.staff WHERE user_id = auth.uid()
  )
  OR 
  public.has_role(auth.uid(), 'admin')
  OR
  public.has_role(auth.uid(), 'super_admin')
);

-- 5. Ensure user_roles visibility
DROP POLICY IF EXISTS "Staff can view user roles." ON public.user_roles;
CREATE POLICY "Staff can view user roles."
ON public.user_roles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.staff WHERE user_id = auth.uid()
  )
);

-- 6. Update handle_new_user function to keep staff role in sync
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
    _branch_id := NEW.raw_user_meta_data->>'branch_id';
    _marketer_code := NEW.raw_user_meta_data->>'marketer_code';

    -- Insert into user_roles
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, _role);

    IF _role = 'member' THEN
        -- Find marketer_id if code is provided
        IF _marketer_code IS NOT NULL THEN
            SELECT id INTO _marketer_id FROM public.marketers WHERE code = _marketer_code;
        END IF;

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
    ELSIF _role IN ('receptionist', 'doctor', 'branch_director', 'admin') THEN
        INSERT INTO public.staff (user_id, full_name, email, phone, branch_id, is_active, role)
        VALUES (NEW.id, _full_name, NEW.email, _phone, _branch_id, TRUE, _role::text);
    ELSIF _role = 'marketer' THEN
        INSERT INTO public.marketers (user_id, full_name, email, phone, code, is_active)
        VALUES (NEW.id, _full_name, NEW.email, _phone, COALESCE(_marketer_code, 'MKT' || LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0')), TRUE);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
