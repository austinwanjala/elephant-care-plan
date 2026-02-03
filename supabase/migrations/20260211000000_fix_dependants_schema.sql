-- Migration to ensure dependants table has consistent column names
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

  -- Rename identification_number to id_number if it exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dependants' AND column_name='identification_number') THEN
    ALTER TABLE dependants RENAME COLUMN identification_number TO id_number;
  END IF;
END $$;