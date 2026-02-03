-- Migration to ensure the dependants table has the relationship column
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dependants' AND column_name='relationship') THEN
    ALTER TABLE dependants ADD COLUMN relationship text;
  END IF;
END $$;