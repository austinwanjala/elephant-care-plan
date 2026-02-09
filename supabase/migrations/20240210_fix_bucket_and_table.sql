-- Create the storage bucket for dependant images if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('dependant-images', 'dependant-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to the bucket (read)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'dependant-images' );

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated Users Upload"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'dependant-images' AND auth.role() = 'authenticated' );

-- Allow users to update their own images (optional but good practice)
CREATE POLICY "Users Update Own Images"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'dependant-images' AND auth.uid() = owner )
WITH CHECK ( bucket_id = 'dependant-images' AND auth.uid() = owner );

-- Allow users to delete their own images
CREATE POLICY "Users Delete Own Images"
ON storage.objects FOR DELETE
USING ( bucket_id = 'dependant-images' AND auth.uid() = owner );

-- Add Date of Birth column to members table
ALTER TABLE public.members
ADD COLUMN IF NOT EXISTS dob DATE;

-- Comment on column
COMMENT ON COLUMN public.members.dob IS 'Date of Birth of the member';
