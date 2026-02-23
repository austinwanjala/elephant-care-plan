-- Allow service deletion even when the service has been used in treatments.
-- Strategy:
--   CASCADE  → child rows that have no meaning without the service (stages, claims, chart records, preapprovals)
--   SET NULL → only where the column is actually nullable (bill_items keeps billing history)

-- 1. service_stages → cascade (stages have no meaning without the service)
ALTER TABLE public.service_stages
  DROP CONSTRAINT IF EXISTS service_stages_service_id_fkey;
ALTER TABLE public.service_stages
  ADD CONSTRAINT service_stages_service_id_fkey
  FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;

-- 2. pending_claims → cascade
ALTER TABLE public.pending_claims
  DROP CONSTRAINT IF EXISTS pending_claims_service_id_fkey;
ALTER TABLE public.pending_claims
  ADD CONSTRAINT pending_claims_service_id_fkey
  FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;

-- 3. dental_chart_records → CASCADE because service_id is NOT NULL (SET NULL would violate the constraint)
ALTER TABLE public.dental_chart_records
  DROP CONSTRAINT IF EXISTS dental_chart_records_service_id_fkey;
ALTER TABLE public.dental_chart_records
  ADD CONSTRAINT dental_chart_records_service_id_fkey
  FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;

-- 4. bill_items → CASCADE (service_name text column already preserves readable history)
ALTER TABLE public.bill_items
  DROP CONSTRAINT IF EXISTS bill_items_service_id_fkey;
ALTER TABLE public.bill_items
  ADD CONSTRAINT bill_items_service_id_fkey
  FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;

-- 5. service_preapprovals → cascade
ALTER TABLE public.service_preapprovals
  DROP CONSTRAINT IF EXISTS service_preapprovals_service_id_fkey;
ALTER TABLE public.service_preapprovals
  ADD CONSTRAINT service_preapprovals_service_id_fkey
  FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;
