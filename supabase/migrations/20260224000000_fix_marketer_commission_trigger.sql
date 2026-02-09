-- Update the trigger function to be more robust and use the correct config table
CREATE OR REPLACE FUNCTION public.create_marketer_commission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    commission_amount NUMERIC;
BEGIN
    -- Only trigger if the member is being activated and has a marketer
    IF NEW.is_active = TRUE AND (OLD.is_active = FALSE OR OLD.is_active IS NULL) AND NEW.marketer_id IS NOT NULL THEN
        
        -- 1. Try to get the rate from the dedicated config table (newest first)
        SELECT commission_per_referral INTO commission_amount
        FROM public.marketer_commission_config
        ORDER BY updated_at DESC
        LIMIT 1;
        
        -- 2. Fallback to system_settings if not found in config table
        IF commission_amount IS NULL THEN
            SELECT value::NUMERIC INTO commission_amount
            FROM public.system_settings
            WHERE key = 'marketer_commission_per_referral';
        END IF;
        
        -- 3. Final safety fallback to 0 to prevent NOT NULL constraint violation on the commissions table
        commission_amount := COALESCE(commission_amount, 0);
        
        -- Insert the commission record
        INSERT INTO public.marketer_commissions (marketer_id, member_id, amount, status)
        VALUES (NEW.marketer_id, NEW.id, commission_amount, 'unclaimed')
        ON CONFLICT (marketer_id, member_id) DO NOTHING;
        
    END IF;
    RETURN NEW;
END;
$function$;