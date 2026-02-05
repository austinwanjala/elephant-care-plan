-- Migration to make document_type nullable in the dependants table
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dependants' AND column_name='document_type') THEN
    ALTER TABLE dependants ALTER COLUMN document_type DROP NOT NULL;
  END IF;
END $$;