-- Add tooth_number to service_stages table
ALTER TABLE public.service_stages 
ADD COLUMN IF NOT EXISTS tooth_number INTEGER;

-- Drop existing index if it exists (to update it)
DROP INDEX IF EXISTS idx_service_stages_patient;

-- Re-create index including tooth_number for more specific lookups
CREATE INDEX idx_service_stages_patient 
ON public.service_stages(member_id, service_id, tooth_number) 
WHERE status = 'in_progress';
