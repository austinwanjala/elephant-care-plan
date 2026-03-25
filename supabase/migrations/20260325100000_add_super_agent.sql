-- Add super_agent to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_agent';

-- Add super_agent_cut_percent to marketer_commission_config
ALTER TABLE public.marketer_commission_config ADD COLUMN super_agent_cut_percent NUMERIC DEFAULT 10; -- Default 10%

-- Create a table to track individual commissions for super agents
CREATE TABLE IF NOT EXISTS public.super_agent_commissions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    super_agent_id UUID REFERENCES auth.users(id) NOT NULL,
    marketer_id UUID REFERENCES auth.users(id),
    member_id UUID REFERENCES public.members(id) NOT NULL,
    amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'unclaimed', -- unclaimed, pending, paid
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(super_agent_id, member_id)
);

-- Note: In a real environment, we'd add RLS policies to super_agent_commissions
ALTER TABLE public.super_agent_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super agents view own commissions" ON public.super_agent_commissions
FOR SELECT TO authenticated
USING (super_agent_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'finance', 'auditor')));

-- Also we need claims for super agents
CREATE TABLE IF NOT EXISTS public.super_agent_claims (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    super_agent_id UUID REFERENCES auth.users(id) NOT NULL,
    amount NUMERIC NOT NULL,
    referral_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending', -- pending, approved, rejected, paid
    notes TEXT,
    paid_at TIMESTAMP WITH TIME ZONE,
    paid_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.super_agent_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super agents view own claims" ON public.super_agent_claims
FOR SELECT TO authenticated
USING (super_agent_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'finance', 'auditor')));

CREATE POLICY "Super agents insert own claims" ON public.super_agent_claims
FOR INSERT TO authenticated
WITH CHECK (super_agent_id = auth.uid());


-- Update the marketer commission trigger
CREATE OR REPLACE FUNCTION public.create_marketer_commission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    commission_amount NUMERIC;
    total_commission NUMERIC;
    super_agent_amount NUMERIC;
    marketer_amount NUMERIC;
    super_agent_cut NUMERIC;
    current_super_agent_id UUID;
BEGIN
    -- Only trigger if the member is being activated and has a marketer
    IF NEW.is_active = TRUE AND (OLD.is_active = FALSE OR OLD.is_active IS NULL) AND NEW.marketer_id IS NOT NULL THEN
        
        -- Try to get the total rate from the member's membership category
        SELECT marketer_commission INTO total_commission
        FROM public.membership_categories
        WHERE id = NEW.membership_category_id;
        
        -- Fallback
        IF total_commission IS NULL OR total_commission = 0 THEN
            SELECT commission_per_referral INTO total_commission
            FROM public.marketer_commission_config
            ORDER BY updated_at DESC
            LIMIT 1;
        END IF;

        total_commission := COALESCE(total_commission, 0);

        -- Find active super agent cut
        SELECT super_agent_cut_percent INTO super_agent_cut
        FROM public.marketer_commission_config
        ORDER BY updated_at DESC
        LIMIT 1;
        
        super_agent_cut := COALESCE(super_agent_cut, 0);

        -- Find the active super agent (assuming 1 global super agent for now, or just the first one created)
        SELECT user_id INTO current_super_agent_id
        FROM public.user_roles
        WHERE role = 'super_agent'
        LIMIT 1;

        -- Calculate amounts
        IF current_super_agent_id IS NOT NULL AND super_agent_cut > 0 THEN
            super_agent_amount := (total_commission * super_agent_cut) / 100;
            marketer_amount := total_commission - super_agent_amount;
            
            -- Insert Super Agent Commission
            INSERT INTO public.super_agent_commissions (super_agent_id, marketer_id, member_id, amount, status)
            VALUES (current_super_agent_id, NEW.marketer_id, NEW.id, super_agent_amount, 'unclaimed')
            ON CONFLICT (super_agent_id, member_id) DO NOTHING;
            
        ELSE
            -- No super agent or 0 cut, marketer gets 100%
            marketer_amount := total_commission;
        END IF;
        
        -- Insert Marketer Commission
        INSERT INTO public.marketer_commissions (marketer_id, member_id, amount, status)
        VALUES (NEW.marketer_id, NEW.id, marketer_amount, 'unclaimed')
        ON CONFLICT (marketer_id, member_id) DO NOTHING;
        
    END IF;
    RETURN NEW;
END;
$function$;
