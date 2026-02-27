-- Migration to fix finance dashboard stats and ensure correct summing of payments
-- Also ensures RBAC permissions are correct for financial reporting

-- Function to get financial statistics efficiently
CREATE OR REPLACE FUNCTION public.get_finance_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    _total_contributions NUMERIC;
    _total_branch_payouts NUMERIC;
    _total_marketer_payouts NUMERIC;
    _pending_branch_claims INTEGER;
    _pending_marketer_claims INTEGER;
    _result JSONB;
BEGIN
    -- Sum contributions from completed payments
    -- We use COALESCE to return 0 if no rows match
    SELECT COALESCE(SUM(amount), 0) INTO _total_contributions
    FROM public.payments
    WHERE status = 'completed';

    -- Sum branch payouts from paid claims
    SELECT COALESCE(SUM(amount), 0) INTO _total_branch_payouts
    FROM public.revenue_claims
    WHERE status = 'paid';

    -- Sum marketer payouts from paid claims
    SELECT COALESCE(SUM(amount), 0) INTO _total_marketer_payouts
    FROM public.marketer_claims
    WHERE status = 'paid';

    -- Count pending claims
    SELECT COUNT(*) INTO _pending_branch_claims
    FROM public.revenue_claims
    WHERE status = 'pending';

    SELECT COUNT(*) INTO _pending_marketer_claims
    FROM public.marketer_claims
    WHERE status = 'pending';

    -- Build the result JSON
    _result := jsonb_build_object(
        'total_contributions', _total_contributions,
        'total_branch_payouts', _total_branch_payouts,
        'total_marketer_payouts', _total_marketer_payouts,
        'pending_branch_claims', _pending_branch_claims,
        'pending_marketer_claims', _pending_marketer_claims,
        'net_position', _total_contributions - (_total_branch_payouts + _total_marketer_payouts)
    );

    RETURN _result;
END;
$$;

-- Grant execution permission to authenticated users (with finance/admin roles ideally)
GRANT EXECUTE ON FUNCTION public.get_finance_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_finance_dashboard_stats() TO service_role;

-- Ensure the 'financials.view' permission exists and is granted to finance/admin
DO $$
DECLARE
    _perm_id UUID;
BEGIN
    -- Check if permission exists
    SELECT id INTO _perm_id FROM public.permissions WHERE name = 'financials.view' AND resource = 'financials';
    
    IF _perm_id IS NULL THEN
        INSERT INTO public.permissions (name, resource, description)
        VALUES ('financials.view', 'financials', 'Allow viewing consolidated financial reports')
        RETURNING id INTO _perm_id;
    END IF;

    -- Grant to 'admin' and 'finance' roles if they exist
    INSERT INTO public.role_permissions (role, permission_id)
    SELECT r, _perm_id FROM unnest(ARRAY['admin'::app_role, 'finance'::app_role]) r
    ON CONFLICT DO NOTHING;
END $$;
