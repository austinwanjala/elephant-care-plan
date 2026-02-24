-- Create the storage bucket for medical records (X-rays) if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('medical-records', 'medical-records', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to view medical records
-- Using SELECT to allow doctors and staff to see patients' X-rays
CREATE POLICY "Allow authenticated view of medical records"
ON storage.objects FOR SELECT
TO authenticated
USING ( bucket_id = 'medical-records' );

-- Policy: Allow authenticated users (staff/doctors) to upload medical records
CREATE POLICY "Allow authenticated upload of medical records"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'medical-records' );

-- Policy: Allow users to update their own uploads
CREATE POLICY "Allow authenticated update of own medical records"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'medical-records' AND auth.uid() = owner );

-- Policy: Allow users to delete their own uploads
CREATE POLICY "Allow authenticated delete of own medical records"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'medical-records' AND auth.uid() = owner );
