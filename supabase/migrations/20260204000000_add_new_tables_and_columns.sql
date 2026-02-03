-- Add 'age' and 'marketer_id' to members table
ALTER TABLE public.members
ADD COLUMN age INTEGER,
ADD COLUMN marketer_id UUID REFERENCES public.marketers(id);

-- Remove 'qr_code_data' from members table as it will be dynamically generated or part of biometric_data
ALTER TABLE public.members
DROP COLUMN qr_code_data;

-- Add 'is_active' to staff table
ALTER TABLE public.staff
ADD COLUMN is_active BOOLEAN DEFAULT TRUE;

-- Add 'receptionist_id', 'doctor_id', 'status', 'biometrics_verified', 'diagnosis', 'treatment_notes' to visits table
ALTER TABLE public.visits
ADD COLUMN receptionist_id UUID REFERENCES public.staff(id),
ADD COLUMN doctor_id UUID REFERENCES public.staff(id),
ADD COLUMN status TEXT DEFAULT 'registered', -- e.g., 'registered', 'with_doctor', 'billed', 'completed', 'cancelled'
ADD COLUMN biometrics_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN diagnosis TEXT,
ADD COLUMN treatment_notes TEXT;

-- Create dependants table
CREATE TABLE public.dependants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    dob DATE NOT NULL,
    identification_number TEXT NOT NULL, -- Birth Cert or Student ID
    relationship TEXT NOT NULL
);
ALTER TABLE public.dependants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view their dependants." ON public.dependants FOR SELECT USING (auth.uid() = (SELECT user_id FROM public.members WHERE id = member_id));
CREATE POLICY "Members can insert their own dependants." ON public.dependants FOR INSERT WITH CHECK (auth.uid() = (SELECT user_id FROM public.members WHERE id = member_id));
CREATE POLICY "Members can update their own dependants." ON public.dependants FOR UPDATE USING (auth.uid() = (SELECT user_id FROM public.members WHERE id = member_id));
CREATE POLICY "Members can delete their own dependants." ON public.dependants FOR DELETE USING (auth.uid() = (SELECT user_id FROM public.members WHERE id = member_id));

-- Create marketers table
CREATE TABLE public.marketers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    code TEXT UNIQUE NOT NULL, -- Unique referral code
    total_earnings NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);
ALTER TABLE public.marketers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Marketers can view their own profile." ON public.marketers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Marketers can update their own profile." ON public.marketers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage marketers." ON public.marketers FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Create bills table
CREATE TABLE public.bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    visit_id UUID NOT NULL UNIQUE REFERENCES public.visits(id) ON DELETE CASCADE,
    receptionist_id UUID REFERENCES public.staff(id),
    total_benefit_cost NUMERIC NOT NULL,
    total_branch_compensation NUMERIC NOT NULL,
    total_real_cost NUMERIC NOT NULL,
    total_profit_loss NUMERIC NOT NULL,
    is_finalized BOOLEAN DEFAULT FALSE,
    finalized_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Doctors can create bills for their visits." ON public.bills FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.visits WHERE id = visit_id AND doctor_id = (SELECT id FROM public.staff WHERE user_id = auth.uid())));
CREATE POLICY "Receptionists can update and finalize bills." ON public.bills FOR UPDATE USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'receptionist'));
CREATE POLICY "Admins can view all bills." ON public.bills FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Doctors can view bills for their visits." ON public.bills FOR SELECT USING (EXISTS (SELECT 1 FROM public.visits WHERE id = visit_id AND doctor_id = (SELECT id FROM public.staff WHERE user_id = auth.uid())));
CREATE POLICY "Branch Directors can view bills for their branch." ON public.bills FOR SELECT USING (EXISTS (SELECT 1 FROM public.visits v JOIN public.staff s ON v.doctor_id = s.id WHERE v.id = visit_id AND s.branch_id = (SELECT branch_id FROM public.staff WHERE user_id = auth.uid() AND role = 'branch_director')));


-- Create bill_items table
CREATE TABLE public.bill_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.services(id),
    service_name TEXT NOT NULL,
    benefit_cost NUMERIC NOT NULL,
    branch_compensation NUMERIC NOT NULL,
    real_cost NUMERIC NOT NULL
);
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view bill items if they can view the bill." ON public.bill_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.bills WHERE id = bill_id));
CREATE POLICY "Doctors can insert bill items for their bills." ON public.bill_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.bills b JOIN public.visits v ON b.visit_id = v.id WHERE b.id = bill_id AND v.doctor_id = (SELECT id FROM public.staff WHERE user_id = auth.uid())));

