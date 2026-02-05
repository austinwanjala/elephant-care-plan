-- Migration to make document_number nullable in the dependants table
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dependants' AND column_name='document_number') THEN
    ALTER TABLE dependants ALTER COLUMN document_number DROP NOT NULL;
  END IF;
END $$;