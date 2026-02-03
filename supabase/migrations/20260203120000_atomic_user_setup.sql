-- Atomic User Setup Migration
-- This trigger handles automatic role assignment and profile creation 
-- using the raw_user_meta_data passed during signUp.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role public.app_role;
  v_marketer_id UUID;
BEGIN
  -- 1. Extract and cast role
  -- Metadata keys are extracted from the raw_user_meta_data JSONB field
  v_role := (new.raw_user_meta_data->>'role')::public.app_role;
  
  -- 2. Insert into user_roles (Atomic setup)
  IF v_role IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, v_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- 3. Profile Creation Logic
  IF v_role = 'member' THEN
    -- Resolve Marketer ID if code was provided in metadata
    IF new.raw_user_meta_data->>'marketer_code' IS NOT NULL THEN
      SELECT id INTO v_marketer_id FROM public.marketers WHERE code = new.raw_user_meta_data->>'marketer_code';
    END IF;

    -- Create Member Profile
    -- No conflict on member_number because it uses the sequence
    INSERT INTO public.members (
      user_id, 
      full_name, 
      phone, 
      email, 
      id_number, 
      member_number,
      marketer_id,
      is_active,
      coverage_balance,
      total_contributions
    )
    VALUES (
      new.id, 
      COALESCE(new.raw_user_meta_data->>'full_name', 'New Member'), 
      COALESCE(new.raw_user_meta_data->>'phone', ''), 
      new.email,
      COALESCE(new.raw_user_meta_data->>'id_number', 'PENDING' || floor(random()*1000000)::text),
      'ED' || LPAD(nextval('member_number_seq')::TEXT, 6, '0'),
      v_marketer_id,
      false, 
      0,
      0
    )
    ON CONFLICT (user_id) DO NOTHING;

  ELSIF v_role IN ('receptionist', 'doctor', 'branch_director', 'admin') THEN
    -- Create Staff Profile
    INSERT INTO public.staff (user_id, full_name, email, phone, branch_id)
    VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data->>'full_name', 'Unnamed Staff'),
      new.email,
      new.raw_user_meta_data->>'phone',
      (new.raw_user_meta_data->>'branch_id')::uuid
    )
    ON CONFLICT (user_id) DO NOTHING;

  ELSIF v_role = 'marketer' THEN
    -- Create Marketer Profile
    INSERT INTO public.marketers (user_id, full_name, phone, code)
    VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data->>'full_name', 'Unnamed Marketer'),
      new.raw_user_meta_data->>'phone',
      COALESCE(new.raw_user_meta_data->>'marketer_code', 'M' || floor(random() * 9000 + 1000)::text)
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup existing trigger if any
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Bind the trigger to auth.users (runs after any new auth record is inserted)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