-- Create dental_records table
CREATE TABLE public.dental_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    visit_id UUID REFERENCES public.visits(id) ON DELETE SET NULL, -- Link to a specific visit, but allow null if visit is deleted
    tooth_number INTEGER NOT NULL, -- Universal Numbering System (1-32)
    status TEXT NOT NULL, -- e.g., 'healthy', 'decay', 'filled', 'planned', 'completed'
    notes TEXT,
    UNIQUE (member_id, tooth_number) -- A member can only have one record per tooth
);
ALTER TABLE public.dental_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Doctors can manage dental records for members in their visits." ON public.dental_records FOR ALL USING (EXISTS (SELECT 1 FROM public.visits WHERE id = visit_id AND doctor_id = (SELECT id FROM public.staff WHERE user_id = auth.uid())));
CREATE POLICY "Members can view their own dental records." ON public.dental_records FOR SELECT USING (auth.uid() = (SELECT user_id FROM public.members WHERE id = member_id));
CREATE POLICY "Admins can manage all dental records." ON public.dental_records FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Update RLS for members table to allow marketers to view basic info of their referred members
DROP POLICY IF EXISTS "Members can view their own profile." ON public.members;
CREATE POLICY "Members can view their own profile." ON public.members FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Marketers can view basic info of their referred members." ON public.members FOR SELECT USING (EXISTS (SELECT 1 FROM public.marketers WHERE id = marketer_id AND user_id = auth.uid()));
CREATE POLICY "Admins can manage all members." ON public.members FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Staff can view members in their branch." ON public.members FOR SELECT USING (EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND branch_id = members.branch_id));

-- Update RLS for visits table
DROP POLICY IF EXISTS "Members can view their own visits." ON public.visits;
CREATE POLICY "Members can view their own visits." ON public.visits FOR SELECT USING (auth.uid() = (SELECT user_id FROM public.members WHERE id = member_id));
CREATE POLICY "Staff can manage visits in their branch." ON public.visits FOR ALL USING (EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND branch_id = visits.branch_id));
CREATE POLICY "Admins can manage all visits." ON public.visits FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Update RLS for staff table
DROP POLICY IF EXISTS "Staff can view their own profile." ON public.staff;
CREATE POLICY "Staff can view their own profile." ON public.staff FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all staff." ON public.staff FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Create a trigger function for on_auth_user_created
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
            FALSE, -- Members are inactive until first payment
            'ED' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0'), -- Generate a temporary member number
            0, -- Initial coverage
            0, -- Initial benefit limit
            0, -- Initial contributions
            _marketer_id
        );
    ELSIF _role IN ('receptionist', 'doctor', 'branch_director', 'admin') THEN
        INSERT INTO public.staff (user_id, full_name, email, phone, branch_id, is_active)
        VALUES (NEW.id, _full_name, NEW.email, _phone, _branch_id, TRUE);
    ELSIF _role = 'marketer' THEN
        INSERT INTO public.marketers (user_id, full_name, email, phone, code, is_active)
        VALUES (NEW.id, _full_name, NEW.email, _phone, COALESCE(_marketer_code, 'MKT' || LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0')), TRUE);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create RPC function to finalize a bill
CREATE OR REPLACE FUNCTION public.finalize_bill(
    _bill_id UUID,
    _receptionist_id UUID
)
RETURNS VOID AS $$
DECLARE
    _visit_id UUID;
    _member_id UUID;
    _branch_id UUID;
    _total_benefit_cost NUMERIC;
    _total_branch_compensation NUMERIC;
    _total_profit_loss NUMERIC;
    _member_coverage_balance NUMERIC;
BEGIN
    -- Get bill details
    SELECT
        b.visit_id,
        v.member_id,
        v.branch_id,
        b.total_benefit_cost,
        b.total_branch_compensation,
        b.total_profit_loss
    INTO
        _visit_id,
        _member_id,
        _branch_id,
        _total_benefit_cost,
        _total_branch_compensation,
        _total_profit_loss
    FROM
        public.bills b
    JOIN
        public.visits v ON b.visit_id = v.id
    WHERE
        b.id = _bill_id;

    IF _visit_id IS NULL THEN
        RAISE EXCEPTION 'Bill not found.';
    END IF;

    -- Get member's current coverage balance
    SELECT coverage_balance INTO _member_coverage_balance FROM public.members WHERE id = _member_id;

    -- Check if member has enough coverage
    IF _member_coverage_balance < _total_benefit_cost THEN
        RAISE EXCEPTION 'Insufficient member coverage balance. Current: %, Required: %', _member_coverage_balance, _total_benefit_cost;
    END IF;

    -- Deduct benefit cost from member coverage
    UPDATE public.members
    SET coverage_balance = coverage_balance - _total_benefit_cost
    WHERE id = _member_id;

    -- Update branch revenue (simplified for now, assuming daily aggregation or direct update)
    -- For a more robust system, this would update a daily/monthly revenue summary table.
    -- For this example, we'll just log it to branch_revenue for the current date.
    INSERT INTO public.branch_revenue (branch_id, date, total_compensation, total_profit_loss, visit_count)
    VALUES (_branch_id, CURRENT_DATE, _total_branch_compensation, _total_profit_loss, 1)
    ON CONFLICT (branch_id, date) DO UPDATE
    SET
        total_compensation = branch_revenue.total_compensation + EXCLUDED.total_compensation,
        total_profit_loss = branch_revenue.total_profit_loss + EXCLUDED.total_profit_loss,
        visit_count = branch_revenue.visit_count + EXCLUDED.visit_count,
        updated_at = now();

    -- Mark bill as finalized
    UPDATE public.bills
    SET
        is_finalized = TRUE,
        finalized_at = now(),
        receptionist_id = _receptionist_id
    WHERE id = _bill_id;

    -- Mark visit as completed
    UPDATE public.visits
    SET status = 'completed'
    WHERE id = _visit_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;