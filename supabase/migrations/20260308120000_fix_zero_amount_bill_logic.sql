-- Migration: 20260308120000_fix_zero_amount_bill_logic.sql
-- Description: Updates finalize_visit_bill to handle zero-cost bills without deduction errors

DROP FUNCTION IF EXISTS public.finalize_visit_bill(UUID, UUID);

CREATE OR REPLACE FUNCTION public.finalize_visit_bill(
    p_bill_id UUID,
    p_receptionist_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_visit_id UUID;
    v_member_id UUID;
    v_total_benefit DECIMAL;
    v_current_coverage DECIMAL;
    v_branch_id UUID;
    v_total_compensation DECIMAL;
    v_pending_claim_id UUID;
BEGIN
    -- Get bill details
    SELECT visit_id, total_benefit_cost, total_branch_compensation, branch_id
    INTO v_visit_id, v_total_benefit, v_total_compensation, v_branch_id
    FROM public.bills WHERE id = p_bill_id;

    IF v_visit_id IS NULL THEN
        RAISE EXCEPTION 'Bill not found.';
    END IF;

    -- Get visit details
    SELECT member_id INTO v_member_id
    FROM public.visits WHERE id = v_visit_id;

    -- Only check and deduct coverage if benefit cost > 0
    IF v_total_benefit > 0 THEN
        -- Check coverage
        SELECT coverage_balance INTO v_current_coverage
        FROM public.members WHERE id = v_member_id;

        IF v_current_coverage < v_total_benefit THEN
            RAISE EXCEPTION 'Insufficient coverage balance. Required: %, Available: %', v_total_benefit, v_current_coverage;
        END IF;

        -- Deduct coverage
        UPDATE public.members 
        SET coverage_balance = coverage_balance - v_total_benefit
        WHERE id = v_member_id;
    END IF;

    -- Mark bill as finalized
    UPDATE public.bills 
    SET is_finalized = true, 
        finalized_at = now(),
        receptionist_id = p_receptionist_id
    WHERE id = p_bill_id;

    -- Update visit status
    UPDATE public.visits
    SET status = 'completed', 
        biometrics_verified = true,
        benefit_deducted = v_total_benefit,
        branch_compensation = v_total_compensation,
        updated_at = now()
    WHERE id = v_visit_id;

    -- Update branch revenue summary (ALWAYS record visit count, but amounts might be 0)
    INSERT INTO public.branch_revenue (branch_id, date, total_compensation, total_benefit_deductions, visit_count)
    VALUES (v_branch_id, CURRENT_DATE, v_total_compensation, v_total_benefit, 1)
    ON CONFLICT (branch_id, date) 
    DO UPDATE SET
        total_compensation = branch_revenue.total_compensation + EXCLUDED.total_compensation,
        total_benefit_deductions = branch_revenue.total_benefit_deductions + EXCLUDED.total_benefit_deductions,
        visit_count = branch_revenue.visit_count + 1,
        updated_at = now();
        
END;
$$;

-- Grant permissions explicitly
GRANT EXECUTE ON FUNCTION public.finalize_visit_bill(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_visit_bill(UUID, UUID) TO service_role;
