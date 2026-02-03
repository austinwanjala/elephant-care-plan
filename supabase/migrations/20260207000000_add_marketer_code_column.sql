ALTER TABLE public.marketers
ADD COLUMN code TEXT UNIQUE NOT NULL DEFAULT 'TEMP_CODE';

-- Update existing rows to have a unique code if they somehow don't have one
-- This is a placeholder for existing data. In a real scenario, you'd generate unique codes.
UPDATE public.marketers
SET code = 'MARKETER-' || substr(md5(random()::text), 1, 8)
WHERE code = 'TEMP_CODE';

-- Ensure the default is removed after migration if not intended for future inserts
ALTER TABLE public.marketers ALTER COLUMN code DROP DEFAULT;