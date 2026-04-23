-- Migration: 20260423000000_consolidate_payment_triggers.sql
-- Purpose: Resolve the doubling of coverage balance by consolidating duplicate payment triggers.

-- 1. Drop existing duplicate triggers
DROP TRIGGER IF EXISTS update_coverage_after_payment ON public.payments;
DROP TRIGGER IF EXISTS on_payment_insert ON public.payments;
DROP TRIGGER IF EXISTS tr_payment_completion_unified ON public.payments;

-- 2. Ensure the function is robust and handles both INSERT and UPDATE
-- (The function is already defined in multiple places, but we ensure the latest version is used)
CREATE OR REPLACE FUNCTION public.update_coverage_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only proceed if status changed to 'completed'
  IF NEW.status = 'completed' AND (
    TG_OP = 'INSERT' 
    OR (TG_OP = 'UPDATE' AND (OLD.status IS NULL OR OLD.status != 'completed'))
  ) THEN
    
    -- Update member's balance and contributions
    UPDATE public.members
    SET 
      coverage_balance = COALESCE(coverage_balance, 0) + COALESCE(NEW.coverage_added, 0),
      total_contributions = COALESCE(total_contributions, 0) + COALESCE(NEW.amount, 0),
      is_active = CASE 
        WHEN NEW.reference LIKE 'SCHEME-%' THEN true 
        ELSE is_active 
      END,
      scheme_selected = CASE 
        WHEN NEW.reference LIKE 'SCHEME-%' THEN true 
        ELSE scheme_selected 
      END,
      -- Handle scheme start/end dates if it's a scheme payment
      scheme_start_at = CASE
        WHEN NEW.reference LIKE 'SCHEME-%' AND (scheme_start_at IS NULL OR scheme_end_at IS NULL OR NEW.payment_date > scheme_end_at)
          THEN NEW.payment_date
        ELSE scheme_start_at
      END,
      scheme_end_at = CASE
        WHEN NEW.reference LIKE 'SCHEME-%' AND (scheme_end_at IS NULL OR NEW.payment_date > scheme_end_at)
          THEN NEW.payment_date + INTERVAL '1 year'
        WHEN NEW.reference LIKE 'SCHEME-%' AND NEW.payment_date <= scheme_end_at
          THEN scheme_end_at + INTERVAL '1 year'
        ELSE scheme_end_at
      END,
      updated_at = now()
    WHERE id = NEW.member_id;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Create a single consolidated trigger for both INSERT and UPDATE
CREATE TRIGGER tr_payment_completion_unified
  AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_coverage_on_payment();
