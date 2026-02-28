-- Add scheme financial year tracking and expiry/reset behavior

-- 1) Track scheme period on members
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS scheme_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheme_end_at   TIMESTAMPTZ;

-- 2) Update payment trigger function so a scheme payment starts the financial year immediately
-- Notes:
-- - We treat payments with reference like 'SCHEME-%' as scheme activation/renewal payments.
-- - If a member renews before expiry, we extend the end date by 1 year.
-- - If the member renews after expiry (or has no scheme dates), we start a new year from payment_date.
CREATE OR REPLACE FUNCTION public.update_coverage_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
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

-- 3) Expiry: once scheme_end_at passes, reset scheme and mark member uncovered
CREATE OR REPLACE FUNCTION public.expire_member_schemes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $function$
BEGIN
  UPDATE public.members m
  SET
    is_active = false,
    scheme_selected = false,
    membership_category_id = NULL,
    benefit_limit = 0,
    coverage_balance = 0,
    scheme_start_at = NULL,
    scheme_end_at = NULL,
    updated_at = now()
  WHERE m.scheme_end_at IS NOT NULL
    AND m.scheme_end_at < now();
END;
$function$;

-- UI fallback helper for immediate expiry at login/dashboard load
CREATE OR REPLACE FUNCTION public.expire_member_scheme_if_needed(p_member_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $function$
DECLARE
  v_updated int := 0;
BEGIN
  UPDATE public.members m
  SET
    is_active = false,
    scheme_selected = false,
    membership_category_id = NULL,
    benefit_limit = 0,
    coverage_balance = 0,
    scheme_start_at = NULL,
    scheme_end_at = NULL,
    updated_at = now()
  WHERE m.id = p_member_id
    AND m.scheme_end_at IS NOT NULL
    AND m.scheme_end_at < now();

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.expire_member_scheme_if_needed(uuid) TO authenticated;

-- 4) Optional: daily scheduler (only if pg_cron exists)
DO $do$
DECLARE
  v_has_pg_cron boolean;
  v_has_cron_schema boolean;
  v_job_id int;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') INTO v_has_pg_cron;
  SELECT to_regnamespace('cron') IS NOT NULL INTO v_has_cron_schema;

  IF NOT v_has_pg_cron OR NOT v_has_cron_schema THEN
    RETURN;
  END IF;

  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'expire_member_schemes_daily'
  LIMIT 1;

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'expire_member_schemes_daily',
    '5 0 * * *',
    $cmd$select public.expire_member_schemes();$cmd$
  );
END;
$do$;
