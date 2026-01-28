-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'member');

-- Create enum for claim status
CREATE TYPE public.claim_status AS ENUM ('pending', 'approved', 'rejected', 'completed');

-- Create enum for payment status
CREATE TYPE public.payment_status AS ENUM ('pending', 'completed', 'failed');

-- Branches table
CREATE TABLE public.branches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Members table (linked to auth.users)
CREATE TABLE public.members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  member_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  id_number TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  next_of_kin_name TEXT,
  next_of_kin_phone TEXT,
  branch_id UUID REFERENCES public.branches(id),
  coverage_balance DECIMAL(10,2) DEFAULT 0,
  total_contributions DECIMAL(10,2) DEFAULT 0,
  qr_code_data TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Staff table
CREATE TABLE public.staff (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT NOT NULL,
  branch_id UUID REFERENCES public.branches(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Payments table
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  coverage_added DECIMAL(10,2) NOT NULL,
  mpesa_reference TEXT,
  phone_used TEXT,
  status payment_status DEFAULT 'pending',
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Claims table
CREATE TABLE public.claims (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
  branch_id UUID REFERENCES public.branches(id) NOT NULL,
  staff_id UUID REFERENCES public.staff(id),
  diagnosis TEXT NOT NULL,
  treatment TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status claim_status DEFAULT 'pending',
  notes TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Enable RLS on all tables
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
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

-- Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- RLS Policies for branches (public read, admin write)
CREATE POLICY "Anyone can view branches" ON public.branches FOR SELECT USING (true);
CREATE POLICY "Admins can manage branches" ON public.branches FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for members
CREATE POLICY "Members can view own profile" ON public.members FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Members can update own profile" ON public.members FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Members can insert own profile" ON public.members FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can manage members" ON public.members FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for staff
CREATE POLICY "Staff can view own profile" ON public.staff FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage staff" ON public.staff FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for payments
CREATE POLICY "Members can view own payments" ON public.payments FOR SELECT USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Members can create payments" ON public.payments FOR INSERT WITH CHECK (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));
CREATE POLICY "Admins can manage payments" ON public.payments FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for claims
CREATE POLICY "Members can view own claims" ON public.claims FOR SELECT USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff can create claims" ON public.claims FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff can update claims" ON public.claims FOR UPDATE USING (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage claims" ON public.claims FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Function to generate member number
CREATE OR REPLACE FUNCTION public.generate_member_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.member_number := 'ED' || LPAD(NEXTVAL('member_number_seq')::TEXT, 6, '0');
  NEW.qr_code_data := NEW.id::TEXT;
  RETURN NEW;
END;
$$;

-- Create sequence for member numbers
CREATE SEQUENCE IF NOT EXISTS member_number_seq START 1000;

-- Trigger for auto-generating member number
CREATE TRIGGER set_member_number
  BEFORE INSERT ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_member_number();

-- Function to update coverage balance after payment
CREATE OR REPLACE FUNCTION public.update_coverage_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE public.members
    SET 
      coverage_balance = coverage_balance + NEW.coverage_added,
      total_contributions = total_contributions + NEW.amount,
      updated_at = now()
    WHERE id = NEW.member_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_coverage_after_payment
  AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_coverage_on_payment();

-- Function to deduct coverage on claim
CREATE OR REPLACE FUNCTION public.deduct_coverage_on_claim()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE public.members
    SET 
      coverage_balance = coverage_balance - NEW.amount,
      updated_at = now()
    WHERE id = NEW.member_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER deduct_coverage_after_claim
  AFTER UPDATE ON public.claims
  FOR EACH ROW
  EXECUTE FUNCTION public.deduct_coverage_on_claim();

-- Insert default branch
INSERT INTO public.branches (name, location, phone, email) VALUES
  ('Main Branch - Nairobi', 'Kenyatta Avenue, Nairobi', '+254700000001', 'nairobi@elephantdental.co.ke'),
  ('Mombasa Branch', 'Moi Avenue, Mombasa', '+254700000002', 'mombasa@elephantdental.co.ke'),
  ('Kisumu Branch', 'Oginga Odinga Street, Kisumu', '+254700000003', 'kisumu@elephantdental.co.ke');