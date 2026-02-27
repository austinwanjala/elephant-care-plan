-- Update function to set is_active = true ONLY on "Scheme Activation" payment
CREATE OR REPLACE FUNCTION public.update_coverage_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE public.members
    SET 
      coverage_balance = coverage_balance + NEW.coverage_added,
      total_contributions = total_contributions + NEW.amount,
      -- Only set is_active = true if the payment reference starts with 'SCHEME-'
      is_active = CASE 
                    WHEN NEW.reference LIKE 'SCHEME-%' THEN true 
                    ELSE is_active 
                  END,
      updated_at = now()
    WHERE id = NEW.member_id;
  END IF;
  RETURN NEW;
END;
$$;
