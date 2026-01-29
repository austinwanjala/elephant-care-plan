-- Create membership category enum
CREATE TYPE public.membership_level AS ENUM ('level_1', 'level_2', 'level_3', 'level_4', 'level_5', 'level_6');

-- Create service approval type enum  
CREATE TYPE public.approval_type AS ENUM ('all_branches', 'pre_approved_only');

-- Create membership categories table
CREATE TABLE public.membership_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  level membership_level NOT NULL UNIQUE,
  name TEXT NOT NULL,
  payment_amount NUMERIC NOT NULL,
  benefit_amount NUMERIC NOT NULL,
  registration_fee NUMERIC NOT NULL DEFAULT 500,
  management_fee NUMERIC NOT NULL DEFAULT 1000,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create services table
CREATE TABLE public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  real_cost NUMERIC NOT NULL,
  branch_compensation NUMERIC NOT NULL,
  benefit_cost NUMERIC NOT NULL,
  profit_loss NUMERIC GENERATED ALWAYS AS (benefit_cost - branch_compensation) STORED,
  approval_type approval_type NOT NULL DEFAULT 'all_branches',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create service pre-approvals (links services to specific branches)
CREATE TABLE public.service_preapprovals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(service_id, branch_id)
);

-- Create visits table (detailed service records)
CREATE TABLE public.visits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  benefit_deducted NUMERIC NOT NULL,
  branch_compensation NUMERIC NOT NULL,
  profit_loss NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create branch revenue summary table
CREATE TABLE public.branch_revenue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_compensation NUMERIC NOT NULL DEFAULT 0,
  total_benefit_deductions NUMERIC NOT NULL DEFAULT 0,
  total_profit_loss NUMERIC NOT NULL DEFAULT 0,
  visit_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(branch_id, date)
);

-- Add membership category to members table
ALTER TABLE public.members 
  ADD COLUMN membership_category_id UUID REFERENCES public.membership_categories(id),
  ADD COLUMN benefit_limit NUMERIC DEFAULT 0,
  ADD COLUMN rollover_balance NUMERIC DEFAULT 0,
  ADD COLUMN rollover_years INTEGER DEFAULT 0,
  ADD COLUMN biometric_data TEXT;

-- Enable RLS on new tables
ALTER TABLE public.membership_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_preapprovals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_revenue ENABLE ROW LEVEL SECURITY;

-- RLS Policies for membership_categories
CREATE POLICY "Anyone can view membership categories"
ON public.membership_categories FOR SELECT
USING (true);

CREATE POLICY "Admins can manage membership categories"
ON public.membership_categories FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for services
CREATE POLICY "Anyone can view active services"
ON public.services FOR SELECT
USING (true);

CREATE POLICY "Admins can manage services"
ON public.services FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for service_preapprovals
CREATE POLICY "Anyone can view service preapprovals"
ON public.service_preapprovals FOR SELECT
USING (true);

CREATE POLICY "Admins can manage service preapprovals"
ON public.service_preapprovals FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for visits
CREATE POLICY "Members can view own visits"
ON public.visits FOR SELECT
USING (
  member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'staff')
);

