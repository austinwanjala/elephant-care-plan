-- Allow anonymous users to read active marketers for the registration referral list
CREATE POLICY "Allow public read access to active marketers"
ON public.marketers
FOR SELECT
USING (is_active = true);