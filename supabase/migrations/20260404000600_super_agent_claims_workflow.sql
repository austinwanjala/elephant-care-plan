-- Migration: Add condition for marketer commission when scheme is assigned, and add RLS for admin/finance to manage super_agent_claims

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
    -- Trigger if the member is activated OR if admin manually assigned a scheme (which sets membership_category_id from NULL)
    IF (
        (NEW.is_active = TRUE AND (OLD.is_active = FALSE OR OLD.is_active IS NULL)) OR
        (NEW.membership_category_id IS NOT NULL AND OLD.membership_category_id IS NULL)
       )
       AND NEW.marketer_id IS NOT NULL THEN
        
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

-- Allow admins, super_admins, finance to UPDATE super_agent_claims
DROP POLICY IF EXISTS "Finance and Admins can update super agent claims" ON public.super_agent_claims;
CREATE POLICY "Finance and Admins can update super agent claims" ON public.super_agent_claims
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'finance')));

-- RPC to securely fetch super agent claims with emails (since they don't have a profile table yet)
CREATE OR REPLACE FUNCTION public.get_super_agent_claims()
RETURNS TABLE (
    id UUID,
    super_agent_id UUID,
    amount NUMERIC,
    referral_count INTEGER,
    status TEXT,
    notes TEXT,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    super_agent_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sac.id,
        sac.super_agent_id,
        sac.amount,
        sac.referral_count,
        sac.status,
        sac.notes,
        sac.paid_at,
        sac.created_at,
        au.email::TEXT
    FROM public.super_agent_claims sac
    LEFT JOIN auth.users au ON au.id = sac.super_agent_id
    ORDER BY sac.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_super_agent_claims() TO authenticated;
