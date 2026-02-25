-- Migration: 20260402000000_mandatory_system_updates.sql
-- Description: Mandatory changes for Admin Portal, Registration, and Doctor Portal

-- 1. Update visits table with clinical fields if they don't exist
ALTER TABLE public.visits 
ADD COLUMN IF NOT EXISTS treatment_done TEXT,
ADD COLUMN IF NOT EXISTS tca TEXT,
ADD COLUMN IF NOT EXISTS periodontal_status TEXT[];

-- 2. Add biometric verification timestamp to visits
ALTER TABLE public.visits
ADD COLUMN IF NOT EXISTS biometric_verified_at TIMESTAMPTZ;

-- 3. Update calculate_age_from_dob function to be more precise
-- The user requested: age = currentDate.year - dob.year adjusting for month/day
CREATE OR REPLACE FUNCTION public.calculate_age_from_dob()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.dob IS NOT NULL THEN
    -- Precise calculation: current_year - dob_year, 
    -- then subtract 1 if the current date is before the birthday in the current year
    NEW.age := DATE_PART('year', AGE(NEW.dob))::INTEGER;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Ensure biometric verification status is handled properly
-- We already have biometrics_verified BOOLEAN column.

-- 5. Audit Log function for password resets (can be used via log_system_activity)
-- No changes needed to schema for this, just logic in the app.
