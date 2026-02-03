-- Migration to standardize the id_number column name
DO $$ 
BEGIN
  -- Rename identification_number to id_number if it exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dependants' AND column_name='identification_number') THEN
    ALTER TABLE dependants RENAME COLUMN identification_number TO id_number;
  END IF;
  
  -- Ensure other columns are also correct just in case
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dependants' AND column_name='name') THEN
    ALTER TABLE dependants RENAME COLUMN name TO full_name;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dependants' AND column_name='date_of_birth') THEN
    ALTER TABLE dependants RENAME COLUMN date_of_birth TO dob;
  END IF;
END $$;