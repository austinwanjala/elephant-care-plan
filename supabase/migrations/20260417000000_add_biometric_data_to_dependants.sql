-- Add biometric_data column to dependants table to support facial recognition
ALTER TABLE dependants ADD COLUMN IF NOT EXISTS biometric_data TEXT;

-- Update RLS policies to allow staff to update biometric data for dependants
-- Assuming staff should have access to manage dependant profiles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'dependants' AND policyname = 'Allow staff to update dependant biometrics'
    ) THEN
        CREATE POLICY "Allow staff to update dependant biometrics"
        ON dependants
        FOR UPDATE
        TO authenticated
        USING (true)
        WITH CHECK (true);
    END IF;
END
$$;
