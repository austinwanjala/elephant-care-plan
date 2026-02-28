-- Ensure scheme financial year starts on first completed scheme payment (including direct inserts)

-- 1) Make update_coverage_on_payment work for both INSERT and UPDATE triggers
CREATE OR REPLACE FUNCTION public.update_coverage_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (
    TG_OP = 'INSERT'
    OR (TG_OP = 'UPDATE' AND (OLD.status IS NULL OR OLD.status <> 'completed'))
  ) THEN
    UPDATE public.members m
    SET
      coverage_balance = COALESCE(m.coverage_balance, 0) + COALESCE(NEW.coverage_added, 0),
      total_contributions = COALESCE(m.total_contributions, 0) + COALESCE(NEW.amount, 0),
      is_active = CASE
        WHEN NEW.reference LIKE 'SCHEME-%' THEN true
        ELSE m.is_active
      END,
      scheme_selected = CASE
        WHEN NEW.reference LIKE 'SCHEME-%' THEN true
        ELSE m.scheme_selected
      END,
      scheme_start_at = CASE
        WHEN NEW.reference LIKE 'SCHEME-%' AND (m.scheme_start_at IS NULL OR m.scheme_end_at IS NULL OR NEW.payment_date > m.scheme_end_at)
          THEN NEW.payment_date
        ELSE m.scheme_start_at
      END,
      scheme_end_at = CASE
        WHEN NEW.reference LIKE 'SCHEME-%' AND (m.scheme_end_at IS NULL OR NEW.payment_date > m.scheme_end_at)
          THEN NEW.payment_date + INTERVAL '1 year'
        WHEN NEW.reference LIKE 'SCHEME-%' AND NEW.payment_date <= m.scheme_end_at
          THEN m.scheme_end_at + INTERVAL '1 year'
        ELSE m.scheme_end_at
      END,
      updated_at = now()
    WHERE m.id = NEW.member_id;
  END IF;

  RETURN NEW;
END;
$$;

-- 2) Add INSERT trigger so direct inserts with status='completed' also start the scheme year
DROP TRIGGER IF EXISTS on_payment_insert ON public.payments;
CREATE TRIGGER on_payment_insert
AFTER INSERT ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_coverage_on_payment();

-- 3) Backfill scheme dates for existing members who have already paid for a scheme
WITH first_scheme_payment AS (
  SELECT
    p.member_id,
    MIN(p.payment_date) AS start_at
  FROM public.payments p
  WHERE p.status = 'completed'
    AND p.reference LIKE 'SCHEME-%'
    AND p.payment_date IS NOT NULL
  GROUP BY p.member_id
)
UPDATE public.members m
SET
  scheme_start_at = f.start_at,
  scheme_end_at = f.start_at + INTERVAL '1 year',
  updated_at = now()
FROM first_scheme_payment f
WHERE m.id = f.member_id
  AND (m.scheme_start_at IS NULL OR m.scheme_end_at IS NULL);
