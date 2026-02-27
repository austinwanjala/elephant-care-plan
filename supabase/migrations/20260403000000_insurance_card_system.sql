-- Add insurance card token to members
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS insurance_card_token TEXT UNIQUE;

-- Create a table for card verifications (specifically for insurance cards)
CREATE TABLE IF NOT EXISTS public.card_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id),
    staff_id UUID REFERENCES auth.users(id),
    device_id TEXT,
    method TEXT NOT NULL, -- 'qr', 'ocr', 'manual'
    status TEXT NOT NULL, -- 'success', 'failed'
    remarks TEXT,
    scanned_image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on card_verifications
ALTER TABLE public.card_verifications ENABLE ROW LEVEL SECURITY;

-- Allow staff to see verifications
CREATE POLICY "Staff can view card verifications" ON public.card_verifications
    FOR SELECT USING (
        public.has_role(auth.uid(), 'admin') OR 
        public.has_role(auth.uid(), 'receptionist') OR 
        public.has_role(auth.uid(), 'doctor') OR
        public.has_role(auth.uid(), 'branch_director')
    );

-- Allow staff to insert verifications
CREATE POLICY "Staff can insert card verifications" ON public.card_verifications
    FOR INSERT WITH CHECK (
        public.has_role(auth.uid(), 'admin') OR 
        public.has_role(auth.uid(), 'receptionist') OR 
        public.has_role(auth.uid(), 'doctor') OR
        public.has_role(auth.uid(), 'branch_director')
    );

-- Storage bucket for scanned cards
INSERT INTO storage.buckets (id, name, public) 
VALUES ('scanned_cards', 'scanned_cards', false)
ON CONFLICT (id) DO NOTHING;

-- RLS for scanned_cards bucket
CREATE POLICY "Strict RLS for scanned images" ON storage.objects
    FOR ALL
    TO authenticated
    USING (bucket_id = 'scanned_cards')
    WITH CHECK (bucket_id = 'scanned_cards');

-- Function to generate/rotate insurance card token
CREATE OR REPLACE FUNCTION public.generate_insurance_card_token()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.insurance_card_token IS NULL THEN
        NEW.insurance_card_token := encode(digest(NEW.id::text || now()::text || random()::text, 'sha256'), 'hex');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-generate token on insert
CREATE TRIGGER on_member_created_token
    BEFORE INSERT ON public.members
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_insurance_card_token();

-- Populate existing members
UPDATE public.members 
SET insurance_card_token = encode(digest(id::text || now()::text || random()::text, 'sha256'), 'hex') 
WHERE insurance_card_token IS NULL;
