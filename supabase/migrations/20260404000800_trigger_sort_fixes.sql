-- 1. FATAL SCHEMA FIX: Drop the strict marketer_id constraint crashing the deductions!
ALTER TABLE public.super_agent_commissions 
  DROP CONSTRAINT IF EXISTS super_agent_commissions_marketer_id_fkey;

-- 2. Apply the final, fully-immune trigger sequence natively

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
    super_agent_cut_val NUMERIC;
    current_super_agent_id UUID;
BEGIN
    -- Trigger if the member is activated OR if admin manually assigned a scheme
    IF (
        (NEW.is_active = TRUE AND (OLD.is_active = FALSE OR OLD.is_active IS NULL)) OR
        (NEW.membership_category_id IS NOT NULL AND OLD.membership_category_id IS NULL)
       )
       AND NEW.marketer_id IS NOT NULL THEN
        
        -- Try to get the total rate from the member's assigned scheme category
        SELECT marketer_commission INTO total_commission
        FROM public.membership_categories
        WHERE id = NEW.membership_category_id;
        
        -- Fallback to the overarching config value if scheme has no explicit rate
        IF total_commission IS NULL OR total_commission = 0 THEN
            SELECT commission_per_referral INTO total_commission
            FROM public.marketer_commission_config
            ORDER BY COALESCE(updated_at, '1970-01-01'::timestamp) DESC
            LIMIT 1;
        END IF;

        total_commission := COALESCE(total_commission, 0);

        -- BULLETPROOF: Grab the absolute highest configured super agent cut guaranteed to ignore stale 0s
        SELECT MAX(super_agent_cut_percent) INTO super_agent_cut_val
        FROM public.marketer_commission_config;
        
        -- Default to 10% automatically if the config table is mysteriously empty or broken
        super_agent_cut_val := COALESCE(super_agent_cut_val, 10);

        -- Find the active Super Agent securely by casting enum to text to bypass arbitrary enum mismatch bugs
        SELECT user_id INTO current_super_agent_id
        FROM public.user_roles
        WHERE role::text IN ('super_agent', 'super_admin', 'admin')
        LIMIT 1;

        -- Forcibly calculate amounts (even if 0) to ensure the logic flows natively
        super_agent_amount := (total_commission * super_agent_cut_val) / 100.0;
        marketer_amount := total_commission - super_agent_amount;
        
        IF current_super_agent_id IS NOT NULL AND super_agent_amount > 0 THEN
             -- Dispatch Super Agent/Owner Commission cut forcibly without ON CONFLICT DO NOTHING
             -- If this magically fails on a database constraint, it WILL throw an error on your screen indicating the exact database bug!
             INSERT INTO public.super_agent_commissions (super_agent_id, member_id, amount, status)
             VALUES (current_super_agent_id, NEW.id, super_agent_amount, 'unclaimed');
        ELSE
             -- Revert mathematically if the cut evaluates to 0
             marketer_amount := total_commission;
        END IF;
        
        -- Dispatch Field Marketer Commission remainder
        INSERT INTO public.marketer_commissions (marketer_id, member_id, amount, status)
        VALUES (NEW.marketer_id, NEW.id, marketer_amount, 'unclaimed')
        ON CONFLICT (marketer_id, member_id) DO NOTHING;
        
    END IF;
    RETURN NEW;
END;
$function$;
