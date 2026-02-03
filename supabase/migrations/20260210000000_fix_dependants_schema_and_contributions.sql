-- Migration to fix dependants table schema consistency
-- Some environments might have 'name' instead of 'full_name', 'date_of_birth' instead of 'dob', 
-- and 'document_number' instead of 'identification_number'.

DO $$ 
BEGIN
    -- Rename 'name' to 'full_name' if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dependants' AND column_name = 'name') THEN
        ALTER TABLE public.dependants RENAME COLUMN "name" TO "full_name";
    END IF;

    -- Rename 'date_of_birth' to 'dob' if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dependants' AND column_name = 'date_of_birth') THEN
        ALTER TABLE public.dependants RENAME COLUMN "date_of_birth" TO "dob";
    END IF;

    -- Rename 'document_number' to 'identification_number' if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dependants' AND column_name = 'document_number') THEN
        ALTER TABLE public.dependants RENAME COLUMN "document_number" TO "identification_number";
    END IF;

    -- Ensure 'identification_number' is NOT NULL if it was missing or nullable
    -- (Based on common patterns, but let's be careful not to break existing data if it's null)
    -- ALTER TABLE public.dependants ALTER COLUMN identification_number SET NOT NULL;

    -- Rename 'document_type' to 'relationship' or similar if needed? 
    -- Actually frontend uses 'relationship'. 
    -- Some migrations had 'relationship' and some had 'document_type'.
    -- If 'document_type' exists and 'relationship' doesn't, rename it.
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dependants' AND column_name = 'document_type') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dependants' AND column_name = 'relationship') THEN
        ALTER TABLE public.dependants RENAME COLUMN "document_type" TO "relationship";
    END IF;

END $$;
