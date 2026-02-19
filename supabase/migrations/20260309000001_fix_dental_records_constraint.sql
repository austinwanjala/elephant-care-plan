-- Migration: 20260309000001_fix_dental_records_constraint.sql
-- Description: Updates unique constraint on dental_records and adds RPC for safe upserts.

-- 1. Ensure dependant_id exists (fix for missing previous migration)
ALTER TABLE public.dental_records
ADD COLUMN IF NOT EXISTS dependant_id UUID REFERENCES public.dependants(id) ON DELETE CASCADE;

-- 2. Drop the old constraint
ALTER TABLE public.dental_records
DROP CONSTRAINT IF EXISTS dental_records_member_tooth_unique;

-- 2. Create Partial Unique Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_dental_records_unique_principal 
ON public.dental_records(member_id, tooth_number) 
WHERE dependant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_dental_records_unique_dependant 
ON public.dental_records(dependant_id, tooth_number) 
WHERE dependant_id IS NOT NULL;

-- 3. Create RPC to handle the upsert logic safely
CREATE OR REPLACE FUNCTION public.upsert_dental_records(records jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    record jsonb;
BEGIN
    FOR record IN SELECT * FROM jsonb_array_elements(records)
    LOOP
        -- Check if it's for a dependant or principal
        IF (record->>'dependant_id') IS NOT NULL THEN
            INSERT INTO public.dental_records (member_id, dependant_id, visit_id, tooth_number, status, condition, color, notes, updated_at)
            VALUES (
                (record->>'member_id')::uuid,
                (record->>'dependant_id')::uuid,
                (record->>'visit_id')::uuid,
                (record->>'tooth_number')::int,
                record->>'status',
                record->>'condition',
                record->>'color',
                record->>'notes',
                COALESCE((record->>'updated_at')::timestamptz, now())
            )
            ON CONFLICT (dependant_id, tooth_number) WHERE dependant_id IS NOT NULL
            DO UPDATE SET
                status = EXCLUDED.status,
                condition = EXCLUDED.condition,
                color = EXCLUDED.color,
                visit_id = EXCLUDED.visit_id,
                notes = EXCLUDED.notes,
                updated_at = EXCLUDED.updated_at;
        ELSE
            INSERT INTO public.dental_records (member_id, dependant_id, visit_id, tooth_number, status, condition, color, notes, updated_at)
            VALUES (
                (record->>'member_id')::uuid,
                NULL,
                (record->>'visit_id')::uuid,
                (record->>'tooth_number')::int,
                record->>'status',
                record->>'condition',
                record->>'color',
                record->>'notes',
                COALESCE((record->>'updated_at')::timestamptz, now())
            )
            ON CONFLICT (member_id, tooth_number) WHERE dependant_id IS NULL
            DO UPDATE SET
                status = EXCLUDED.status,
                condition = EXCLUDED.condition,
                color = EXCLUDED.color,
                visit_id = EXCLUDED.visit_id,
                notes = EXCLUDED.notes,
                updated_at = EXCLUDED.updated_at;
        END IF;
    END LOOP;
END;
$$;
