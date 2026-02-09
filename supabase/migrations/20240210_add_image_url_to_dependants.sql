-- Add image_url column to dependants table
ALTER TABLE public.dependants
ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN public.dependants.image_url IS 'URL of the dependant profile image';
