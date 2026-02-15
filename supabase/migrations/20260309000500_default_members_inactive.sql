-- Migration: Default new members to inactive (uncovered) status

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
    _dob DATE;
    _branch_id UUID;
    _marketer_code TEXT;
    _marketer_id UUID;
BEGIN
    -- Extract role, defaulting to 'member' if not specified (e.g., OAuth)
    _role := COALESCE(NEW.raw_user_meta_data->>'role', 'member');
    
    -- Extract full name (Google uses 'full_name' or 'name')
    _full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        'New Member'
    );
    
    _phone := NEW.raw_user_meta_data->>'phone';
    _id_number := NEW.raw_user_meta_data->>'id_number';
    
    -- Handle DOB and Age
    IF NEW.raw_user_meta_data->>'dob' IS NOT NULL THEN
        _dob := (NEW.raw_user_meta_data->>'dob')::DATE;
    END IF;

    -- If dob is present, calculate age. If not, try to use provided age.
    IF _dob IS NOT NULL THEN
        _age := EXTRACT(YEAR FROM age(_dob))::INTEGER;
    ELSIF NEW.raw_user_meta_data->>'age' IS NOT NULL THEN
        _age := (NEW.raw_user_meta_data->>'age')::INTEGER;
    END IF;
    
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

        -- Handle missing constraints for OAuth users
        IF _id_number IS NULL OR _id_number = '' THEN
             _id_number := 'PENDING-' || SUBSTRING(NEW.id::TEXT, 1, 8);
        END IF;

        IF _phone IS NULL OR _phone = '' THEN
            _phone := 'PENDING';
        END IF;

        INSERT INTO public.members (
            user_id, 
            full_name, 
            email, 
            phone, 
            id_number, 
            age, 
            dob,
            is_active,  -- CHANGED: Now defaults to FALSE for new members
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
            COALESCE(_age, 0),
            _dob,
            FALSE, -- Default to FALSE so they are "Uncovered" until they pay/select scheme
            'TEMP', 
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
EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$;
