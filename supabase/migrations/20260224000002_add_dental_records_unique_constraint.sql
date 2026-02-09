-- Add a unique constraint to ensure each member has only one status record per tooth
-- This is required for the 'upsert' operation in the Doctor portal to work correctly
ALTER TABLE public.dental_records 
ADD CONSTRAINT dental_records_member_tooth_unique UNIQUE (member_id, tooth_number);