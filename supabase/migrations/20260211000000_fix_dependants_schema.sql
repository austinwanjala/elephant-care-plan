-- Migration to ensure dependants table has the correct column names
DO $$ 
BEGIN
  -- Rename name to full_name if it exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dependants' AND column_name='name') THEN
    ALTER TABLE dependants RENAME COLUMN name TO full_name;
  END IF;

  -- Rename date_of_birth to dob if it exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dependants' AND column_name='date_of_birth') THEN
    ALTER TABLE dependants RENAME COLUMN date_of_birth TO dob;
  END IF;

  -- Rename id_number or identification_number to identification_number
  -- We'll standardize on identification_number as per the types.ts
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dependants' AND column_name='id_number') THEN
    ALTER TABLE dependants RENAME COLUMN id_number TO identification_number;
  END IF;
END $$;