CREATE POLICY "Staff can create visits"
ON public.visits FOR INSERT
WITH CHECK (has_role(auth.uid(), 'staff') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage visits"
ON public.visits FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for branch_revenue
CREATE POLICY "Staff can view branch revenue"
ON public.branch_revenue FOR SELECT
USING (has_role(auth.uid(), 'staff') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "System can update branch revenue"
ON public.branch_revenue FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Insert default membership categories
INSERT INTO public.membership_categories (level, name, payment_amount, benefit_amount, registration_fee, management_fee) VALUES
  ('level_1', 'Level I', 5000, 10000, 500, 1000),
  ('level_2', 'Level II', 10000, 20000, 500, 1000),
  ('level_3', 'Level III', 20000, 40000, 500, 1000),
  ('level_4', 'Level IV', 40000, 80000, 500, 1000),
  ('level_5', 'Level V', 60000, 120000, 500, 1000),
  ('level_6', 'Level VI', 80000, 160000, 500, 1000);

-- Insert default services from the document
INSERT INTO public.services (name, real_cost, branch_compensation, benefit_cost, approval_type) VALUES
  ('Consultation', 300, 300, 500, 'all_branches'),
  ('X-Ray (IOPA)', 300, 300, 500, 'all_branches'),
  ('Scaling and Polishing', 600, 1200, 3500, 'all_branches'),
  ('Permanent Filling / Pulp Capping', 800, 1600, 3500, 'all_branches'),
  ('Pins and Posts', 200, 500, 1500, 'all_branches'),
  ('Root Canal Therapy / Re-RCT', 1400, 2800, 9000, 'pre_approved_only'),
  ('Pulpotomy / Pulpectomy', 800, 1600, 4500, 'all_branches'),
  ('Milk Tooth Extraction', 700, 1200, 1500, 'all_branches'),
  ('Normal Extraction', 700, 1200, 1500, 'all_branches'),
  ('Closed Dis-impaction / Difficult Extraction', 900, 2500, 4500, 'all_branches'),
  ('Surgical Dis-impaction', 1300, 4000, 10000, 'pre_approved_only'),
  ('Apicectomy', 1300, 4000, 12000, 'pre_approved_only'),
  ('Denture 1st Tooth', 1300, 2600, 8000, 'all_branches'),
  ('Additional Tooth into Partial Denture', 50, 200, 800, 'all_branches'),
  ('Crown / Bridge per Unit / Veneers', 4000, 5500, 15000, 'pre_approved_only'),
  ('Complete Denture', 8000, 11000, 30000, 'pre_approved_only'),
  ('Removable Orthodontic Appliance', 3000, 5000, 18000, 'pre_approved_only'),
  ('Braces (Per Arch)', 3000, 20000, 60000, 'pre_approved_only'),
  ('Office Bleaching', 10000, 12000, 30000, 'pre_approved_only'),
  ('Home Bleaching', 10000, 12000, 25000, 'pre_approved_only'),
  ('Splinting (Per Arch)', 1200, 4000, 12000, 'all_branches'),
  ('MandibuloMaxillary Fixation (MMF)', 1500, 5000, 20000, 'pre_approved_only'),
  ('Implant Plus Prosthesis', 35000, 45000, 110000, 'pre_approved_only'),
  ('Implant with Bone Graft plus Prosthesis', 62000, 68500, 150000, 'pre_approved_only');

-- Function to process a visit and update balances
CREATE OR REPLACE FUNCTION public.process_visit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Deduct benefit from member coverage
  UPDATE public.members
  SET 
    coverage_balance = coverage_balance - NEW.benefit_deducted,
    updated_at = now()
  WHERE id = NEW.member_id;

  -- Update or insert branch revenue for today
  INSERT INTO public.branch_revenue (branch_id, date, total_compensation, total_benefit_deductions, total_profit_loss, visit_count)
  VALUES (NEW.branch_id, CURRENT_DATE, NEW.branch_compensation, NEW.benefit_deducted, NEW.profit_loss, 1)
  ON CONFLICT (branch_id, date) 
  DO UPDATE SET
    total_compensation = branch_revenue.total_compensation + NEW.branch_compensation,
    total_benefit_deductions = branch_revenue.total_benefit_deductions + NEW.benefit_deducted,
    total_profit_loss = branch_revenue.total_profit_loss + NEW.profit_loss,
    visit_count = branch_revenue.visit_count + 1,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- Create trigger for visit processing
CREATE TRIGGER on_visit_created
  AFTER INSERT ON public.visits
  FOR EACH ROW
  EXECUTE FUNCTION public.process_visit();

-- Function to apply yearly rollover (10% unused, max 3 years)
CREATE OR REPLACE FUNCTION public.apply_yearly_rollover()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.members
  SET 
    rollover_balance = CASE 
      WHEN rollover_years < 3 THEN rollover_balance + (coverage_balance * 0.10)
      ELSE rollover_balance
    END,
    rollover_years = CASE 
      WHEN rollover_years < 3 THEN rollover_years + 1
      ELSE rollover_years
    END,
    coverage_balance = coverage_balance * 0.90,
    updated_at = now()
  WHERE is_active = true AND coverage_balance > 0;
END;
$$;