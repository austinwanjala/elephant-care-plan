ALTER TABLE public.visits
ADD COLUMN status TEXT DEFAULT 'registered' NOT NULL;

-- Update existing rows to 'registered' if they somehow don't have a status
UPDATE public.visits
SET status = 'registered'
WHERE status IS NULL;