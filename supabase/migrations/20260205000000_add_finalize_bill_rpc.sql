-- Create the finalize_bill RPC function
CREATE OR REPLACE FUNCTION public.finalize_bill(
    _bill_id uuid,
    _receptionist_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_member_id uuid;
    v_visit_id uuid;
    v_branch_id uuid;
    v_total_benefit_cost numeric;
    v_total_branch_compensation numeric;
    v_total_profit_loss numeric;
    v_member_coverage_balance numeric;
    v_member_is_active boolean;
    v_today date := current_date;
BEGIN
    -- Get bill details
    SELECT
        b.visit_id,
        b.total_benefit_cost,
        b.total_branch_compensation,
        b.total_profit_loss,
        v.member_id,
        v.branch_id
    INTO
        v_visit_id,
        v_total_benefit_cost,
        v_total_branch_compensation,
        v_total_profit_loss,
        v_member_id,
        v_branch_id
    FROM
        bills b
    JOIN
        visits v ON b.visit_id = v.id
    WHERE
        b.id = _bill_id;

    IF v_visit_id IS NULL THEN
        RAISE EXCEPTION 'Bill not found.';
    END IF;

    -- Get member's current coverage balance and active status
    SELECT coverage_balance, is_active
    INTO v_member_coverage_balance, v_member_is_active
    FROM members
    WHERE id = v_member_id;

    IF NOT v_member_is_active THEN
        RAISE EXCEPTION 'Member is not active. Cannot finalize bill.';
    END IF;

    IF v_member_coverage_balance < v_total_benefit_cost THEN
        RAISE EXCEPTION 'Insufficient coverage balance for member. Current: %, Required: %', v_member_coverage_balance, v_total_benefit_cost;
    END IF;

    -- Deduct benefit cost from member's coverage balance
    UPDATE members
    SET coverage_balance = coverage_balance - v_total_benefit_cost
    WHERE id = v_member_id;

    -- Update branch_revenue for the current day
    INSERT INTO branch_revenue (branch_id, date, total_compensation, total_profit_loss, total_benefit_deductions, visit_count)
    VALUES (v_branch_id, v_today, v_total_branch_compensation, v_total_profit_loss, v_total_benefit_cost, 1)
    ON CONFLICT (branch_id, date) DO UPDATE SET
        total_compensation = branch_revenue.total_compensation + EXCLUDED.total_compensation,
        total_profit_loss = branch_revenue.total_profit_loss + EXCLUDED.total_profit_loss,
        total_benefit_deductions = branch_revenue.total_benefit_deductions + EXCLUDED.total_benefit_deductions,
        visit_count = branch_revenue.visit_count + 1,
        updated_at = now();

    -- Mark bill as finalized
    UPDATE bills
    SET
        is_finalized = TRUE,
        finalized_at = now(),
        receptionist_id = _receptionist_id
    WHERE id = _bill_id;

    -- Update visit status to completed
    UPDATE visits
    SET status = 'completed'
    WHERE id = v_visit_id;

END;
$$;