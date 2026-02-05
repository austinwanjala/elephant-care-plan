-- Create table for OTP storage
CREATE TABLE public.otp_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '10 minutes'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  verified_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow public insert otp" ON public.otp_verifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public select otp" ON public.otp_verifications FOR SELECT USING (verified_at IS NULL AND expires_at > now());
CREATE POLICY "Allow public update otp" ON public.otp_verifications FOR UPDATE USING (verified_at IS NULL AND expires_at > now());