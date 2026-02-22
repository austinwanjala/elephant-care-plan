-- Migration: 20260311000003_include_marketers_in_messaging.sql
-- Description: Adds marketers to staff table for messaging purposes and updates RLS

-- 1. Sync existing marketers to staff table if they are not there
INSERT INTO public.staff (user_id, full_name, email, phone, role, is_active)
SELECT 
    m.user_id, 
    m.full_name, 
    m.email, 
    m.phone, 
    'marketer', 
    m.is_active
FROM public.marketers m
WHERE NOT EXISTS (
    SELECT 1 FROM public.staff s WHERE s.user_id = m.user_id
);

-- 2. Update handle_new_user to include marketers in staff injection
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

    -- Staff Injection (including ALL internal roles)
    IF _role IN ('receptionist', 'doctor', 'branch_director', 'admin', 'super_admin', 'finance', 'auditor', 'marketer') THEN
        IF NOT EXISTS (SELECT 1 FROM public.staff WHERE user_id = NEW.id) THEN
            INSERT INTO public.staff (user_id, full_name, email, phone, branch_id, is_active, role)
            VALUES (NEW.id, _full_name, NEW.email, _phone, _branch_id, TRUE, _role::text);
        ELSE
            -- Just update the role column to ensure it is set correctly
            UPDATE public.staff 
            SET role = _role::text 
            WHERE user_id = NEW.id AND (role IS NULL OR role = '');
        END IF;
    END IF;

    -- Role-specific profiles
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
    ELSIF _role = 'marketer' THEN
        IF NOT EXISTS (SELECT 1 FROM public.marketers WHERE user_id = NEW.id) THEN
            INSERT INTO public.marketers (user_id, full_name, email, phone, code, is_active)
            VALUES (NEW.id, _full_name, NEW.email, _phone, COALESCE(_marketer_code, 'MKT' || LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0')), TRUE);
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update Staff RLS to include marketers
DROP POLICY IF EXISTS "Staff visibility" ON public.staff;
CREATE POLICY "Staff visibility"
ON public.staff
FOR SELECT
USING (
  user_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'super_admin', 'receptionist', 'doctor', 'branch_director', 'finance', 'auditor', 'marketer')
  )
);

-- 4. Update Portal Messages RLS to ensure all appropriate roles can read/send
-- (The existing policy in 20260311000000_portal_enhancements.sql uses has_role and staff check)
-- "Staff can view messages sent to them or by them"
-- FOR SELECT USING (EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND (id = sender_id OR id = recipient_id)) OR public.has_role(auth.uid(), 'admin'))
-- This should work now that marketers are in staff, but let's be explicitly inclusive.

DROP POLICY IF EXISTS "Staff can view messages sent to them or by them" ON public.portal_messages;
CREATE POLICY "Staff can view messages sent to them or by them" ON public.portal_messages
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND (id = sender_id OR id = recipient_id))
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
);

DROP POLICY IF EXISTS "Staff can send messages" ON public.portal_messages;
CREATE POLICY "Staff can send messages" ON public.portal_messages
FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND id = sender_id)
);
