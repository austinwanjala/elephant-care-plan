-- Enable Row Level Security for the marketers table
ALTER TABLE public.marketers ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow anonymous users to SELECT marketer data
-- This is necessary for the registration page to display the list of marketers
CREATE POLICY "Allow public read access to marketers"
ON public.marketers FOR SELECT
TO anon, authenticated
USING (true);