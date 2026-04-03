-- 1. Drop existing function to cleanly allow signature rebuilds
DROP FUNCTION IF EXISTS public.marketer_submit_claim();

-- 2. Redefine marketer_submit_claim to strictly use real marketer_commissions rows
CREATE OR REPLACE FUNCTION public.marketer_submit_claim()
 RETURNS TABLE(id uuid, amount numeric, referral_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_marketer_id UUID;
    v_total_amount NUMERIC := 0;
    v_referral_count INTEGER := 0;
    v_claim_id UUID;
BEGIN
    -- Get marketer ID for the current authenticated user
    SELECT m.id INTO v_marketer_id
    FROM public.marketers m
    WHERE m.user_id = auth.uid();
    
    IF v_marketer_id IS NULL THEN
        RAISE EXCEPTION 'Marketer profile not found';
    END IF;

    DECLARE
        temp_base NUMERIC;
        temp_sa_cut NUMERIC;
    BEGIN
        SELECT commission_per_referral, super_agent_cut_percent 
        INTO temp_base, temp_sa_cut
        FROM public.marketer_commission_config 
        ORDER BY updated_at DESC LIMIT 1;
        
        temp_base := COALESCE(temp_base, 0);
        temp_sa_cut := COALESCE(temp_sa_cut, 0);

        -- Filter securely based strictly on finalized claimable rows directly
        -- and dynamically recalculate per member's scheme override to ignore broken legacy amounts
        SELECT 
            COALESCE(SUM(
                COALESCE(NULLIF(cat.marketer_commission, 0), temp_base) * (1.0 - (temp_sa_cut / 100.0))
            ), 0),
            COUNT(mc.id)
        INTO v_total_amount, v_referral_count
        FROM public.marketer_commissions mc
        JOIN public.members m ON m.id = mc.member_id
        LEFT JOIN public.membership_categories cat ON cat.id = m.membership_category_id
        WHERE mc.marketer_id = v_marketer_id
        AND mc.status IN ('unclaimed', 'claimable');
    END;

    IF v_referral_count = 0 OR v_total_amount <= 0 THEN
        RAISE EXCEPTION 'No claimable commissions found';
    END IF;

    -- Insert the claim securely bypassing row-level overrides
    INSERT INTO public.marketer_claims (marketer_id, amount, referral_count, status)
    VALUES (v_marketer_id, v_total_amount, v_referral_count, 'pending')
    RETURNING public.marketer_claims.id INTO v_claim_id;

    -- Lock the commission records immediately to prevent double submissions
    UPDATE public.marketer_commissions
    SET status = 'claimed'
    WHERE marketer_id = v_marketer_id
    AND status IN ('unclaimed', 'claimable');

    -- Return newly created payload to UI
    RETURN QUERY SELECT v_claim_id, v_total_amount, v_referral_count;
END;
$function$;
