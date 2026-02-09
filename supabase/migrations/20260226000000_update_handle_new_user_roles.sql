-- Update the handle_new_user function to include super_admin and finance roles in staff table
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
AS $$
DECLARE
    _role TEXT;
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

    -- Insert into user_roles
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, _role::public.app_role);

    IF _role = 'member' THEN
        -- Find marketer_id if code is provided
        IF _marketer_code IS NOT NULL THEN
            SELECT id INTO _marketer_id FROM public.marketers WHERE code = _marketer_code;
        END IF;

        INSERT INTO public.members (
            user_id, 
            full_name, 
            email, 
            phone, 
            id_number, 
            age, 
            is_active, 
            member_number, 
            coverage_balance, 
            benefit_limit, 
            total_contributions, 
            marketer_id
        )
        VALUES (
            NEW.id,
            _full_name,
            NEW.email,
            _phone,
            _id_number,
            _age,
            FALSE,
            'ED' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0'),
            0,
            0,
            0,
            _marketer_id
        );
    ELSIF _role IN ('receptionist', 'doctor', 'branch_director', 'admin', 'super_admin', 'finance') THEN
        INSERT INTO public.staff (user_id, full_name, email, phone, branch_id, is_active)
        VALUES (NEW.id, _full_name, NEW.email, _phone, _branch_id, TRUE);
    ELSIF _role = 'marketer' THEN
        INSERT INTO public.marketers (user_id, full_name, email, phone, code, is_active)
        VALUES (NEW.id, _full_name, NEW.email, _phone, COALESCE(_marketer_code, 'MKT' || LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0')), TRUE);
    END IF;

    RETURN NEW;
END;
$$;