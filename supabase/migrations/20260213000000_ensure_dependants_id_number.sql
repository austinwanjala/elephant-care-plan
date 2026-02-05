-- Migration to ensure the dependants table has the correct id_number column
DO $$ 
BEGIN
  -- 1. If identification_number exists, rename it to id_number
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dependants' AND column_name='identification_number') THEN
    ALTER TABLE dependants RENAME COLUMN identification_number TO id_number;
  
  -- 2. If neither identification_number nor id_number exists, add id_number
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dependants' AND column_name='id_number') THEN
    ALTER TABLE dependants ADD COLUMN id_number text;
  END IF;

  -- 3. Ensure full_name exists (rename from name if necessary)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dependants' AND column_name='name') THEN
    ALTER TABLE dependants RENAME COLUMN name TO full_name;
  END IF;

  -- 4. Ensure dob exists (rename from date_of_birth if necessary)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dependants' AND column_name='date_of_birth') THEN
    ALTER TABLE dependants RENAME COLUMN date_of_birth TO dob;
  END IF;
END $$;